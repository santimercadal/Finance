import { insights } from "./yahoo.js";
import { askAI, aiEnabled } from "./news.js";
import { getJSON, setJSON, storageKind } from "./storage.js";

const persist = storageKind === "upstash";
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

// Morningstar writes the bull/bear case in English; translate once per report
// (the publish date changes when the analyst updates it) and keep it stored.
// Translations run one at a time so a whole portfolio doesn't burst the free
// AI quota; a failed one is retried on a later request.
const translations = new Map();
let queue = Promise.resolve();
function translate(symbol, publishDate, bull, bear) {
  if (!aiEnabled || (!bull.length && !bear.length)) return Promise.resolve(null);
  const key = `analyst-es:${symbol}:${publishDate}`;
  if (translations.has(key)) return Promise.resolve(translations.get(key));
  const run = queue.then(() => translateNow(key, bull, bear));
  queue = run.catch(() => {});
  return run.then((r) => {
    if (r) translations.set(key, r);
    return r;
  });
}

async function translateNow(key, bull, bear) {
  if (persist) {
    const saved = await getJSON(key).catch(() => null);
    if (saved) return saved;
  }
  const text = await askAI(
    "Eres un traductor financiero. Traduces al español de forma fiel, sin agregar ni quitar información.",
    `Traduce al español cada punto manteniendo el mismo orden y cantidad. Responde SOLO con JSON válido con la forma {"bull": ["..."], "bear": ["..."]}.\n\n${JSON.stringify({ bull, bear })}`,
  ).catch((err) => {
    console.error("AI translation failed:", err.message);
    return null;
  });
  const json = text?.match(/\{[\s\S]*\}/)?.[0];
  try {
    const parsed = JSON.parse(json);
    if (parsed.bull?.length !== bull.length || parsed.bear?.length !== bear.length) return null;
    const result = { bull: parsed.bull.map(clean), bear: parsed.bear.map(clean) };
    if (persist) await setJSON(key, result, 90 * 24 * 3600).catch(() => {});
    return result;
  } catch {
    return null;
  }
}

const DIRECTION = { Bullish: "alcista", Bearish: "bajista", Neutral: "neutral" };
const VALUATION = { Overvalued: "Sobrevalorada", Undervalued: "Infravalorada", "Near Fair Value": "Cerca de su valor justo" };
const outlook =(o) => (o?.direction ? { direction: DIRECTION[o.direction] ?? o.direction, score: o.score ?? null } : null);

// Analyst view of a stock from Yahoo's research feed: Morningstar bull/bear
// case (pros and cons), Argus rating and price target, Trading Central outlook.
// Returns null for assets without coverage (most ETFs, crypto, small caps).
// If the translation isn't ready within a few seconds the English text is
// returned and the translation keeps going for the next request.
export async function analystView(symbol) {
  symbol = symbol.toUpperCase();
  try {
    const r = await insights(symbol);
    const up = r.upsell ?? {};
    const bull = (up.msBullishSummary ?? []).map(clean).filter(Boolean);
    const bear = (up.msBearishSummary ?? []).map(clean).filter(Boolean);
    const rec = r.recommendation;
    const tech = r.instrumentInfo?.technicalEvents;
    const val = r.instrumentInfo?.valuation;
    if (!bull.length && !bear.length && !rec?.rating) return null;

    const publishDate = up.msBullishBearishSummariesPublishDate ?? null;
    const es = await Promise.race([
      translate(symbol, publishDate, bull, bear),
      new Promise((resolve) => setTimeout(() => resolve(null), 8_000)),
    ]);
    return {
      symbol,
      pros: es?.bull ?? bull,
      cons: es?.bear ?? bear,
      translated: Boolean(es),
      prosConsSource: bull.length || bear.length ? "Morningstar" : null,
      prosConsDate: publishDate ? new Date(publishDate).toISOString().slice(0, 10) : null,
      rating: rec?.rating ?? null,
      targetPrice: rec?.targetPrice ?? null,
      ratingSource: rec?.provider ?? null,
      valuation: val?.description ? { label: VALUATION[val.description] ?? val.description, discount: val.discount ?? null, source: val.provider } : null,
      outlook: tech
        ? {
            short: outlook(tech.shortTermOutlook),
            mid: outlook(tech.intermediateTermOutlook),
            long: outlook(tech.longTermOutlook),
            source: tech.provider ?? null,
          }
        : null,
    };
  } catch {
    return null;
  }
}
