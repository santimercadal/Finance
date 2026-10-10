import { cached, fxPerUsd, insights, optionalSummary, HOUR } from "./yahoo.js";
import { companySnapshot, fundamentals } from "./company.js";
import { num, changePct, isoDate } from "./util.js";

// Analysts' forecasts for a stock: price target, recommendations, EPS (and
// revenue when available) for the coming quarters and fiscal years, recent
// earnings surprises, plus the price each EPS forecast implies at today's P/E.
//
// Sources, best first: Yahoo's quoteSummary (complete, but needs the crumb
// that cloud hosts don't get), Nasdaq's public analyst API (EPS and targets,
// US listings), and Argus' price target from Yahoo's research feed.

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const fiscalLabel = (date, kind) => {
  const d = new Date(`${date}T12:00:00`);
  return kind === "year" ? `Año fiscal ${d.getFullYear()} (cierra ${MONTHS[d.getMonth()]})` : `Trimestre al ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
};

const range = (e) =>
  e && num(e.avg) != null
    ? { avg: e.avg, low: num(e.low), high: num(e.high), analysts: num(e.numberOfAnalysts), growth: num(e.growth) != null ? e.growth * 100 : null }
    : null;

async function fromYahoo(symbol) {
  const s = await optionalSummary(symbol, ["earningsTrend", "financialData", "recommendationTrend", "earningsHistory"]);
  const trend = s.earningsTrend?.trend ?? [];
  if (!trend.length && !s.financialData) return null;
  const fd = s.financialData ?? {};
  const rec = s.recommendationTrend?.trend?.find((t) => t.period === "0m");
  return {
    source: "Yahoo Finance",
    epsCurrency: trend.find((t) => t.earningsEstimate?.earningsCurrency)?.earningsEstimate.earningsCurrency ?? null,
    target: num(fd.targetMeanPrice) != null
      ? { low: num(fd.targetLowPrice), mean: fd.targetMeanPrice, high: num(fd.targetHighPrice), analysts: num(fd.numberOfAnalystOpinions) }
      : null,
    ratings: rec ? { strongBuy: rec.strongBuy, buy: rec.buy, hold: rec.hold, sell: rec.sell, strongSell: rec.strongSell } : null,
    periods: trend
      .filter((t) => /^[0+]1?[qy]$/.test(t.period) && t.endDate)
      .map((t) => {
        const kind = t.period.endsWith("y") ? "year" : "quarter";
        const end = isoDate(t.endDate);
        return {
          kind,
          end,
          label: fiscalLabel(end, kind),
          eps: range(t.earningsEstimate),
          epsYearAgo: num(t.earningsEstimate?.yearAgoEps),
          revenue: range(t.revenueEstimate),
          revisions: t.epsRevisions ? { up: num(t.epsRevisions.upLast30days) ?? 0, down: num(t.epsRevisions.downLast30days) ?? 0 } : null,
        };
      })
      .filter((p) => p.eps),
    surprises: (s.earningsHistory?.history ?? [])
      .filter((h) => num(h.epsActual) != null && num(h.epsEstimate) != null && h.quarter)
      .map((h) => ({ quarter: isoDate(h.quarter), actual: h.epsActual, estimate: h.epsEstimate, surprisePct: num(h.surprisePercent) != null ? h.surprisePercent * 100 : null })),
  };
}

const NASDAQ_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36",
  Accept: "application/json",
  Origin: "https://www.nasdaq.com",
  Referer: "https://www.nasdaq.com/",
};

async function nasdaqJson(path) {
  const res = await fetch(`https://api.nasdaq.com/api/${path}`, { headers: NASDAQ_HEADERS, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Nasdaq HTTP ${res.status}`);
  return (await res.json())?.data ?? null;
}

// "Sep 2026" -> last day of that month, YYYY-MM-DD
const monthEnd = (s) => {
  const [mon, year] = String(s).split(" ");
  const m = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"].indexOf(mon?.toLowerCase());
  return m >= 0 && year ? isoDate(Date.UTC(Number(year), m + 1, 0)) : null;
};

