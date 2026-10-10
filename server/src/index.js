import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import { yf, cached, quotes, MIN } from "./yahoo.js";
import { portfolioSnapshot, portfolioHistory, loadHoldings, saveHoldings, upsertHolding, removeHolding } from "./portfolio.js";
import { stockDetail, stockReports } from "./stock.js";
import { peerComparison } from "./peers.js";
import { isSecDocument, SEC_HEADERS } from "./sec.js";
import { newsFeed, articleSummary, dailyDigest } from "./news.js";
import { aiEnabled, aiProvider } from "./ai.js";
import { storageKind, storageWritable, getJSON, setJSON } from "./storage.js";
import { etoroEnabled, etoroHoldings } from "./etoro.js";
import { analystView } from "./analysts.js";
import { httpError } from "./util.js";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "200kb" }));

// Optional password: when APP_PASSWORD is set every /api call (except health)
// must send it in the x-app-key header. Required when the app is public.
const PASSWORD = process.env.APP_PASSWORD ?? "";
const sameSecret = (a, b) => {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};
app.use("/api", (req, res, next) => {
  if (!PASSWORD || req.path === "/health") return next();
  if (sameSecret(String(req.get("x-app-key") ?? ""), PASSWORD)) return next();
  res.status(401).json({ error: "Contraseña requerida", auth: true });
});

const INDICATORS = [
  { symbol: "^GSPC", label: "S&P 500" },
  { symbol: "^IXIC", label: "Nasdaq" },
  { symbol: "^DJI", label: "Dow Jones" },
  { symbol: "^VIX", label: "VIX" },
  { symbol: "^TNX", label: "Bono 10A EE.UU.", unit: "%" },
  { symbol: "DX-Y.NYB", label: "Dólar (DXY)" },
  { symbol: "GC=F", label: "Oro" },
  { symbol: "CL=F", label: "Petróleo WTI" },
  { symbol: "BTC-USD", label: "Bitcoin" },
];

const wrap = (fn) => async (req, res) => {
  try {
    res.json(await fn(req, res));
  } catch (err) {
    console.error(req.method, req.url, err.message);
    res.status(err.status ?? 500).json({ error: err.message });
  }
};

app.get("/api/health", async (_req, res) => {
  res.json({ ok: true, ai: aiProvider, auth: Boolean(PASSWORD), storage: storageKind, storageWritable: await storageWritable() });
});
app.get("/api/auth/check", (_req, res) => res.json({ ok: true }));

app.get("/api/market", wrap(async () => {
  const qs = await quotes(INDICATORS.map((i) => i.symbol));
  const bySym = Object.fromEntries(qs.map((q) => [q.symbol, q]));
  return INDICATORS.map((i) => {
    const q = bySym[i.symbol] ?? {};
    return {
      ...i,
      price: q.regularMarketPrice ?? null,
      change: q.regularMarketChange ?? null,
      changePct: q.regularMarketChangePercent ?? null,
    };
  });
}));

app.get("/api/portfolio", wrap(() => portfolioSnapshot()));
app.get("/api/portfolio/history", wrap(() => portfolioHistory()));
app.post("/api/portfolio", wrap(async (req) => {
  const { symbol, shares, avgCost } = req.body ?? {};
  if (!symbol || !(Number(shares) > 0) || !(Number(avgCost) >= 0)) {
    throw httpError(400, "Datos inválidos: se requiere símbolo, cantidad > 0 y costo promedio");
  }
  const [q] = await quotes([String(symbol).toUpperCase()]);
  if (!q?.regularMarketPrice) throw httpError(404, `Símbolo no encontrado: ${symbol}`);
  return upsertHolding({ symbol, shares, avgCost });
}));
app.delete("/api/portfolio/:symbol", wrap((req) => removeHolding(req.params.symbol)));

// Replaces the whole portfolio (bulk import). Repeated symbols are merged with a
// weighted average cost; every symbol must exist on Yahoo Finance unless
// `skipMissing` is set, in which case unknown symbols are left out and returned.
async function replaceHoldings(rows, { skipMissing = false } = {}) {
  const merged = new Map();
  for (const r of rows) {
    const symbol = String(r.symbol ?? "").trim().toUpperCase();
    const shares = Number(r.shares);
    const avgCost = Number(r.avgCost);
    if (!symbol || !(shares > 0) || !(avgCost >= 0)) {
      throw httpError(400, `Fila inválida: ${JSON.stringify(r)}`);
    }
    const prev = merged.get(symbol);
    if (prev) {
      const total = prev.shares + shares;
      merged.set(symbol, { symbol, shares: total, avgCost: (prev.avgCost * prev.shares + avgCost * shares) / total });
    } else {
      merged.set(symbol, { symbol, shares, avgCost });
    }
  }
  if (!merged.size) throw httpError(400, "La lista está vacía");
  const found = new Set((await quotes([...merged.keys()])).map((q) => q.symbol.toUpperCase()));
  const missing = [...merged.keys()].filter((s) => !found.has(s));
  if (missing.length && !skipMissing) {
    throw httpError(404, `No se encontraron en Yahoo Finance: ${missing.join(", ")}`);
  }
  const holdings = [...merged.values()].filter((h) => found.has(h.symbol));
  if (!holdings.length) throw httpError(404, "Ninguna posición se encontró en Yahoo Finance");
  await saveHoldings(holdings);
  return { holdings, missing };
}

