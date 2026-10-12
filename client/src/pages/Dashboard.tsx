import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, Line, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { api, useApi, type Holding, type Portfolio, type PortfolioHistory } from '../api'
import { compact, formatDate, money, num, pct, signedMoney, tone } from '../format'
import MarketStrip from '../components/MarketStrip'
import ChartTip from '../components/ChartTip'
import SymbolSearch from '../components/SymbolSearch'
import ImportHoldings from '../components/ImportHoldings'
import MetricStat from '../components/MetricStat'
import ConfirmDialog from '../components/ConfirmDialog'
import Toast, { type ToastMsg } from '../components/Toast'
import AllocationChart from '../components/AllocationChart'

const RANGES = { '1M': 30, '3M': 91, '6M': 182, '1A': 365 } as const
type Range = keyof typeof RANGES
type Panel = 'add' | 'import' | null

const icon = (d: string, size = 18) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)
const ICONS = {
  eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  eyeOff: 'M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3.2 4.1M6.6 6.6C3.9 8.3 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
  sync: 'M21 12a9 9 0 0 1-15.5 6.2M3 12A9 9 0 0 1 18.5 5.8M18 2v4h-4M6 22v-4h4',
  plus: 'M12 5v14M5 12h14',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  trendUp: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  trendDown: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
  scale: 'M12 3v18M5 21h14M7 7h10M4 15l3-8 3 8a3 3 0 0 1-6 0zM14 15l3-8 3 8a3 3 0 0 1-6 0z',
  bulb: 'M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z',
  x: 'M6 6l12 12M18 6 6 18',
}

// Hide money amounts (not percentages) when someone is looking over your shoulder.
function usePrivacy() {
  const [on, setOn] = useState(() => {
    try { return localStorage.getItem('privacy') === '1' } catch { return false }
  })
  useEffect(() => {
    document.documentElement.classList.toggle('privacy', on)
    try { localStorage.setItem('privacy', on ? '1' : '0') } catch { /* storage unavailable */ }
  }, [on])
  return [on, () => setOn((v) => !v)] as const
}

// NYSE/NASDAQ regular session, Mon–Fri 9:30–16:00 New York time (holidays not considered).
function marketOpen(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(now).map((p) => [p.type, p.value]),
  )
  const mins = Number(parts.hour) * 60 + Number(parts.minute)
  return !['Sat', 'Sun'].includes(parts.weekday) && mins >= 570 && mins < 960
}

function StatusBar({ updated, privacy, togglePrivacy, onRefresh }: { updated: Date | null; privacy: boolean; togglePrivacy: () => void; onRefresh: () => void }) {
  const open = marketOpen()
  return (
    <div className="status-bar">
      <div className="pill">
        <span className={`dot ${open ? 'live' : ''}`} />
        <span className="caps">{open ? 'Mercado abierto' : 'Mercado cerrado'}</span>
        <span className="num">NYSE / NASDAQ</span>
      </div>
      <div className="status-actions">
        <button className={`pill btn-pill ${privacy ? 'on' : ''}`} onClick={togglePrivacy} aria-pressed={privacy}
          aria-label={privacy ? 'Mostrar montos' : 'Ocultar montos'}>
          {icon(privacy ? ICONS.eyeOff : ICONS.eye, 16)}
        </button>
        <button className="pill btn-pill" onClick={onRefresh} aria-label="Actualizar">
          {icon(ICONS.sync, 16)}
          <span className="num">{updated ? updated.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }) : '--:--'}</span>
        </button>
      </div>
    </div>
  )
}

