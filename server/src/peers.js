import { yf, cached, quotes, MIN, HOUR } from "./yahoo.js";

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const pct = (v) => (num(v) != null ? v * 100 : null);

// Metrics used to compare a company against its competitors.
// better: "high" = more is better, "low" = less is better.
export const PEER_METRICS = [
  { key: "pe", category: "Valuación", better: "low", positiveOnly: true },
  { key: "forwardPe", category: "Valuación", better: "low", positiveOnly: true },
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

// Industry page lists the largest companies of the industry (real competitors).
function industryCompanies(industryKey) {
  return cached(`industry:${industryKey}`, 12 * HOUR, async () => {
    const res = await yf._fetch(
      `https://query1.finance.yahoo.com/v1/finance/industries/${encodeURIComponent(industryKey)}`,
      { formatted: "false", lang: "en-US", region: "US" },
      { validateResult: false },
      "json",
      true,
    );
    const data = res?.data ?? res;
    return (data?.topCompanies ?? []).map((c) => c.symbol).filter(Boolean);
  });
}

function summary(symbol) {
  return cached(`peerqs:${symbol}`, 2 * HOUR, () =>
    yf.quoteSummary(
      symbol,
      { modules: ["assetProfile", "financialData", "defaultKeyStatistics", "summaryDetail"] },
      { validateResult: false },
    ),
  );
}

async function companyMetrics(symbol) {
  const [s, [q]] = await Promise.all([summary(symbol), quotes([symbol])]);
  const fd = s.financialData ?? {};
  const ks = s.defaultKeyStatistics ?? {};
  const sd = s.summaryDetail ?? {};
  const ap = s.assetProfile ?? {};
  return {
    symbol,
    name: q?.shortName || q?.longName || symbol,
    industry: ap.industry,
    industryKey: ap.industryKey,
    sector: ap.sector,
    marketCap: num(q?.marketCap),
    price: num(q?.regularMarketPrice),
    currency: q?.currency,
    changePct: num(q?.regularMarketChangePercent),
    metrics: {
      pe: num(sd.trailingPE) ?? num(q?.trailingPE),
      forwardPe: num(sd.forwardPE) ?? num(q?.forwardPE),
      pb: num(ks.priceToBook),
      evToEbitda: num(ks.enterpriseToEbitda),
      evToRevenue: num(ks.enterpriseToRevenue),
      roe: pct(fd.returnOnEquity),
      roa: pct(fd.returnOnAssets),
      grossMargin: pct(fd.grossMargins),
      operatingMargin: pct(fd.operatingMargins),
      profitMargin: pct(fd.profitMargins),
      revenueGrowth: pct(fd.revenueGrowth),
      earningsGrowth: pct(fd.earningsGrowth),
      // Yahoo reports debt/equity as a percentage (78.4 = 0.784x).
      debtToEquity: num(fd.debtToEquity) != null ? fd.debtToEquity / 100 : null,
      currentRatio: num(fd.currentRatio),
      quickRatio: num(fd.quickRatio),
      dividendYield: pct(sd.dividendYield) ?? 0,
      beta: num(sd.beta) ?? num(ks.beta),
    },
  };
}

async function findPeers(symbol, profile) {
  let candidates = [];
  if (profile.industryKey) candidates = await industryCompanies(profile.industryKey).catch(() => []);
  if (candidates.filter((s) => s !== symbol).length < 3) {
    const rec = await yf.recommendationsBySymbol(symbol, {}, { validateResult: false }).catch(() => null);
    candidates.push(...(rec?.recommendedSymbols ?? []).map((r) => r.symbol));
  }
  return [...new Set(candidates)].filter((s) => s !== symbol);
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
    const auto = await findPeers(symbol, self);
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
