import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useApi, type Estimates } from '../api'
import { compact, money, num, pct, quarterLabel, ratingLabel, tone, year } from '../format'
import ChartTip from './ChartTip'

const axis = { tick: { fill: 'var(--muted)', fontSize: 11 }, tickLine: false }

// Where the current price and the analysts' mean target sit inside the low–high range.
function TargetRange({ e }: { e: Estimates }) {
  const t = e.target!
  if (t.low == null || t.high == null || t.high <= t.low) return null
  const lo = Math.min(t.low, e.price)
  const hi = Math.max(t.high, e.price)
  const at = (v: number) => `${((v - lo) / (hi - lo)) * 100}%`
  return (
    <div className="target-range" role="img"
      aria-label={`Rango de objetivos de ${money(t.low, e.currency)} a ${money(t.high, e.currency)}; promedio ${money(t.mean, e.currency)}; precio actual ${money(e.price, e.currency)}`}>
      <div className="target-track">
        <div className="target-band" style={{ left: at(t.low), right: `calc(100% - ${at(t.high)})` }} />
        <div className="target-mark mean" style={{ left: at(t.mean) }} />
        <div className="target-mark price" style={{ left: at(e.price) }} />
      </div>
      <div className="target-labels num">
        <span>Mín. {money(t.low, e.currency)}</span>
        <span>Máx. {money(t.high, e.currency)}</span>
      </div>
      <div className="legend">
        <span><i style={{ background: 'var(--primary)' }} />Objetivo promedio</span>
        <span><i style={{ background: 'var(--text)' }} />Precio actual</span>
      </div>
    </div>
  )
}

function Ratings({ r }: { r: NonNullable<Estimates['ratings']> }) {
  const parts = [
    ['Compra fuerte', r.strongBuy, 'var(--gain)'],
    ['Compra', r.buy, 'color-mix(in srgb, var(--gain) 55%, transparent)'],
    ['Mantener', r.hold, 'var(--layer-4)'],
    ['Venta', r.sell, 'color-mix(in srgb, var(--loss) 55%, transparent)'],
    ['Venta fuerte', r.strongSell, 'var(--loss)'],
  ] as const
  const shown = parts.filter(([, n]) => n > 0)
  const total = shown.reduce((s, [, n]) => s + n, 0)
  if (!total) return null
  return (
    <div>
      <div className="ratio-bar rating-bar" role="img" aria-label={shown.map(([l, n]) => `${l}: ${n}`).join(', ')}>
        {shown.map(([label, n, color]) => <div key={label} style={{ width: `${(n / total) * 100}%`, background: color }} />)}
      </div>
      <div className="legend" style={{ marginTop: 8 }}>
        {shown.map(([label, n, color]) => <span key={label}><i style={{ background: color }} />{label} <b className="num">{n}</b></span>)}
      </div>
    </div>
  )
}