function Hero({ p }: { p: Portfolio | null }) {
  const { data, error } = useApi<PortfolioHistory>('/portfolio/history')
  const [range, setRange] = useState<Range>('6M')
  const points = useMemo(() => {
    const last = data?.points.at(-1)
    if (!data || !last) return []
    // Window counted back from the latest data point.
    const from = new Date(new Date(last.date).getTime() - RANGES[range] * 864e5).toISOString().slice(0, 10)
    const pts = data.points.filter((pt) => pt.date >= from)
    // Rebase the benchmark to the portfolio value at the start of the visible range.
    const b0 = pts[0]?.benchmark
    const v0 = pts[0]?.value
    return pts.map((pt) => ({ ...pt, benchmark: b0 && pt.benchmark ? (pt.benchmark / b0) * v0 : null }))
  }, [data, range])
  const first = points[0]?.value
  const last = points.at(-1)?.value
  const benchLast = points.at(-1)?.benchmark
  const rangeReturn = first && last ? (last / first - 1) * 100 : null
  const benchReturn = first && benchLast ? (benchLast / first - 1) * 100 : null
  const lineColor = rangeReturn != null && rangeReturn < 0 ? 'var(--loss)' : 'var(--gain)'
  const t = p?.totals

  return (
    <section className="hero-card">
      <div className="hero-glow" />
      <div className="hero-head">
        <span className="caps muted">Patrimonio total</span>
        <span className="tag num">USD · {p ? `${p.holdings.length} posiciones` : '…'}</span>
      </div>
      {t ? (
        <>
          <div className="hero-value num sensitive">${num(t.value)} <span className="ccy">USD</span></div>
          <div className={`hero-change ${tone(t.dayChange)}`}>
            {icon(t.dayChange < 0 ? ICONS.trendDown : ICONS.trendUp)}
            <span className="num sensitive">{signedMoney(t.dayChange)}</span>
            <span className={`badge ${tone(t.dayChangePct)}`}>({pct(t.dayChangePct)} hoy)</span>
          </div>
        </>
      ) : (
        <><div className="skeleton" style={{ height: 34, width: '70%' }} /><div className="skeleton" style={{ width: '45%' }} /></>
      )}
      {error && <div className="error">{error}</div>}
      <div className="hero-chart">
        {points.length > 1 ? (
          <ResponsiveContainer>
            <AreaChart data={points} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
              <defs>
                <linearGradient id="pf" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={lineColor} stopOpacity={0.3} />
                  <stop offset="60%" stopColor={lineColor} stopOpacity={0.06} />
                  <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <YAxis hide domain={['auto', 'auto']} />
              <Tooltip content={<ChartTip format={(v) => (document.documentElement.classList.contains('privacy') ? '••••' : money(v))}
                labelFormat={formatDate} />} />
              <Area type="monotone" dataKey="value" name="Portafolio" stroke={lineColor} strokeWidth={2.5} fill="url(#pf)" dot={false} />
              <Line type="monotone" dataKey="benchmark" name="S&P 500" stroke="var(--primary-soft)" strokeOpacity={0.6} strokeWidth={1.25} strokeDasharray="4 3" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          !error && <div className="skeleton" style={{ height: '100%' }} />
        )}
        {data && (
          <div className="bench-pill num">
            <span className={tone(rangeReturn)}>{pct(rangeReturn)}</span>
            <span className="muted">vs S&amp;P 500 {pct(benchReturn)}</span>
          </div>
        )}
      </div>
      <div className="seg seg-full" role="tablist">
        {(Object.keys(RANGES) as Range[]).map((r) => (
          <button key={r} role="tab" aria-selected={r === range} className={r === range ? 'on' : ''} onClick={() => setRange(r)}>{r}</button>
        ))}
      </div>
      {data && Object.keys(data.returns).length > 0 && (
        <div className="returns">
          {Object.entries(data.returns).map(([k, v]) => (
            <span key={k} className="muted">{k} <b className={`num ${tone(v)}`}>{pct(v, 1)}</b></span>
          ))}
        </div>
      )}
    </section>
  )
}

interface SyncStatus { enabled: boolean; lastSync: { at: string; count: number } | null }
interface SyncResult { count: number; skipped: string[]; shorts: number; cash: number | null }

