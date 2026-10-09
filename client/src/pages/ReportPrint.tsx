import { Link, useParams } from 'react-router-dom'
import { useApi, type PeerComparison, type Reports, type StockDetail } from '../api'
import { compact, money, num, pct } from '../format'
import { METRICS } from '../metrics'

const quarterLabel = (date: string) => {
  const d = new Date(date)
  return `T${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`
}

// Printable one-page quarterly summary. "Guardar como PDF" from the print dialog.
export default function ReportPrint() {
  const { symbol = '' } = useParams()
  const enc = encodeURIComponent(symbol)
  const detail = useApi<StockDetail>(`/stock/${enc}`)
  const reports = useApi<Reports>(`/stock/${enc}/reports`)
  const peers = useApi<PeerComparison>(`/stock/${enc}/peers`)
  const d = detail.data
  const r = reports.data
  const p = peers.data
  const ready = d && r && (p || peers.error)
  const error = detail.error || reports.error

  const lastQ = r?.quarterly.dates.length ? r.quarterly.dates.length - 1 : -1
  const row = (key: string) => r?.quarterly.rows.find((x) => x.key === key)?.values ?? []
  const qVal = (key: string, offset = 0) => row(key)[lastQ - offset] ?? null
  const yoy = (key: string) => {
    const now = qVal(key)
    const prev = qVal(key, 4)
    return now != null && prev ? ((now - prev) / Math.abs(prev)) * 100 : null
  }
  const b = d?.balance.latest

  return (
    <main className="print-page">
      <div className="no-print print-toolbar">
        <Link to={`/accion/${enc}`}>← Volver</Link>
        <button className="btn" disabled={!ready} onClick={() => window.print()}>🖨 Imprimir / Guardar PDF</button>
      </div>
      {error && <div className="error">{error}</div>}
      {!ready && !error && <div className="card"><div className="skeleton" style={{ height: 400 }} /></div>}
      {ready && d && r && (
        <article className="report">
          <header className="report-head">
            <div>
              <h1>{d.quote.name} ({d.symbol})</h1>
              <div className="muted">
                Informe trimestral resumido · {lastQ >= 0 ? quarterLabel(r.quarterly.dates[lastQ]) : 'sin datos trimestrales'} ·
                generado el {new Date().toLocaleDateString('es', { dateStyle: 'long' })}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="report-price">{money(d.quote.price, d.quote.currency)}</div>
              <div className="muted small">Capitalización {compact(d.quote.marketCap, d.quote.currency)}</div>
            </div>
          </header>

          <section>
            <h2>Resultados del trimestre ({r.currency})</h2>
            <table>
              <thead><tr><th>Concepto</th><th>Trimestre</th><th>Mismo trim. año anterior</th><th>Variación</th></tr></thead>
              <tbody>
                {['totalRevenue', 'grossProfit', 'operatingIncome', 'EBITDA', 'netIncome', 'dilutedEPS', 'operatingCashFlow', 'freeCashFlow'].map((key) => {
                  const label = r.quarterly.rows.find((x) => x.key === key)?.label
                  if (!label) return null
                  const fmt = (v: number | null) => (key === 'dilutedEPS' ? num(v, 2) : compact(v))
                  return (
                    <tr key={key}>
                      <td>{label}</td><td>{fmt(qVal(key))}</td><td>{fmt(qVal(key, 4))}</td><td>{pct(yoy(key), 1)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </section>

          {b && (
            <section>
              <h2>Estructura patrimonial al {new Date(b.date).toLocaleDateString('es', { dateStyle: 'medium' })}</h2>
              <table>
                <tbody>
                  <tr><td>Activo total</td><td>{compact(b.totalAssets)}</td><td>Pasivo / Activo</td><td>{pct(b.liabilitiesPct, 1, false)}</td></tr>
                  <tr><td>Pasivo total</td><td>{compact(b.totalLiabilities)}</td><td>Patrimonio / Activo</td><td>{pct(b.equityPct, 1, false)}</td></tr>
                  <tr><td>Patrimonio neto</td><td>{compact(b.equity)}</td><td>Deuda / Patrimonio</td><td>{num(b.debtToEquity, 2)}</td></tr>
                  <tr><td>Deuda total</td><td>{compact(b.totalDebt)}</td><td>Liquidez corriente</td><td>{num(b.currentRatio, 2)}</td></tr>
                </tbody>
              </table>
            </section>
          )}

          {p && p.score != null && (
            <section>
              <h2>Comparación con la competencia — score {p.score}/100 ({p.verdict})</h2>
              <p className="muted small">{p.industry} · vs. {p.companies.filter((c) => !c.isSelf).map((c) => c.symbol).join(', ')}</p>
              <table>
                <thead><tr><th>Categoría</th><th>Score</th><th>Lectura</th></tr></thead>
                <tbody>{p.categories.map((c) => <tr key={c.name}><td>{c.name}</td><td>{c.score}</td><td>{c.verdict}</td></tr>)}</tbody>
              </table>
              <table style={{ marginTop: 8 }}>
                <thead><tr><th>Métrica</th><th>{p.symbol}</th><th>Mediana pares</th><th>Puntaje</th></tr></thead>
                <tbody>
                  {p.metrics.filter((m) => m.scored).map((m) => (
                    <tr key={m.key}>
                      <td>{METRICS[m.key]?.name ?? m.key}</td>
                      <td>{num(m.value, 2)}</td>
                      <td>{num(m.peerMedian, 2)}</td>
                      <td>{m.score ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <footer className="muted small">
            Fuente: Yahoo Finance y presentaciones ante la SEC. Información con fines informativos; no constituye recomendación de inversión.
          </footer>
        </article>
      )}
    </main>
  )
}
