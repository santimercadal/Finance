import { useState } from 'react'
import { useApi, type Horizon, type Ideas, type Portfolio } from '../api'
import IdeaCard from '../components/IdeaCard'
import { HORIZONS } from '../ideas'

export default function IdeasPage() {
  const { data, error } = useApi<Ideas>('/ideas')
  const portfolio = useApi<Portfolio>('/portfolio')
  const [horizon, setHorizon] = useState<Horizon>(() => {
    try { return (sessionStorage.getItem('ideas-horizon') as Horizon) || 'long' } catch { return 'long' }
  })
  const pick = (h: Horizon) => {
    setHorizon(h)
    try { sessionStorage.setItem('ideas-horizon', h) } catch { /* storage unavailable */ }
  }
  const owned = new Set(portfolio.data?.holdings.map((h) => h.symbol))
  const list = data?.horizons[horizon] ?? []

  return (
    <main className="page">
      <header className="page-head">
        <span className="eyebrow">Ideas de analistas</span>
        <h1>¿Qué recomiendan para cada plazo?</h1>
        <p>Empresas grandes de EE.UU. con consenso de compra, ordenadas por las señales técnicas de cada horizonte, la calificación de Argus y su valuación.</p>
      </header>

      <div className="horizon-tabs" role="tablist" aria-label="Plazo">
        {(Object.keys(HORIZONS) as Horizon[]).map((h) => (
          <button key={h} role="tab" aria-selected={h === horizon} className={h === horizon ? 'on' : ''} onClick={() => pick(h)}>
            <b>{HORIZONS[h].label.split(' ')[0]}</b>
            <span>{HORIZONS[h].span}</span>
          </button>
        ))}
      </div>

      {error && <div className="card error">No se pudieron cargar las ideas: {error}</div>}
      {!data && !error && (
        <div className="idea-list">
          {[0, 1, 2].map((i) => <div key={i} className="idea"><div className="skeleton" style={{ height: 120 }} /></div>)}
          <p className="note">La primera vez se analizan ~50 empresas; tarda unos segundos.</p>
        </div>
      )}
      {data && list.length === 0 && <div className="card empty">Hoy ninguna acción tiene señales alcistas claras para este plazo.</div>}
      {data && (
        <div className="idea-list">
          {list.map((idea, i) => <IdeaCard key={idea.symbol} idea={idea} rank={i + 1} horizon={horizon} owned={owned.has(idea.symbol)} />)}
        </div>
      )}

      {data && (
        <footer className="disclaimer">
          <p><b>No es una recomendación de inversión personal.</b> Son opiniones de analistas y señales técnicas de terceros; pueden cambiar en cualquier momento.</p>
          <p>Fuentes: {data.sources.join(' · ')}. {data.analyzed} empresas analizadas · actualizado {new Date(data.updatedAt).toLocaleString('es', { dateStyle: 'short', timeStyle: 'short' })}.</p>
        </footer>
      )}
    </main>
  )
}
