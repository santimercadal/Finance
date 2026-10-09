import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { api, useApi, type NewsItem, type Portfolio, type PortfolioHistory } from '../api'
import { compact, money, num, pct, signedMoney, tone } from '../format'
import MarketStrip from '../components/MarketStrip'
import NewsList from '../components/NewsList'
import ChartTip from '../components/ChartTip'
import SymbolSearch from '../components/SymbolSearch'
import ImportHoldings from '../components/ImportHoldings'
import MetricStat from '../components/MetricStat'

const RANGES = { '1M': 30, '3M': 91, '6M': 182, '1A': 365 } as const
type Range = keyof typeof RANGES

function Kpis({ p }: { p: Portfolio }) {
  const t = p.totals
  return (
    <div className="kpis">
      <div className="kpi hero">
        <div className="label">Valor del portafolio</div>
        <div className="value num">{money(t.value)}</div>
        <div className="sub muted">{p.holdings.length} posiciones</div>
      </div>
      <div className="kpi">
        <div className="label">Variación del día</div>
        <div className={`value num ${tone(t.dayChange)}`}>{signedMoney(t.dayChange)}</div>
        <div className="sub"><span className={`badge ${tone(t.dayChangePct)}`}>{pct(t.dayChangePct)}</span></div>
      </div>
      <div className="kpi">
        <div className="label">Ganancia total</div>
        <div className={`value num ${tone(t.pnl)}`}>{signedMoney(t.pnl)}</div>
        <div className="sub"><span className={`badge ${tone(t.pnlPct)}`}>{pct(t.pnlPct)}</span> <span className="muted num">s/ {compact(t.cost)}</span></div>
      </div>
      <div className="kpi">
        <div className="label">Mejor / peor del día</div>
        <div className="value" style={{ fontSize: 16 }}>
          {t.best ? <Link to={`/accion/${t.best.symbol}`}>{t.best.symbol}</Link> : '—'}{' '}
          <span className={`num ${tone(t.best?.pct)}`}>{pct(t.best?.pct)}</span>
        </div>
        <div className="sub">
          {t.worst ? <Link to={`/accion/${t.worst.symbol}`}>{t.worst.symbol}</Link> : '—'}{' '}
          <span className={`num ${tone(t.worst?.pct)}`}>{pct(t.worst?.pct)}</span>
        </div>
      </div>
      <div className="kpi kpi-beta">
        <MetricStat id="portfolioBeta" label="Beta del portafolio" value={num(t.beta, 2)}
          hint={betaLabel(t.beta) + (t.betaCoverage != null && t.betaCoverage < 99.5 ? ` · ${num(t.betaCoverage, 0)}% del valor` : '')} />
      </div>
    </div>
  )
}

function betaLabel(beta: number | null) {
  if (beta == null) return 'Sin datos'
  return beta < 0.8 ? 'Defensivo' : beta <= 1.2 ? 'Similar al mercado' : 'Agresivo'
}

