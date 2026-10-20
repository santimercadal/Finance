import { cached, MIN } from "./yahoo.js";
import { httpError } from "./util.js";

// Stock screener built on free sources that work from cloud hosts (no Yahoo
// crumb): Nasdaq's public screener for filters (sector, size, analysts'
// consensus, exchange, region) and Yahoo's predefined screeners for investment
// styles (growth, value, dividends…), which bring P/E, yield and ratings.

const NASDAQ_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
  Accept: "application/json",
  Origin: "https://www.nasdaq.com",
  Referer: "https://www.nasdaq.com/",
};

// Values Nasdaq accepts for each filter; anything else is dropped.
export const FILTERS = {
  sector: ["technology", "telecommunications", "health_care", "finance", "real_estate", "consumer_discretionary", "consumer_staples", "industrials", "basic_materials", "energy", "utilities"],
  marketcap: ["mega", "large", "mid", "small", "micro", "nano"],
  recommendation: ["strong_buy", "buy", "hold", "sell", "strong_sell"],
  exchange: ["nasdaq", "nyse", "amex"],
  region: ["north_america", "europe", "asia", "south_america", "middle_east", "africa", "australia_and_south_pacific", "caribbean"],
};

const SORTS = { cap: "marketCap", change: "changePct", volume: "volume", price: "price" };

const toNum = (s) => {
  const n = Number(String(s ?? "").replace(/[$,%\s]/g, ""));
  return s === "" || s == null || !Number.isFinite(n) ? null : n;
};

// "NVIDIA Corporation Common Stock" -> "NVIDIA Corporation"
export const cleanName = (s) =>
  String(s ?? "")
    .replace(/\s+(Class [A-Z] )?(Common Stock|Ordinary Shares|Capital Stock|Common Shares|American Depositary Shares?|Depositary Shares?|Sponsored ADR).*$/i, "")
    .trim();