// Sync replaces the portfolio with the open positions of the eToro account
// (read-only API keys configured on the server).
function QuickActions({ panel, setPanel }: { panel: Panel; setPanel: (p: Panel) => void }) {
  const status = useApi<SyncStatus>('/portfolio/sync/etoro')
  const [busy, setBusy] = useState(false)
  const [asking, setAsking] = useState(false)
  // Result of a sync that finished right before the page reload.
  const [toast, setToast] = useState<ToastMsg | null>(() => {
    const done = sessionStorageTake('etoro-sync-msg')
    return done ? { text: done } : null
  })
  const closeToast = useCallback(() => setToast(null), [])

  const askSync = () => {
    if (!status.data?.enabled) {
      setToast({ text: 'Falta configurar las claves de eToro en el servidor (ETORO_API_KEY y ETORO_USER_KEY). Ver README.', error: true })
      return
    }
    setAsking(true)
  }

  const sync = async () => {
    setAsking(false)
    setBusy(true)
    setToast(null)
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
      setToast({ text: `No se pudo sincronizar con eToro: ${(e as Error).message}`, error: true })
      setBusy(false)
    }
  }

  const last = status.data?.lastSync
  const toggle = (p: Panel) => setPanel(panel === p ? null : p)
  return (
    <section>
      <div className="quick-actions">
        <button className="qa primary" onClick={askSync} disabled={busy} aria-busy={busy}
          title={last ? `Última sincronización: ${new Date(last.at).toLocaleString('es')}` : 'Trae tus posiciones abiertas de eToro'}>
          <span className={`qa-icon ${busy ? 'spin' : ''}`}>{icon(ICONS.sync, 20)}</span>
          {busy ? 'Sincronizando…' : 'Sincronizar eToro'}
        </button>
        <button className={`qa ${panel === 'add' ? 'on' : ''}`} onClick={() => toggle('add')} aria-expanded={panel === 'add'}>
          <span className="qa-icon blue">{icon(ICONS.plus, 20)}</span>
          Agregar posición
        </button>
        <button className={`qa ${panel === 'import' ? 'on' : ''}`} onClick={() => toggle('import')} aria-expanded={panel === 'import'}>
          <span className="qa-icon green">{icon(ICONS.list, 20)}</span>
          Importar lista
        </button>
      </div>
      {last && (
        <div className="sync-msg small muted">Última sincronización con eToro: {new Date(last.at).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}</div>
      )}
      {asking && (
        <ConfirmDialog title="Sincronizar con eToro" confirmLabel="Sincronizar"
          message="Se reemplazará el portafolio con tus posiciones abiertas de eToro."
          onConfirm={sync} onCancel={() => setAsking(false)} />
      )}
      <Toast msg={toast} onClose={closeToast} />
    </section>
  )
}

function AddForm({ reload, onClose }: { reload: () => void; onClose: () => void }) {
  const [symbol, setSymbol] = useState('')
  const [shares, setShares] = useState('')
  const [cost, setCost] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

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

  return (
    <section className="card">
      <div className="card-head">
        <h2>Agregar o actualizar posición</h2>
        <button className="icon-btn" onClick={onClose} aria-label="Cerrar">{icon(ICONS.x, 16)}</button>
      </div>
      <form className="add-form" onSubmit={add}>
        <SymbolSearch className="search" placeholder="Símbolo" onSelect={(r) => setSymbol(r.symbol)} />
        {symbol && <span className="chip" style={{ alignSelf: 'center' }}>{symbol}</span>}
        <label className="field"><span>Cantidad</span>
          <input className="input" type="number" step="any" min="0" placeholder="0" value={shares} onChange={(e) => setShares(e.target.value)} required />
        </label>
        <label className="field"><span>Costo promedio</span>
          <input className="input" type="number" step="any" min="0" placeholder="0,00" value={cost} onChange={(e) => setCost(e.target.value)} required />
        </label>
        <button className="btn" disabled={busy || !symbol}>{busy ? 'Agregando…' : 'Agregar / actualizar'}</button>
      </form>
      {err && <div className="error" style={{ marginTop: 6 }}>{err}</div>}
      <div className="note">Los valores en otras monedas se convierten a USD al tipo de cambio actual. El costo promedio se ingresa en la moneda del activo.</div>
    </section>
  )
}

function betaLabel(beta: number | null) {
  if (beta == null) return 'Sin datos'
  return beta < 0.8 ? 'Defensivo' : beta <= 1.2 ? 'Similar al mercado' : 'Agresivo'
}