function PerformanceChart() {
  const { data, error } = useApi<PortfolioHistory>('/portfolio/history')
  const [range, setRange] = useState<Range>('6M')
  const points = useMemo(() => {
    if (!data) return []
    const from = new Date(Date.now() - RANGES[range] * 864e5).toISOString().slice(0, 10)
    const pts = data.points.filter((p) => p.date >= from)
    // Rebase the benchmark to the portfolio value at the start of the visible range.
    const b0 = pts[0]?.benchmark
    const v0 = pts[0]?.value
    return pts.map((p) => ({ ...p, benchmark: b0 && p.benchmark ? (p.benchmark / b0) * v0 : null }))
  }, [data, range])
  const first = points[0]?.value
  const last = points.at(-1)?.value
  const benchLast = points.at(-1)?.benchmark
  const rangeReturn = first && last ? (last / first - 1) * 100 : null
  const benchReturn = first && benchLast ? (benchLast / first - 1) * 100 : null

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Rendimiento</h2>
          <div className="small muted">Posiciones actuales vs. S&amp;P 500 (rebasado)</div>
        </div>
        <div className="seg" role="tablist">
          {(Object.keys(RANGES) as Range[]).map((r) => (
            <button key={r} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {data && (
        <div className="returns" style={{ marginBottom: 8 }}>
          <span>Período <b className={`num ${tone(rangeReturn)}`}>{pct(rangeReturn)}</b></span>
          <span className="muted">S&amp;P 500 <b className="num">{pct(benchReturn)}</b></span>
          {Object.entries(data.returns).map(([k, v]) => (
            <span key={k} className="muted">{k} <b className={`num ${tone(v)}`}>{pct(v, 1)}</b></span>
          ))}
        </div>
      )}
      <div style={{ height: 280 }}>
        {points.length > 1 ? (
          <ResponsiveContainer>
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="pf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--s1)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--s1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'var(--axis)' }}
                tickFormatter={(d: string) => new Date(d).toLocaleDateString('es', { day: '2-digit', month: 'short' })} minTickGap={40} />
              <YAxis tick={{ fill: 'var(--muted)', fontSize: 11 }} tickLine={false} axisLine={false} width={56}
                domain={['auto', 'auto']} tickFormatter={(v: number) => compact(v)} />
              <Tooltip content={<ChartTip format={(v) => money(v)} labelFormat={(d) => new Date(d).toLocaleDateString('es', { dateStyle: 'medium' })} />} />
              <Area type="monotone" dataKey="value" name="Portafolio" stroke="var(--s1)" strokeWidth={2} fill="url(#pf)" dot={false} />
              <Line type="monotone" dataKey="benchmark" name="S&P 500" stroke="var(--bench)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          !error && <div className="skeleton" style={{ height: '100%' }} />
        )}
      </div>
      <div className="legend" style={{ marginTop: 8 }}>
        <span><i style={{ background: 'var(--s1)' }} />Portafolio</span>
        <span><i style={{ background: 'var(--bench)' }} />S&amp;P 500</span>
      </div>
    </section>
  )
}

function Holdings({ p, reload }: { p: Portfolio; reload: () => void }) {
  const navigate = useNavigate()
  const [symbol, setSymbol] = useState('')
  const [shares, setShares] = useState('')
  const [cost, setCost] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await api('/portfolio', { method: 'POST', body: JSON.stringify({ symbol, shares: Number(shares), avgCost: Number(cost) }) })
      setSymbol(''); setShares(''); setCost('')
      reload()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const remove = async (sym: string) => {
    if (!confirm(`¿Quitar ${sym} del portafolio?`)) return
    await api(`/portfolio/${encodeURIComponent(sym)}`, { method: 'DELETE' })
    reload()
  }

  return (
    <section className="card">
      <div className="card-head">
        <div><h2>Mis posiciones</h2><span className="small muted">Toca una posición para ver el análisis</span></div>
        <div className="head-actions">
          <EtoroSync />
          {!importing && <button className="btn ghost" onClick={() => setImporting(true)}>Importar lista</button>}
        </div>
      </div>
      {importing && (
        // Reload the page so the KPIs and the performance chart reflect the new holdings.
        <ImportHoldings onDone={() => window.location.reload()} onCancel={() => setImporting(false)} />
      )}
      <div className="table-wrap holdings-table">
        <table>
          <thead>
            <tr>
              <th>Activo</th><th>Precio</th><th>Día</th><th>Cantidad</th><th>Costo prom.</th>
              <th>Valor (USD)</th><th>G/P</th><th>Peso</th><th></th>
            </tr>
          </thead>
          <tbody>
            {p.holdings.map((h) => (
              <tr key={h.symbol} className="click" onClick={() => navigate(`/accion/${encodeURIComponent(h.symbol)}`)}>
                <td><div className="sym">{h.symbol}<TypeChip type={h.type} /></div><div className="name">{h.name}</div></td>
                <td>{money(h.price, h.currency)}</td>
                <td className={tone(h.dayChangePct)}>{pct(h.dayChangePct)}</td>
                <td>{num(h.shares, h.shares % 1 ? 4 : 0)}</td>
                <td>{money(h.avgCost, h.currency)}</td>
                <td>{money(h.valueUsd)}</td>
                <td className={tone(h.pnlUsd)}>{signedMoney(h.pnlUsd)}<div className="small">{pct(h.pnlPct)}</div></td>
                <td>{num(h.weight, 1)}%<div className="weight-bar"><div style={{ width: `${h.weight}%` }} /></div></td>
                <td><button className="icon-btn" title="Quitar" aria-label={`Quitar ${h.symbol}`} onClick={(e) => { e.stopPropagation(); remove(h.symbol) }}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="positions">
        {p.holdings.map((h) => (
          <div key={h.symbol} className="position" role="link" tabIndex={0}
            onClick={() => navigate(`/accion/${encodeURIComponent(h.symbol)}`)}
            onKeyDown={(e) => e.key === 'Enter' && navigate(`/accion/${encodeURIComponent(h.symbol)}`)}>
            <div style={{ minWidth: 0 }}>
              <div className="sym">
                {h.symbol}
                <TypeChip type={h.type} />
                <button className="icon-btn" aria-label={`Quitar ${h.symbol}`} onClick={(e) => { e.stopPropagation(); remove(h.symbol) }}>✕</button>
              </div>
              <div className="name">{h.name}</div>
              <div className="meta">{num(h.shares, h.shares % 1 ? 2 : 0)} × {money(h.avgCost, h.currency)}</div>
            </div>
            <Sparkline values={h.spark} />
            <div className="right">
              <div className="price">{money(h.valueUsd)}</div>
              <span className={`badge ${tone(h.dayChangePct)}`}>{pct(h.dayChangePct)}</span>
              <div className={`meta ${tone(h.pnlUsd)}`}>{signedMoney(h.pnlUsd)}</div>
            </div>
          </div>
        ))}
      </div>
      <form className="add-form" onSubmit={add}>
        <SymbolSearch className="search" placeholder="Símbolo" onSelect={(r) => setSymbol(r.symbol)} />
        {symbol && <span className="chip" style={{ alignSelf: 'center' }}>{symbol}</span>}
        <input className="input" type="number" step="any" min="0" placeholder="Cantidad" value={shares} onChange={(e) => setShares(e.target.value)} required />
        <input className="input" type="number" step="any" min="0" placeholder="Costo promedio" value={cost} onChange={(e) => setCost(e.target.value)} required />
        <button className="btn" disabled={busy || !symbol}>{busy ? 'Agregando…' : 'Agregar / actualizar'}</button>
      </form>
      {err && <div className="error" style={{ marginTop: 6 }}>{err}</div>}
      <div className="note">Los valores en otras monedas se convierten a USD al tipo de cambio actual. El costo promedio se ingresa en la moneda del activo.</div>
    </section>
  )
}

function TypeChip({ type }: { type: string | null }) {
  const label = type === 'ETF' ? 'ETF' : type === 'CRYPTOCURRENCY' ? 'Cripto' : null
  return label ? <span className="chip type-chip">{label}</span> : null
}

interface SyncStatus { enabled: boolean; lastSync: { at: string; count: number } | null }
interface SyncResult { count: number; skipped: string[]; shorts: number; cash: number | null }

// Replaces the portfolio with the open positions of the eToro account (read-only
// API keys configured on the server).
function EtoroSync() {
  const status = useApi<SyncStatus>('/portfolio/sync/etoro')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null)

  const sync = async () => {
    if (!status.data?.enabled) {
      setMsg({ text: 'Falta configurar las claves de eToro en el servidor (ETORO_API_KEY y ETORO_USER_KEY). Ver README.', error: true })
      return
    }
    if (!confirm('¿Reemplazar el portafolio con tus posiciones abiertas de eToro?')) return
    setBusy(true)
    setMsg(null)
    try {
      const r = await api<SyncResult>('/portfolio/sync/etoro', { method: 'POST' })
      const extra = [
        r.skipped.length ? `sin datos en Yahoo: ${r.skipped.join(', ')}` : '',
        r.shorts ? `${r.shorts} posición(es) en corto omitidas` : '',
      ].filter(Boolean).join(' · ')
      sessionStorageSet('etoro-sync-msg', `Sincronizado: ${r.count} posiciones${extra ? ` (${extra})` : ''}.`)
      // Reload so the KPIs and the performance chart reflect the new holdings.
      window.location.reload()
    } catch (e) {
      setMsg({ text: (e as Error).message, error: true })
      setBusy(false)
    }
  }

  const [done] = useState(() => sessionStorageTake('etoro-sync-msg'))
  const last = status.data?.lastSync
  return (
    <>
      <button className="btn ghost" onClick={sync} disabled={busy}
        title={last ? `Última sincronización: ${new Date(last.at).toLocaleString('es')}` : 'Trae tus posiciones abiertas de eToro'}>
        {busy ? 'Sincronizando…' : '⟳ Sincronizar eToro'}
      </button>
      {(msg || done) && <div className={`sync-msg small ${msg?.error ? 'error' : 'muted'}`}>{msg?.text ?? done}</div>}
    </>
  )
}

function sessionStorageSet(key: string, value: string) {
  try { sessionStorage.setItem(key, value) } catch { /* storage unavailable */ }
}
function sessionStorageTake(key: string) {
  try {
    const v = sessionStorage.getItem(key)
    sessionStorage.removeItem(key)
    return v
  } catch {
    return null
  }
}

// 48×24 trend line of the last month; color encodes direction (also shown by the % badge).
function Sparkline({ values }: { values?: number[] }) {
  if (!values || values.length < 2) return <span />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 48},${22 - ((v - min) / range) * 20}`).join(' ')
  const up = values.at(-1)! >= values[0]
  return (
    <svg className="spark" width="48" height="24" viewBox="0 0 48 24" aria-label={`Tendencia 1 mes: ${up ? 'alcista' : 'bajista'}`}>
      <polyline points={points} fill="none" stroke={up ? 'var(--gain)' : 'var(--loss)'} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

function NewsDigest() {
  const { data } = useApi<{ digest: string | null; ai: boolean }>('/news/digest')
  if (!data?.digest) return null
  return (
    <div style={{ marginBottom: 12 }}>
      <h3 style={{ marginBottom: 6 }}>✨ Resumen del día</h3>
      <div className="digest">{data.digest}</div>
    </div>
  )
}

export default function Dashboard() {
  const portfolio = useApi<Portfolio>('/portfolio', 60_000)
  const news = useApi<NewsItem[]>('/news?limit=8', 10 * 60_000)

  return (
    <main>
      <MarketStrip />
      {portfolio.error && <div className="error">No se pudo cargar el portafolio: {portfolio.error}</div>}
      {portfolio.data && <Kpis p={portfolio.data} />}
      <PerformanceChart />
      {portfolio.data && <Holdings p={portfolio.data} reload={portfolio.reload} />}
      <section className="card">
        <div className="card-head"><h2>Noticias de tu portafolio</h2><Link to="/noticias" className="small">Ver todas →</Link></div>
        <div className="news-layout">
          <NewsDigest />
          {news.data ? <NewsList items={news.data} /> : <div className="skeleton" style={{ height: 200 }} />}
        </div>
      </section>
    </main>
  )
}
