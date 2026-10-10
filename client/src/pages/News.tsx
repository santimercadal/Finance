import { useMemo, useState } from 'react'
import { useApi, type AnalystView, type NewsItem, type Portfolio } from '../api'
import { ratingLabel } from '../format'
import NewsList from '../components/NewsList'
import AnalystCard from '../components/AnalystCard'
import DailyDigest from '../components/DailyDigest'

// Pros and cons of every holding with analyst coverage; one expandable row each.
function AnalystsSection({ filter, portfolio }: { filter: string; portfolio: Portfolio | null }) {
  const { data, error } = useApi<AnalystView[]>('/analysts')
  const currency = (s: string) => portfolio?.holdings.find((h) => h.symbol === s)?.currency
  const name = (s: string) => portfolio?.holdings.find((h) => h.symbol === s)?.name
  const items = (data ?? []).filter((a) => filter === 'todas' || filter === 'portafolio' || a.symbol === filter)
  const uncovered = portfolio?.holdings.filter((h) => !(data ?? []).some((a) => a.symbol === h.symbol)).map((h) => h.symbol) ?? []

  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>Pros y contras de los analistas</h2>
          <span className="small muted">Toca una posición para ver los argumentos a favor y en contra</span>
        </div>
      </div>
      {error && <div className="error">{error}</div>}
      {!data && !error && <div className="skeleton" style={{ height: 120 }} />}
      {data && items.length === 0 && <div className="empty">No hay cobertura de analistas para {filter === 'todas' || filter === 'portafolio' ? 'tus posiciones' : filter}.</div>}
      <div className="analyst-list">
        {items.map((a) => {
          const rating = ratingLabel(a.rating)
          return (
            <details key={a.symbol} open={items.length === 1}>
              <summary>
                <span className="sym">{a.symbol}</span>
                <span className="small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name(a.symbol)}</span>
                {rating && <span className={`badge ${rating[1]}`}>{rating[0]}</span>}
              </summary>
              <AnalystCard a={a} currency={currency(a.symbol)} />
            </details>
          )
        })}
      </div>
      {data && uncovered.length > 0 && (filter === 'todas' || filter === 'portafolio') && (
        <div className="note">Sin cobertura (ETF, cripto o empresas fuera de EE.UU.): {uncovered.join(', ')}.</div>
      )}
    </section>
  )
}

export default function NewsPage() {
  const portfolio = useApi<Portfolio>('/portfolio')
  const news = useApi<NewsItem[]>('/news?limit=60', 10 * 60_000)
  const [filter, setFilter] = useState<string>('todas')

  const symbols = useMemo(() => portfolio.data?.holdings.map((h) => h.symbol) ?? [], [portfolio.data])
  const items = useMemo(() => {
    const all = news.data ?? []
    if (filter === 'todas') return all
    if (filter === 'portafolio') return all.filter((n) => n.tickers.some((t) => symbols.includes(t)))
    return all.filter((n) => n.tickers.includes(filter))
  }, [news.data, filter, symbols])

  return (
    <main>
      <section className="card">
        <div className="card-head">
          <h2>Noticias</h2>
          <div className="seg" style={{ flexWrap: 'wrap' }}>
            {['todas', 'portafolio', ...symbols].map((f) => (
              <button key={f} className={f === filter ? 'on' : ''} onClick={() => setFilter(f)}>
                {f === 'todas' ? 'Todas' : f === 'portafolio' ? 'Mi portafolio' : f}
              </button>
            ))}
          </div>
        </div>
        <DailyDigest setupTip />
      </section>
      <AnalystsSection filter={filter} portfolio={portfolio.data} />
      <section className="card">
        <div className="card-head"><h2>Titulares</h2></div>
        {news.error && <div className="error">{news.error}</div>}
        {news.data ? <NewsList items={items} /> : <div className="skeleton" style={{ height: 300 }} />}
      </section>
    </main>
  )
}