function KeyMetrics({ p }: { p: Portfolio }) {
  const t = p.totals
  return (
    <section>
      <div className="section-head"><h2 className="section-title">Métricas clave</h2></div>
      <div className="metric-grid">
        <div className="metric-card">
          <div className="metric-top"><span className="caps">Ganancia total</span>{icon(ICONS.trendUp, 16)}</div>
          <div className={`metric-value num sensitive ${tone(t.pnl)}`}>{signedMoney(t.pnl)}</div>
          <div className="metric-sub">
            <span className={`badge ${tone(t.pnlPct)}`}>{pct(t.pnlPct)}</span>
            <span className="muted">sobre <span className="num sensitive">{compact(t.cost)}</span> invertidos</span>
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-top"><span className="caps">Mejor / peor del día</span>{icon(ICONS.trendDown, 16)}</div>
          <div className="mover-row">
            {t.best ? <Link to={`/accion/${encodeURIComponent(t.best.symbol)}`} className="num">{t.best.symbol}</Link> : <span>—</span>}
            <span className={`num ${tone(t.best?.pct)}`}>{pct(t.best?.pct)}</span>
          </div>
          <div className="mover-row">
            {t.worst ? <Link to={`/accion/${encodeURIComponent(t.worst.symbol)}`} className="num">{t.worst.symbol}</Link> : <span>—</span>}
            <span className={`num ${tone(t.worst?.pct)}`}>{pct(t.worst?.pct)}</span>
          </div>
        </div>
        <div className="metric-card kpi-beta">
          <MetricStat id="portfolioBeta" label="Beta del portafolio" value={num(t.beta, 2)}
            hint={betaLabel(t.beta) + (t.betaCoverage != null && t.betaCoverage < 99.5 ? ` · ${num(t.betaCoverage, 0)}% del valor` : '')} />
        </div>
      </div>
    </section>
  )
}

function Positions({ p, reload }: { p: Portfolio; reload: () => void }) {
  const navigate = useNavigate()
  const open = (h: Holding) => navigate(`/accion/${encodeURIComponent(h.symbol)}`)

  const [removing, setRemoving] = useState<string | null>(null)
  const [error, setError] = useState<ToastMsg | null>(null)
  const closeError = useCallback(() => setError(null), [])
  const remove = async (sym: string) => {
    setRemoving(null)
    try {
      await api(`/portfolio/${encodeURIComponent(sym)}`, { method: 'DELETE' })
      reload()
    } catch (e) {
      setError({ text: `No se pudo eliminar ${sym}: ${(e as Error).message}`, error: true })
    }
  }

  return (
    <section>
      <div className="section-head">
        <div>
          <h2 className="section-title">Tus posiciones</h2>
          <span className="small muted">{p.holdings.length} posiciones · tocá una para ver el análisis</span>
        </div>
      </div>
      {p.holdings.length === 0 && <div className="card empty">Todavía no hay posiciones. Sincronizá eToro o agregá una.</div>}
      <div className="holding-list">
        {p.holdings.map((h) => (
          <div key={h.symbol} className="holding" role="link" tabIndex={0} onClick={() => open(h)}
            onKeyDown={(e) => e.key === 'Enter' && open(h)}>
            <div className="holding-row">
              <div className={`ticker-tile num ${tone(h.dayChangePct)}`}>{h.symbol.replace(/-USD$/, '').slice(0, 4)}</div>
              <div className="holding-id">
                <div className="holding-sym">
                  <span className="num">{h.symbol}</span>
                  <span className="chip">{num(h.weight, 1)}%</span>
                  <TypeChip type={h.type} />
                </div>
                <div className="name">{h.name}</div>
              </div>
              <Sparkline values={h.spark} />
              <div className="holding-right">
                <div className="num holding-value sensitive">{money(h.valueUsd)}</div>
                <div className="holding-price">
                  <span className="num muted">
                    {money(h.price, h.currency)}
                    {h.currency !== 'USD' && h.price != null && h.fx ? <> · ({money(h.price / h.fx)})</> : null}
                  </span>
                  <span className={`badge ${tone(h.dayChangePct)}`}>{pct(h.dayChangePct)}</span>
                </div>
              </div>
            </div>
            <div className="holding-meta">
              <span className="num muted"><span className="sensitive">{num(h.shares, h.shares % 1 ? 4 : 0)}</span> × {money(h.avgCost, h.currency)}</span>
              <span className={`num ${tone(h.pnlUsd)}`}><span className="sensitive">{signedMoney(h.pnlUsd)}</span> ({pct(h.pnlPct)})</span>
              <button className="icon-btn" aria-label={`Quitar ${h.symbol}`} title="Quitar"
                onClick={(e) => { e.stopPropagation(); setRemoving(h.symbol) }}>{icon(ICONS.x, 14)}</button>
            </div>
            <div className="weight-track"><div className={(h.pnlUsd ?? 0) < 0 ? 'neg' : ''} style={{ width: `${Math.min(h.weight, 100)}%` }} /></div>
          </div>
        ))}
      </div>
      {removing && (
        <ConfirmDialog title={`Eliminar ${removing}`} message="¿Seguro que deseas eliminar esta posición?" confirmLabel="Eliminar" danger
          onConfirm={() => remove(removing)} onCancel={() => setRemoving(null)} />
      )}
      <Toast msg={error} onClose={closeError} />
    </section>
  )
}

