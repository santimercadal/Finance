import Anthropic from "@anthropic-ai/sdk";
import { yf, cached, MIN, HOUR } from "./yahoo.js";

const MODEL = "claude-opus-5-5";
export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const client = aiEnabled ? new Anthropic() : null;

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

async function ask(system, prompt) {
  // Server-side fallback re-runs the request on another model if the primary declines.
  const response = await client.beta.messages.create({
    model: MODEL,
    max_tokens: 4000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return textOf(response);
}

// Summary of a single article. Uses Claude when an API key is configured,
// otherwise the first sentences of the article.
export function articleSummary(url, title) {
  return cached(`summary:${url}`, 24 * HOUR, async () => {
    let article = { paragraphs: [], description: null };
    try {
      article = await articleText(url);
    } catch {
      // Article blocked or unreachable: fall back to the headline only.
    }
    const body = article.paragraphs.join("\n").slice(0, 12_000);
    if (client && body.length > 200) {
      try {
        const summary = await ask(
          "Eres un analista financiero. Resumes noticias para un inversor en español, de forma clara y neutral.",
          `Resume esta noticia en 2-3 oraciones en español. Después agrega una línea que empiece con "Impacto:" indicando qué empresas o activos podrían verse afectados y en qué sentido. No inventes datos que no estén en el texto.\n\nTítulo: ${title}\n\n${body}`,
        );
        if (summary) return { summary, source: "ai" };
      } catch (err) {
        console.error("AI summary failed:", err.message);
      }
    }
    return { summary: extractiveSummary(article), source: "extract" };
  });
}

// One-paragraph briefing over the latest headlines (requires Claude).
export function dailyDigest(news) {
  if (!client) return Promise.resolve(null);
  const headlines = news
    .slice(0, 30)
    .map((n) => `- [${n.time.slice(0, 16).replace("T", " ")}] ${n.title} (${n.publisher}${n.tickers.length ? `; ${n.tickers.slice(0, 4).join(", ")}` : ""})`)
    .join("\n");
  const key = `digest:${news.slice(0, 30).map((n) => n.id).join(",")}`;
  return cached(key, 30 * MIN, () =>
    ask(
      "Eres un analista financiero que escribe un briefing de mercado breve en español.",
      `Con estos titulares, escribe un resumen del día en 3 a 5 viñetas cortas (empezando con "- "): qué está moviendo al mercado y qué conviene seguir. Básate sólo en los titulares.\n\n${headlines}`,
    ),
  ).catch((err) => {
    console.error("AI digest failed:", err.message);
    return null;
  });
}
