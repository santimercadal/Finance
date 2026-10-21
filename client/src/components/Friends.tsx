import { useState } from 'react'
import { api, useApi, type Friend, type FriendCredentials } from '../api'
import ConfirmDialog from './ConfirmDialog'

const inviteText = ({ user, password }: FriendCredentials) =>
  `Te invito a Mi Portafolio: ${window.location.origin}\nNombre: ${user.name}\nContraseña: ${password}`

// Shows a friend's password once, ready to send (share sheet on the phone,
// clipboard elsewhere).
function NewPassword({ creds, onDone }: { creds: FriendCredentials; onDone: () => void }) {
  const [copied, setCopied] = useState(false)
  const text = inviteText(creds)
  const canShare = typeof navigator.share === 'function'
  const share = async () => {
    if (canShare) {
      await navigator.share({ text }).catch(() => { /* cancelled */ })
      return
    }
    await navigator.clipboard.writeText(text)
    setCopied(true)
  }
  return (
    <div className="friend-creds" role="status">
      <p>Contraseña de <b>{creds.user.name}</b>: <code>{creds.password}</code></p>
      <p className="small muted">Se muestra solo esta vez. Mandásela junto con el link de la app.</p>
      <div className="friend-creds-actions">
        <button className="btn sm" onClick={share}>{copied ? 'Copiado' : canShare ? 'Compartir' : 'Copiar invitación'}</button>
        <button className="btn sm ghost" onClick={onDone}>Listo</button>
      </div>
    </div>
  )
}

// Owner-only: friends' accounts. Each friend has their own portfolio and
// settings and never sees the owner's data or eToro.
export default function Friends() {
  const { data: friends, error, reload } = useApi<Friend[]>('/users')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [creds, setCreds] = useState<FriendCredentials | null>(null)
  const [removing, setRemoving] = useState<Friend | null>(null)

  const run = async (fn: () => Promise<void>) => {
    setBusy(true)
    setMsg(null)
    try {
      await fn()
      reload()
    } catch (e) {
      setMsg((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const add = (e: React.FormEvent) => {
    e.preventDefault()
    run(async () => {
      setCreds(await api<FriendCredentials>('/users', { method: 'POST', body: JSON.stringify({ name }) }))
      setName('')
    })
  }
  const resetPassword = (f: Friend) =>
    run(async () => setCreds(await api<FriendCredentials>(`/users/${f.id}/password`, { method: 'POST' })))
  const remove = (f: Friend) => {
    setRemoving(null)
    run(async () => {
      await api(`/users/${f.id}`, { method: 'DELETE' })
      if (creds?.user.id === f.id) setCreds(null)
    })
  }

  if (error) return <p className="error">{error}</p>
  return (
    <div className="friends">
      <form className="friend-add" onSubmit={add}>
        <input className="input" placeholder="Nombre del amigo" value={name} maxLength={30}
          onChange={(e) => setName(e.target.value)} aria-label="Nombre del amigo" />
        <button className="btn" disabled={busy || name.trim().length < 2}>Agregar</button>
      </form>
      {msg && <p className="error">{msg}</p>}
      {creds && <NewPassword creds={creds} onDone={() => setCreds(null)} />}
      {friends == null ? <div className="skeleton" style={{ height: 48 }} /> : friends.length === 0 ? (
        <p className="small muted">Todavía no agregaste a nadie.</p>
      ) : (
        <ul className="friend-list">
          {friends.map((f) => (
            <li key={f.id}>
              <div>
                <b>{f.name}</b>
                <span className="small muted">desde {new Date(f.createdAt).toLocaleDateString('es-AR')}</span>
              </div>
              <button className="btn sm ghost" disabled={busy} onClick={() => resetPassword(f)}>Nueva contraseña</button>
              <button className="btn sm ghost danger-text" disabled={busy} onClick={() => setRemoving(f)}>Quitar</button>
            </li>
          ))}
        </ul>
      )}
      {removing && (
        <ConfirmDialog title={`Quitar a ${removing.name}`} confirmLabel="Quitar" danger
          message="Pierde el acceso al instante y se borran su portafolio y su configuración."
          onConfirm={() => remove(removing)} onCancel={() => setRemoving(null)} />
      )}
    </div>
  )
}
