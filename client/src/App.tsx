import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import StockPage from './pages/Stock'
import NewsPage from './pages/News'
import ReportPrint from './pages/ReportPrint'
import SymbolSearch from './components/SymbolSearch'
import Login from './components/Login'
import { AUTH_EVENT } from './api'

const icon = (d: string) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

export default function App() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const section = pathname.startsWith('/noticias') ? 'Noticias' : pathname.startsWith('/accion') ? 'Acciones' : 'Portafolio'
  const [needLogin, setNeedLogin] = useState(false)

  useEffect(() => {
    const onAuth = () => setNeedLogin(true)
    window.addEventListener(AUTH_EVENT, onAuth)
    return () => window.removeEventListener(AUTH_EVENT, onAuth)
  }, [])

  if (needLogin) return <Login />

  const focusSearch = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    document.querySelector<HTMLInputElement>('.topbar .search input')?.focus()
  }

  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">
          <img className="brand-logo" src="/logo.svg" alt="" />
          <span className="brand-text"><span>Mi Portafolio</span><small>{section}</small></span>
        </NavLink>
        <nav className="nav">
          <NavLink to="/" end>Portafolio</NavLink>
          <NavLink to="/noticias">Noticias</NavLink>
        </nav>
        <SymbolSearch placeholder="Buscar ticker…" onSelect={(s) => navigate(`/accion/${encodeURIComponent(s.symbol)}`)} />
      </header>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/noticias" element={<NewsPage />} />
        <Route path="/accion/:symbol" element={<StockPage />} />
        <Route path="/accion/:symbol/informe" element={<ReportPrint />} />
      </Routes>
      <nav className="bottom-nav" aria-label="Navegación principal">
        <NavLink to="/" end>{icon('M3 7a2 2 0 0 1 2-2h14v14H5a2 2 0 0 1-2-2V7zm0 0h18M15 12h2')}Portafolio</NavLink>
        <button onClick={focusSearch} className={section === 'Acciones' ? 'active' : ''}>{icon('M3 3v18h18M7 15l4-4 3 3 5-6')}Acciones</button>
        <NavLink to="/noticias">{icon('M4 5h13v14H6a2 2 0 0 1-2-2V5zm13 4h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5')}Noticias</NavLink>
      </nav>
    </>
  )
}
