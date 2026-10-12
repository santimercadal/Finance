import { dailyCloses, optionalSummary, quotes, profileOf } from "./yahoo.js";
import { fundIndicators } from "./etf.js";
import { fundamentals, companySnapshot } from "./company.js";
import { secFilings } from "./sec.js";
import { num, div, ratioPct, daysAgo, isoDate } from "./util.js";

const first = (row, ...keys) => {
  for (const k of keys) if (num(row?.[k]) != null) return row[k];
  return null;
};

function balance(r) {
  const totalAssets = first(r, "totalAssets");
  const totalLiabilities = first(r, "totalLiabilitiesNetMinorityInterest");
  const equity = first(r, "stockholdersEquity", "totalEquityGrossMinorityInterest", "commonStockEquity");
  return {
    date: r.date,
    totalAssets,
    currentAssets: first(r, "currentAssets"),
    nonCurrentAssets: first(r, "totalNonCurrentAssets"),
    cash: first(r, "cashCashEquivalentsAndShortTermInvestments", "cashAndCashEquivalents"),
    receivables: first(r, "receivables", "accountsReceivable"),
    inventory: first(r, "inventory"),
    ppe: first(r, "netPPE"),
    intangibles: first(r, "goodwillAndOtherIntangibleAssets"),
    totalLiabilities,
    currentLiabilities: first(r, "currentLiabilities"),
    nonCurrentLiabilities: first(r, "totalNonCurrentLiabilitiesNetMinorityInterest"),
    payables: first(r, "accountsPayable", "payables"),
    currentDebt: first(r, "currentDebtAndCapitalLeaseObligation", "currentDebt"),
    longTermDebt: first(r, "longTermDebtAndCapitalLeaseObligation", "longTermDebt"),
    totalDebt: first(r, "totalDebt"),
    equity,
    assetsPct: 100,
    liabilitiesPct: ratioPct(totalLiabilities, totalAssets),
    equityPct: ratioPct(equity, totalAssets),
    currentRatio: div(first(r, "currentAssets"), first(r, "currentLiabilities")),
    debtToEquity: div(first(r, "totalDebt"), equity),
    workingCapital: first(r, "workingCapital"),
  };
}

function cashFlow(r) {
  const capex = first(r, "capitalExpenditure");
  const ocf = first(r, "operatingCashFlow", "cashFlowFromContinuingOperatingActivities");
  return {
    date: r.date,
    operating: ocf,
    investing: first(r, "investingCashFlow", "cashFlowFromContinuingInvestingActivities"),
    financing: first(r, "financingCashFlow", "cashFlowFromContinuingFinancingActivities"),
    capex,
    freeCashFlow: first(r, "freeCashFlow") ?? (ocf != null && capex != null ? ocf + capex : null),
    dividends: first(r, "cashDividendsPaid"),
    buybacks: first(r, "repurchaseOfCapitalStock"),
    debtIssued: first(r, "issuanceOfDebt"),
    debtRepaid: first(r, "repaymentOfDebt"),
    netChange: first(r, "changesInCash"),
    endCash: first(r, "endCashPosition"),
    netIncome: first(r, "netIncome", "netIncomeCommonStockholders"),
    revenue: first(r, "totalRevenue", "operatingRevenue"),
  };
}

// Cost of debt per fiscal year = interest expense / average total debt.
function debtCost(rows) {
  return rows.map((r, i) => {
    const prev = rows[i - 1];
    const debt = first(r, "totalDebt");
    const prevDebt = first(prev, "totalDebt");
    const avgDebt = debt != null && prevDebt != null ? (debt + prevDebt) / 2 : debt;
    const interest = Math.abs(first(r, "interestExpense", "interestExpenseNonOperating") ?? NaN);
    const interestOk = Number.isFinite(interest) && interest > 0 ? interest : null;
    const ebit = first(r, "EBIT", "operatingIncome");
    const ebitda = first(r, "EBITDA", "normalizedEBITDA");
    const pretax = first(r, "pretaxIncome");
    const taxRate =
      first(r, "taxRateForCalcs") ??
      (pretax > 0 && first(r, "taxProvision") != null ? r.taxProvision / pretax : null);
    const kd = div(interestOk, avgDebt);
    const equity = first(r, "stockholdersEquity", "commonStockEquity");
    const netDebt = first(r, "netDebt") ?? (debt != null ? debt - (first(r, "cashCashEquivalentsAndShortTermInvestments") ?? 0) : null);
    return {
      date: r.date,
      totalDebt: debt,
      netDebt,
      interestExpense: interestOk,
      costOfDebt: kd != null ? kd * 100 : null,
      taxRate: taxRate != null ? taxRate * 100 : null,
      afterTaxCostOfDebt: kd != null && taxRate != null ? kd * (1 - taxRate) * 100 : null,
      interestCoverage: div(ebit, interestOk),
      debtToEquity: div(debt, equity),
      netDebtToEbitda: div(netDebt, ebitda),
      debtToAssets: div(debt, first(r, "totalAssets")),
      ebit,
      ebitda,
    };
  });
}