async function fromNasdaq(symbol) {
  // Nasdaq only covers US listings (no exchange suffix like .PA or .L).
  if (/[.=^]/.test(symbol.replace(/\.[AB]$/, ""))) return null;
  const sym = encodeURIComponent(symbol.toLowerCase());
  const [forecast, target] = await Promise.all([
    nasdaqJson(`analyst/${sym}/earnings-forecast`).catch(() => null),
    nasdaqJson(`analyst/${sym}/targetprice`).catch(() => null),
  ]);
  const rows = (kind, list) =>
    (list ?? []).slice(0, kind === "year" ? 4 : 2).map((r) => {
      const end = monthEnd(r.fiscalEnd);
      return {
        kind,
        end,
        label: end ? fiscalLabel(end, kind) : r.fiscalEnd,
        eps: num(r.consensusEPSForecast) != null
          ? { avg: r.consensusEPSForecast, low: num(r.lowEPSForecast), high: num(r.highEPSForecast), analysts: num(r.noOfEstimates), growth: null }
          : null,
        epsYearAgo: null,
        revenue: null,
        revisions: { up: num(r.up) ?? 0, down: num(r.down) ?? 0 },
      };
    }).filter((p) => p.eps);
  const periods = [...rows("quarter", forecast?.quarterlyForecast?.rows), ...rows("year", forecast?.yearlyForecast?.rows)];
  const c = target?.consensusOverview;
  if (!periods.length && !c) return null;
  return {
    source: "Nasdaq",
    epsCurrency: "USD",
    target: num(c?.priceTarget) != null ? { low: num(c.lowPriceTarget), mean: c.priceTarget, high: num(c.highPriceTarget), analysts: null } : null,
    ratings: c ? { strongBuy: 0, buy: num(c.buy) ?? 0, hold: num(c.hold) ?? 0, sell: num(c.sell) ?? 0, strongSell: 0 } : null,
    periods,
    surprises: [],
  };
}

export function stockEstimates(symbol) {
  symbol = symbol.toUpperCase();
  return cached(`estimates:${symbol}`, 6 * HOUR, async () => {
    const [snap, yahoo, annual, research] = await Promise.all([
      companySnapshot(symbol),
      fromYahoo(symbol).catch(() => null),
      fundamentals(symbol, "annual").catch(() => []),
      insights(symbol).catch(() => ({})),
    ]);
    const data = yahoo?.periods.length ? yahoo : (await fromNasdaq(symbol).catch(() => null)) ?? yahoo;

    const price = snap.quote.regularMarketPrice;
    const currency = snap.quote.currency;
    const pe = snap.metrics.pe;
    // Forecasts are in the reporting currency; convert to the trading currency
    // before pricing them (ADRs such as TSM report in TWD).
    const epsCurrency = data?.epsCurrency ?? snap.financialCurrency ?? currency;
    const fx = epsCurrency && currency && epsCurrency !== currency ? (await fxPerUsd(currency)) / (await fxPerUsd(epsCurrency)) : 1;

    // Reported annual EPS, to draw the history before the forecasts. Skipped
    // when the statements use another currency or share unit than the
    // forecasts (ADRs such as TSM report per local share in TWD).
    const sameUnit = !snap.financialCurrency || snap.financialCurrency === epsCurrency;
    const history = sameUnit
      ? annual
          .filter((r) => num(r.dilutedEPS ?? r.basicEPS) != null)
          .map((r) => ({ end: r.date, eps: r.dilutedEPS ?? r.basicEPS }))
          .slice(-5)
      : [];

    let prevYearEps = history.at(-1)?.eps;
    const periods = (data?.periods ?? []).map((p) => {
      let { eps } = p;
      if (p.kind === "year") {
        // Nasdaq doesn't give growth: measure it against the previous fiscal year.
        if (eps.growth == null && prevYearEps > 0) eps = { ...eps, growth: changePct(eps.avg, prevYearEps) };
        prevYearEps = eps.avg;
      }
      const implied = p.kind === "year" && pe != null ? eps.avg * fx * pe : null;
      return { ...p, eps, impliedPrice: implied, impliedUpside: changePct(implied, price) };
    });

    const argus = research.recommendation;
    const target = data?.target ?? (num(argus?.targetPrice) != null ? { low: null, mean: argus.targetPrice, high: null, analysts: 1 } : null);

    return {
      symbol,
      currency,
      epsCurrency,
      price,
      pe,
      source: data?.source ?? null,
      target: target && { ...target, upside: changePct(target.mean, price), source: data?.target ? data.source : argus?.provider ?? null },
      argus: num(argus?.targetPrice) != null ? { target: argus.targetPrice, rating: argus.rating ?? null } : null,
      ratings: data?.ratings ?? null,
      periods,
      surprises: data?.surprises ?? [],
      history,
    };
  });
}
