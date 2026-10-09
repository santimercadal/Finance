import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, type NewsItem } from '../api'
import { ago } from '../format'

interface Summary {
  summary: string | null
  source: 'ai' | 'extract' | 'none'
}

const summaryCache = new Map<string, Promise<Summary>>()
function fetchSummary(n: NewsItem) {
  let p = summaryCache.get(n.link)
  if (!p) {
    p = api<Summary>(`/news/summary?url=${encodeURIComponent(n.link)}&title=${encodeURIComponent(n.title)}`)
      .catch(() => ({ summary: null, source: 'none' as const }))
    summaryCache.set(n.link, p)
  }
  return p
}

function NewsRow({ item, withSummary }: { item: NewsItem; withSummary: boolean }) {
  const [summary, setSummary] = useState<Summary | null>(null)
  useEffect(() => {
    if (!withSummary) return
    let alive = true
    fetchSummary(item).then((s) => alive && setSummary(s))
    return () => { alive = false }
  }, [item, withSummary])

  return (
    <article className="news-item">
      <div>
        <a className="title" href={item.link} target="_blank" rel="noreferrer">{item.title}</a>
        <div className="meta">
          <span>{item.publisher}</span>·<span>{ago(item.time)}</span>
          {item.tickers.slice(0, 4).map((t) => (
            <Link key={t} to={`/accion/${encodeURIComponent(t)}`} className="chip">{t}</Link>
          ))}
          {summary?.source === 'ai' && <span className="chip" title="Resumen generado con IA">✨ IA</span>}
        </div>
        {withSummary && (
          summary ? (
            summary.summary && <div className="summary">{summary.summary}</div>
          ) : (
            <><div className="skeleton" style={{ width: '95%' }} /><div className="skeleton" style={{ width: '70%' }} /></>
          )
        )}
      </div>
      {item.thumbnail && <img src={item.thumbnail} alt="" loading="lazy" />}
    </article>
  )
}

export default function NewsList({ items, withSummary = true }: { items: NewsItem[]; withSummary?: boolean }) {
  if (!items.length) return <div className="empty">No hay noticias por ahora.</div>
  return (
    <div className="news-list">
      {items.map((n) => <NewsRow key={n.id} item={n} withSummary={withSummary} />)}
    </div>
  )
}
