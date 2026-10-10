import crypto from "node:crypto";
import { httpError } from "./util.js";

// eToro Public API (read-only use): https://api-portal.etoro.com
// Keys are created in eToro > Settings > Trading > API Key Management.
const BASE = "https://public-api.etoro.com";
const API_KEY = process.env.ETORO_API_KEY;
const USER_KEY = process.env.ETORO_USER_KEY;
export const etoroEnabled = Boolean(API_KEY && USER_KEY);

const TYPE_CRYPTO = 10;

async function etoroGet(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "x-api-key": API_KEY, "x-user-key": USER_KEY, "x-request-id": crypto.randomUUID() },
    signal: AbortSignal.timeout(20_000),
  });
  if (res.status === 401 || res.status === 403) {
    throw httpError(502, "eToro rechazó las claves de API (revisa ETORO_API_KEY y ETORO_USER_KEY)");
  }
  if (res.status === 429) {
    throw httpError(429, "eToro: demasiadas solicitudes, intenta en un minuto");
  }
  if (!res.ok) throw httpError(502, `eToro respondió ${res.status}`);
  return res.json();
}

// Groups open positions (own + copy-trading) by instrument: total units and
// unit-weighted average open rate (in the asset's currency). Short positions
// can't be represented as holdings, so they are reported as skipped.
function aggregatePositions(portfolio) {
  const own = portfolio?.positions ?? [];
  const copied = (portfolio?.mirrors ?? []).flatMap((m) => m.positions ?? []);
  const byInstrument = new Map();
  let shorts = 0;
  for (const p of [...own, ...copied]) {
    const id = p.instrumentID ?? p.instrumentId;
    const units = Number(p.units);
    const rate = Number(p.openRate);
    if (!id || !(units > 0) || !(rate > 0)) continue;
    if (p.isBuy === false) { shorts++; continue; }
    const prev = byInstrument.get(id) ?? { instrumentId: id, units: 0, cost: 0 };
    prev.units += units;
    prev.cost += units * rate;
    byInstrument.set(id, prev);
  }
  return {
    positions: [...byInstrument.values()].map((p) => ({ instrumentId: p.instrumentId, units: p.units, avgOpenRate: p.cost / p.units })),
    shorts,
  };
}

// eToro symbol -> Yahoo Finance symbol. Stocks and ETFs mostly share the same
// ticker and exchange suffix (BNP.PA, VOD.L); crypto needs the "-USD" pair.
function yahooSymbol(instrument) {
  const sym = String(instrument.symbolFull ?? "").trim().toUpperCase();
  if (!sym) return null;
  if (instrument.instrumentTypeID === TYPE_CRYPTO) return `${sym.replace(/USD$/, "")}-USD`;
  return sym;
}

// Real account positions as holdings ready to save, plus cash and anything
// that could not be converted.
export async function etoroHoldings() {
  if (!etoroEnabled) {
    throw httpError(400, "Falta configurar ETORO_API_KEY y ETORO_USER_KEY en el servidor (ver README)");
  }
  const pnl = await etoroGet("/api/v1/trading/info/real/pnl");
  const { positions, shorts } = aggregatePositions(pnl.clientPortfolio);
  if (!positions.length) return { holdings: [], skipped: [], shorts, cash: pnl.clientPortfolio?.credit ?? null };

  const ids = positions.map((p) => p.instrumentId).join(",");
  const meta = await etoroGet(`/api/v1/market-data/instruments?instrumentIds=${ids}`);
  const byId = new Map((meta.instrumentDisplayDatas ?? []).map((i) => [i.instrumentID, i]));

  const holdings = [];
  const skipped = [];
  for (const p of positions) {
    const inst = byId.get(p.instrumentId);
    const symbol = inst && yahooSymbol(inst);
    if (!symbol) {
      skipped.push(inst?.instrumentDisplayName ?? `Instrumento ${p.instrumentId}`);
      continue;
    }
    holdings.push({ symbol, shares: p.units, avgCost: p.avgOpenRate, name: inst.instrumentDisplayName });
  }
  return { holdings, skipped, shorts, cash: pnl.clientPortfolio?.credit ?? null };
}
