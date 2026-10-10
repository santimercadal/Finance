import { useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { METRICS, type MetricId, type MetricInfo } from '../metrics'
import { PeerContext } from './peerContext'

interface Props {
  id: MetricId
  value: string
  /** Raw numeric value, used to compare against the peer median. */
  raw?: number | null
  /** Formats the peer median the same way as `value`. */
  format?: (v: number) => string
  hint?: string
  cls?: string
  label?: string
}

interface SheetProps {
  info: MetricInfo
  title: string
  value: string
  median: string | null
  better: boolean | null
  peerCount: number
  onClose: () => void
}

// Explanation shown as a bottom sheet on phones and a centered dialog on desktop.
function MetricSheet({ info, title, value, median, better, peerCount, onClose }: SheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <h2>{title}</h2>
        {info.comparable && (
          <span className="badge">
            Medida relativa · {info.better === 'high' ? 'mayor es mejor' : 'menor es mejor'}
          </span>
        )}
        {median != null ? (
          <div className="compare-box">
            <div><div className="small muted">Esta empresa</div><div className="value">{value}</div></div>
            <div>
              <div className="small muted">Mediana de {peerCount} competidores</div>
              <div className="value">{median}</div>
              {better != null && <span className={`badge ${better ? 'good' : 'bad'}`}>{better ? '▲ Mejor que sus pares' : '▼ Peor que sus pares'}</span>}
            </div>
          </div>
        ) : (
          <div className="sheet-value">{value}</div>
        )}
        <section><h3>Qué es</h3><p>{info.what}</p></section>
        <section><h3>Para qué sirve</h3><p>{info.use}</p></section>
        {info.ref && <section><h3>Referencia</h3><p>{info.ref}</p></section>}
        <button className="btn ghost" onClick={onClose}>Cerrar</button>
      </div>
    </div>,
    document.body,
  )
}

export default function MetricStat({ id, value, raw, format, hint, cls, label }: Props) {
  const info: MetricInfo = METRICS[id]
  const [open, setOpen] = useState(false)
  const peers = useContext(PeerContext)
  const median = info.peerKey ? peers.medians[info.peerKey] : null
  const hasMedian = median != null && format != null
  const better =
    !hasMedian || raw == null || raw === median ? null : info.better === 'high' ? raw > median : raw < median

  let tag: React.ReactNode = null
  if (info.comparable) {
    if (hasMedian) {
      tag = (
        <span className={`peer-tag ${better == null ? '' : better ? 'good' : 'bad'}`} title={`Mediana de ${peers.count} competidores`}>
          Pares {format(median)}
          {better != null && <b>{better ? ' ▲' : ' ▼'}</b>}
        </span>
      )
    } else if (info.peerKey && peers.loading) {
      tag = <span className="peer-tag">Pares…</span>
    } else {
      tag = <span className="peer-tag" title="Medida relativa: compárala con empresas del mismo sector">Comparar con pares</span>
    }
  }

  const title = label ?? info.name
  return (
    <div className="stat">
      <button className="stat-label" onClick={() => setOpen(true)} title="¿Qué es?">
        <span>{title}</span> <span className="info-dot" aria-hidden>i</span>
      </button>
      <div className={`value ${cls ?? ''}`}>{value}</div>
      {tag}
      {hint && <div className="hint">{hint}</div>}
      {open && (
        <MetricSheet
          info={info}
          title={title}
          value={value}
          median={hasMedian ? format(median) : null}
          better={better}
          peerCount={peers.count}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
