import { useMemo, useState } from 'react'
import { useApi, type NewsItem, type Portfolio } from '../api'
import NewsList from '../components/NewsList'

export default function NewsPage() {
  const portfolio = useApi<Portfolio>('/portfolio')
  const news = useApi<NewsItem[]>('/news?limit=60', 10 * 60_000)
  const digest = useApi<{ digest: string | null; ai: boolean }>('/news/digest')
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
        {digest.data?.digest ? (
          <div style={{ marginBottom: 12 }}>
            <h3 style={{ marginBottom: 6 }}>✨ Resumen del día</h3>
            <div className="digest">{digest.data.digest}</div>
          </div>
        ) : digest.data && !digest.data.ai ? (
          <div className="note" style={{ marginBottom: 8 }}>
            Tip: configura <code>ANTHROPIC_API_KEY</code> en <code>server/.env</code> para obtener un resumen del día y resúmenes con IA en español.
          </div>
        ) : null}
        {news.error && <div className="error">{news.error}</div>}
        {news.data ? <NewsList items={items} /> : <div className="skeleton" style={{ height: 300 }} />}
      </section>
    </main>
  )
}
