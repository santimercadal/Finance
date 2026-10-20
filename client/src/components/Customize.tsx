import { useEffect, useRef, useState } from 'react'
import Icon, { type IconName } from '../icons'
import { PANELS, START_PAGES, usePrefs, type Prefs, type StartPage, type Theme } from '../prefs'

const THEMES: [Theme, string, IconName][] = [['system', 'Automático', 'auto'], ['light', 'Claro', 'sun'], ['dark', 'Oscuro', 'moon']]
const START_ICONS: Record<StartPage, IconName> = { portfolio: 'wallet', news: 'news', ideas: 'bulb', explore: 'compass' }

// Panel order with drag & drop (handle) plus up/down buttons for keyboard and
// screen-reader users. Visibility toggles keep hidden panels in their place.
function PanelList({ panels, onChange }: { panels: Prefs['panels']; onChange: (p: Prefs['panels']) => void }) {
  const list = useRef<HTMLOListElement>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  const move = (from: number, to: number) => {
    if (to < 0 || to >= panels.length || from === to) return
    const next = [...panels]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !list.current) return
    const rows = [...list.current.children] as HTMLElement[]
    const from = panels.findIndex((p) => p.id === dragging)
    // Target = first row whose middle is below the pointer.
    let to = rows.findIndex((r) => {
      const box = r.getBoundingClientRect()
      return e.clientY < box.top + box.height / 2
    })
    if (to === -1) to = rows.length - 1
    else if (to > from) to -= 1
    move(from, to)
  }

  return (
    <ol className="panel-list" ref={list} onPointerMove={onPointerMove}
      onPointerUp={() => setDragging(null)} onPointerCancel={() => setDragging(null)}>
      {panels.map((p, i) => (
        <li key={p.id} className={`panel-row ${dragging === p.id ? 'dragging' : ''} ${p.visible ? '' : 'off'}`}>
          <button className="grip" aria-label={`Arrastrar ${PANELS[p.id].label}`}
            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setDragging(p.id) }}>
            <Icon name="grip" />
          </button>
          <div className="panel-text">
            <b>{PANELS[p.id].label}</b>
            <span>{PANELS[p.id].hint}</span>
          </div>
          <div className="panel-moves">
            <button className="icon-btn" aria-label={`Subir ${PANELS[p.id].label}`} disabled={i === 0} onClick={() => move(i, i - 1)}><Icon name="up" size={16} /></button>
            <button className="icon-btn" aria-label={`Bajar ${PANELS[p.id].label}`} disabled={i === panels.length - 1} onClick={() => move(i, i + 1)}><Icon name="down" size={16} /></button>
          </div>
          <label className="switch">
            <input type="checkbox" checked={p.visible} aria-label={`Mostrar ${PANELS[p.id].label}`}
              onChange={(e) => onChange(panels.map((x) => (x.id === p.id ? { ...x, visible: e.target.checked } : x)))} />
            <span />
          </label>
        </li>
      ))}
    </ol>
  )
}

export default function Customize({ onClose }: { onClose: () => void }) {
  const { prefs, update, reset } = usePrefs()
  const sheet = useRef<HTMLDivElement>(null)

  useEffect(() => {
    sheet.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet customize" role="dialog" aria-modal="true" aria-labelledby="customize-title" tabIndex={-1} ref={sheet}
        onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grip" />
        <div className="customize-head">
          <h2 id="customize-title">Personalizar</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar"><Icon name="x" /></button>
        </div>

        <section>
          <h3>Abrir la app en</h3>
          <div className="choice-grid four">
            {(Object.keys(START_PAGES) as StartPage[]).map((k) => (
              <button key={k} className={`choice ${prefs.startPage === k ? 'on' : ''}`} aria-pressed={prefs.startPage === k}
                onClick={() => update({ startPage: k })}>
                <Icon name={START_ICONS[k]} size={20} />
                {START_PAGES[k].label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>Tema</h3>
          <div className="choice-grid three">
            {THEMES.map(([k, label, icon]) => (
              <button key={k} className={`choice ${prefs.theme === k ? 'on' : ''}`} aria-pressed={prefs.theme === k}
                onClick={() => update({ theme: k })}>
                <Icon name={icon} size={20} />
                {label}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>Paneles del inicio</h3>
          <p className="small">Arrastrá desde <Icon name="grip" size={14} /> o usá las flechas para ordenarlos. Apagá los que no uses.</p>
          <PanelList panels={prefs.panels} onChange={(panels) => update({ panels })} />
        </section>

        <div className="customize-foot">
          <button className="btn ghost" onClick={reset}>Restablecer</button>
          <button className="btn" onClick={onClose}>Listo</button>
        </div>
        <p className="note">Se guarda en el servidor: el teléfono y la computadora comparten la misma configuración.</p>
      </div>
    </div>
  )
}
