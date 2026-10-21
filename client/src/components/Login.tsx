import { useState } from 'react'
import { api, setAppKey } from '../api'

export default function Login() {
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const { token } = await api<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ name, password }),
      })
      setAppKey(token)
      // Answers cached on this device may belong to whoever used it before.
      await caches?.delete('api').catch(() => false)
      try { localStorage.removeItem('prefs') } catch { /* storage unavailable */ }
      window.location.reload()
    } catch (err) {
      setError((err as Error).message)
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form className="card login-card" onSubmit={submit}>
        <div className="brand-mark"><img src="/icon-192.png" alt="" /></div>
        <h1>Mi Portafolio</h1>
        <p className="muted small">Ingresá con el nombre y la contraseña que te pasaron. Si sos el dueño, alcanza con tu contraseña.</p>
        <input
          className="input"
          autoComplete="username"
          autoCapitalize="words"
          placeholder="Nombre"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <input
          className="input"
          type="password"
          autoComplete="current-password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="error">{error}</div>}
        <button className="btn" disabled={busy}>{busy ? 'Verificando…' : 'Entrar'}</button>
      </form>
    </div>
  )
}
