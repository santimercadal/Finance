import YahooFinance from "yahoo-finance2";

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

export function quotes(symbols) {
  const list = [...new Set(symbols)].sort();
  if (!list.length) return Promise.resolve([]);
  return cached(`quotes:${list.join(",")}`, MIN, async () => {
    const res = await yf.quote(list, { return: "array" }, { validateResult: false });
    return res;
  });
}

export function dailyCloses(symbol, period1) {
  return cached(`chart:${symbol}:${period1}`, 15 * MIN, async () => {
    const c = await yf.chart(symbol, { period1, interval: "1d" }, { validateResult: false });
    return c.quotes
      .filter((q) => q.close != null)
      .map((q) => ({ date: new Date(q.date).toISOString().slice(0, 10), close: q.adjclose ?? q.close }));
  });
}

// Units of `currency` per 1 USD. Handles GBp (pence) quotes.
export async function fxPerUsd(currency) {
  if (!currency || currency === "USD") return 1;
  if (currency === "GBp") return (await fxPerUsd("GBP")) * 100;
  if (currency === "ILA") return (await fxPerUsd("ILS")) * 100;
  return cached(`fx:${currency}`, 30 * MIN, async () => {
    const q = await yf.quote(`${currency}=X`, {}, { validateResult: false });
    return q?.regularMarketPrice || 1;
  });
}
