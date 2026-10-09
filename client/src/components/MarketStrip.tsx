import { useApi, type Indicator } from '../api'
import { num, pct, tone } from '../format'

export default function MarketStrip() {
  const { data, error } = useApi<Indicator[]>('/market', 60_000)
  if (error) return <div className="error">No se pudieron cargar los indicadores: {error}</div>
  return (
    <div className="ticker" aria-label="Indicadores de mercado">
      {(data ?? Array.from({ length: 9 }, () => null)).map((i, idx) => (
        <div className="tick" key={i?.symbol ?? idx}>
          {i ? (
            <>
              <div className="label">{i.label}</div>
              <div className="price num">{num(i.price, i.price && i.price > 1000 ? 0 : 2)}{i.unit ?? ''}</div>
              <div className={`chg num ${tone(i.changePct)}`}>
                {i.changePct != null && (i.changePct > 0 ? '▲ ' : i.changePct < 0 ? '▼ ' : '')}
                {pct(i.changePct)}
              </div>
            </>
          ) : (
            <><div className="skeleton" style={{ width: 70 }} /><div className="skeleton" style={{ width: 90 }} /></>
          )}
        </div>
      ))}
    </div>
  )
}