// Reported annual EPS followed by the consensus forecasts for the next fiscal years.
function EpsChart({ e }: { e: Estimates }) {
  const years = e.periods.filter((p) => p.kind === 'year' && p.end)
  const lastReported = e.history.at(-1)?.end ?? ''
  const data = [
    ...e.history.map((h) => ({ year: year(h.end), eps: h.eps, estimate: false })),
    ...years.filter((p) => p.end! > lastReported).map((p) => ({ year: year(p.end!), eps: p.eps.avg, estimate: true })),
  ]
  if (data.length < 2) return null
  return (
    <section className="card">
      <div className="card-head">
        <h2>Ganancia por acción (BPA) anual</h2>
        <span className="small muted">{e.epsCurrency}</span>
      </div>
      <div style={{ height: 240 }}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="year" {...axis} axisLine={{ stroke: 'var(--axis)' }} />
            <YAxis {...axis} axisLine={false} width={44} tickFormatter={(v: number) => num(v, v >= 100 ? 0 : 1)} />
            <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip format={(v) => num(v, 2)} />} />
            <ReferenceLine y={0} stroke="var(--axis)" />
            <Bar dataKey="eps" name="BPA" radius={[4, 4, 0, 0]}>
              {data.map((d) => <Cell key={d.year} fill={d.estimate ? 'var(--accent-2)' : 'var(--primary)'} fillOpacity={d.estimate ? 0.55 : 1} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="legend" style={{ marginTop: 8 }}>
        <span><i style={{ background: 'var(--primary)' }} />Reportado</span>
        <span><i style={{ background: 'var(--accent-2)', opacity: 0.55 }} />Estimación de consenso</span>
      </div>
    </section>
  )
}

const estimateRange = (low: number | null, high: number | null, fmt: (v: number) => string) =>
  low != null && high != null && low !== high ? `${fmt(low)} – ${fmt(high)}` : null

export default function Projections({ symbol }: { symbol: string }) {
  const { data: e, error, loading } = useApi<Estimates>(`/stock/${encodeURIComponent(symbol)}/estimates`)

  if (error) return <div className="card error">No se pudieron cargar las proyecciones: {error}</div>
  if (loading || !e) return <div className="card"><div className="skeleton" style={{ height: 260 }} /></div>
  if (!e.target && !e.periods.length) {
    return (
      <div className="card empty">
        No hay estimaciones de analistas disponibles para {symbol}. Suelen faltar en acciones que solo cotizan fuera de EE.UU. o con poca cobertura.
      </div>
    )
  }

  const t = e.target
  const argusRating = ratingLabel(e.argus?.rating ?? null)
  const years = e.periods.filter((p) => p.kind === 'year')

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="grid-half">
        {t && (
          <section className="card">
            <div className="card-head">
              <h2>Precio objetivo de los analistas</h2>
              <span className="small muted">12 meses</span>
            </div>
            <div className="target-head">
              <div>
                <div className="metric-value num">{money(t.mean, e.currency)}</div>
                <div className="small muted">
                  Promedio{t.analysts ? ` de ${t.analysts} analistas` : ''} · precio actual {money(e.price, e.currency)}
                </div>
              </div>
              <span className={`badge ${tone(t.upside)}`}>{pct(t.upside, 1)} potencial</span>
            </div>
            <TargetRange e={e} />
            {/* Argus' own target, when the consensus above comes from another source. */}
            {e.argus && !t.source?.startsWith('Argus') && (
              <div className="note">
                Argus Research: objetivo {money(e.argus.target, e.currency)}{argusRating ? ` · ${argusRating[0]}` : ''}.
              </div>
            )}
          </section>
        )}
        {e.ratings && (
          <section className="card">
            <div className="card-head"><h2>Recomendaciones</h2><span className="small muted">Último mes</span></div>
            <Ratings r={e.ratings} />
          </section>
        )}
      </div>

      <EpsChart e={e} />

      {e.periods.length > 0 && (
        <section className="card">
          <div className="card-head">
            <h2>Estimaciones de consenso</h2>
            <span className="small muted">BPA en {e.epsCurrency}</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Período</th><th>BPA estimado</th><th>Rango</th><th>Crec. a/a</th>
                  {e.periods.some((p) => p.revenue) && <th>Ingresos est.</th>}
                  <th>Analistas</th><th>Revisiones 30d</th>
                </tr>
              </thead>
              <tbody>
                {e.periods.map((p) => (
                  <tr key={`${p.kind}-${p.label}`}>
                    <td>{p.label}</td>
                    <td><b>{num(p.eps.avg, 2)}</b></td>
                    <td className="muted">{estimateRange(p.eps.low, p.eps.high, (v) => num(v, 2)) ?? '—'}</td>
                    <td className={tone(p.eps.growth)}>{pct(p.eps.growth, 1)}</td>
                    {e.periods.some((x) => x.revenue) && <td>{compact(p.revenue?.avg)}</td>}
                    <td>{p.eps.analysts ?? '—'}</td>
                    <td>
                      {p.revisions && (p.revisions.up || p.revisions.down)
                        ? <><span className="up">▲{p.revisions.up}</span> <span className="down">▼{p.revisions.down}</span></>
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {years.some((p) => p.impliedPrice != null) && (
        <section className="card">
          <div className="card-head">
            <h2>Precio implícito por las estimaciones</h2>
            <span className="small muted">P/E actual {num(e.pe, 1)}</span>
          </div>
          <div className="stats">
            {years.filter((p) => p.impliedPrice != null).map((p) => (
              <div key={p.label} className="stat">
                <div className="stat-label"><span>{p.label.replace(/ \(cierra .*\)/, '')}</span></div>
                <div className="value">{money(p.impliedPrice, e.currency)}</div>
                <span className={`badge ${tone(p.impliedUpside)}`}>{pct(p.impliedUpside, 1)}</span>
              </div>
            ))}
          </div>
          <div className="note">
            BPA estimado × P/E actual. Muestra cuánto valdría la acción si el mercado sigue pagando el mismo múltiplo por sus ganancias;
            si el P/E baja o sube, el precio cambia en la misma proporción.
          </div>
        </section>
      )}

      {e.surprises.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Resultados vs. estimaciones</h2><span className="small muted">Últimos trimestres</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Trimestre</th><th>BPA estimado</th><th>BPA real</th><th>Sorpresa</th></tr></thead>
              <tbody>
                {e.surprises.map((s) => (
                  <tr key={s.quarter}>
                    <td>{quarterLabel(s.quarter)}</td>
                    <td>{num(s.estimate, 2)}</td>
                    <td>{num(s.actual, 2)}</td>
                    <td className={tone(s.surprisePct)}>{pct(s.surprisePct, 1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="note">
        Estimaciones de analistas vía {e.source ?? t?.source ?? 'Yahoo Finance'}. Son proyecciones de terceros, pueden cambiar y no son una recomendación de la app.
      </div>
    </div>
  )
}
