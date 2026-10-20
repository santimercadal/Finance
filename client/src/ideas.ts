import type { Horizon } from './api'

// Shared by the ideas page, the home panel and the stock page.

export const HORIZONS: Record<Horizon, { label: string; span: string }> = {
  short: { label: 'Corto plazo', span: 'días a semanas' },
  mid: { label: 'Mediano plazo', span: 'semanas a meses' },
  long: { label: 'Largo plazo', span: 'meses a años' },
}

export const finvizQuote = (symbol: string) => `https://finviz.com/quote.ashx?t=${encodeURIComponent(symbol)}`
