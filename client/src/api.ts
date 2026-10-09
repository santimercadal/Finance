import { useCallback, useEffect, useState } from 'react'

export interface Indicator {
  symbol: string
  label: string
  unit?: string
  price: number | null
  change: number | null
  changePct: number | null
}

export interface Holding {
  symbol: string
  shares: number
  avgCost: number
  name: string
  currency: string
  price: number | null
  dayChangePct: number | null
  dayChangeUsd: number
  valueUsd: number | null
  costUsd: number
  pnlUsd: number | null
  pnlPct: number | null
  weight: number
}

export interface Portfolio {
  holdings: Holding[]
  totals: {
    value: number
    cost: number
    pnl: number
    pnlPct: number | null
    dayChange: number
    dayChangePct: number | null
    best: { symbol: string; pct: number } | null
    worst: { symbol: string; pct: number } | null
  }
}

export interface PortfolioHistory {
  points: { date: string; value: number; benchmark: number | null }[]
  returns: Record<string, number | null>
}

export interface NewsItem {
  id: string
  title: string
  publisher: string
  link: string
  time: string
  tickers: string[]
  thumbnail: string | null
}

export interface BalanceRow {
  date: string
  totalAssets: number | null
  currentAssets: number | null
  nonCurrentAssets: number | null
  cash: number | null
  receivables: number | null
  inventory: number | null
  ppe: number | null
  intangibles: number | null
  totalLiabilities: number | null
  currentLiabilities: number | null
  nonCurrentLiabilities: number | null
  payables: number | null
  currentDebt: number | null
  longTermDebt: number | null
  totalDebt: number | null
  equity: number | null
  liabilitiesPct: number | null
  equityPct: number | null
  currentRatio: number | null
  debtToEquity: number | null
  workingCapital: number | null
}

export interface CashFlowRow {
  date: string
  operating: number | null
  investing: number | null
  financing: number | null
  capex: number | null
  freeCashFlow: number | null
  dividends: number | null
  buybacks: number | null
  debtIssued: number | null
  debtRepaid: number | null
  netChange: number | null
  endCash: number | null
  netIncome: number | null
  revenue: number | null
}

export interface DebtRow {
  date: string
  totalDebt: number | null
  netDebt: number | null
  interestExpense: number | null
  costOfDebt: number | null
  taxRate: number | null
  afterTaxCostOfDebt: number | null
  interestCoverage: number | null
  debtToEquity: number | null
  netDebtToEbitda: number | null
  debtToAssets: number | null
  ebit: number | null
  ebitda: number | null
}

export interface StockDetail {
  symbol: string
  quote: {
    name: string
    price: number
    change: number
    changePct: number
    currency: string
    exchange: string
    marketCap: number | null
    marketState: string
    fiftyTwoWeekLow: number | null
    fiftyTwoWeekHigh: number | null
  }
  profile: {
    sector?: string
    industry?: string
    country?: string
    employees?: number
    website?: string
    description?: string
  }
  keyStats: Record<string, number | string | null> & { financialCurrency: string }
  balance: { latest: BalanceRow | null; history: BalanceRow[] }
  cashFlow: CashFlowRow[]
  debt: DebtRow[]
  chart: { date: string; close: number }[]
}

export interface SearchResult {
  symbol: string
  name: string
  type: string
  exchange: string
}

export interface PeerCompany {
  symbol: string
  name: string
  industry?: string
  marketCap: number | null
  price: number | null
  currency: string
  changePct: number | null
  isSelf: boolean
  metrics: Record<string, number | null>
}

export interface PeerComparison {
  symbol: string
  industry?: string
  sector?: string
  score: number | null
  verdict: string | null
  categories: { name: string; score: number; verdict: string }[]
  metrics: {
    key: string
    category: string
    better: 'high' | 'low'
    scored: boolean
    value: number | null
    peerMedian: number | null
    score: number | null
  }[]
  companies: PeerCompany[]
}

export interface Reports {
  symbol: string
  name: string
  currency: string
  nextEarnings: string | null
  filings: { date: string; type: string; label: string; title: string; documentUrl: string | null; viewUrl: string | null }[]
  quarterly: { dates: string[]; rows: { label: string; key: string; values: (number | null)[] }[] }
}

const KEY_STORAGE = 'app-key'
export const getAppKey = () => {
  try { return localStorage.getItem(KEY_STORAGE) ?? '' } catch { return '' }
}
export const setAppKey = (key: string) => {
  try { localStorage.setItem(KEY_STORAGE, key) } catch { /* storage unavailable: key lasts for this page only */ }
}

// Fired when the server asks for the password, so the app can show the login screen.
export const AUTH_EVENT = 'app-auth-required'

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', 'x-app-key': getAppKey(), ...init?.headers },
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 401 && body.auth) window.dispatchEvent(new Event(AUTH_EVENT))
  if (!res.ok) throw new Error(body.error || `Error ${res.status}`)
  return body as T
}

// Fetch helper with loading/error state and an optional auto-refresh interval.
export function useApi<T>(path: string | null, refreshMs?: number) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!path) return
    try {
      setData(await api<T>(path))
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [path])

  useEffect(() => {
    setLoading(true)
    setData(null)
    load()
    if (!refreshMs) return
    const id = setInterval(load, refreshMs)
    return () => clearInterval(id)
  }, [load, refreshMs])

  return { data, error, loading, reload: load }
}
