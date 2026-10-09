import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useNavigate } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import StockPage from './pages/Stock'
import NewsPage from './pages/News'
import ReportPrint from './pages/ReportPrint'
import SymbolSearch from './components/SymbolSearch'
import Login from './components/Login'
import { AUTH_EVENT } from './api'

export default function App() {
  const navigate = useNavigate()
  const [needLogin, setNeedLogin] = useState(false)

  useEffect(() => {
    const onAuth = () => setNeedLogin(true)
    window.addEventListener(AUTH_EVENT, onAuth)
    return () => window.removeEventListener(AUTH_EVENT, onAuth)
  }, [])

  if (needLogin) return <Login />

  return (
    <>
      <header className="topbar">
        <NavLink to="/" className="brand">📈 Mi Portafolio</NavLink>
        <nav className="nav">
          <NavLink to="/" end>Inicio</NavLink>
          <NavLink to="/noticias">Noticias</NavLink>
        </nav>
        <SymbolSearch placeholder="Buscar acción (ej. AAPL, YPF)…" onSelect={(s) => navigate(`/accion/${encodeURIComponent(s.symbol)}`)} />
      </header>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/noticias" element={<NewsPage />} />
        <Route path="/accion/:symbol" element={<StockPage />} />
        <Route path="/accion/:symbol/informe" element={<ReportPrint />} />
      </Routes>
    </>
  )
}
