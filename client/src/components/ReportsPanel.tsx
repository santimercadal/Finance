import { useState } from 'react'
import { Link } from 'react-router-dom'
import { getAppKey, useApi, type Reports } from '../api'
import { compact } from '../format'

const quarterLabel = (date: string) => {
  const d = new Date(date)
  return `T${Math.floor(d.getUTCMonth() / 3) + 1} ${d.getUTCFullYear()}`
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// CSV with ";" separator and decimal comma so it opens correctly in Excel in Spanish.
function downloadCsv(r: Reports) {
  const cell = (v: number | null) => (v == null ? '' : String(v).replace('.', ','))
  const lines = [
    [`Concepto (${r.currency})`, ...r.quarterly.dates.map(quarterLabel)].join(';'),
    ...r.quarterly.rows.map((row) => [row.label, ...row.values.map(cell)].join(';')),
  ]
  saveBlob(new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' }), `${r.symbol}-trimestral.csv`)
}

export default function ReportsPanel({ symbol }: { symbol: string }) {
  const { data, error, loading } = useApi<Reports>(`/stock/${encodeURIComponent(symbol)}/reports`)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [dlError, setDlError] = useState<string | null>(null)

  const downloadFiling = async (url: string, name: string) => {
    setDownloading(url)
    setDlError(null)
    try {
      const res = await fetch(`/api/filing?url=${encodeURIComponent(url)}&name=${encodeURIComponent(name)}`, {
        headers: { 'x-app-key': getAppKey() },
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `Error ${res.status}`)
      saveBlob(await res.blob(), name)
    } catch (e) {
      setDlError((e as Error).message)
    } finally {
      setDownloading(null)
    }
  }

  if (error) return <div className="card error">{error}</div>
  if (loading || !data) return <div className="card"><div className="skeleton" style={{ height: 240 }} /></div>

  const latestQ = data.filings.find((f) => f.type === '10-Q' || f.type === '6-K')
  const quarters = data.quarterly.dates

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section className="card">
        <div className="card-head">
          <div>
            <h2>Informe trimestral</h2>
            {data.nextEarnings && <div className="small muted">Próxima presentación de resultados: {new Date(data.nextEarnings).toLocaleDateString('es', { dateStyle: 'long' })}</div>}
          </div>
        </div>
        <div className="report-actions">
          <div className="report-option">
            <div>
              <b>Informe oficial de la empresa</b>
              <div className="small muted">
                {latestQ ? `${latestQ.label} presentado el ${new Date(latestQ.date).toLocaleDateString('es', { dateStyle: 'medium' })} ante la SEC.` : 'No hay un informe trimestral presentado ante la SEC para este activo.'}
              </div>
            </div>
            {latestQ?.documentUrl && (
              <button className="btn" disabled={downloading === latestQ.documentUrl}
                onClick={() => downloadFiling(latestQ.documentUrl!, `${data.symbol}-${latestQ.type}-${latestQ.date}.htm`)}>
                {downloading === latestQ.documentUrl ? 'Descargando…' : '⬇ Descargar'}
              </button>
            )}
          </div>
          <div className="report-option">
            <div>
              <b>Informe resumido de la app (PDF)</b>
              <div className="small muted">Resultados, balance, flujo de fondos y comparación con la competencia del último trimestre, listo para imprimir o guardar como PDF.</div>
            </div>
            <Link className="btn" to={`/accion/${encodeURIComponent(data.symbol)}/informe`}>📄 Generar</Link>
          </div>
          <div className="report-option">
            <div>
              <b>Datos trimestrales (Excel / CSV)</b>
              <div className="small muted">Últimos {quarters.length} trimestres: resultados, balance y flujo de fondos.</div>
            </div>
            <button className="btn" disabled={!quarters.length} onClick={() => downloadCsv(data)}>⬇ CSV</button>
          </div>
        </div>
        {dlError && <div className="error" style={{ marginTop: 8 }}>{dlError}</div>}
      </section>

      {quarters.length > 0 && (
        <section className="card">
          <div className="card-head"><h2>Últimos trimestres</h2><span className="small muted">{data.currency}</span></div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Concepto</th>{quarters.map((d) => <th key={d}>{quarterLabel(d)}</th>)}</tr></thead>
              <tbody>
                {data.quarterly.rows.map((row) => (
                  <tr key={row.key}>
                    <td>{row.label}</td>
                    {row.values.map((v, i) => <td key={i}>{row.key === 'dilutedEPS' ? (v?.toFixed(2) ?? '—') : compact(v)}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="card">
        <div className="card-head"><h2>Presentaciones ante la SEC</h2></div>
        {data.filings.length ? (
          <div className="filings">
            {data.filings.map((f) => (
              <div key={`${f.type}-${f.date}-${f.documentUrl}`} className="filing">
                <div>
                  <span className="chip">{f.type}</span> <b>{f.label}</b>
                  <div className="small muted">{new Date(f.date).toLocaleDateString('es', { dateStyle: 'medium' })} · {f.title}</div>
                </div>
                <div className="filing-actions">
                  {f.viewUrl && <a className="btn ghost" href={f.viewUrl} target="_blank" rel="noreferrer">Ver</a>}
                  {f.documentUrl && (
                    <button className="btn ghost" disabled={downloading === f.documentUrl}
                      onClick={() => downloadFiling(f.documentUrl!, `${data.symbol}-${f.type}-${f.date}.htm`)}>
                      {downloading === f.documentUrl ? '…' : '⬇'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">Esta empresa no tiene presentaciones ante la SEC disponibles (habitual en acciones que solo cotizan fuera de EE.UU.).</div>
        )}
      </section>
    </div>
  )
}