// Line items exported in the quarterly report download, in display order.
const QUARTERLY_ITEMS = [
  ["Ingresos", "totalRevenue"],
  ["Costo de ventas", "costOfRevenue"],
  ["Ganancia bruta", "grossProfit"],
  ["Resultado operativo", "operatingIncome"],
  ["EBITDA", "EBITDA"],
  ["Gastos por intereses", "interestExpense"],
  ["Resultado neto", "netIncome"],
  ["BPA diluido", "dilutedEPS"],
  ["Activo corriente", "currentAssets"],
  ["Activo total", "totalAssets"],
  ["Pasivo corriente", "currentLiabilities"],
  ["Pasivo total", "totalLiabilitiesNetMinorityInterest"],
  ["Patrimonio neto", "stockholdersEquity"],
  ["Caja e inversiones CP", "cashCashEquivalentsAndShortTermInvestments"],
  ["Deuda total", "totalDebt"],
  ["Flujo operativo", "operatingCashFlow"],
  ["CapEx", "capitalExpenditure"],
  ["Flujo libre (FCF)", "freeCashFlow"],
  ["Dividendos pagados", "cashDividendsPaid"],
  ["Recompra de acciones", "repurchaseOfCapitalStock"],
];

export async function stockReports(symbol) {
  symbol = symbol.toUpperCase();
  const [sec, quarterly, snap, extra] = await Promise.all([
    secFilings(symbol).catch(() => ({ available: false, reason: "No se pudo consultar la SEC en este momento.", filings: [] })),
    fundamentals(symbol, "quarterly").catch(() => []),
    companySnapshot(symbol),
    optionalSummary(symbol, ["calendarEvents"]),
  ]);
  const quarters = quarterly.slice(-8);
  const earningsDate = extra.calendarEvents?.earnings?.earningsDate?.[0];
  return {
    symbol,
    name: snap.profile.name,
    currency: snap.financialCurrency,
    nextEarnings: earningsDate ? isoDate(earningsDate) : null,
    filings: sec.filings,
    sec: { available: sec.available, reason: sec.reason },
    quarterly: {
      dates: quarters.map((q) => q.date),
      rows: QUARTERLY_ITEMS.map(([label, key]) => ({
        label,
        key,
        values: quarters.map((q) => num(q[key])),
      })).filter((r) => r.values.some((v) => v != null)),
    },
  };
}

const FUND_TYPES = new Set(["ETF", "MUTUALFUND", "CRYPTOCURRENCY"]);

// ETFs and crypto have no financial statements: price-based indicators instead.
async function fundDetail(symbol, quote, start) {
  const [indicators, profile, chart] = await Promise.all([
    fundIndicators(symbol, quote),
    profileOf(symbol).catch(() => ({})),
    dailyCloses(symbol, start).catch(() => []),
  ]);
  return {
    symbol,
    kind: indicators.kind,
    quote: {
      name: quote.longName || quote.shortName || profile.longname || symbol,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePct: quote.regularMarketChangePercent,
      currency: quote.currency,
      exchange: quote.fullExchangeName,
      marketCap: null,
      marketState: quote.marketState,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
    },
    profile: {},
    keyStats: { financialCurrency: quote.currency },
    balance: { latest: null, history: [] },
    cashFlow: [],
    debt: [],
    chart,
    fund: indicators,
  };
}

export async function stockDetail(symbol) {
  symbol = symbol.toUpperCase();
  const start = daysAgo(365);
  const [q] = await quotes([symbol]);
  if (q && FUND_TYPES.has(q.quoteType)) return fundDetail(symbol, q, start);
  const [snap, extra, annual, quarterly, chart] = await Promise.all([
    companySnapshot(symbol),
    // Description and analyst consensus need Yahoo's crumb: present locally, may be missing on cloud hosts.
    optionalSummary(symbol, ["assetProfile", "financialData"]),
    fundamentals(symbol, "annual").catch(() => []),
    fundamentals(symbol, "quarterly").catch(() => []),
    dailyCloses(symbol, start).catch(() => []),
  ]);
  const { quote, profile, metrics } = snap;
  const fd = extra.financialData ?? {};
  const ap = extra.assetProfile ?? {};

  const annualBalances = annual.filter((r) => num(r.totalAssets) != null).map(balance);
  const latestQuarter = [...quarterly].reverse().find((r) => num(r.totalAssets) != null);

  return {
    symbol,
    kind: "equity",
    quote: {
      name: profile.name,
      price: quote.regularMarketPrice,
      change: quote.regularMarketChange,
      changePct: quote.regularMarketChangePercent,
      currency: quote.currency,
      exchange: quote.fullExchangeName,
      marketCap: quote.marketCap,
      marketState: quote.marketState,
      fiftyTwoWeekLow: quote.fiftyTwoWeekLow,
      fiftyTwoWeekHigh: quote.fiftyTwoWeekHigh,
    },
    profile: {
      sector: profile.sector ?? ap.sector,
      industry: profile.industry ?? ap.industry,
      country: ap.country,
      employees: ap.fullTimeEmployees,
      website: ap.website,
      description: ap.longBusinessSummary,
    },
    keyStats: {
      ...metrics,
      targetMean: num(fd.targetMeanPrice),
      recommendation: fd.recommendationKey,
      analysts: num(fd.numberOfAnalystOpinions),
      financialCurrency: snap.financialCurrency,
    },
    balance: {
      latest: latestQuarter ? balance(latestQuarter) : annualBalances.at(-1) ?? null,
      history: annualBalances,
    },
    cashFlow: annual.filter((r) => num(r.operatingCashFlow) != null || num(r.freeCashFlow) != null).map(cashFlow),
    debt: debtCost(annual.filter((r) => num(r.totalAssets) != null)),
    chart,
  };
}
