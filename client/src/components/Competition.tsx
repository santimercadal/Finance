import { Link } from 'react-router-dom'
import type { PeerComparison } from '../api'
import { METRICS } from '../metrics'
import { compact, num, pct, scoreClass } from '../format'
import SymbolSearch from './SymbolSearch'

const PERCENT = new Set(['roe', 'roa', 'grossMargin', 'operatingMargin', 'profitMargin', 'revenueGrowth', 'earningsGrowth', 'dividendYield'])
const fmtMetric = (key: string, v: number | null | undefined) =>
  v == null ? '—' : PERCENT.has(key) ? pct(v, 1, key.endsWith('Growth')) : num(v, key === 'beta' || key.includes('Ratio') ? 2 : 1)

function Gauge({ score, verdict }: { score: number; verdict: string | null }) {
  const r = 52
  const c = Math.PI * r
  return (
    <div className="gauge" role="img" aria-label={`Score ${score} de 100: ${verdict}`}>
      <svg viewBox="0 0 120 70" width="180">
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" stroke="var(--surface-2)" strokeWidth="10" strokeLinecap="round" />
        <path d="M8 62 A52 52 0 0 1 112 62" fill="none" className={`gauge-arc ${scoreClass(score)}`} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`} />
      </svg>
      <div className="gauge-value"><b>{score}</b><span>/100</span></div>
      <div className={`gauge-verdict ${scoreClass(score)}`}>{verdict}</div>
    </div>
  )
}

interface Props {
  data: PeerComparison | null
  loading: boolean
  error: string | null
  onAdd: (symbol: string) => void
}

export default function Competition({ data, loading, error, onAdd }: Props) {
  if (error) return <div className="card error">No se pudo armar la comparación: {error}</div>
  if (!data) return <div className="card">{loading && <div className="skeleton" style={{ height: 260 }} />}</div>

  const peers = data.companies.filter((c) => !c.isSelf)
  const self = data.companies.find((c) => c.isSelf)!
  const categories = [...new Set(data.metrics.map((m) => m.category))]

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="grid-half">
        <section className="card score-card">
          <div className="card-head">
            <div>
              <h2>Score vs. competencia</h2>
              <div className="small muted">{data.industry ?? data.sector} · {peers.length} competidores</div>
            </div>
          </div>
          {data.score != null ? <Gauge score={data.score} verdict={data.verdict} /> : <div className="empty">Datos insuficientes</div>}
          <div className="note">
            Cada métrica se ubica en un ranking contra los competidores (0 = la peor del grupo, 100 = la mejor), se promedia por
            categoría y el score final es el promedio de las categorías. 67+ = Fuerte · 40-66 = En línea · menos de 40 = Débil.
          </div>
        </section>
        <section className="card">
          <div className="card-head"><h2>Por categoría</h2></div>
          <div className="cat-bars">
            {data.categories.map((c) => (
              <div key={c.name} className="cat-bar">
                <div className="cat-bar-head">
                  <span>{c.name}</span>
                  <span className="num"><b>{c.score}</b> · <span className={`verdict ${scoreClass(c.score)}`}>{c.verdict}</span></span>
                </div>
                <div className="bar-track"><div className={`bar-fill ${scoreClass(c.score)}`} style={{ width: `${Math.max(c.score, 2)}%` }} /></div>
              </div>
            ))}
          </div>
          <div className="note">La valuación puntúa alto cuando la acción es <b>más barata</b> que sus pares.</div>
        </section>
      </div>

      <section className="card">
        <div className="card-head">
          <h2>Comparación detallada</h2>
          <SymbolSearch className="search" placeholder="Agregar competidor…" onSelect={(r) => onAdd(r.symbol)} />
        </div>
        {loading && <div className="small muted">Actualizando…</div>}
        <div className="table-wrap">
          <table className="compare">
            <thead>
              <tr>
                <th>Métrica</th>
                <th className="self-col">{self.symbol}</th>
                <th>Mediana pares</th>
                <th>Puntaje</th>
                {peers.map((p) => <th key={p.symbol}><Link to={`/accion/${encodeURIComponent(p.symbol)}`}>{p.symbol}</Link></th>)}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Capitalización</td>
                <td className="self-col">{compact(self.marketCap)}</td>
                <td>—</td><td></td>
                {peers.map((p) => <td key={p.symbol}>{compact(p.marketCap)}</td>)}
              </tr>
              {categories.map((cat) => [
                <tr key={cat} className="group-row"><td colSpan={4 + peers.length}>{cat}</td></tr>,
                ...data.metrics.filter((m) => m.category === cat).map((m) => (
                  <tr key={m.key}>
                    <td title={METRICS[m.key]?.what}>
                      {METRICS[m.key]?.name ?? m.key}
                      <span className="muted small"> {m.better === 'high' ? '↑' : '↓'}</span>
                    </td>
                    <td className="self-col">{fmtMetric(m.key, m.value)}</td>
                    <td>{fmtMetric(m.key, m.peerMedian)}</td>
                    <td>{m.score != null ? <span className={`score-chip ${scoreClass(m.score)}`}>{m.score}</span> : <span className="muted">—</span>}</td>
                    {peers.map((p) => <td key={p.symbol}>{fmtMetric(m.key, p.metrics[m.key])}</td>)}
                  </tr>
                )),
              ])}
            </tbody>
          </table>
        </div>
        <div className="note">↑ = mayor es mejor · ↓ = menor es mejor. Dividendos y beta se muestran como referencia pero no suman al score. Los competidores se toman de las mayores empresas de la misma industria según Yahoo Finance.</div>
      </section>
    </div>
  )
}
