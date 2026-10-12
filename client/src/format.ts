const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export function money(v: number | null | undefined, currency = 'USD', digits = 2) {
  if (!isNum(v)) return '—'
  try {
    return new Intl.NumberFormat('es', { style: 'currency', currency, maximumFractionDigits: digits, minimumFractionDigits: digits, useGrouping: 'always' }).format(v)
  } catch {
    return `${num(v, digits)} ${currency}`
  }
}

export function num(v: number | null | undefined, digits = 2) {
  if (!isNum(v)) return '—'
  return new Intl.NumberFormat('es', { maximumFractionDigits: digits, minimumFractionDigits: digits, useGrouping: 'always' }).format(v)
}

// Compact large amounts: 1,2 B / 350 M / 12 K
export function compact(v: number | null | undefined, currency?: string) {
  if (!isNum(v)) return '—'
  const abs = Math.abs(v)
  const [div, suffix] =
    abs >= 1e12 ? [1e12, ' B'] : abs >= 1e9 ? [1e9, ' MM'] : abs >= 1e6 ? [1e6, ' M'] : abs >= 1e3 ? [1e3, ' K'] : [1, '']
  const out = `${num(v / div, abs >= 1e3 ? 1 : 0)}${suffix}`
  return currency ? `${out} ${currency}` : out
}

// Spelled-out scale for headline amounts, so "5,0 B" can't be read as five
// (English) billions: 4,98 billones (= 4,98 trillion en inglés) / 105,7 mil millones.
export function bigAmount(v: number | null | undefined, currency?: string) {
  if (!isNum(v)) return '—'
  const abs = Math.abs(v)
  const [div, words, en] =
    abs >= 1e12 ? [1e12, 'billones', 'trillion'] : abs >= 1e9 ? [1e9, 'mil millones', 'billion'] : abs >= 1e6 ? [1e6, 'millones', 'million'] : [1, '', '']
  const n = num(v / div, div > 1 ? 2 : 0)
  return `${n}${words ? ` ${words}` : ''}${currency ? ` ${currency}` : ''}${en ? ` (${n} ${en} en inglés)` : ''}`
}

export function pct(v: number | null | undefined, digits = 2, signed = true) {
  if (!isNum(v)) return '—'
  const s = num(v, digits)
  return `${signed && v > 0 ? '+' : ''}${s}%`
}

export function signedMoney(v: number | null | undefined, currency = 'USD') {
  if (!isNum(v)) return '—'
  return `${v > 0 ? '+' : ''}${money(v, currency)}`
}

export const tone = (v: number | null | undefined) => (!isNum(v) || v === 0 ? 'flat' : v > 0 ? 'up' : 'down')

export function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 60) return `hace ${Math.max(mins, 1)} min`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `hace ${hours} h`
  const days = Math.round(hours / 24)
  return `hace ${days} d`
}

export const year = (date: string) => date.slice(0, 4)

// The API sends calendar dates as YYYY-MM-DD. Read them at noon so the local
// time zone (UTC-3) can't move them to the previous day.
const asDate = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00` : d)

export const formatDate = (d: string | null | undefined, style: 'medium' | 'long' = 'medium') =>
  d ? asDate(d).toLocaleDateString('es', { dateStyle: style }) : '—'

export const monthLabel = (d: string) => asDate(d).toLocaleDateString('es', { month: 'short', year: '2-digit' })

export const quarterLabel = (d: string) => {
  const date = asDate(d)
  return `T${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`
}

const RATINGS: Record<string, [label: string, tone: string]> = {
  BUY: ['Comprar', 'up'],
  STRONG_BUY: ['Compra fuerte', 'up'],
  HOLD: ['Mantener', 'mid'],
  SELL: ['Vender', 'down'],
  STRONG_SELL: ['Venta fuerte', 'down'],
}

// Analyst rating ("BUY", "hold"…) -> [Spanish label, tone class].
export const ratingLabel = (rating: string | null): [string, string] | null =>
  rating ? RATINGS[rating.toUpperCase()] ?? [rating, ''] : null

export const scoreClass =(score: number) => (score >= 67 ? 'good' : score >= 40 ? 'mid' : 'bad')