function nasdaqRows(params) {
  const qs = new URLSearchParams({ tableonly: "true", limit: "10000", download: "true", ...params });
  return cached(`nasdaq-screener:${qs}`, 15 * MIN, async () => {
    const res = await fetch(`https://api.nasdaq.com/api/screener/stocks?${qs}`, { headers: NASDAQ_HEADERS, signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw httpError(502, `El buscador de Nasdaq no respondió (HTTP ${res.status})`);
    const rows = (await res.json())?.data?.rows ?? [];
    return rows
      // Warrants, units, rights and preferred shares aren't what people screen for.
      .filter((r) => r.symbol && !/[\^/]/.test(r.symbol) && !/warrant|\bunits?\b|\brights?\b|preferred|depositary shares? each/i.test(r.name))
      .map((r) => ({
        symbol: r.symbol.trim(),
        name: cleanName(r.name),
        price: toNum(r.lastsale),
        changePct: toNum(r.pctchange),
        marketCap: toNum(r.marketCap) || null,
        volume: toNum(r.volume),
        sector: r.sector || null,
        industry: r.industry || null,
        country: r.country || null,
      }));
  });
}

// Filtered stock list. `query` holds comma-separated filter values, plus
// `sort` (cap, change, volume, price), `dir` (asc, desc) and `limit`.
export async function screenStocks(query = {}) {
  const params = {};
  for (const [key, allowed] of Object.entries(FILTERS)) {
    const values = String(query[key] ?? "").split(",").map((v) => v.trim().toLowerCase()).filter((v) => allowed.includes(v));
    if (values.length) params[key] = values.join("|");
  }
  const rows = await nasdaqRows(params);
  const minPrice = toNum(query.minPrice);
  const field = SORTS[query.sort] ?? "marketCap";
  const sign = query.dir === "asc" ? 1 : -1;
  const limit = Math.min(Math.max(Number(query.limit) || 60, 1), 200);
  const list = rows
    .filter((r) => r.price != null && (minPrice == null || r.price >= minPrice))
    .sort((a, b) => ((a[field] ?? -Infinity) - (b[field] ?? -Infinity)) * sign || (b.marketCap ?? 0) - (a.marketCap ?? 0));
  return { total: list.length, results: list.slice(0, limit), source: "Nasdaq" };
}

// Investment styles, each backed by one of Yahoo's predefined screeners. The
// Finviz link opens a similar screen there.
export const STYLES = {
  growth: {
    id: "growth_technology_stocks",
    name: "Crecimiento",
    description: "Tecnológicas con ventas y ganancias creciendo más de 25% al año.",
    profile: "Moderado a agresivo",
    finviz: "f=fa_epsyoy_o25,fa_salesqoq_o25,sec_technology&o=-marketcap",
  },
  garp: {
    id: "undervalued_growth_stocks",
    name: "Crecimiento a buen precio",
    description: "Ganancias creciendo más de 25% con P/E y PEG relativamente bajos.",
    profile: "Moderado",
    finviz: "f=fa_epsyoy_o25,fa_pe_u20,fa_peg_u1&o=-marketcap",
  },
  value: {
    id: "undervalued_large_caps",
    name: "Valor",
    description: "Empresas grandes que cotizan baratas frente a sus ganancias.",
    profile: "Conservador a moderado",
    finviz: "f=cap_largeover,fa_pe_u15,fa_peg_u1&o=-marketcap",
  },
  dividends: {
    id: "high_dividend_yield",
    name: "Dividendos",
    description: "Empresas medianas y grandes con dividendo alto, ordenadas por rendimiento.",
    profile: "Conservador",
    finviz: "f=cap_midover,fa_div_o4&o=-dividendyield",
    minCap: 2e9,
    sort: "dividendYield",
  },
  aggressive: {
    id: "aggressive_small_caps",
    name: "Small caps agresivas",
    description: "Empresas chicas con ganancias creciendo fuerte. Más volátiles.",
    profile: "Agresivo",
    finviz: "f=cap_small,fa_epsyoy_o25&o=-volume",
  },
  momentum: {
    id: "day_gainers",
    name: "Momentum del día",
    description: "Las que más suben hoy con volumen relevante.",
    profile: "Especulativo",
    finviz: "s=ta_topgainers",
  },
  active: {
    id: "most_actives",
    name: "Más operadas",
    description: "Las acciones con más volumen negociado hoy.",
    profile: "Informativo",
    finviz: "s=ta_mostactive",
  },
};

const RATING = /^([\d.]+)\s*-\s*(.+)$/;

export function styleScreen(style) {
  const s = STYLES[style];
  if (!s) throw httpError(404, `Estilo desconocido: ${style}`);
  return cached(`style:${style}`, 30 * MIN, async () => {
    const url = `https://query1.finance.yahoo.com/v1/finance/screener/predefined/saved?scrIds=${s.id}&count=100&formatted=false`;
    const res = await fetch(url, { headers: { "User-Agent": NASDAQ_HEADERS["User-Agent"] }, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw httpError(502, `Yahoo Finance no respondió (HTTP ${res.status})`);
    const quotes = (await res.json())?.finance?.result?.[0]?.quotes ?? [];
    const seen = new Set();
    let results = quotes
      .filter((q) => q.symbol && q.regularMarketPrice != null && (!s.minCap || (q.marketCap ?? 0) >= s.minCap))
      .map((q) => {
        const [, score, label] = String(q.averageAnalystRating ?? "").match(RATING) ?? [];
        return {
          symbol: q.symbol,
          name: q.longName || q.shortName || q.symbol,
          price: q.regularMarketPrice,
          currency: q.currency ?? "USD",
          changePct: q.regularMarketChangePercent ?? null,
          marketCap: q.marketCap ?? null,
          pe: q.trailingPE ?? null,
          forwardPe: q.forwardPE ?? null,
          dividendYield: q.dividendYield ?? null,
          yearChangePct: q.fiftyTwoWeekChangePercent ?? null,
          // 1 = strong buy … 5 = sell
          analystScore: score ? Number(score) : null,
          analystLabel: label ?? null,
        };
      })
      // Same company, several share classes (GOOG/GOOGL): keep the first.
      .filter((r) => {
        const key = cleanName(r.name).toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    if (s.sort) results = results.filter((r) => r[s.sort] != null && r[s.sort] <= 15).sort((a, b) => b[s.sort] - a[s.sort]);
    return {
      style,
      name: s.name,
      description: s.description,
      profile: s.profile,
      finvizUrl: `https://finviz.com/screener.ashx?v=111&${s.finviz}`,
      results: results.slice(0, 40),
      source: "Yahoo Finance",
    };
  });
}

export const styleList = () =>
  Object.entries(STYLES).map(([key, s]) => ({ key, name: s.name, description: s.description, profile: s.profile }));
