import { createContext, useContext, useState } from 'react'
import { METRICS } from '../metrics'

export interface PeerMedians {
  loading: boolean
  medians: Record<string, number | null>
  count: number
}

export const PeerContext = createContext<PeerMedians>({ loading: false, medians: {}, count: 0 })

interface Props {
  id: keyof typeof METRICS
  value: string
  /** Raw numeric value, used to compare against the peer median. */
  raw?: number | null
  /** Formats the peer median the same way as `value`. */
  format?: (v: number) => string
  hint?: string
  cls?: string
  label?: string
}

export default function MetricStat({ id, value, raw, format, hint, cls, label }: Props) {
  const info = METRICS[id]
  const [open, setOpen] = useState(false)
  const peers = useContext(PeerContext)
  const median = info.peerKey ? peers.medians[info.peerKey] : null

  let tag: React.ReactNode = null
  if (info.comparable) {
    if (median != null && format) {
      const better =
        raw == null || raw === median ? null : info.better === 'high' ? raw > median : raw < median
      tag = (
        <span className={`peer-tag ${better == null ? '' : better ? 'good' : 'bad'}`} title={`Mediana de ${peers.count} competidores`}>
          Pares {format(median)}
          {better != null && <b>{better ? ' ▲ mejor' : ' ▼ peor'}</b>}
        </span>
      )
    } else if (info.peerKey && peers.loading) {
      tag = <span className="peer-tag">Pares…</span>
    } else {
      tag = <span className="peer-tag" title="Medida relativa: compárala con empresas del mismo sector">Comparar con pares</span>
    }
  }

  return (
    <div className={`stat ${open ? 'open' : ''}`}>
      <button className="stat-label" onClick={() => setOpen(!open)} aria-expanded={open} title="¿Qué es?">
        {label ?? info.name} <span className="info-dot" aria-hidden>i</span>
      </button>
      <div className={`value ${cls ?? ''}`}>{value}</div>
      {tag}
      {hint && <div className="hint">{hint}</div>}
      {open && (
        <div className="explain">
          <p><b>Qué es:</b> {info.what}</p>
          <p><b>Para qué sirve:</b> {info.use}</p>
          {info.ref && <p className="muted">{info.ref}</p>}
          {info.comparable && (
            <p className="muted">
              {info.better === 'high' ? 'Mayor es mejor' : 'Menor es mejor'} · medida relativa: compárala con la competencia.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
