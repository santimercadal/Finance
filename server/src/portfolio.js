import { quotes, dailyCloses, fxPerUsd, profileOf } from "./yahoo.js";
import { getJSON, setJSON } from "./storage.js";
import { userKey, isAdmin } from "./users.js";
import { betaOf } from "./company.js";
import { changePct, daysAgo } from "./util.js";

const DEFAULT_HOLDINGS = [
  { symbol: "AAPL", shares: 10, avgCost: 180 },
  { symbol: "MSFT", shares: 5, avgCost: 350 },
  { symbol: "GOOGL", shares: 8, avgCost: 140 },
  { symbol: "KO", shares: 20, avgCost: 60 },
];

// Each user has their own portfolio. The owner starts with sample positions on
// a fresh install; friends start empty.
export async function loadHoldings() {
  const holdings = await getJSON(userKey("portfolio"));
  if (holdings) return holdings;
  if (!isAdmin()) return [];
  await saveHoldings(DEFAULT_HOLDINGS);
  return DEFAULT_HOLDINGS;
}

export async function saveHoldings(holdings) {
  await setJSON(userKey("portfolio"), holdings);
}

export async function upsertHolding({ symbol, shares, avgCost }) {
  const holdings = await loadHoldings();
  const sym = String(symbol).trim().toUpperCase();
  const entry = { symbol: sym, shares: Number(shares), avgCost: Number(avgCost) };
  const i = holdings.findIndex((h) => h.symbol === sym);
  if (i >= 0) holdings[i] = entry;
  else holdings.push(entry);
  await saveHoldings(holdings);
  return holdings;
}

export async function removeHolding(symbol) {
  const holdings = (await loadHoldings()).filter((h) => h.symbol !== symbol.toUpperCase());
  await saveHoldings(holdings);
  return holdings;
}

// Portfolio snapshot with live prices. All totals are in USD; non-USD holdings
// are converted at the current FX rate.
export async function portfolioSnapshot() {
  const holdings = await loadHoldings();
  const qs = await quotes(holdings.map((h) => h.symbol));
  const bySym = Object.fromEntries(qs.map((q) => [q.symbol, q]));
  const sparkStart = daysAgo(31);

  const rows = await Promise.all(
    holdings.map(async (h) => {
      const q = bySym[h.symbol] ?? {};
      const [fx, closes, beta, profile] = await Promise.all([
        fxPerUsd(q.currency),
        dailyCloses(h.symbol, sparkStart).catch(() => []),
        betaOf(h.symbol),
        profileOf(h.symbol).catch(() => ({})),
      ]);
      const price = q.regularMarketPrice ?? null;
      const prev = q.regularMarketPreviousClose ?? price;
      const value = price != null ? (price * h.shares) / fx : null;
      const cost = (h.avgCost * h.shares) / fx;
      return {
        ...h,
        name: q.shortName || q.longName || h.symbol,
        currency: q.currency || "USD",
        type: q.quoteType ?? null,
        sector: profile.sectorDisp ?? profile.sector ?? null,
        // Units of the holding's currency per 1 USD (1 for USD holdings).
        fx,
        beta,
        price,
        dayChangePct: q.regularMarketChangePercent ?? null,
        dayChangeUsd: price != null ? ((price - prev) * h.shares) / fx : 0,
        valueUsd: value,
        costUsd: cost,
        pnlUsd: value != null ? value - cost : null,
        pnlPct: value != null ? changePct(value, cost) : null,
        spark: closes.map((c) => c.close),
      };
    }),
  );

  const totalValue = rows.reduce((s, r) => s + (r.valueUsd ?? 0), 0);
  const totalCost = rows.reduce((s, r) => s + r.costUsd, 0);
  const dayChange = rows.reduce((s, r) => s + r.dayChangeUsd, 0);
  for (const r of rows) r.weight = totalValue ? ((r.valueUsd ?? 0) / totalValue) * 100 : 0;
  rows.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));

  const best = rows.reduce((b, r) => (r.dayChangePct != null && (!b || r.dayChangePct > b.dayChangePct) ? r : b), null);
  const worst = rows.reduce((w, r) => (r.dayChangePct != null && (!w || r.dayChangePct < w.dayChangePct) ? r : w), null);

  // Portfolio beta = value-weighted average of each holding's beta, over the
  // holdings that have one (coverage = share of the portfolio value included).
  const withBeta = rows.filter((r) => r.beta != null && r.valueUsd);
  const betaValue = withBeta.reduce((s, r) => s + r.valueUsd, 0);

  return {
    holdings: rows,
    totals: {
      value: totalValue,
      cost: totalCost,
      pnl: totalValue - totalCost,
      pnlPct: changePct(totalValue, totalCost),
      dayChange,
      dayChangePct: totalValue - dayChange ? (dayChange / (totalValue - dayChange)) * 100 : null,
      best: best && { symbol: best.symbol, pct: best.dayChangePct },
      worst: worst && { symbol: worst.symbol, pct: worst.dayChangePct },
      beta: betaValue ? withBeta.reduce((s, r) => s + r.beta * r.valueUsd, 0) / betaValue : null,
      betaCoverage: totalValue ? (betaValue / totalValue) * 100 : null,
    },
  };
}

// Daily value of the *current* holdings over the last year, plus the S&P 500
// rebased to the same starting value for comparison.
export async function portfolioHistory() {
  const holdings = await loadHoldings();
  const start = daysAgo(365);
  const [series, bench] = await Promise.all([
    Promise.all(
      holdings.map(async (h) => {
        const [closes, q] = await Promise.all([dailyCloses(h.symbol, start), quotes([h.symbol])]);
        const fx = await fxPerUsd(q[0]?.currency);
        return { h, fx, map: new Map(closes.map((c) => [c.date, c.close])) };
      }).map((p) => p.catch(() => null)),
    ),
    dailyCloses("^GSPC", start).catch(() => []),
  ]);

  const valid = series.filter(Boolean);
  const dates = [...new Set(valid.flatMap((s) => [...s.map.keys()]))].sort();
  const last = new Map();
  const points = [];
  for (const d of dates) {
    let total = 0;
    let complete = true;
    for (const s of valid) {
      const c = s.map.get(d) ?? last.get(s.h.symbol);
      if (c == null) { complete = false; continue; }
      last.set(s.h.symbol, c);
      total += (c * s.h.shares) / s.fx;
    }
    if (complete) points.push({ date: d, value: total });
  }

  const benchMap = new Map(bench.map((b) => [b.date, b.close]));
  const base = points[0];
  const benchBase = base && (benchMap.get(base.date) ?? bench[0]?.close);
  let lastBench = benchBase;
  for (const p of points) {
    lastBench = benchMap.get(p.date) ?? lastBench;
    p.benchmark = benchBase ? (lastBench / benchBase) * base.value : null;
  }

  const valueAt = (days) => {
    const target = daysAgo(days);
    return points.find((p) => p.date >= target)?.value;
  };
  const now = points.at(-1)?.value;
  const ytdStart = points.find((p) => p.date >= `${new Date().getFullYear()}-01-01`)?.value;
  return {
    points,
    returns: {
      "1S": changePct(now, valueAt(7)),
      "1M": changePct(now, valueAt(30)),
      "3M": changePct(now, valueAt(91)),
      YTD: changePct(now, ytdStart),
      "1A": changePct(now, points[0]?.value),
    },
  };
}
