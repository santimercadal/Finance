import { insights } from "./yahoo.js";
import { screenStocks } from "./screener.js";
import { recall, remember } from "./storage.js";
import { changePct } from "./util.js";

// Stocks analysts like, split by horizon. The universe is the largest US
// companies with a Buy or Strong Buy consensus (Nasdaq); each one is then read
// from Yahoo's research feed: Trading Central's technical outlook for the
// short, intermediate and long term, Argus' rating and price target, and the
// fair-value estimate. Rebuilt every few hours and kept in storage so a
// sleeping server doesn't redo ~50 requests on wake-up.

const TTL = 6 * 3600;
const KEY = "ideas:v1";
const PER_HORIZON = 8;

const DIRECTION = { Bullish: 1, Bearish: -1, Neutral: 0 };
const STRENGTH = ["", "débiles", "moderadas", "fuertes", "muy fuertes"];
const VALUATION = { Overvalued: "Sobrevalorada", Undervalued: "Infravalorada", "Near Fair Value": "Cerca de su valor justo" };

const outlook = (o) =>
  o?.direction
    ? {
        direction: o.direction === "Bullish" ? "alcista" : o.direction === "Bearish" ? "bajista" : "neutral",
        score: o.score ?? 0,
        // Signed strength: +3 = strong bullish evidence, -2 = bearish…
        signed: (DIRECTION[o.direction] ?? 0) * (o.score ?? 0),
      }
    : null;

// "señales alcistas fuertes"
const strength = (o) => `señales ${o.direction}s ${STRENGTH[Math.min(Math.max(o.score, 0), 4)]}`.trim();

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]).catch(() => null);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

async function universe() {
  const [strong, buy] = await Promise.all([
    screenStocks({ recommendation: "strong_buy", marketcap: "mega,large", limit: 35 }),
    screenStocks({ recommendation: "buy", marketcap: "mega,large", limit: 20 }),
  ]);
  const seen = new Set();
  return [
    ...strong.results.map((r) => ({ ...r, consensus: "Compra fuerte" })),
    ...buy.results.map((r) => ({ ...r, consensus: "Comprar" })),
  ].filter((r) => {
    // One share class per company (GOOG/GOOGL).
    const key = r.name.toLowerCase();
    if (seen.has(key) || seen.has(r.symbol)) return false;
    seen.add(key);
    seen.add(r.symbol);
    return true;
  });
}

async function enrich(stock) {
  const r = await insights(stock.symbol);
  const tech = r.instrumentInfo?.technicalEvents;
  const rec = r.recommendation;
  const val = r.instrumentInfo?.valuation;
  const target = typeof rec?.targetPrice === "number" ? rec.targetPrice : null;
  return {
    ...stock,
    outlook: {
      short: outlook(tech?.shortTermOutlook),
      mid: outlook(tech?.intermediateTermOutlook),
      long: outlook(tech?.longTermOutlook),
    },
    argus: rec?.rating ? { rating: rec.rating, target, upside: changePct(target, stock.price) } : null,
    valuation: val?.description ? { label: VALUATION[val.description] ?? val.description, discount: val.discount ?? null } : null,
  };
}

// Why a stock made a list, in plain Spanish, strongest reason first.
function reasons(s, horizon) {
  const out = [];
  const o = s.outlook[horizon];
  if (o && o.signed > 0) out.push(`Trading Central: ${strength(o)}`);
  if (horizon === "long" && s.argus?.rating === "BUY") {
    out.push(`Argus: comprar${s.argus.upside != null ? `, objetivo ${s.argus.upside > 0 ? "+" : ""}${s.argus.upside.toFixed(0)}%` : ""}`);
  }
  if (s.valuation?.label === "Infravalorada") out.push(`Infravalorada${s.valuation.discount ? ` (${s.valuation.discount} bajo su valor justo)` : ""}`);
  out.push(`Consenso: ${s.consensus.toLowerCase()}`);
  return out;
}

function rank(stocks, horizon) {
  const score = (s) => {
    const o = s.outlook[horizon];
    let v = (o?.signed ?? 0) * 2;
    if (horizon !== "short") v += s.valuation?.label === "Infravalorada" ? 1 : s.valuation?.label === "Sobrevalorada" ? -1 : 0;
    if (horizon === "long") {
      v += s.argus?.rating === "BUY" ? 2 : s.argus?.rating === "SELL" ? -2 : 0;
      v += Math.max(Math.min((s.argus?.upside ?? 0) / 10, 3), -3);
    }
    v += s.consensus === "Compra fuerte" ? 0.5 : 0;
    return v;
  };
  return stocks
    // Short and mid term need a bullish signal for that horizon; long term can
    // also qualify on Argus' buy rating.
    .filter((s) => (s.outlook[horizon]?.signed ?? 0) > 0 || (horizon === "long" && s.argus?.rating === "BUY" && (s.outlook.long?.signed ?? 0) >= 0))
    .map((s) => ({ ...s, score: Math.round(score(s) * 10) / 10, reasons: reasons(s, horizon) }))
    .sort((a, b) => b.score - a.score || (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .slice(0, PER_HORIZON);
}

let building = null;
let memo = null;

async function build() {
  const stocks = (await mapLimit(await universe(), 6, enrich)).filter((s) => s && (s.outlook.short || s.outlook.mid || s.outlook.long));
  if (!stocks.length) throw new Error("No hay datos de analistas disponibles por ahora");
  const result = {
    updatedAt: new Date().toISOString(),
    analyzed: stocks.length,
    horizons: { short: rank(stocks, "short"), mid: rank(stocks, "mid"), long: rank(stocks, "long") },
    sources: ["Nasdaq (consenso de analistas)", "Trading Central (señales técnicas)", "Argus Research (calificación y precio objetivo)"],
  };
  memo = { result, expires: Date.now() + TTL * 1000 };
  await remember(KEY, result, TTL);
  return result;
}

export async function analystIdeas() {
  if (memo && memo.expires > Date.now()) return memo.result;
  const saved = await recall(KEY);
  if (saved) {
    memo = { result: saved, expires: new Date(saved.updatedAt).getTime() + TTL * 1000 };
    if (memo.expires > Date.now()) return saved;
  }
  building ??= build().finally(() => { building = null; });
  try {
    return await building;
  } catch (err) {
    // Sources down: older ideas beat an error.
    if (saved) return saved;
    throw err;
  }
}
