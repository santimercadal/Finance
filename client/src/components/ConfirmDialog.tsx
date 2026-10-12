import { useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

// Small confirmation dialog (bottom sheet on phones, centered on desktop).
export default function ConfirmDialog({ title, message, confirmLabel = 'Confirmar', danger, onConfirm, onCancel }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  return createPortal(
    <div className="sheet-backdrop" onClick={onCancel}>
      <div className="sheet confirm" role="alertdialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <h2>{title}</h2>
        {message && <p>{message}</p>}
        <div className="confirm-actions">
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className={`btn ${danger ? 'danger' : ''}`} onClick={onConfirm} autoFocus>{confirmLabel}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
