import { createContext, useContext } from 'react'

export type PanelId = 'market' | 'hero' | 'actions' | 'news' | 'ideas' | 'metrics' | 'allocation' | 'positions' | 'tip'
export type StartPage = 'portfolio' | 'news' | 'ideas' | 'explore'
export type Theme = 'system' | 'light' | 'dark'

export interface Prefs {
  startPage: StartPage
  theme: Theme
  panels: { id: PanelId; visible: boolean }[]
}

// Home panels in their default order, with the name and description shown in
// the customize sheet.
export const PANELS: Record<PanelId, { label: string; hint: string }> = {
  market: { label: 'Indicadores de mercado', hint: 'S&P 500, Nasdaq, VIX, dólar, oro, bitcoin' },
  hero: { label: 'Patrimonio y rendimiento', hint: 'Valor total, variación del día y gráfico vs. S&P 500' },
  actions: { label: 'Acciones rápidas', hint: 'Sincronizar eToro, agregar o importar posiciones' },
  news: { label: 'Noticias', hint: 'Resumen del día y últimos titulares de tus posiciones' },
  ideas: { label: 'Ideas de analistas', hint: 'Recomendadas para corto, mediano y largo plazo' },
  metrics: { label: 'Métricas clave', hint: 'Ganancia total, mejor y peor del día, beta' },
  allocation: { label: 'Distribución', hint: 'Cómo se reparte el portafolio' },
  positions: { label: 'Tus posiciones', hint: 'Lista de acciones, ETF y cripto' },
  tip: { label: 'Alerta de concentración', hint: 'Avisa si una posición pesa demasiado' },
}

export const START_PAGES: Record<StartPage, { label: string; path: string }> = {
  portfolio: { label: 'Portafolio', path: '/' },
  news: { label: 'Noticias', path: '/noticias' },
  ideas: { label: 'Ideas', path: '/ideas' },
  explore: { label: 'Explorar', path: '/explorar' },
}

export const DEFAULT_PREFS: Prefs = {
  startPage: 'portfolio',
  theme: 'system',
  panels: (Object.keys(PANELS) as PanelId[]).map((id) => ({ id, visible: true })),
}

// Saved order first; panels added in a later version go at the end.
export function normalizePrefs(p: Partial<Prefs> | null): Prefs {
  const known = (p?.panels ?? []).filter((x) => x.id in PANELS)
  const ids = new Set(known.map((x) => x.id))
  return {
    startPage: p?.startPage && p.startPage in START_PAGES ? p.startPage : DEFAULT_PREFS.startPage,
    theme: p?.theme ?? DEFAULT_PREFS.theme,
    panels: [...known, ...DEFAULT_PREFS.panels.filter((x) => !ids.has(x.id))],
  }
}

export interface PrefsCtx {
  prefs: Prefs
  /** True once the saved preferences (device cache or server) are known. */
  ready: boolean
  update: (change: Partial<Prefs>) => void
  reset: () => void
}

export const PrefsContext = createContext<PrefsCtx>({ prefs: DEFAULT_PREFS, ready: false, update: () => {}, reset: () => {} })

export const usePrefs = () => useContext(PrefsContext)
