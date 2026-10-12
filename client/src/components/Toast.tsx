import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export interface ToastMsg { text: string; error?: boolean }

// Transient notification at the bottom of the screen; errors stay until dismissed.
export default function Toast({ msg, onClose }: { msg: ToastMsg | null; onClose: () => void }) {
  useEffect(() => {
    if (!msg || msg.error) return
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [msg, onClose])

  if (!msg) return null
  return createPortal(
    <div className={`toast ${msg.error ? 'error' : ''}`} role={msg.error ? 'alert' : 'status'}>
      <span>{msg.error ? '⚠️' : '✓'}</span>
      <span>{msg.text}</span>
      <button className="icon-btn" onClick={onClose} aria-label="Cerrar aviso">✕</button>
    </div>,
    document.body,
  )
}
