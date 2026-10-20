import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import SymbolSearch from './components/SymbolSearch'
import Login from './components/Login'
import Logo from './components/Logo'
import { AUTH_EVENT, CUSTOMIZE_EVENT } from './api'
import { START_PAGES, usePrefs } from './prefs'
import Icon, { type IconName } from './icons'

// Secondary pages load on demand so the home screen downloads less on the phone.
const StockPage = lazy(() => import('./pages/Stock'))
const NewsPage = lazy(() => import('./pages/News'))
const IdeasPage = lazy(() => import('./pages/Ideas'))
const ExplorePage = lazy(() => import('./pages/Explore'))
const ReportPrint = lazy(() => import('./pages/ReportPrint'))
const Customize = lazy(() => import('./components/Customize'))

const pageFallback = <main><div className="card"><div className="skeleton" style={{ height: 240 }} /></div></main>

const NAV: [path: string, label: string, icon: IconName][] = [
  ['/', 'Portafolio', 'wallet'],
  ['/ideas', 'Ideas', 'bulb'],
  ['/explorar', 'Explorar', 'compass'],
  ['/noticias', 'Noticias', 'news'],
]

const SECTIONS: [prefix: string, label: string][] = [
  ['/noticias', 'Noticias'], ['/ideas', 'Ideas de analistas'], ['/explorar', 'Explorar'], ['/accion', 'Acciones'],
]

// Opens the screen chosen in the preferences once per app launch, only if the
// app started on the home route (a shared link to a stock still opens it).
function useStartPage() {
  const { prefs, ready } = usePrefs()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const done = useRef(false)
  useEffect(() => {
    if (!ready || done.current) return
    done.current = true
    let launched = false
    try {
      launched = sessionStorage.getItem('launched') === '1'
      sessionStorage.setItem('launched', '1')
    } catch { /* storage unavailable */ }
    const target = START_PAGES[prefs.startPage].path
    if (!launched && pathname === '/' && target !== '/') navigate(target, { replace: true })
  }, [ready, prefs.startPage, pathname, navigate])
}

export default function App() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const section = SECTIONS.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? 'Portafolio'
  const [needLogin, setNeedLogin] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  useStartPage()

  useEffect(() => {
    const onAuth = () => setNeedLogin(true)
    const onCustomize = () => setCustomizing(true)
    window.addEventListener(AUTH_EVENT, onAuth)
    window.addEventListener(CUSTOMIZE_EVENT, onCustomize)
    return () => {
      window.removeEventListener(AUTH_EVENT, onAuth)
      window.removeEventListener(CUSTOMIZE_EVENT, onCustomize)
    }
  }, [])

  if (needLogin) return <Login />

  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">
          <Logo className="brand-logo" />
          <span className="brand-text"><span>Mi Portafolio</span><small>{section}</small></span>
        </NavLink>
        <nav className="nav">
          {NAV.map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
        </nav>
        <SymbolSearch placeholder="Buscar ticker…" onSelect={(s) => navigate(`/accion/${encodeURIComponent(s.symbol)}`)} />
        <button className="icon-btn settings-btn" onClick={() => setCustomizing(true)} aria-label="Personalizar" title="Personalizar">
          <Icon name="sliders" size={20} />
        </button>
      </header>
      <Suspense fallback={pageFallback}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/noticias" element={<NewsPage />} />
          <Route path="/ideas" element={<IdeasPage />} />
          <Route path="/explorar" element={<ExplorePage />} />
          <Route path="/accion/:symbol" element={<StockPage />} />
          <Route path="/accion/:symbol/informe" element={<ReportPrint />} />
        </Routes>
      </Suspense>
      <nav className="bottom-nav" aria-label="Navegación principal">
        {NAV.map(([to, label, icon]) => (
          <NavLink key={to} to={to} end={to === '/'}><Icon name={icon} size={22} />{label}</NavLink>
        ))}
      </nav>
      {customizing && (
        <Suspense fallback={null}>
          <Customize onClose={() => setCustomizing(false)} />
        </Suspense>
      )}
    </>
  )
}
