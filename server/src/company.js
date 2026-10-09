import { yf, cached, quotes, fxPerUsd, profileOf, financialCurrency, HOUR } from "./yahoo.js";

export const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const div = (a, b) => (num(a) != null && num(b) ? a / b : null);
const pct = (a, b) => (div(a, b) != null ? (a / b) * 100 : null);

// Financial statements from Yahoo's fundamentals time series (no crumb needed).
// type: "annual" | "quarterly" | "trailing" (trailing = last twelve months).
export function fundamentals(symbol, type) {
  const years = type === "annual" ? 6 : 2;
  const period1 = new Date(Date.now() - years * 365 * 864e5).toISOString().slice(0, 10);
  return cached(`fts:${symbol}:${type}`, 6 * HOUR, async () => {
    const rows = await yf.fundamentalsTimeSeries(symbol, { period1, type, module: "all" }, { validateResult: false });
    return rows
      .filter((r) => r.date)
      .map((r) => {
        const d = typeof r.date === "number" ? new Date(r.date * 1000) : new Date(r.date);
        return { ...r, date: d.toISOString().slice(0, 10) };
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  });
}

// Beta = covariance of monthly returns with the S&P 500 / variance of the index.
function beta(stock, index) {
  const idx = new Map(index.map((p) => [p.date, p.close]));
  const pairs = [];
  for (let i = 1; i < stock.length; i++) {
    const a = idx.get(stock[i - 1].date);
    const b = idx.get(stock[i].date);
    if (a && b) pairs.push([stock[i].close / stock[i - 1].close - 1, b / a - 1]);
  }
  if (pairs.length < 24) return null;
  const mean = (k) => pairs.reduce((s, p) => s + p[k], 0) / pairs.length;
  const ms = mean(0);
  const mm = mean(1);
  let cov = 0;
  let varM = 0;
  for (const [s, m] of pairs) {
    cov += (s - ms) * (m - mm);
    varM += (m - mm) ** 2;
  }
  return varM ? cov / varM : null;
}

// Quote, profile and valuation/profitability/health metrics for one company,
// computed from statements so it works without Yahoo's crumb-protected APIs.
export function companySnapshot(symbol) {
  symbol = symbol.toUpperCase();
  return cached(`snap:${symbol}`, 30 * 60_000, async () => {
    // Beta like Yahoo: 5 years of monthly returns against the S&P 500.
    const start = new Date(Date.now() - 5 * 365 * 864e5).toISOString().slice(0, 10);
    const [[quote], profile, ttmRows, quarterly, closes, index, finCur] = await Promise.all([
      quotes([symbol]),
      profileOf(symbol).catch(() => ({})),
      fundamentals(symbol, "trailing").catch(() => []),
      fundamentals(symbol, "quarterly").catch(() => []),
      monthlyCloses(symbol, start).catch(() => []),
      monthlyCloses("^GSPC", start).catch(() => []),
      financialCurrency(symbol),
    ]);
    if (!quote) {
      const err = new Error(`No se encontró el símbolo ${symbol}`);
      err.status = 404;
      throw err;
    }

    const price = quote.regularMarketPrice;
    const ttm = ttmRows.at(-1) ?? {};
    const balances = quarterly.filter((r) => num(r.totalAssets) != null);
    const bs = balances.at(-1) ?? {};
    const withRevenue = quarterly.filter((r) => num(r.totalRevenue) != null);
    const lastQ = withRevenue.at(-1);
    const yearAgoQ = withRevenue.at(-5);

    // Statements may be in another currency than the share price (ADRs).
    const tradeCur = quote.currency;
    const statementCur = finCur ?? tradeCur;
    const fx = statementCur && tradeCur && statementCur !== tradeCur
      ? (await fxPerUsd(tradeCur)) / (await fxPerUsd(statementCur))
      : 1;
    const conv = (v) => (num(v) != null ? v * fx : null);

    const netIncome = conv(ttm.netIncome ?? ttm.netIncomeCommonStockholders);
    const eps = conv(ttm.dilutedEPS ?? ttm.basicEPS);
    // Share count implied by EPS matches the unit the price is quoted in (ADR
    // ratios, bad share counts in the balance sheet data); fall back to the balance sheet.
    const impliedShares = netIncome > 0 && eps > 0 ? netIncome / eps : null;
    const shares = impliedShares ?? num(bs.ordinarySharesNumber) ?? num(bs.shareIssued);
    const marketCap = shares && price ? shares * price : null;
    const equity = conv(bs.stockholdersEquity ?? bs.commonStockEquity);
    const totalDebt = conv(bs.totalDebt) ?? 0;
    const cash = conv(bs.cashCashEquivalentsAndShortTermInvestments ?? bs.cashAndCashEquivalents) ?? 0;
    const ev = marketCap != null ? marketCap + totalDebt - cash : null;
    const revenue = conv(ttm.totalRevenue);
    const dividends = num(ttm.cashDividendsPaid ?? ttm.commonStockDividendPaid);

    const growth = (key) => {
      const a = num(lastQ?.[key]);
      const b = num(yearAgoQ?.[key]);
      return a != null && b != null && b > 0 ? (a / b - 1) * 100 : null;
    };

    return {
      symbol,
      quote: { ...quote, marketCap },
      profile: {
        name: quote.longName || quote.shortName || profile.longname || profile.shortname || symbol,
        sector: profile.sector ?? profile.sectorDisp,
        industry: (profile.industry ?? profile.industryDisp)?.replace(/—/g, " - "),
        exchange: profile.exchDisp,
      },
      financialCurrency: statementCur,
      metrics: {
        pe: eps && eps > 0 ? price / eps : null,
        forwardPe: null,
        pb: div(marketCap, equity),
        evToEbitda: div(ev, conv(ttm.EBITDA ?? ttm.normalizedEBITDA)),
        evToRevenue: div(ev, revenue),
        roe: equity > 0 ? pct(netIncome, equity) : null,
        roa: pct(netIncome, conv(bs.totalAssets)),
        grossMargin: pct(conv(ttm.grossProfit), revenue),
        operatingMargin: pct(conv(ttm.operatingIncome ?? ttm.EBIT), revenue),
        profitMargin: pct(netIncome, revenue),
        revenueGrowth: growth("totalRevenue"),
        earningsGrowth: growth("netIncome"),
        debtToEquity: equity > 0 ? div(totalDebt, equity) : null,
        currentRatio: div(bs.currentAssets, bs.currentLiabilities),
        quickRatio: div(num(bs.currentAssets) != null ? bs.currentAssets - (num(bs.inventory) ?? 0) : null, bs.currentLiabilities),
        dividendYield: dividends != null && marketCap ? (Math.abs(conv(dividends)) / marketCap) * 100 : 0,
        beta: beta(closes, index),
      },
    };
  });
}

function monthlyCloses(symbol, period1) {
  return cached(`monthly:${symbol}:${period1.slice(0, 7)}`, 12 * HOUR, async () => {
    const c = await yf.chart(symbol, { period1, interval: "1mo" }, { validateResult: false });
    return c.quotes
      .filter((q) => q.close != null)
      .map((q) => ({ date: new Date(q.date).toISOString().slice(0, 7), close: q.adjclose ?? q.close }));
  });
}
