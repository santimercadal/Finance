import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { api } from '../api'
import { DEFAULT_PREFS, normalizePrefs, PrefsContext, type Prefs, type Theme } from '../prefs'

const CACHE = 'prefs'
const THEME_COLOR = { light: '#f4f5f7', dark: '#111319' }

function readCache(): Prefs | null {
  try {
    const raw = localStorage.getItem(CACHE)
    return raw ? normalizePrefs(JSON.parse(raw)) : null
  } catch {
    return null
  }
}

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  const mode = dark ? 'dark' : 'light'
  document.documentElement.dataset.theme = mode
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', THEME_COLOR[mode])
}

// Preferences live on the server so the phone and the computer share them; a
// copy in localStorage paints the right theme and order before the API answers.
export default function PrefsProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(readCache)
  const [prefs, setPrefs] = useState<Prefs>(initial ?? DEFAULT_PREFS)
  const [ready, setReady] = useState(initial != null)
  const edited = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    api<Prefs>('/preferences')
      .then((p) => { if (!edited.current) setPrefs(normalizePrefs(p)) })
      .catch(() => { /* offline or no storage: keep the device copy */ })
      .finally(() => setReady(true))
  }, [])

  useEffect(() => {
    try { localStorage.setItem(CACHE, JSON.stringify(prefs)) } catch { /* storage unavailable */ }
    applyTheme(prefs.theme)
    if (prefs.theme !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [prefs])

  const update = useCallback((change: Partial<Prefs>) => {
    edited.current = true
    setPrefs((p) => {
      const next = { ...p, ...change }
      clearTimeout(saveTimer.current)
      // Dragging fires many changes; send the final order once.
      saveTimer.current = setTimeout(() => {
        api('/preferences', { method: 'PUT', body: JSON.stringify(next) }).catch(() => { /* kept on this device */ })
      }, 600)
      return next
    })
  }, [])

  const reset = useCallback(() => update(DEFAULT_PREFS), [update])

  return <PrefsContext.Provider value={{ prefs, ready, update, reset }}>{children}</PrefsContext.Provider>
}
