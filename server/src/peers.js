import { yf, cached, quotes, crumbBlocked, blockCrumb, MIN, HOUR } from "./yahoo.js";
import { companySnapshot } from "./company.js";
import { askAI, aiEnabled } from "./news.js";
import { getJSON, setJSON, storageKind } from "./storage.js";

// Metrics used to compare a company against its competitors.
// better: "high" = more is better, "low" = less is better.
export const PEER_METRICS = [
  { key: "pe", category: "Valuación", better: "low", positiveOnly: true },
  { key: "pb", category: "Valuación", better: "low", positiveOnly: true },
  { key: "evToEbitda", category: "Valuación", better: "low", positiveOnly: true },
  { key: "evToRevenue", category: "Valuación", better: "low", positiveOnly: true },
  { key: "roe", category: "Rentabilidad", better: "high" },
  { key: "roa", category: "Rentabilidad", better: "high" },
  { key: "grossMargin", category: "Rentabilidad", better: "high" },
  { key: "operatingMargin", category: "Rentabilidad", better: "high" },
  { key: "profitMargin", category: "Rentabilidad", better: "high" },
  { key: "revenueGrowth", category: "Crecimiento", better: "high" },
  { key: "earningsGrowth", category: "Crecimiento", better: "high" },
  { key: "debtToEquity", category: "Salud financiera", better: "low", positiveOnly: true },
  { key: "currentRatio", category: "Salud financiera", better: "high" },
  { key: "quickRatio", category: "Salud financiera", better: "high" },
  { key: "dividendYield", category: "Dividendos", better: "high", noScore: true },
  { key: "beta", category: "Riesgo", better: "low", noScore: true },
];

// Yahoo's industry page lists the largest companies of an industry, but it
// needs the crumb, so it only works where Yahoo grants one (not on Render).
async function industryCompanies(industry) {
  if (!industry || crumbBlocked()) return [];
  const key = industry.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  try {
    return await cached(`industry:${key}`, 12 * HOUR, async () => {
      const res = await yf._fetch(
        `https://query1.finance.yahoo.com/v1/finance/industries/${encodeURIComponent(key)}`,
        { formatted: "false", lang: "en-US", region: "US" },
        { validateResult: false },
        "json",
        true,
      );
      const data = res?.data ?? res;
      return (data?.topCompanies ?? []).map((c) => c.symbol).filter(Boolean);
    });
  } catch {
    blockCrumb();
    return [];
  }
}

// Ask the AI for the main listed competitors (stored for a week to save quota).
async function aiCompetitors(snap) {
  if (!aiEnabled) return [];
  const storeKey = `peers:ai:${snap.symbol}`;
  const persist = storageKind === "upstash";
  if (persist) {
    const saved = await getJSON(storeKey).catch(() => null);
    if (saved) return saved;
  }
  const answer = await askAI(
    "Eres un analista bursátil. Respondes solo con JSON válido, sin texto adicional.",
    `Lista los 6 principales competidores directos que cotizan en bolsa de ${snap.profile.name} (ticker ${snap.symbol}, industria: ${snap.profile.industry ?? "desconocida"}, sector: ${snap.profile.sector ?? "desconocido"}). Prioriza empresas del mismo negocio y tamaño comparable. Usa los tickers tal como aparecen en Yahoo Finance (por ejemplo PEP, KDP, NSRGY, 7203.T). Formato: {"tickers": ["AAA", "BBB"]}`,
  ).catch(() => null);
  const json = answer?.match(/\{[\s\S]*\}/)?.[0];
  let tickers = [];
  try {
    tickers = (JSON.parse(json ?? "{}").tickers ?? []).map((t) => String(t).trim().toUpperCase()).filter((t) => /^[A-Z0-9.^=-]{1,12}$/.test(t));
  } catch {
    return [];
  }
  // Keep only tickers Yahoo actually knows.
  const valid = (await quotes(tickers)).map((q) => q.symbol.toUpperCase());
  if (persist && valid.length) await setJSON(storeKey, valid, 7 * 24 * 3600).catch(() => {});
  return valid;
}

