import { useState } from 'react'
import { api, setAppKey } from '../api'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setAppKey(password)
    try {
      await api('/auth/check')
      window.location.reload()
    } catch {
      setError('Contraseña incorrecta')
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand-mark"><img src="/icon-192.png" alt="" /></div>
        <h1>Mi Portafolio</h1>
        <p className="muted small">Ingresa la contraseña de acceso que configuraste en el servidor.</p>
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
        />
        {error && <div className="error">{error}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Verificando…' : 'Entrar'}</button>
      </form>
    </div>
  )
}
