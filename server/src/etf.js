import { dailyHistory, optionalSummary, quotes } from "./yahoo.js";
import { betaOf, num } from "./company.js";

const pct = (a, b) => (num(a) != null && num(b) ? (a / b - 1) * 100 : null);
const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);

// Close on or right after `date` (first trading day of the window).
const closeFrom = (closes, date) => closes.find((c) => c.date >= date)?.close ?? null;

function annualized(closes, years) {
  const start = closeFrom(closes, daysAgo(years * 365));
  const last = closes.at(-1)?.close;
  // Only when the history really covers the whole window.
  if (!start || !last || closes[0].date > daysAgo(years * 365 - 7)) return null;
  return ((last / start) ** (1 / years) - 1) * 100;
}

function dailyReturns(closes) {
  const out = new Map();
  for (let i = 1; i < closes.length; i++) out.set(closes[i].date, closes[i].close / closes[i - 1].close - 1);
  return out;
}

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const stdev = (xs) => {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) ** 2, 0) / (xs.length - 1));
};

// Largest peak-to-trough fall in the period, as a negative percentage.
function maxDrawdown(closes) {
  let peak = -Infinity;
  let worst = 0;
  for (const { close } of closes) {
    peak = Math.max(peak, close);
    worst = Math.min(worst, close / peak - 1);
  }
  return closes.length ? worst * 100 : null;
}

function correlation(a, b) {
  const pairs = [...a.keys()].filter((d) => b.has(d)).map((d) => [a.get(d), b.get(d)]);
  if (pairs.length < 60) return null;
  const xs = pairs.map((p) => p[0]);
  const ys = pairs.map((p) => p[1]);
  const mx = mean(xs);
  const my = mean(ys);
  let cov = 0;
  for (const [x, y] of pairs) cov += (x - mx) * (y - my);
  return cov / (pairs.length - 1) / (stdev(xs) * stdev(ys));
}

const FREQUENCY = [[11, "Mensual"], [3.5, "Trimestral"], [1.5, "Semestral"], [0.5, "Anual"]];

// Indicators for ETFs (and crypto, which shares the price-based ones), built
// from price history so they work without Yahoo's crumb. Expense ratio, size
// and holdings need quoteSummary: included only when the host can get it.
export async function fundIndicators(symbol, quote) {
  const isEtf = quote.quoteType === "ETF" || quote.quoteType === "MUTUALFUND";
  // Crypto trades every day: annualize with 365 days instead of 252.
  const periodsPerYear = quote.quoteType === "CRYPTOCURRENCY" ? 365 : 252;
  const [hist, bench, beta, [rf], summary] = await Promise.all([
    dailyHistory(symbol, daysAgo(5 * 365 + 10)),
    dailyHistory("^GSPC", daysAgo(400)),
    betaOf(symbol),
    quotes(["^IRX"]),
    isEtf ? optionalSummary(symbol, ["fundProfile", "topHoldings", "summaryDetail", "defaultKeyStatistics"]) : {},
  ]);
  const closes = hist.closes;
  const last = closes.at(-1)?.close;
  const year = closes.filter((c) => c.date >= daysAgo(365));
  const yearReturns = [...dailyReturns(year).values()];
  const volatility = yearReturns.length > 20 ? stdev(yearReturns) * Math.sqrt(periodsPerYear) * 100 : null;
  const return1y = pct(last, closeFrom(closes, daysAgo(365)));
  // Risk-free rate: 13-week US T-bill yield (^IRX quotes the rate in percent).
  const riskFree = rf?.regularMarketPrice ?? null;

  // Dividends: trailing 12 months over the current (unadjusted) price.
  const price = quote.regularMarketPrice;
  const ttmDivs = hist.dividends.filter((d) => d.date >= daysAgo(365));
  const ttmAmount = ttmDivs.reduce((s, d) => s + d.amount, 0);
  const perYear = hist.dividends.filter((d) => d.date >= daysAgo(3 * 365)).length / 3;
  const lastDiv = hist.dividends.at(-1);

  const fp = summary.fundProfile ?? {};
  const sd = summary.summaryDetail ?? {};
  const ks = summary.defaultKeyStatistics ?? {};
  const th = summary.topHoldings ?? {};
  const expense = num(fp.feesExpensesInvestment?.annualReportExpenseRatio) ?? num(ks.annualReportExpenseRatio);

  return {
    kind: isEtf ? "etf" : "crypto",
    returns: {
      "1M": pct(last, closeFrom(closes, daysAgo(30))),
      "3M": pct(last, closeFrom(closes, daysAgo(91))),
      YTD: pct(last, closeFrom(closes, `${new Date().getFullYear()}-01-01`)),
      "1A": return1y,
      "3A anual": annualized(closes, 3),
      "5A anual": annualized(closes, 5),
    },
    risk: {
      volatility,
      maxDrawdown1y: maxDrawdown(year),
      maxDrawdown5y: maxDrawdown(closes),
      beta,
      correlation: correlation(dailyReturns(year), dailyReturns(bench.closes)),
      sharpe: volatility && return1y != null && riskFree != null ? (return1y - riskFree) / volatility : null,
      riskFree,
    },
    dividends: {
      yield: price && ttmAmount ? (ttmAmount / price) * 100 : isEtf ? 0 : null,
      ttmAmount: ttmAmount || null,
      frequency: perYear ? FREQUENCY.find(([n]) => perYear >= n)?.[1] ?? "Irregular" : null,
      last: lastDiv ?? null,
    },
    inception: quote.firstTradeDate ?? null,
    // Present only where Yahoo's quoteSummary is reachable (not on cloud hosts).
    fund: isEtf
      ? {
          available: Boolean(summary.fundProfile || summary.summaryDetail),
          family: fp.family ?? null,
          category: fp.categoryName ?? null,
          expenseRatio: expense != null ? expense * 100 : null,
          totalAssets: num(sd.totalAssets) ?? num(ks.totalAssets),
          holdings: (th.holdings ?? []).slice(0, 10).map((h) => ({ symbol: h.symbol, name: h.holdingName, weight: num(h.holdingPercent) * 100 })),
          sectors: (th.sectorWeightings ?? [])
            .flatMap((o) => Object.entries(o))
            .map(([sector, w]) => ({ sector, weight: num(w) * 100 }))
            .filter((s) => s.weight > 0)
            .sort((a, b) => b.weight - a.weight),
        }
      : null,
  };
}
