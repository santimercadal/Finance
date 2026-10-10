import type { AnalystView } from '../api'
import { formatDate, money, ratingLabel } from '../format'

const TONE: Record<string, string> = { alcista: 'up', bajista: 'down', neutral: 'mid' }

// Pros and cons from Morningstar's bull/bear case plus the published rating,
// target and technical outlook. Text is the analysts', not the app's.
export default function AnalystCard({ a, currency }: { a: AnalystView; currency?: string }) {
  const rating = ratingLabel(a.rating)
  const outlook = a.outlook
    ? ([['Corto', a.outlook.short], ['Mediano', a.outlook.mid], ['Largo', a.outlook.long]] as const).filter(([, o]) => o)
    : []
  return (
    <div className="analyst">
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
        {a.prosConsSource && <>Pros y contras: {a.prosConsSource}{a.prosConsDate ? ` (${formatDate(a.prosConsDate)})` : ''}{!a.translated && ' · en inglés, la traducción está en curso'}. </>}
        {a.ratingSource && <>Calificación: {a.ratingSource}. </>}
        {a.outlook?.source && <>Perspectiva técnica: {a.outlook.source}. </>}
        Vía Yahoo Finance. Es la opinión de los analistas, no una recomendación de la app.
      </div>
    </div>
  )
}
