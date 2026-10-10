import { useState } from 'react'
import { api } from '../api'

// eToro and other brokers list crypto without the "-USD" suffix Yahoo uses.
const CRYPTO = new Set(['BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'LTC', 'BNB', 'AVAX', 'LINK', 'MATIC', 'SHIB', 'TRX', 'XLM', 'BCH'])

// "1.234,5" / "1,234.5" / "1,5" / "1.5" -> number; the last separator is the decimal one.
function parseNumber(raw: string) {
  const s = raw.replace(/[$€£\s]/g, '')
  const lastDot = s.lastIndexOf('.')
  const lastComma = s.lastIndexOf(',')
  const normalized =
    lastComma > lastDot ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '')
  return Number(normalized)
}

interface ParsedRow { symbol: string; shares: number; avgCost: number }

// One holding per line: TICKER UNITS AVG_COST (separated by spaces, tabs or ";").
function parseHoldings(text: string): { rows: ParsedRow[]; errors: string[] } {
  const rows: ParsedRow[] = []
  const errors: string[] = []
  for (const line of text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
    const parts = line.split(/[\s;|]+/).filter(Boolean)
    if (parts.length < 3) {
      errors.push(`"${line}": faltan datos (ticker, unidades y precio promedio)`)
      continue
    }
    let symbol = parts[0].toUpperCase()
    if (CRYPTO.has(symbol)) symbol = `${symbol}-USD`
    const shares = parseNumber(parts[1])
    const avgCost = parseNumber(parts[2])
    if (!(shares > 0) || !(avgCost >= 0)) {
      errors.push(`"${line}": números inválidos`)
      continue
    }
    rows.push({ symbol, shares, avgCost })
  }
  return { rows, errors }
}

export default function ImportHoldings({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [text, setText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const { rows, errors } = parseHoldings(text)

  const submit = async () => {
    setBusy(true)
    setError(null)
    try {
      await api('/portfolio', { method: 'PUT', body: JSON.stringify({ holdings: rows }) })
      onDone()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="import-box">
      <p className="small muted" style={{ margin: '0 0 8px' }}>
        Una posición por línea: <code>TICKER UNIDADES PRECIO_PROMEDIO</code> (precio en la moneda del activo).
        Reemplaza todo el portafolio actual. Las cripto (BTC, ETH…) se convierten al formato de Yahoo.
      </p>
      <textarea
        className="input"
        rows={8}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'AAPL 2.5 182.30\nSPY 1.01836 582.53\nBNP.PA 1 78.34'}
        spellCheck={false}
      />
      {errors.map((e) => <div key={e} className="error small">{e}</div>)}
      {error && <div className="error">{error}</div>}
      <div className="import-actions">
        <span className="small muted">{rows.length} posiciones detectadas</span>
        <button className="btn ghost" onClick={onCancel}>Cancelar</button>
        <button className="btn" disabled={busy || !rows.length || errors.length > 0} onClick={submit}>
          {busy ? 'Importando…' : 'Reemplazar portafolio'}
        </button>
      </div>
    </div>
  )
}
