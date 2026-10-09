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

export const scoreClass = (score: number) => (score >= 67 ? 'good' : score >= 40 ? 'mid' : 'bad')
