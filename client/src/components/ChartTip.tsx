interface TipPayload {
  name?: string | number
  value?: number | string | (number | string)[]
  color?: string
  dataKey?: string | number
}

interface Props {
  active?: boolean
  label?: string | number
  payload?: readonly TipPayload[]
  format: (v: number) => string
  labelFormat?: (l: string) => string
}

// Shared tooltip for recharts: colored swatch carries identity, text stays in ink colors.
export default function ChartTip({ active, payload, label, format, labelFormat }: Props) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tip">
      <div className="muted" style={{ marginBottom: 4 }}>{labelFormat ? labelFormat(String(label)) : label}</div>
      {payload.map((p) => (
        <div className="row" key={String(p.dataKey)}>
          <span><i style={{ background: p.color }} />{p.name}</span>
          <b className="num">{typeof p.value === 'number' ? format(p.value) : '—'}</b>
        </div>
      ))}
    </div>
  )
}
