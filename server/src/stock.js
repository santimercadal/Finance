import { yf, cached, quotes, dailyCloses, MIN, HOUR } from "./yahoo.js";

const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
const div = (a, b) => (num(a) != null && num(b) ? a / b : null);
const first = (row, ...keys) => {
  for (const k of keys) if (num(row?.[k]) != null) return row[k];
  return null;
};

function fundamentals(symbol, type) {
  const years = type === "annual" ? 6 : 2;
  const period1 = new Date(Date.now() - years * 365 * 864e5).toISOString().slice(0, 10);
  return cached(`fts:${symbol}:${type}`, 6 * HOUR, async () => {
    const rows = await yf.fundamentalsTimeSeries(
      symbol,
      { period1, type, module: "all" },
      { validateResult: false },
    );
    return rows
      .filter((r) => r.date)
      .map((r) => ({ ...r, date: new Date(r.date).toISOString().slice(0, 10) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  });
}

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
    liabilitiesPct: div(totalLiabilities, totalAssets) * 100 || null,
    equityPct: div(equity, totalAssets) * 100 || null,
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

const FILING_LABELS = {
  "10-Q": "Informe trimestral (10-Q)",
  "10-K": "Informe anual (10-K)",
  "6-K": "Informe de emisor extranjero (6-K)",
  "20-F": "Informe anual extranjero (20-F)",
  "40-F": "Informe anual extranjero (40-F)",
  "8-K": "Hecho relevante (8-K)",
};

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
  const [summary, quarterly, [quote]] = await Promise.all([
    cached(`filings:${symbol}`, 6 * HOUR, () =>
      yf.quoteSummary(symbol, { modules: ["secFilings", "calendarEvents"] }, { validateResult: false }),
    ).catch(() => ({})),
    fundamentals(symbol, "quarterly").catch(() => []),
    quotes([symbol]),
  ]);
  const filings = (summary.secFilings?.filings ?? [])
    .filter((f) => FILING_LABELS[f.type])
    .slice(0, 20)
    .map((f) => {
      const main = f.exhibits?.find((e) => e.type === f.type) ?? f.exhibits?.[0];
      return {
        date: new Date(f.date ?? f.epochDate).toISOString().slice(0, 10),
        type: f.type,
        label: FILING_LABELS[f.type],
        title: f.title,
        documentUrl: main?.url ?? null,
        viewUrl: f.edgarUrl ?? null,
      };
    });
  const quarters = quarterly.slice(-8);
  const earningsDate = summary.calendarEvents?.earnings?.earningsDate?.[0];
  return {
    symbol,
    name: quote?.longName || quote?.shortName || symbol,
    currency: quote?.financialCurrency || quote?.currency,
    nextEarnings: earningsDate ? new Date(earningsDate).toISOString().slice(0, 10) : null,
    filings,
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

export async function stockDetail(symbol) {
  symbol = symbol.toUpperCase();
  const start = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 10);
  const [quote, summary, annual, quarterly, chart] = await Promise.all([
    quotes([symbol]).then((q) => q[0]),
    cached(`qs:${symbol}`, 30 * MIN, () =>
      yf.quoteSummary(
        symbol,
        { modules: ["assetProfile", "financialData", "defaultKeyStatistics", "summaryDetail"] },
        { validateResult: false },
      ),
    ).catch(() => ({})),
    fundamentals(symbol, "annual").catch(() => []),
    fundamentals(symbol, "quarterly").catch(() => []),
    dailyCloses(symbol, start).catch(() => []),
  ]);
  if (!quote) {
    const err = new Error(`No se encontró el símbolo ${symbol}`);
    err.status = 404;
    throw err;
  }

  const fd = summary.financialData ?? {};
  const ks = summary.defaultKeyStatistics ?? {};
  const sd = summary.summaryDetail ?? {};
  const ap = summary.assetProfile ?? {};

  const annualBalances = annual.filter((r) => num(r.totalAssets) != null).map(balance);
  const latestQuarter = [...quarterly].reverse().find((r) => num(r.totalAssets) != null);

  return {
    symbol,
    quote: {
      name: quote.longName || quote.shortName || symbol,
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
      sector: ap.sector,
      industry: ap.industry,
      country: ap.country,
      employees: ap.fullTimeEmployees,
      website: ap.website,
      description: ap.longBusinessSummary,
    },
    keyStats: {
      pe: num(sd.trailingPE) ?? num(quote.trailingPE),
      forwardPe: num(sd.forwardPE) ?? num(quote.forwardPE),
      pb: num(ks.priceToBook),
      evToEbitda: num(ks.enterpriseToEbitda),
      dividendYield: num(sd.dividendYield) != null ? sd.dividendYield * 100 : null,
      beta: num(sd.beta) ?? num(ks.beta),
      roe: num(fd.returnOnEquity) != null ? fd.returnOnEquity * 100 : null,
      roa: num(fd.returnOnAssets) != null ? fd.returnOnAssets * 100 : null,
      grossMargin: num(fd.grossMargins) != null ? fd.grossMargins * 100 : null,
      operatingMargin: num(fd.operatingMargins) != null ? fd.operatingMargins * 100 : null,
      profitMargin: num(fd.profitMargins) != null ? fd.profitMargins * 100 : null,
      revenueGrowth: num(fd.revenueGrowth) != null ? fd.revenueGrowth * 100 : null,
      currentRatio: num(fd.currentRatio),
      quickRatio: num(fd.quickRatio),
      targetMean: num(fd.targetMeanPrice),
      recommendation: fd.recommendationKey,
      analysts: num(fd.numberOfAnalystOpinions),
      financialCurrency: fd.financialCurrency || quote.financialCurrency || quote.currency,
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
