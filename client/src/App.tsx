import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
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
        <NavLink to="/" className="brand"><img className="brand-logo" src="/icon-192.png" alt="" />Mi Portafolio</NavLink>
        <nav className="nav">
          <NavLink to="/" end>Inicio</NavLink>
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
        <NavLink to="/" end>{icon('M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10')}Inicio</NavLink>
        <NavLink to="/noticias">{icon('M4 5h13v14H6a2 2 0 0 1-2-2V5zm13 4h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5')}Noticias</NavLink>
        <button onClick={focusSearch}>{icon('M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zm9 2-4-4')}Buscar</button>
      </nav>
    </>
  )
}
