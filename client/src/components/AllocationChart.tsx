import { useMemo, useState } from 'react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import type { Holding } from '../api'
import { money, num } from '../format'

type View = 'activo' | 'tipo' | 'sector'
const VIEWS: [View, string][] = [['activo', 'Por activo'], ['tipo', 'Por tipo'], ['sector', 'Por sector']]

// Categorical hues in fixed order; anything past the sixth slice folds into "Otros".
const COLORS = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--s5)', 'var(--s6)']
const OTHER = 'var(--s-other)'
const MAX_SLICES = COLORS.length

const SECTORS: Record<string, string> = {
  Technology: 'Tecnología',
  'Financial Services': 'Finanzas',
  'Consumer Cyclical': 'Consumo cíclico',
  'Consumer Defensive': 'Consumo defensivo',
  Healthcare: 'Salud',
  'Communication Services': 'Comunicaciones',
  Industrials: 'Industria',
  Energy: 'Energía',
  'Basic Materials': 'Materiales',
  'Real Estate': 'Inmobiliario',
  Utilities: 'Servicios públicos',
}

const typeOf = (h: Holding) => (h.type === 'ETF' || h.type === 'MUTUALFUND' ? 'ETF' : h.type === 'CRYPTOCURRENCY' ? 'Cripto' : 'Acciones')
const sectorOf = (h: Holding) => {
  const t = typeOf(h)
  if (t !== 'Acciones') return t === 'ETF' ? 'ETF (diversificado)' : 'Cripto'
  return h.sector ? SECTORS[h.sector] ?? h.sector : 'Sin clasificar'
}
// Asset types keep the same color whatever the portfolio holds.
const TYPE_COLOR: Record<string, string> = { Acciones: COLORS[0], ETF: COLORS[1], Cripto: COLORS[2] }

interface Slice { name: string; value: number; pct: number; color: string }

function slices(holdings: Holding[], view: View): Slice[] {
  const groups = new Map<string, number>()
  for (const h of holdings) {
    if (!h.valueUsd || h.valueUsd <= 0) continue
    const key = view === 'activo' ? h.symbol : view === 'tipo' ? typeOf(h) : sectorOf(h)
    groups.set(key, (groups.get(key) ?? 0) + h.valueUsd)
  }
  const total = [...groups.values()].reduce((s, v) => s + v, 0)
  if (!total) return []
  const sorted = [...groups].sort((a, b) => b[1] - a[1])
  const head = sorted.length > MAX_SLICES ? sorted.slice(0, MAX_SLICES - 1) : sorted
  const rest = sorted.slice(head.length).reduce((s, [, v]) => s + v, 0)
  const out = head.map(([name, value], i) => ({
    name, value, pct: (value / total) * 100, color: view === 'tipo' ? TYPE_COLOR[name] ?? OTHER : COLORS[i],
  }))
  if (rest > 0) out.push({ name: `Otros (${sorted.length - head.length})`, value: rest, pct: (rest / total) * 100, color: OTHER })
  return out
}

function SliceTip({ active, payload }: { active?: boolean; payload?: readonly { payload?: Slice }[] }) {
  const s = active ? payload?.[0]?.payload : undefined
  if (!s) return null
  const hidden = document.documentElement.classList.contains('privacy')
  return (
    <div className="chart-tip">
      <div className="row"><span><i style={{ background: s.color }} />{s.name}</span><b>{num(s.pct, 1)}%</b></div>
      <div className="muted num">{hidden ? '••••' : money(s.value)}</div>
    </div>
  )
}

// Portfolio allocation donut with three groupings: holding, asset type and sector.
export default function AllocationChart({ holdings }: { holdings: Holding[] }) {
  const [view, setView] = useState<View>('activo')
  const data = useMemo(() => slices(holdings, view), [holdings, view])
  if (!data.length) return null
  const top = data[0]

  return (
    <section className="card">
      <div className="card-head">
        <h2>Distribución</h2>
        <div className="seg" role="tablist" aria-label="Agrupar por">
          {VIEWS.map(([v, label]) => (
            <button key={v} role="tab" aria-selected={v === view} className={v === view ? 'on' : ''} onClick={() => setView(v)}>{label}</button>
          ))}
        </div>
      </div>
      <div className="alloc">
        <div className="alloc-chart">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="95%" paddingAngle={1}
                stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
                {data.map((s) => <Cell key={s.name} fill={s.color} />)}
              </Pie>
              <Tooltip content={<SliceTip />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="alloc-center">
            <b>{num(top.pct, 0)}%</b>
            <span className="small muted">{top.name}</span>
          </div>
        </div>
        <ul className="alloc-legend">
          {data.map((s) => (
            <li key={s.name}>
              <i style={{ background: s.color }} />
              <span>{s.name}</span>
              <b>{num(s.pct, 1)}%</b>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
