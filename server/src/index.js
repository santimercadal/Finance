import crypto from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import { yf, cached, quotes, MIN } from "./yahoo.js";
import { portfolioSnapshot, portfolioHistory, loadHoldings, upsertHolding, removeHolding } from "./portfolio.js";
import { stockDetail, stockReports } from "./stock.js";
import { peerComparison } from "./peers.js";
import { newsFeed, articleSummary, dailyDigest, aiEnabled, aiProvider } from "./news.js";
import { storageKind } from "./storage.js";

const app = express();
app.set("trust proxy", 1);
if (process.env.NODE_ENV !== "production") app.use(cors());
app.use(express.json());

// Optional password: when APP_PASSWORD is set every /api call (except health)
// must send it in the x-app-key header. Required when the app is public.
const PASSWORD = process.env.APP_PASSWORD ?? "";
const sameSecret = (a, b) => {
  const ha = crypto.createHash("sha256").update(a).digest();
  const hb = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};
app.use("/api", (req, res, next) => {
  if (!PASSWORD || req.path === "/health" || req.path === "/health/yahoo") return next();
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

app.get("/api/health", (_req, res) => res.json({ ok: true, ai: aiProvider, auth: Boolean(PASSWORD), storage: storageKind }));
app.get("/api/auth/check", (_req, res) => res.json({ ok: true }));

// Temporary diagnostic: which Yahoo endpoints answer from this host (no data returned).
app.get("/api/health/yahoo", async (_req, res) => {
  const probe = async (name, fn) => {
    const t = Date.now();
    try {
      const r = await fn();
      return [name, `ok ${Date.now() - t}ms ${JSON.stringify(r).length}b`];
    } catch (err) {
      return [name, `fail: ${err.message.slice(0, 120)}`];
    }
  };
  const ua = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130 Safari/537.36" };
  const raw = (url) => async () => {
    const r = await fetch(url, { headers: ua, signal: AbortSignal.timeout(15_000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return (await r.text()).slice(0, 50);
  };
  const results = await Promise.all([
    probe("chart", () => yf.chart("KO", { period1: "2026-09-01" }, { validateResult: false })),
    probe("search", () => yf.search("KO", { newsCount: 2 }, { validateResult: false })),
    probe("fts", () => yf.fundamentalsTimeSeries("KO", { period1: "2025-01-01", type: "quarterly", module: "all" }, { validateResult: false })),
    probe("recs", () => yf.recommendationsBySymbol("KO", {}, { validateResult: false })),
    probe("quote", () => yf.quote("KO", {}, { validateResult: false })),
    probe("raw-chart-q1", raw("https://query1.finance.yahoo.com/v8/finance/chart/KO")),
    probe("raw-chart-q2", raw("https://query2.finance.yahoo.com/v8/finance/chart/KO")),
    probe("raw-industry", raw("https://query1.finance.yahoo.com/v1/finance/industries/beverages-non-alcoholic")),
    probe("raw-crumb", raw("https://query1.finance.yahoo.com/v1/test/getcrumb")),
    probe("sec-tickers", async () => {
      const r = await fetch("https://www.sec.gov/files/company_tickers.json", { headers: { "User-Agent": "mi-portafolio admin@example.com" }, signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return "ok";
    }),
  ]);
  res.json(Object.fromEntries(results));
});

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
    throw Object.assign(new Error("Datos inválidos: se requiere símbolo, cantidad > 0 y costo promedio"), { status: 400 });
  }
  const [q] = await quotes([String(symbol).toUpperCase()]);
  if (!q?.regularMarketPrice) throw Object.assign(new Error(`Símbolo no encontrado: ${symbol}`), { status: 404 });
  return upsertHolding({ symbol, shares, avgCost });
}));
app.delete("/api/portfolio/:symbol", wrap((req) => removeHolding(req.params.symbol)));

app.get("/api/stock/:symbol", wrap((req) => stockDetail(req.params.symbol)));
app.get("/api/stock/:symbol/peers", wrap((req) => {
  const extra = String(req.query.add ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5);
  return peerComparison(req.params.symbol, extra);
}));
app.get("/api/stock/:symbol/reports", wrap((req) => stockReports(req.params.symbol)));

// Downloads an SEC filing document. Only Yahoo's filings CDN is allowed, so this
// can't be used to fetch arbitrary URLs through the server.
app.get("/api/filing", async (req, res) => {
  const url = String(req.query.url ?? "");
  if (!/^https:\/\/cdn\.yahoofinance\.com\/prod\/sec-filings\/[\w/.-]+$/.test(url)) {
    return res.status(400).json({ error: "URL de informe no válida" });
  }
  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(30_000) });
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
  app.use(express.static(webDist, { index: false, maxAge: "1h" }));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(webDist, "index.html")));
}

const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT} (resúmenes IA: ${aiProvider ?? "no"})`);
});
