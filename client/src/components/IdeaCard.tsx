import { Link } from 'react-router-dom'
import type { Horizon, Idea } from '../api'
import { money, pct, tone } from '../format'
import Icon from '../icons'
import { finvizQuote, HORIZONS } from '../ideas'

// Trading Central's direction for the three horizons; the selected one stands out.
export function HorizonMeter({ idea, active }: { idea: Idea; active?: Horizon }) {
  return (
    <div className="horizon-meter" aria-label="Señales técnicas por plazo">
      {(Object.keys(HORIZONS) as Horizon[]).map((h) => {
        const o = idea.outlook[h]
        const dir = o?.direction ?? 'neutral'
        return (
          <span key={h} className={`hm ${dir} ${h === active ? 'active' : ''}`} title={`${HORIZONS[h].label}: ${o ? `${dir} (${o.score}/4)` : 'sin datos'}`}>
            <i>{h === 'short' ? 'C' : h === 'mid' ? 'M' : 'L'}</i>
            <span className="hm-label">{HORIZONS[h].label.split(' ')[0]}</span>
            <b aria-label={dir}>{dir === 'alcista' ? '↑' : dir === 'bajista' ? '↓' : '→'}</b>
          </span>
        )
      })}
    </div>
  )
}

export default function IdeaCard({ idea, rank, horizon, owned }: { idea: Idea; rank: number; horizon: Horizon; owned?: boolean }) {
  const to = `/accion/${encodeURIComponent(idea.symbol)}`
  return (
    <article className="idea">
      <div className="idea-head">
        <span className="idea-rank" aria-label={`Puesto ${rank}`}>{String(rank).padStart(2, '0')}</span>
        <Link to={to} className="idea-id">
          <span className="idea-sym">{idea.symbol}</span>
          <span className="idea-name">{idea.name}</span>
        </Link>
        <div className="idea-price">
          <span className="num">{money(idea.price)}</span>
          <span className={`num idea-chg ${tone(idea.changePct)}`}>
            {(idea.changePct ?? 0) > 0 ? '▲' : (idea.changePct ?? 0) < 0 ? '▼' : ''} {pct(idea.changePct)}
          </span>
        </div>
      </div>
      <div className="idea-tags">
        <span className={`pill-tag ${idea.consensus === 'Compra fuerte' ? 'strong' : ''}`}><i />{idea.consensus}</span>
        {idea.argus?.upside != null && (
          <span className="pill-tag" title="Precio objetivo de Argus Research">
            Obj. {money(idea.argus.target, 'USD', 0)} · <b className={tone(idea.argus.upside)}>{pct(idea.argus.upside, 0)}</b>
          </span>
        )}
        {idea.sector && <span className="pill-tag quiet">{idea.sector}</span>}
        {owned && <span className="pill-tag owned">En tu portafolio</span>}
      </div>
      <HorizonMeter idea={idea} active={horizon} />
      <ul className="idea-reasons">
        {idea.reasons.map((r) => <li key={r} className={r.startsWith('Infravalorada') ? 'value' : ''}>{r}</li>)}
      </ul>
      <div className="idea-foot">
        <a href={finvizQuote(idea.symbol)} target="_blank" rel="noreferrer" className="btn ghost sm">Finviz <Icon name="external" size={13} /></a>
        <Link to={to} className="btn sm">Análisis <Icon name="arrow" size={14} /></Link>
      </div>
    </article>
  )
}