async function findPeers(snap) {
  const symbol = snap.symbol;
  let candidates = (await industryCompanies(snap.profile.industry)).filter((s) => s !== symbol);
  if (candidates.length < 3) candidates.push(...(await aiCompetitors(snap)));
  if (candidates.filter((s) => s !== symbol).length < 3) {
    const rec = await yf.recommendationsBySymbol(symbol, {}, { validateResult: false }).catch(() => null);
    candidates.push(...(rec?.recommendedSymbols ?? []).map((r) => r.symbol));
  }
  return [...new Set(candidates)].filter((s) => s !== symbol);
}

function companyMetrics(symbol) {
  return companySnapshot(symbol).then((s) => ({
    symbol: s.symbol,
    name: s.quote.shortName || s.profile.name,
    industry: s.profile.industry,
    sector: s.profile.sector,
    marketCap: s.quote.marketCap,
    price: s.quote.regularMarketPrice,
    currency: s.quote.currency,
    changePct: s.quote.regularMarketChangePercent,
    metrics: s.metrics,
  }));
}

const median = (arr) => {
  const v = arr.filter((x) => x != null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};

// Percentile (0..1) of `value` within `values`, oriented so 1 = best.
function rankScore(value, values, def) {
  const valid = (x) => x != null && (!def.positiveOnly || x > 0);
  const pool = values.filter(valid);
  if (!valid(value) || pool.length < 2) {
    // A negative P/E or negative equity is worse than any valid value.
    return value != null && def.positiveOnly && value <= 0 && pool.length ? 0 : null;
  }
  const below = pool.filter((x) => (def.better === "high" ? x < value : x > value)).length;
  const equal = pool.filter((x) => x === value).length - 1;
  return (below + equal / 2) / (pool.length - 1);
}

const verdict = (score) => (score == null ? null : score >= 67 ? "Fuerte" : score >= 40 ? "En línea" : "Débil");

export async function peerComparison(symbol, extra = []) {
  symbol = symbol.toUpperCase();
  return cached(`peers:${symbol}:${extra.join(",")}`, 30 * MIN, async () => {
    const self = await companyMetrics(symbol);
    const auto = await findPeers(await companySnapshot(symbol));
    const peerSymbols = [...new Set([...extra.map((s) => s.toUpperCase()), ...auto])]
      .filter((s) => s !== symbol)
      .slice(0, 6 + extra.length);
    const peers = (await Promise.all(peerSymbols.map((s) => companyMetrics(s).catch(() => null))))
      .filter((p) => p && p.price != null);

    const group = [self, ...peers];
    const metrics = PEER_METRICS.map((def) => {
      const values = group.map((c) => c.metrics[def.key]);
      const peerValues = peers.map((c) => c.metrics[def.key]).filter((v) => v != null && (!def.positiveOnly || v > 0));
      const score = rankScore(self.metrics[def.key], values, def);
      return {
        key: def.key,
        category: def.category,
        better: def.better,
        scored: !def.noScore,
        value: self.metrics[def.key],
        peerMedian: median(peerValues),
        score: score != null ? Math.round(score * 100) : null,
      };
    });

    const categories = {};
    for (const m of metrics) {
      if (!m.scored || m.score == null) continue;
      (categories[m.category] ??= []).push(m.score);
    }
    const categoryScores = Object.entries(categories).map(([name, scores]) => {
      const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      return { name, score, verdict: verdict(score) };
    });
    const overall = categoryScores.length
      ? Math.round(categoryScores.reduce((a, c) => a + c.score, 0) / categoryScores.length)
      : null;

    return {
      symbol,
      industry: self.industry,
      sector: self.sector,
      score: overall,
      verdict: verdict(overall),
      categories: categoryScores,
      metrics,
      companies: group.map((c) => ({ ...c, isSelf: c.symbol === symbol })),
    };
  });
}
