import YahooFinance from "yahoo-finance2";
import { isoDate } from "./util.js";

export const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// Simple in-memory cache with TTL, also dedupes concurrent requests for the same key.
const store = new Map();
export async function cached(key, ttlMs, fn) {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = fn();
  store.set(key, { value, expires: Date.now() + ttlMs });
  try {
    return await value;
  } catch (err) {
    store.delete(key);
    throw err;
  }
}

export const MIN = 60_000;
export const HOUR = 60 * MIN;

// Yahoo's quote and quoteSummary APIs need a "crumb" that Yahoo refuses to
// hand out to cloud hosts (Render gets HTTP 429). Everything in this app is
// built on endpoints that work without it: chart, search, fundamentals.

// Current quote for one symbol from the chart endpoint's metadata. Returns the
// same field names as yf.quote() so callers don't care where it came from.
function chartQuote(symbol) {
  return cached(`cq:${symbol}`, MIN, async () => {
    const c = await yf.chart(
      symbol,
      { period1: new Date(Date.now() - 7 * 864e5), interval: "1d" },
      { validateResult: false },
    );
    const m = c.meta ?? {};
    const price = m.regularMarketPrice ?? null;
    const pct = m.regularMarketChangePercent ?? null;
    const prev = price != null && pct != null ? price / (1 + pct / 100) : m.chartPreviousClose ?? null;
    const regular = m.currentTradingPeriod?.regular;
    const now = Date.now();
    const open = regular && now >= new Date(regular.start).getTime() && now <= new Date(regular.end).getTime();
    return {
      symbol: m.symbol ?? symbol,
      // EQUITY, ETF, CRYPTOCURRENCY, INDEX, MUTUALFUND, CURRENCY, FUTURE…
      quoteType: m.instrumentType ?? null,
      // The library may already convert it to a Date; otherwise it's epoch seconds.
      firstTradeDate: m.firstTradeDate
        ? isoDate(m.firstTradeDate instanceof Date ? m.firstTradeDate : m.firstTradeDate * 1000)
        : null,
      shortName: m.shortName,
      longName: m.longName,
      currency: m.currency,
      fullExchangeName: m.fullExchangeName ?? m.exchangeName,
      regularMarketPrice: price,
      regularMarketChangePercent: pct,
      regularMarketChange: price != null && prev != null ? price - prev : null,
      regularMarketPreviousClose: prev,
      fiftyTwoWeekHigh: m.fiftyTwoWeekHigh ?? null,
      fiftyTwoWeekLow: m.fiftyTwoWeekLow ?? null,
      marketState: open ? "REGULAR" : "CLOSED",
    };
  });
}

export async function quotes(symbols) {
  const list = [...new Set(symbols)];
  const res = await Promise.all(list.map((s) => chartQuote(s).catch(() => null)));
  return res.filter((q) => q && q.regularMarketPrice != null);
}

// quoteSummary extras (company description, analyst targets) only work where
// Yahoo grants a crumb. After the first refusal, stop asking for an hour.
// YF_NO_CRUMB=1 simulates a cloud host locally.
let crumbBlockedUntil = process.env.YF_NO_CRUMB ? Infinity : 0;
export const crumbBlocked = () => Date.now() < crumbBlockedUntil;
export const blockCrumb = () => { crumbBlockedUntil = Math.max(crumbBlockedUntil, Date.now() + HOUR); };
export async function optionalSummary(symbol, modules) {
  if (crumbBlocked()) return {};
  try {
    return await cached(`qs:${symbol}:${modules.join(",")}`, 2 * HOUR, () =>
      yf.quoteSummary(symbol, { modules }, { validateResult: false }),
    );
  } catch (err) {
    if (/crumb|429|401/i.test(err.message)) blockCrumb();
    return {};
  }
}

// Yahoo's research insights (no crumb needed): Morningstar bull/bear case,
// Argus rating and target, Trading Central technical outlook. Stocks only.
export function insights(symbol) {
  return cached(`insights:${symbol}`, 6 * HOUR, async () => {
    const url = `https://query2.finance.yahoo.com/ws/insights/v2/finance/insights?symbol=${encodeURIComponent(symbol)}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Yahoo insights HTTP ${res.status}`);
    return (await res.json())?.finance?.result ?? {};
  });
}

// Price history with dividends, for fund/crypto indicators.
export function dailyHistory(symbol, period1) {
  return cached(`hist:${symbol}:${period1}`, HOUR, async () => {
    const c = await yf.chart(symbol, { period1, interval: "1d", events: "div" }, { validateResult: false });
    return {
      closes: c.quotes
        .filter((q) => q.close != null)
        .map((q) => ({ date: isoDate(q.date), close: q.adjclose ?? q.close, price: q.close })),
      dividends: (c.events?.dividends ?? []).map((d) => ({ date: isoDate(d.date), amount: d.amount })),
    };
  });
}

// Search result for a symbol: name, sector and industry.
export function profileOf(symbol) {
  return cached(`profile:${symbol}`, 12 * HOUR, async () => {
    const res = await yf.search(symbol, { quotesCount: 5, newsCount: 0 }, { validateResult: false });
    return (res.quotes ?? []).find((q) => q.symbol === symbol) ?? {};
  });
}

// Currency the company reports its financial statements in (can differ from the
// trading currency, e.g. ADRs). The library drops this field, so ask directly.
export function financialCurrency(symbol) {
  return cached(`fincur:${symbol}`, 24 * HOUR, async () => {
    const p1 = Math.floor((Date.now() - 2 * 365 * 864e5) / 1000);
    const p2 = Math.floor(Date.now() / 1000);
    const url = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(symbol)}?type=quarterlyTotalRevenue,annualTotalRevenue&period1=${p1}&period2=${p2}`;
    const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(10_000) });
    const body = await res.json();
    for (const r of body?.timeseries?.result ?? []) {
      for (const key of Object.keys(r)) {
        const cur = Array.isArray(r[key]) ? r[key].find((x) => x?.currencyCode)?.currencyCode : null;
        if (cur) return cur;
      }
    }
    return null;
  }).catch(() => null);
}

export function dailyCloses(symbol, period1) {
  return cached(`chart:${symbol}:${period1}`, 15 * MIN, async () => {
    const c = await yf.chart(symbol, { period1, interval: "1d" }, { validateResult: false });
    return c.quotes
      .filter((q) => q.close != null)
      .map((q) => ({ date: isoDate(q.date), close: q.adjclose ?? q.close }));
  });
}

// Units of `currency` per 1 USD. Handles GBp (pence) quotes.
export async function fxPerUsd(currency) {
  if (!currency || currency === "USD") return 1;
  if (currency === "GBp") return (await fxPerUsd("GBP")) * 100;
  if (currency === "ILA") return (await fxPerUsd("ILS")) * 100;
  return cached(`fx:${currency}`, 30 * MIN, async () => {
    const q = await chartQuote(`${currency}=X`);
    return q?.regularMarketPrice || 1;
  });
}