// Flags a single position that dominates the portfolio.
function ConcentrationTip({ p }: { p: Portfolio }) {
  const top = p.holdings.reduce<Holding | null>((a, h) => (!a || h.weight > a.weight ? h : a), null)
  if (!top || p.holdings.length < 2 || top.weight < 25) return null
  return (
    <section className="tip-card">
      <div className="tip-icon">{icon(ICONS.bulb, 20)}</div>
      <div>
        <div className="caps tip-title">Concentración</div>
        <div className="small">
          <b className="num">{top.symbol}</b> representa el <b className="num">{num(top.weight, 1)}%</b> del portafolio. Una caída fuerte de esa posición pesaría mucho en el total.
        </div>
      </div>
    </section>
  )
}

function TypeChip({ type }: { type: string | null }) {
  const label = type === 'ETF' ? 'ETF' : type === 'CRYPTOCURRENCY' ? 'Cripto' : null
  return label ? <span className="chip type-chip">{label}</span> : null
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

// Trend line of the last month; color encodes direction (also shown by the % badge).
function Sparkline({ values }: { values?: number[] }) {
  if (!values || values.length < 2) return <span className="spark" />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 56},${22 - ((v - min) / range) * 20}`).join(' ')
  const up = values.at(-1)! >= values[0]
  return (
    <svg className="spark" width="56" height="24" viewBox="0 0 56 24" aria-label={`Tendencia 1 mes: ${up ? 'alcista' : 'bajista'}`}>
      <polyline points={points} fill="none" stroke={up ? 'var(--gain)' : 'var(--loss)'} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

export default function Dashboard() {
  const portfolio = useApi<Portfolio>('/portfolio', 60_000)
  const [privacy, togglePrivacy] = usePrivacy()
  const [panel, setPanel] = useState<Panel>(null)

  return (
    <main className="dashboard">
      <MarketStrip />
      <StatusBar updated={portfolio.updatedAt} privacy={privacy} togglePrivacy={togglePrivacy} onRefresh={portfolio.reload} />
      {portfolio.error && <div className="error">No se pudo cargar el portafolio: {portfolio.error}</div>}
      <div className="dash-grid">
        <div className="dash-main">
          <Hero p={portfolio.data} />
          <QuickActions panel={panel} setPanel={setPanel} />
          {panel === 'add' && <AddForm reload={portfolio.reload} onClose={() => setPanel(null)} />}
          {panel === 'import' && (
            <section className="card">
              {/* Reload the page so the KPIs and the performance chart reflect the new holdings. */}
              <ImportHoldings onDone={() => window.location.reload()} onCancel={() => setPanel(null)} />
            </section>
          )}
          {portfolio.data && <KeyMetrics p={portfolio.data} />}
          {portfolio.data && <AllocationChart holdings={portfolio.data.holdings} />}
        </div>
        <div className="dash-side">
          {portfolio.data && <Positions p={portfolio.data} reload={portfolio.reload} />}
          {portfolio.data && <ConcentrationTip p={portfolio.data} />}
        </div>
      </div>
    </main>
  )
}
