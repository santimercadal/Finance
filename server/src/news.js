import Anthropic from "@anthropic-ai/sdk";
import { yf, cached, MIN, HOUR } from "./yahoo.js";
import { getJSON, setJSON, storageKind } from "./storage.js";

// AI provider for summaries. Groq has a free tier (open models, no card);
// Claude is the paid option. Groq wins when both keys are configured.
const GROQ_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
const CLAUDE_MODEL = "claude-opus-5-5";
const hasClaude = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
export const aiProvider = GROQ_KEY ? "groq" : hasClaude ? "claude" : null;
export const aiEnabled = aiProvider != null;
const claude = aiProvider === "claude" ? new Anthropic() : null;

// After a rate-limit response, skip AI calls until this time (free tiers have daily caps).
let aiPausedUntil = 0;

const MARKET_QUERIES = ["stock market", "Federal Reserve", "economy"];

function normalize(n) {
  return {
    id: n.uuid,
    title: n.title,
    publisher: n.publisher,
    link: n.link,
    time: new Date(n.providerPublishTime).toISOString(),
    tickers: n.relatedTickers ?? [],
    thumbnail: n.thumbnail?.resolutions?.find((r) => r.width >= 140)?.url ?? n.thumbnail?.resolutions?.[0]?.url ?? null,
  };
}

function searchNews(query, count = 8) {
  return cached(`news:${query}`, 10 * MIN, async () => {
    const res = await yf.search(query, { newsCount: count, quotesCount: 0 }, { validateResult: false });
    return (res.news ?? []).map(normalize);
  });
}

// News for the given symbols plus general market news, deduplicated, newest first.
export async function newsFeed(symbols = [], { includeMarket = true, limit = 40 } = {}) {
  const queries = [...symbols, ...(includeMarket ? MARKET_QUERIES : [])];
  const lists = await Promise.all(queries.map((q) => searchNews(q).catch(() => [])));
  const seen = new Set();
  const out = [];
  for (const n of lists.flat()) {
    if (!n.id || seen.has(n.id) || !n.title) continue;
    seen.add(n.id);
    out.push(n);
  }
  return out.sort((a, b) => b.time.localeCompare(a.time)).slice(0, limit);
}

const decode = (s) =>
  s
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;/g, "—")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();

async function articleText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const html = await res.text();
  const paragraphs = [...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/gi)]
    .map((m) => decode(m[1]))
    .filter((p) => p.length > 60 && !/cookie|subscribe|sign in|newsletter|©/i.test(p));
  const meta = html.match(/<meta[^>]+(?:name|property)="(?:og:)?description"[^>]+content="([^"]*)"/i)?.[1];
  return { paragraphs, description: meta ? decode(meta) : null };
}

function extractiveSummary({ paragraphs, description }) {
  const text = paragraphs.slice(0, 3).join(" ");
  if (text.length < 120) return description || text || null;
  if (text.length <= 450) return text;
  const cut = text.slice(0, 450);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
  return end > 200 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}…`;
}

function textOf(response) {
  if (response.stop_reason === "refusal") return null;
  return response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

async function askGroq(system, prompt) {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      // gpt-oss models reason before answering; keep it short to save the free quota.
      ...(GROQ_MODEL.includes("gpt-oss") ? { reasoning_effort: "low" } : {}),
      max_completion_tokens: 2000,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (res.status === 429) {
    const retry = Number(res.headers.get("retry-after")) || 60;
    aiPausedUntil = Date.now() + Math.min(retry, 3600) * 1000;
    throw new Error(`Groq: límite gratuito alcanzado, reintento en ${retry}s`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Groq ${res.status}: ${body.error?.message ?? "error"}`);
  return body.choices?.[0]?.message?.content?.trim() || null;
}

async function askClaude(system, prompt) {
  // Server-side fallback re-runs the request on another model if the primary declines.
  const response = await claude.beta.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return textOf(response);
}

export function askAI(system, prompt) {
  if (Date.now() < aiPausedUntil) return Promise.resolve(null);
  return aiProvider === "groq" ? askGroq(system, prompt) : askClaude(system, prompt);
}

// Summaries are also stored in the database (when configured) so they survive
// server restarts and each article is summarized only once.
const SUMMARY_TTL_SECONDS = 7 * 24 * 3600;
const persist = storageKind === "upstash";

// Summary of a single article: AI when a provider is configured, otherwise
// the first sentences of the article.
export function articleSummary(url, title) {
  return cached(`summary:${url}`, 24 * HOUR, async () => {
    const storeKey = `summary:${url}`;
    if (persist && aiEnabled) {
      const saved = await getJSON(storeKey).catch(() => null);
      if (saved) return saved;
    }
    let article = { paragraphs: [], description: null };
    try {
      article = await articleText(url);
    } catch {
      // Article blocked or unreachable: fall back to the headline only.
    }
    // Free tiers cap tokens per day, so send only the first part of the article.
    const body = article.paragraphs.join("\n").slice(0, aiProvider === "groq" ? 5_000 : 12_000);
    if (aiEnabled && body.length > 200) {
      try {
        const summary = await askAI(
          "Eres un analista financiero. Resumes noticias para un inversor en español, de forma clara y neutral.",
          `Resume esta noticia en 2-3 oraciones en español. Después agrega una línea que empiece con "Impacto:" indicando qué empresas o activos podrían verse afectados y en qué sentido. No inventes datos que no estén en el texto. Responde solo con el resumen.\n\nTítulo: ${title}\n\n${body}`,
        );
        if (summary) {
          const result = { summary, source: "ai" };
          if (persist) await setJSON(storeKey, result, SUMMARY_TTL_SECONDS).catch(() => {});
          return result;
        }
      } catch (err) {
        console.error("AI summary failed:", err.message);
      }
    }
    return { summary: extractiveSummary(article), source: "extract" };
  });
}

// Short market briefing over the latest headlines (requires an AI provider).
export function dailyDigest(news) {
  if (!aiEnabled) return Promise.resolve(null);
  const headlines = news
    .slice(0, 30)
    .map((n) => `- [${n.time.slice(0, 16).replace("T", " ")}] ${n.title} (${n.publisher}${n.tickers.length ? `; ${n.tickers.slice(0, 4).join(", ")}` : ""})`)
    .join("\n");
  const key = `digest:${news.slice(0, 30).map((n) => n.id).join(",")}`;
  return cached(key, 30 * MIN, () =>
    askAI(
      "Eres un analista financiero que escribe un briefing de mercado breve en español.",
      `Con estos titulares, escribe un resumen del día en 3 a 5 viñetas cortas de una o dos oraciones (empezando con "- "): qué está moviendo al mercado y qué eventos próximos conviene seguir. Básate sólo en lo que dicen los titulares, sin interpretar más allá de ellos, y no des recomendaciones de compra, venta ni de cómo posicionarse.\n\n${headlines}`,
    ),
  ).catch((err) => {
    console.error("AI digest failed:", err.message);
    return null;
  });
}
