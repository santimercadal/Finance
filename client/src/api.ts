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
  type: string | null
  sector: string | null
  /** Units of `currency` per 1 USD. */
  fx: number
  beta: number | null
  price: number | null
  dayChangePct: number | null
  dayChangeUsd: number
  valueUsd: number | null
  costUsd: number
  pnlUsd: number | null
  pnlPct: number | null
  weight: number
  spark?: number[]
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
    beta: number | null
    betaCoverage: number | null
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

interface CashFlowRow {
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

interface DebtRow {
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

export interface FundIndicators {
  kind: 'etf' | 'crypto'
  returns: Record<string, number | null>
  risk: {
    volatility: number | null
    maxDrawdown1y: number | null
    maxDrawdown5y: number | null
    beta: number | null
    correlation: number | null
    sharpe: number | null
    riskFree: number | null
  }
  dividends: {
    yield: number | null
    ttmAmount: number | null
    frequency: string | null
    last: { date: string; amount: number } | null
  }
  inception: string | null
  fund: {
    available: boolean
    family: string | null
    category: string | null
    expenseRatio: number | null
    totalAssets: number | null
    holdings: { symbol: string; name: string; weight: number }[]
    sectors: { sector: string; weight: number }[]
  } | null
}

interface Outlook { direction: string; score: number | null }

export interface AnalystView {
  symbol: string
  pros: string[]
  cons: string[]
  translated: boolean
  prosConsSource: string | null
  prosConsDate: string | null
  rating: string | null
  targetPrice: number | null
  ratingSource: string | null
  valuation: { label: string; discount: string | null; source: string } | null
  outlook: { short: Outlook | null; mid: Outlook | null; long: Outlook | null; source: string | null } | null
}

export interface StockDetail {
  symbol: string
  kind: 'equity' | 'etf' | 'crypto'
  fund?: FundIndicators
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

interface PeerCompany {
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

interface EstimateRange {
  avg: number
  low: number | null
  high: number | null
  analysts: number | null
  growth: number | null
}

export interface EstimatePeriod {
  kind: 'quarter' | 'year'
  end: string | null
  label: string
  eps: EstimateRange
  epsYearAgo: number | null
  revenue: EstimateRange | null
  revisions: { up: number; down: number } | null
  impliedPrice: number | null
  impliedUpside: number | null
}

export interface Estimates {
  symbol: string
  currency: string
  epsCurrency: string
  price: number
  pe: number | null
  source: string | null
  target: { low: number | null; mean: number; high: number | null; analysts: number | null; upside: number | null; source: string | null } | null
  argus: { target: number; rating: string | null } | null
  ratings: { strongBuy: number; buy: number; hold: number; sell: number; strongSell: number } | null
  periods: EstimatePeriod[]
  surprises: { quarter: string; actual: number; estimate: number; surprisePct: number | null }[]
  history: { end: string; eps: number }[]
}

export interface Reports {
  symbol: string
  name: string
  currency: string
  nextEarnings: string | null
  filings: { date: string; type: string; label: string; title: string; documentUrl: string | null; viewUrl: string | null }[]
  sec?: { available: boolean; reason: string | null }
  quarterly: { dates: string[]; rows: { label: string; key: string; values: (number | null)[] }[] }
}

export interface ScreenRow {
  symbol: string
  name: string
  price: number | null
  changePct: number | null
  marketCap: number | null
  volume: number | null
  sector: string | null
  industry: string | null
  country: string | null
}

export interface ScreenResult { total: number; results: ScreenRow[]; source: string }

export interface StyleInfo { key: string; name: string; description: string; profile: string }

export interface StyleRow {
  symbol: string
  name: string
  price: number
  currency: string
  changePct: number | null
  marketCap: number | null
  pe: number | null
  forwardPe: number | null
  dividendYield: number | null
  yearChangePct: number | null
  /** 1 = strong buy … 5 = sell */
  analystScore: number | null
  analystLabel: string | null
}

export interface StyleResult extends StyleInfo { style: string; finvizUrl: string; results: StyleRow[]; source: string }

export type Horizon = 'short' | 'mid' | 'long'
interface IdeaOutlook { direction: 'alcista' | 'bajista' | 'neutral'; score: number; signed: number }

export interface Idea {
  symbol: string
  name: string
  sector: string | null
  price: number | null
  changePct: number | null
  marketCap: number | null
  consensus: string
  outlook: Record<Horizon, IdeaOutlook | null>
  argus: { rating: string; target: number | null; upside: number | null } | null
  valuation: { label: string; discount: string | null } | null
  score: number
  reasons: string[]
}

export interface Ideas {
  updatedAt: string
  analyzed: number
  horizons: Record<Horizon, Idea[]>
  sources: string[]
}

export interface AiUsage {
  enabled: boolean
  model?: string
  today?: { requests: number; tokens: number; errors: number }
  dailyTokenLimit?: number | null
  limits?: {
    at: string
    requestsPerDay: number | null
    requestsLeft: number | null
    requestsReset: string | null
    tokensPerMinute: number | null
    tokensLeft: number | null
    tokensReset: string | null
  } | null
  pausedUntil?: string | null
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
// Opens the customize sheet from anywhere in the app.
export const CUSTOMIZE_EVENT = 'app-customize'

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

interface ApiState<T> {
  path: string | null
  data: T | null
  error: string | null
  updatedAt: Date | null
}

// Fetch helper with loading/error state and an optional auto-refresh interval.
// Results are tagged with their path, so when the path changes the previous
// data is hidden right away and late responses for an old path are ignored.
export function useApi<T>(path: string | null, refreshMs?: number) {
  const [state, setState] = useState<ApiState<T>>({ path: null, data: null, error: null, updatedAt: null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!path) return
    let active = true
    const load = () =>
      api<T>(path).then(
        (data) => active && setState({ path, data, error: null, updatedAt: new Date() }),
        (e: Error) =>
          active &&
          // Keep the last good data for this path: a failed refresh shouldn't blank the page.
          setState((s) => (s.path === path ? { ...s, error: e.message } : { path, data: null, error: e.message, updatedAt: null })),
      )
    load()
    const id = refreshMs ? setInterval(load, refreshMs) : undefined
    return () => {
      active = false
      clearInterval(id)
    }
  }, [path, refreshMs, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  const current = state.path === path
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: path != null && !current,
    updatedAt: current ? state.updatedAt : null,
    reload,
  }
}
