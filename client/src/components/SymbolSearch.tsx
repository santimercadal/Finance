import { useEffect, useState } from 'react'
import { api, type SearchResult } from '../api'

interface Props {
  placeholder?: string
  onSelect: (r: SearchResult) => void
  className?: string
}

export default function SymbolSearch({ placeholder, onSelect, className = 'search' }: Props) {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [open, setOpen] = useState(false)
  const [hl, setHl] = useState(0)

  useEffect(() => {
    const term = q.trim()
    if (!term) return setResults([])
    const id = setTimeout(() => {
      api<SearchResult[]>(`/search?q=${encodeURIComponent(term)}`)
        .then((r) => { setResults(r); setHl(0) })
        .catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(id)
  }, [q])

  const pick = (r: SearchResult) => {
    onSelect(r)
    setQ('')
    setResults([])
    setOpen(false)
  }

  return (
    <div className={className}>
      <input
        className="input"
        value={q}
        placeholder={placeholder}
        onChange={(e) => { setQ(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setHl((h) => Math.min(h + 1, results.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setHl((h) => Math.max(h - 1, 0)) }
          if (e.key === 'Enter') {
            if (results[hl]) pick(results[hl])
            else if (q.trim()) pick({ symbol: q.trim().toUpperCase(), name: '', type: '', exchange: '' })
          }
          if (e.key === 'Escape') setOpen(false)
        }}
      />
      {open && results.length > 0 && (
        <div className="search-results">
          {results.map((r, i) => (
            <button key={r.symbol} className={i === hl ? 'hl' : ''} onMouseDown={() => pick(r)}>
              <span><b>{r.symbol}</b> <span className="muted small">{r.name}</span></span>
              <span className="muted small">{r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
