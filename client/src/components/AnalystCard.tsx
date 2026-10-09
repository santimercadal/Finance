import { Link } from 'react-router-dom'
import type { AnalystView } from '../api'
import { money } from '../format'

const RATING: Record<string, [string, string]> = {
  BUY: ['Comprar', 'up'],
  STRONG_BUY: ['Compra fuerte', 'up'],
  HOLD: ['Mantener', 'mid'],
  SELL: ['Vender', 'down'],
  STRONG_SELL: ['Venta fuerte', 'down'],
}
const TONE: Record<string, string> = { alcista: 'up', bajista: 'down', neutral: 'mid' }

// Pros and cons from Morningstar's bull/bear case plus the published rating,
// target and technical outlook. Text is the analysts', not the app's.
export default function AnalystCard({ a, currency, title }: { a: AnalystView; currency?: string; title?: boolean }) {
  const rating = a.rating ? RATING[a.rating.toUpperCase()] ?? [a.rating, ''] : null
  const outlook = a.outlook
    ? ([['Corto', a.outlook.short], ['Mediano', a.outlook.mid], ['Largo', a.outlook.long]] as const).filter(([, o]) => o)
    : []
  return (
    <div className="analyst">
      {title && (
        <div className="analyst-head">
          <Link to={`/accion/${encodeURIComponent(a.symbol)}`} className="sym">{a.symbol}</Link>
        </div>
      )}
      <div className="analyst-tags">
        {rating && (
          <span className={`badge ${rating[1]}`} title={a.ratingSource ?? undefined}>
            {a.ratingSource ?? 'Analista'}: {rating[0]}{a.targetPrice ? ` · objetivo ${money(a.targetPrice, currency)}` : ''}
          </span>
        )}
        {a.valuation && (
          <span className="badge" title={a.valuation.source}>
            {a.valuation.label}{a.valuation.discount ? ` (${a.valuation.discount})` : ''}
          </span>
        )}
        {outlook.map(([label, o]) => (
          <span key={label} className={`badge ${TONE[o!.direction] ?? ''}`} title={`Perspectiva técnica (${a.outlook?.source ?? ''})`}>
            {label} plazo: {o!.direction}
          </span>
        ))}
      </div>
      {(a.pros.length > 0 || a.cons.length > 0) && (
        <div className="pros-cons">
          <div>
            <h3 className="up">▲ Pros</h3>
            <ul>{a.pros.map((p) => <li key={p}>{p}</li>)}</ul>
          </div>
          <div>
            <h3 className="down">▼ Contras</h3>
            <ul>{a.cons.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        </div>
      )}
      <div className="note">
        {a.prosConsSource && <>Pros y contras: {a.prosConsSource}{a.prosConsDate ? ` (${new Date(`${a.prosConsDate}T12:00:00`).toLocaleDateString('es', { dateStyle: 'medium' })})` : ''}{!a.translated && ' · en inglés, la traducción está en curso'}. </>}
        {a.ratingSource && <>Calificación: {a.ratingSource}. </>}
        {a.outlook?.source && <>Perspectiva técnica: {a.outlook.source}. </>}
        Vía Yahoo Finance. Es la opinión de los analistas, no una recomendación de la app.
      </div>
    </div>
  )
}
