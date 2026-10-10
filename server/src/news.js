import { yf, cached, MIN, HOUR } from "./yahoo.js";
import { askAI, aiEnabled } from "./ai.js";
import { recall, remember } from "./storage.js";

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

const SUMMARY_TTL_SECONDS = 7 * 24 * 3600;

// Summary of a single article: AI when available (stored so each article is
// summarized only once), otherwise the first sentences of the article.
export function articleSummary(url, title) {
  return cached(`summary:${url}`, 24 * HOUR, async () => {
    const storeKey = `summary:${url}`;
    if (aiEnabled) {
      const saved = await recall(storeKey);
      if (saved) return saved;
    }
    let article = { paragraphs: [], description: null };
    try {
      article = await articleText(url);
    } catch {
      // Article blocked or unreachable: fall back to the headline only.
    }
    // The free tier caps tokens per day, so send only the first part of the article.
    const body = article.paragraphs.join("\n").slice(0, 5_000);
    if (aiEnabled && body.length > 200) {
      try {
        const summary = await askAI(
          "Eres un analista financiero. Resumes noticias para un inversor en español, de forma clara y neutral.",
          `Resume esta noticia en 2-3 oraciones en español. Después agrega una línea que empiece con "Impacto:" indicando qué empresas o activos podrían verse afectados y en qué sentido. No inventes datos que no estén en el texto. Responde solo con el resumen.\n\nTítulo: ${title}\n\n${body}`,
        );
        if (summary) {
          const result = { summary, source: "ai" };
          await remember(storeKey, result, SUMMARY_TTL_SECONDS);
          return result;
        }
      } catch (err) {
        console.error("AI summary failed:", err.message);
      }
    }
    return { summary: extractiveSummary(article), source: "extract" };
  });
}

// Short market briefing over the latest headlines (requires AI).
export function dailyDigest(news) {
  if (!aiEnabled) return Promise.resolve(null);
  const latest = news.slice(0, 30);
  const headlines = latest
    .map((n) => `- [${n.time.slice(0, 16).replace("T", " ")}] ${n.title} (${n.publisher}${n.tickers.length ? `; ${n.tickers.slice(0, 4).join(", ")}` : ""})`)
    .join("\n");
  return cached(`digest:${latest.map((n) => n.id).join(",")}`, 30 * MIN, () =>
    askAI(
      "Eres un analista financiero que escribe un briefing de mercado breve en español.",
      `Con estos titulares, escribe un resumen del día en 3 a 5 viñetas cortas de una o dos oraciones (empezando con "- "): qué está moviendo al mercado y qué eventos próximos conviene seguir. Básate sólo en lo que dicen los titulares, sin interpretar más allá de ellos, y no des recomendaciones de compra, venta ni de cómo posicionarse. Texto plano, sin markdown.\n\n${headlines}`,
    ).then((text) => text && text.replace(/\*\*|__/g, "")),
  ).catch((err) => {
    console.error("AI digest failed:", err.message);
    return null;
  });
}