app.put("/api/portfolio", wrap(async (req) => {
  const rows = Array.isArray(req.body?.holdings) ? req.body.holdings : [];
  return (await replaceHoldings(rows)).holdings;
}));

// Replaces the portfolio with the open positions of the eToro real account.
app.post("/api/portfolio/sync/etoro", wrap(async () => {
  const { holdings: rows, skipped, shorts, cash } = await etoroHoldings();
  if (!rows.length) throw httpError(404, "La cuenta de eToro no tiene posiciones abiertas");
  const { holdings, missing } = await replaceHoldings(rows, { skipMissing: true });
  const names = new Map(rows.map((r) => [r.symbol, r.name]));
  await setJSON("etoro-last-sync", { at: new Date().toISOString(), count: holdings.length }).catch(() => {});
  return {
    count: holdings.length,
    skipped: [...skipped, ...missing.map((s) => `${names.get(s) ?? s} (${s})`)],
    shorts,
    cash,
  };
}));
app.get("/api/portfolio/sync/etoro", wrap(async () => ({
  enabled: etoroEnabled,
  lastSync: await getJSON("etoro-last-sync").catch(() => null),
})));

app.get("/api/stock/:symbol", wrap((req) => stockDetail(req.params.symbol)));
app.get("/api/stock/:symbol/peers", wrap((req) => {
  const extra = String(req.query.add ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5);
  return peerComparison(req.params.symbol, extra);
}));
app.get("/api/stock/:symbol/reports", wrap((req) => stockReports(req.params.symbol)));
app.get("/api/stock/:symbol/analysts", wrap((req) => analystView(req.params.symbol)));

// Analysts' pros and cons for every holding that has coverage.
app.get("/api/analysts", wrap(async () => {
  const symbols = (await loadHoldings()).map((h) => h.symbol);
  const views = await Promise.all(symbols.map((s) => analystView(s)));
  return views.filter(Boolean);
}));

// Downloads an SEC filing document. Only the SEC archive is allowed, so this
// can't be used to fetch arbitrary URLs through the server.
app.get("/api/filing", async (req, res) => {
  const url = String(req.query.url ?? "");
  if (!isSecDocument(url)) {
    return res.status(400).json({ error: "URL de informe no válida" });
  }
  try {
    const upstream = await fetch(url, { headers: SEC_HEADERS, signal: AbortSignal.timeout(30_000) });
    if (!upstream.ok) return res.status(502).json({ error: `No se pudo descargar el informe (${upstream.status})` });
    const name = String(req.query.name ?? url.split("/").pop()).replace(/[^\w.-]/g, "_");
    res.set("Content-Type", upstream.headers.get("content-type") ?? "text/html");
    res.set("Content-Disposition", `attachment; filename="${name}"`);
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

app.get("/api/search", wrap(async (req) => {
  const q = String(req.query.q ?? "").trim();
  if (!q) return [];
  return cached(`search:${q}`, 30 * MIN, async () => {
    const res = await yf.search(q, { quotesCount: 8, newsCount: 0 }, { validateResult: false });
    return (res.quotes ?? [])
      .filter((x) => x.symbol && x.isYahooFinance !== false)
      .map((x) => ({ symbol: x.symbol, name: x.shortname || x.longname || x.symbol, type: x.quoteType, exchange: x.exchDisp }));
  });
}));

app.get("/api/news", wrap(async (req) => {
  const symbols = req.query.symbols
    ? String(req.query.symbols).split(",").filter(Boolean)
    : (await loadHoldings()).map((h) => h.symbol);
  const includeMarket = req.query.market !== "0";
  return newsFeed(symbols, { includeMarket, limit: Number(req.query.limit) || 40 });
}));

app.get("/api/news/summary", wrap(async (req) => {
  const url = String(req.query.url ?? "");
  if (!/^https:\/\/([a-z0-9-]+\.)*yahoo\.com\//i.test(url)) {
    // Only fetch article pages from the news source we list, never arbitrary URLs.
    return { summary: null, source: "none" };
  }
  return articleSummary(url, String(req.query.title ?? ""));
}));

app.get("/api/news/digest", wrap(async () => {
  const symbols = (await loadHoldings()).map((h) => h.symbol);
  const news = await newsFeed(symbols);
  return { digest: await dailyDigest(news), ai: aiEnabled };
}));

// In production the API also serves the built web app (client/dist).
const here = path.dirname(fileURLToPath(import.meta.url));
const webDist = path.join(here, "..", "..", "client", "dist");
if (fs.existsSync(webDist)) {
  // Built files have a content hash in their name, so they never change: cache for good.
  app.use("/assets", express.static(path.join(webDist, "assets"), { immutable: true, maxAge: "1y" }));
  app.use(express.static(webDist, { index: false, maxAge: "1h" }));
  // index.html is revalidated on every visit so a new deploy shows up right away.
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html"), { headers: { "Cache-Control": "no-cache" } }));
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT} (resúmenes IA: ${aiProvider ?? "no"})`);
});
