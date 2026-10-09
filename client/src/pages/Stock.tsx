import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart,
  ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { useApi, type BalanceRow, type NewsItem, type PeerComparison, type StockDetail } from '../api'
import { compact, money, num, pct, scoreClass, tone, year } from '../format'
import ChartTip from '../components/ChartTip'
import NewsList from '../components/NewsList'
import MetricStat, { PeerContext } from '../components/MetricStat'
import Competition from '../components/Competition'
import ReportsPanel from '../components/ReportsPanel'

const TABS = ['Resumen', 'Competencia', 'Estructura patrimonial', 'Flujo de fondos', 'Deuda', 'Informes', 'Noticias'] as const
type Tab = (typeof TABS)[number]

function SeriesLegend({ items }: { items: [string, string][] }) {
  return (
    <div className="legend" style={{ marginTop: 8 }}>
      {items.map(([label, color]) => <span key={label}><i style={{ background: `var(${color})` }} />{label}</span>)}
    </div>
  )
}

// Thin segmented bar comparing two balance-sheet amounts, labelled with their share.
function RatioBar({ label, parts }: { label: string; parts: [string, number | null, string][] }) {
  const valid = parts.filter(([, v]) => v != null && v > 0) as [string, number, string][]
  const total = valid.reduce((s, [, v]) => s + v, 0)
  if (valid.length < 2 || !total) return null
  return (
    <div>
      <div className="ratio-bar-head">
        <span>{label}</span>
        <span>{valid.map(([name, v]) => <span key={name} style={{ marginLeft: 10 }}>{name} <b>{pct((v / total) * 100, 0, false)}</b></span>)}</span>
      </div>
      <div className="ratio-bar" role="img" aria-label={valid.map(([n, v]) => `${n} ${pct((v / total) * 100, 0, false)}`).join(', ')}>
        {valid.map(([name, v, color]) => <div key={name} style={{ width: `${(v / total) * 100}%`, background: `var(${color})` }} />)}
      </div>
    </div>
  )
}

const axis ={ tick: { fill: 'var(--muted)', fontSize: 11 }, tickLine: false }


function Overview({ d }: { d: StockDetail }) {
  const [open, setOpen] = useState(false)
  const k = d.keyStats
  const n = (key: string) => (typeof k[key] === 'number' ? (k[key] as number) : null)
  const first = d.chart[0]?.close
  const last = d.chart.at(-1)?.close
  const up = first && last ? last >= first : true
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section className="card">
        <div className="card-head">
          <h2>Precio — último año</h2>
          <span className={`small num ${up ? 'up' : 'down'}`}>{first && last ? pct((last / first - 1) * 100) : ''} en 12 meses</span>
        </div>
        <div style={{ height: 260 }}>
          <ResponsiveContainer>
            <AreaChart data={d.chart} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="px" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--s1)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--s1)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="date" {...axis} axisLine={{ stroke: 'var(--axis)' }} minTickGap={50}
                tickFormatter={(v: string) => new Date(v).toLocaleDateString('es', { month: 'short', year: '2-digit' })} />
              <YAxis {...axis} axisLine={false} width={56} domain={['auto', 'auto']} tickFormatter={(v: number) => num(v, 0)} />
              <Tooltip content={<ChartTip format={(v) => money(v, d.quote.currency)} labelFormat={(l) => new Date(l).toLocaleDateString('es', { dateStyle: 'medium' })} />} />
              <Area type="monotone" dataKey="close" name="Cierre" stroke="var(--s1)" strokeWidth={2} fill="url(#px)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
      <section className="card">
        <div className="card-head"><h2>Indicadores clave</h2></div>
        <div className="stats">
          <MetricStat id="marketCap" value={compact(d.quote.marketCap, d.quote.currency)} />
          <MetricStat id="pe" value={num(n('pe'), 1)} raw={n('pe')} format={(v) => num(v, 1)} />
          <MetricStat id="forwardPe" value={num(n('forwardPe'), 1)} raw={n('forwardPe')} format={(v) => num(v, 1)} />
          <MetricStat id="pb" value={num(n('pb'), 2)} raw={n('pb')} format={(v) => num(v, 2)} />
          <MetricStat id="evToEbitda" value={num(n('evToEbitda'), 1)} raw={n('evToEbitda')} format={(v) => num(v, 1)} />
          <MetricStat id="dividendYield" value={pct(n('dividendYield'), 2, false)} raw={n('dividendYield') ?? 0} format={(v) => pct(v, 2, false)} />
          <MetricStat id="beta" value={num(n('beta'), 2)} raw={n('beta')} format={(v) => num(v, 2)} />
          <MetricStat id="roe" value={pct(n('roe'), 1, false)} raw={n('roe')} format={(v) => pct(v, 1, false)} />
          <MetricStat id="roa" value={pct(n('roa'), 1, false)} raw={n('roa')} format={(v) => pct(v, 1, false)} />
          <MetricStat id="grossMargin" value={pct(n('grossMargin'), 1, false)} raw={n('grossMargin')} format={(v) => pct(v, 1, false)} />
          <MetricStat id="operatingMargin" value={pct(n('operatingMargin'), 1, false)} raw={n('operatingMargin')} format={(v) => pct(v, 1, false)} />
          <MetricStat id="profitMargin" value={pct(n('profitMargin'), 1, false)} raw={n('profitMargin')} format={(v) => pct(v, 1, false)} />
          <MetricStat id="revenueGrowth" value={pct(n('revenueGrowth'), 1)} raw={n('revenueGrowth')} format={(v) => pct(v, 1)} cls={tone(n('revenueGrowth'))} />
          <MetricStat id="currentRatio" value={num(n('currentRatio'), 2)} raw={n('currentRatio')} format={(v) => num(v, 2)} />
          <MetricStat id="quickRatio" value={num(n('quickRatio'), 2)} raw={n('quickRatio')} format={(v) => num(v, 2)} />
          <MetricStat id="range52" value={`${num(d.quote.fiftyTwoWeekLow)} – ${num(d.quote.fiftyTwoWeekHigh)}`} />
          <MetricStat id="targetMean" value={money(n('targetMean'), d.quote.currency)}
            hint={k.recommendation ? `${String(k.recommendation).replace('_', ' ')} · ${n('analysts') ?? '?'} analistas` : undefined} />
        </div>
      </section>
      {d.profile.description && (
        <section className="card">
          <div className="card-head">
            <h2>Sobre la empresa</h2>
            <span className="small muted">{[d.profile.sector, d.profile.industry, d.profile.country].filter(Boolean).join(' · ')}</span>
          </div>
          <div className={`description ${open ? 'open' : ''}`}>{d.profile.description}</div>
          <button className="btn ghost" style={{ marginTop: 8 }} onClick={() => setOpen(!open)}>{open ? 'Ver menos' : 'Ver más'}</button>
        </section>
      )}
    </div>
  )
}

function EquationBar({ b, cur }: { b: BalanceRow; cur: string }) {
  const total = b.totalAssets ?? 0
  if (!total) return null
  const h = (v: number | null) => `${Math.max(((v ?? 0) / total) * 100, 0)}%`
  const share = (v: number | null) => pct(v != null ? (v / total) * 100 : null, 1, false)
  const negEquity = (b.equity ?? 0) < 0
  return (
    <>
      <div className="equation" role="img" aria-label={`Activos ${compact(total)}; pasivos ${share(b.totalLiabilities)}; patrimonio ${share(b.equity)}`}>
        <div className="col">
          <div className="block" style={{ background: 'var(--s1)', height: h(b.currentAssets) }}>
            <span>Activo corriente</span><b>{compact(b.currentAssets)}</b><span>{share(b.currentAssets)}</span>
          </div>
          <div className="block" style={{ background: 'var(--s1)', opacity: 0.75, height: h(b.nonCurrentAssets) }}>
            <span>Activo no corriente</span><b>{compact(b.nonCurrentAssets)}</b><span>{share(b.nonCurrentAssets)}</span>
          </div>
        </div>
        <div className="col">
          <div className="block" style={{ background: 'var(--s2)', height: h(b.currentLiabilities) }}>
            <span>Pasivo corriente</span><b>{compact(b.currentLiabilities)}</b><span>{share(b.currentLiabilities)}</span>
          </div>
          <div className="block" style={{ background: 'var(--s2)', opacity: 0.75, height: h(b.nonCurrentLiabilities) }}>
            <span>Pasivo no corriente</span><b>{compact(b.nonCurrentLiabilities)}</b><span>{share(b.nonCurrentLiabilities)}</span>
          </div>
          {!negEquity && (
            <div className="block" style={{ background: 'var(--s3)', height: h(b.equity) }}>
              <span>Patrimonio neto</span><b>{compact(b.equity)}</b><span>{share(b.equity)}</span>
            </div>
          )}
        </div>
      </div>
      <div className="legend" style={{ marginTop: 10 }}>
        <span><i style={{ background: 'var(--s1)' }} />Activos {compact(b.totalAssets, cur)}</span>
        <span><i style={{ background: 'var(--s2)' }} />Pasivos {compact(b.totalLiabilities, cur)}</span>
        <span><i style={{ background: 'var(--s3)' }} />Patrimonio {compact(b.equity, cur)}</span>
      </div>
      {negEquity && <div className="note">⚠️ Patrimonio neto negativo: los pasivos superan a los activos (frecuente en empresas con recompras agresivas de acciones).</div>}
    </>
  )
}

function Structure({ d }: { d: StockDetail }) {
  const cur = d.keyStats.financialCurrency
  const b = d.balance.latest
  if (!b) return <div className="card empty">No hay datos de balance disponibles para este activo.</div>
  const history = d.balance.history.map((r) => ({
    year: year(r.date),
    Pasivos: r.liabilitiesPct,
    Patrimonio: r.equityPct,
  }))
  const rows: [string, keyof BalanceRow][] = [
    ['Caja e inversiones CP', 'cash'], ['Cuentas por cobrar', 'receivables'], ['Inventarios', 'inventory'],
    ['Propiedad, planta y equipo', 'ppe'], ['Intangibles y llave', 'intangibles'], ['Activo total', 'totalAssets'],
    ['Cuentas por pagar', 'payables'], ['Deuda corto plazo', 'currentDebt'], ['Deuda largo plazo', 'longTermDebt'],
    ['Pasivo total', 'totalLiabilities'], ['Patrimonio neto', 'equity'], ['Capital de trabajo', 'workingCapital'],
  ]
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <div className="grid-half">
        <section className="card">
          <div className="card-head">
            <h2>Activos = Pasivos + Patrimonio</h2>
            <span className="small muted">Balance al {new Date(b.date).toLocaleDateString('es', { dateStyle: 'medium' })} · {cur}</span>
          </div>
          <EquationBar b={b} cur={cur} />
        </section>
        <section className="card">
          <div className="card-head"><h2>Proporciones</h2></div>
          <div className="stats" style={{ gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }}>
            <MetricStat id="liabilitiesToAssets" value={pct(b.liabilitiesPct, 1, false)} />
            <MetricStat id="equityToAssets" value={pct(b.equityPct, 1, false)} />
            <MetricStat id="debtToEquity" value={num(b.debtToEquity, 2)} raw={b.debtToEquity} format={(v) => num(v, 2)} />
            <MetricStat id="currentRatio" value={num(b.currentRatio, 2)} raw={b.currentRatio} format={(v) => num(v, 2)} />
            <MetricStat id="liabilitiesToEquity" value={num(b.totalLiabilities != null && b.equity ? b.totalLiabilities / b.equity : null, 2)} />
            <MetricStat id="workingCapital" value={compact(b.workingCapital, cur)} cls={tone(b.workingCapital)} />
          </div>
          <div className="ratio-bars" style={{ marginTop: 16 }}>
            <RatioBar label="Activo corriente vs. pasivo corriente"
              parts={[['Activo cte.', b.currentAssets, '--s1'], ['Pasivo cte.', b.currentLiabilities, '--s2']]} />
            <RatioBar label="Financiamiento del activo"
              parts={[['Pasivo', b.totalLiabilities, '--s2'], ['Patrimonio', b.equity, '--s3']]} />
            <RatioBar label="Deuda corto vs. largo plazo"
              parts={[['Corto plazo', b.currentDebt, '--s4'], ['Largo plazo', b.longTermDebt, '--s1']]} />
          </div>
        </section>
      </div>
      <section className="card">
        <div className="card-head"><h2>Evolución: financiamiento con pasivos vs. patrimonio</h2><span className="small muted">% del activo total, anual</span></div>
        <div style={{ height: 240 }}>
          <ResponsiveContainer>
            <BarChart data={history} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="year" {...axis} axisLine={{ stroke: 'var(--axis)' }} />
              <YAxis {...axis} axisLine={false} width={44} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip format={(v) => pct(v, 1, false)} />} />
              <ReferenceLine y={0} stroke="var(--axis)" />
              <Bar dataKey="Pasivos" stackId="a" fill="var(--s2)" stroke="var(--surface)" strokeWidth={2} />
              <Bar dataKey="Patrimonio" stackId="a" fill="var(--s3)" stroke="var(--surface)" strokeWidth={2} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <SeriesLegend items={[['Pasivos', '--s2'], ['Patrimonio', '--s3']]} />
      </section>
      <section className="card">
        <div className="card-head"><h2>Detalle del balance</h2><span className="small muted">{cur}</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Partida</th>{d.balance.history.map((r) => <th key={r.date}>{year(r.date)}</th>)}{b.date !== d.balance.history.at(-1)?.date && <th>Último trim.</th>}</tr></thead>
            <tbody>
              {rows.map(([label, key]) => (
                <tr key={key}>
                  <td>{label}</td>
                  {d.balance.history.map((r) => <td key={r.date}>{compact(r[key] as number | null)}</td>)}
                  {b.date !== d.balance.history.at(-1)?.date && <td>{compact(b[key] as number | null)}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function CashFlow({ d }: { d: StockDetail }) {
  const cur = d.keyStats.financialCurrency
  if (!d.cashFlow.length) return <div className="card empty">No hay datos de flujo de fondos disponibles.</div>
  const data = d.cashFlow.map((r) => ({
    year: year(r.date),
    Operativo: r.operating,
    Inversión: r.investing,
    Financiamiento: r.financing,
    'Flujo libre (FCF)': r.freeCashFlow,
  }))
  const last = d.cashFlow.at(-1)!
  const fcfMargin = last.freeCashFlow != null && last.revenue ? (last.freeCashFlow / last.revenue) * 100 : null
  const conversion = last.operating != null && last.netIncome ? last.operating / last.netIncome : null
  const shareholder = -((last.dividends ?? 0) + (last.buybacks ?? 0))
  const rows: [string, keyof typeof last][] = [
    ['Flujo operativo', 'operating'], ['Inversiones en capital (CapEx)', 'capex'], ['Flujo libre (FCF)', 'freeCashFlow'],
    ['Flujo de inversión', 'investing'], ['Flujo de financiamiento', 'financing'], ['Dividendos pagados', 'dividends'],
    ['Recompra de acciones', 'buybacks'], ['Emisión de deuda', 'debtIssued'], ['Pago de deuda', 'debtRepaid'],
    ['Variación de caja', 'netChange'], ['Caja al cierre', 'endCash'], ['Resultado neto', 'netIncome'],
  ]
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section className="card">
        <div className="card-head"><h2>Último ejercicio ({year(last.date)})</h2><span className="small muted">{cur}</span></div>
        <div className="stats">
          <MetricStat id="operatingCF" value={compact(last.operating)} cls={tone(last.operating)} />
          <MetricStat id="investingCF" value={compact(last.investing)} cls={tone(last.investing)} />
          <MetricStat id="financingCF" value={compact(last.financing)} cls={tone(last.financing)} />
          <MetricStat id="fcf" value={compact(last.freeCashFlow)} cls={tone(last.freeCashFlow)} hint="Operativo − CapEx" />
          <MetricStat id="fcfMargin" value={pct(fcfMargin, 1, false)} hint="FCF / Ingresos" />
          <MetricStat id="earningsQuality" value={conversion != null ? `${num(conversion, 2)}x` : '—'} hint="Flujo operativo / Resultado neto" />
          <MetricStat id="shareholderReturn" value={compact(shareholder || null)} hint="Dividendos + recompras" />
        </div>
      </section>
      <section className="card">
        <div className="card-head"><h2>Flujo de fondos anual</h2><span className="small muted">{cur}</span></div>
        <div style={{ height: 300 }}>
          <ResponsiveContainer>
            <ComposedChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="year" {...axis} axisLine={false} />
              <YAxis {...axis} axisLine={false} width={56} tickFormatter={(v: number) => compact(v)} />
              <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip format={(v) => compact(v, cur)} />} />
              <ReferenceLine y={0} stroke="var(--axis)" />
              <Bar dataKey="Operativo" fill="var(--s1)" radius={[4, 4, 4, 4]} stroke="var(--surface)" strokeWidth={2} />
              <Bar dataKey="Inversión" fill="var(--s2)" radius={[4, 4, 4, 4]} stroke="var(--surface)" strokeWidth={2} />
              <Bar dataKey="Financiamiento" fill="var(--s3)" radius={[4, 4, 4, 4]} stroke="var(--surface)" strokeWidth={2} />
              <Line dataKey="Flujo libre (FCF)" stroke="var(--s4)" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: 'var(--surface)' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <SeriesLegend items={[['Operativo', '--s1'], ['Inversión', '--s2'], ['Financiamiento', '--s3'], ['Flujo libre (FCF)', '--s4']]} />
        <div className="note">Positivo = entrada de fondos; negativo = salida. El flujo de inversión suele ser negativo (CapEx) y el de financiamiento refleja deuda, dividendos y recompras.</div>
      </section>
      <section className="card">
        <div className="card-head"><h2>Detalle</h2><span className="small muted">{cur}</span></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Concepto</th>{d.cashFlow.map((r) => <th key={r.date}>{year(r.date)}</th>)}</tr></thead>
            <tbody>
              {rows.map(([label, key]) => (
                <tr key={key}>
                  <td>{label}</td>
                  {d.cashFlow.map((r) => <td key={r.date} className={tone(r[key] as number | null)}>{compact(r[key] as number | null)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

function Debt({ d }: { d: StockDetail }) {
  const cur = d.keyStats.financialCurrency
  if (!d.debt.length) return <div className="card empty">No hay datos de deuda disponibles.</div>
  const last = d.debt.at(-1)!
  const lastKd = [...d.debt].reverse().find((r) => r.costOfDebt != null)
  const kdData = d.debt.map((r) => ({ year: year(r.date), 'Costo de deuda': r.costOfDebt, 'Costo neto de impuestos': r.afterTaxCostOfDebt }))
  const debtData = d.debt.map((r) => ({ year: year(r.date), 'Deuda total': r.totalDebt, 'Deuda neta': r.netDebt }))
  const coverage = lastKd?.interestCoverage
  const coverageNote = coverage == null ? undefined : coverage > 8 ? 'Holgada' : coverage > 3 ? 'Adecuada' : coverage > 1.5 ? 'Ajustada' : 'Riesgosa'
  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <section className="card">
        <div className="card-head"><h2>Costo de endeudamiento</h2><span className="small muted">{cur}</span></div>
        <div className="stats">
          <MetricStat id="kd" label={`Costo de deuda (Kd) ${lastKd ? year(lastKd.date) : ''}`} value={pct(lastKd?.costOfDebt, 2, false)} hint="Intereses / deuda promedio" />
          <MetricStat id="kdAfterTax" value={pct(lastKd?.afterTaxCostOfDebt, 2, false)} hint={`Kd × (1 − t), t = ${pct(lastKd?.taxRate, 1, false)}`} />
          <MetricStat id="interestExpense" value={compact(lastKd?.interestExpense)} />
          <MetricStat id="interestCoverage" value={coverage != null ? `${num(coverage, 1)}x` : '—'} hint={coverageNote} />
          <MetricStat id="totalDebt" value={compact(last.totalDebt)} />
          <MetricStat id="netDebt" value={compact(last.netDebt)} hint={last.netDebt != null && last.netDebt < 0 ? 'Caja neta positiva' : undefined} />
          <MetricStat id="netDebtToEbitda" value={last.netDebtToEbitda != null ? `${num(last.netDebtToEbitda, 2)}x` : '—'} />
          <MetricStat id="debtToEquity" value={num(last.debtToEquity, 2)} raw={last.debtToEquity} format={(v) => num(v, 2)} />
          <MetricStat id="debtToAssets" value={pct(last.debtToAssets != null ? last.debtToAssets * 100 : null, 1, false)} />
        </div>
        {!lastKd && <div className="note">La empresa no reporta gastos por intereses por separado, por lo que no se puede calcular el costo de la deuda.</div>}
        {lastKd && lastKd.date !== last.date && <div className="note">El último ejercicio no informa gastos por intereses por separado; se muestra el Kd de {year(lastKd.date)}.</div>}
      </section>
      <div className="grid-half">
        <section className="card">
          <div className="card-head"><h2>Costo de deuda anual</h2><span className="small muted">%</span></div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <LineChart data={kdData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="year" {...axis} axisLine={{ stroke: 'var(--axis)' }} />
                <YAxis {...axis} axisLine={false} width={40} tickFormatter={(v: number) => `${v}%`} />
                <Tooltip content={<ChartTip format={(v) => pct(v, 2, false)} />} />
                <Line dataKey="Costo de deuda" stroke="var(--s1)" strokeWidth={2} dot={{ r: 4 }} connectNulls />
                <Line dataKey="Costo neto de impuestos" stroke="var(--s2)" strokeWidth={2} dot={{ r: 4 }} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <SeriesLegend items={[['Costo de deuda', '--s1'], ['Costo neto de impuestos', '--s2']]} />
        </section>
        <section className="card">
          <div className="card-head"><h2>Deuda total vs. neta</h2><span className="small muted">{cur}</span></div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer>
              <BarChart data={debtData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="year" {...axis} axisLine={false} />
                <YAxis {...axis} axisLine={false} width={56} tickFormatter={(v: number) => compact(v)} />
                <Tooltip cursor={{ fill: 'var(--surface-2)' }} content={<ChartTip format={(v) => compact(v, cur)} />} />
                <ReferenceLine y={0} stroke="var(--axis)" />
                <Bar dataKey="Deuda total" fill="var(--s1)" radius={[4, 4, 0, 0]} stroke="var(--surface)" strokeWidth={2} />
                <Bar dataKey="Deuda neta" fill="var(--s2)" radius={[4, 4, 0, 0]} stroke="var(--surface)" strokeWidth={2} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <SeriesLegend items={[['Deuda total', '--s1'], ['Deuda neta', '--s2']]} />
        </section>
      </div>
      <section className="card">
        <div className="card-head"><h2>Detalle</h2></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Indicador</th>{d.debt.map((r) => <th key={r.date}>{year(r.date)}</th>)}</tr></thead>
            <tbody>
              <tr><td>Deuda total</td>{d.debt.map((r) => <td key={r.date}>{compact(r.totalDebt)}</td>)}</tr>
              <tr><td>Gastos por intereses</td>{d.debt.map((r) => <td key={r.date}>{compact(r.interestExpense)}</td>)}</tr>
              <tr><td>Costo de deuda (Kd)</td>{d.debt.map((r) => <td key={r.date}>{pct(r.costOfDebt, 2, false)}</td>)}</tr>
              <tr><td>Tasa impositiva efectiva</td>{d.debt.map((r) => <td key={r.date}>{pct(r.taxRate, 1, false)}</td>)}</tr>
              <tr><td>Kd después de impuestos</td>{d.debt.map((r) => <td key={r.date}>{pct(r.afterTaxCostOfDebt, 2, false)}</td>)}</tr>
              <tr><td>EBITDA</td>{d.debt.map((r) => <td key={r.date}>{compact(r.ebitda)}</td>)}</tr>
              <tr><td>Cobertura de intereses</td>{d.debt.map((r) => <td key={r.date}>{r.interestCoverage != null ? `${num(r.interestCoverage, 1)}x` : '—'}</td>)}</tr>
              <tr><td>Deuda neta / EBITDA</td>{d.debt.map((r) => <td key={r.date}>{r.netDebtToEbitda != null ? `${num(r.netDebtToEbitda, 2)}x` : '—'}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <div className="note">Kd = gastos por intereses del año / promedio de la deuda financiera al inicio y cierre del ejercicio.</div>
      </section>
    </div>
  )
}

function StockNews({ symbol }: { symbol: string }) {
  const { data, error } = useApi<NewsItem[]>(`/news?symbols=${encodeURIComponent(symbol)}&market=0&limit=15`)
  return (
    <section className="card">
      <div className="card-head"><h2>Noticias de {symbol}</h2></div>
      {error && <div className="error">{error}</div>}
      {data ? <NewsList items={data} /> : <div className="skeleton" style={{ height: 200 }} />}
    </section>
  )
}

// Keyed by symbol so tab and added competitors reset when navigating to another stock.
export default function StockPage() {
  const { symbol = '' } = useParams()
  return <StockView key={symbol} symbol={symbol} />
}

function StockView({ symbol }: { symbol: string }) {
  const { data: d, error, loading } = useApi<StockDetail>(`/stock/${encodeURIComponent(symbol)}`)
  const [extraPeers, setExtraPeers] = useState<string[]>([])
  const peersPath = `/stock/${encodeURIComponent(symbol)}/peers${extraPeers.length ? `?add=${extraPeers.join(',')}` : ''}`
  const peers = useApi<PeerComparison>(peersPath)
  const [tab, setTab] = useState<Tab>('Resumen')

  const peerCtx = useMemo(() => ({
    loading: peers.loading,
    medians: Object.fromEntries((peers.data?.metrics ?? []).map((m) => [m.key, m.peerMedian])),
    count: (peers.data?.companies.length ?? 1) - 1,
  }), [peers.data, peers.loading])

  return (
    <PeerContext.Provider value={peerCtx}>
      <main>
        {error && <div className="card error">{error}</div>}
        {loading && !d && <div className="card"><div className="skeleton" style={{ width: 200, height: 24 }} /><div className="skeleton" style={{ height: 240, marginTop: 16 }} /></div>}
        {d && (
          <>
            <div className="stock-head">
              <div>
                <h1>{d.quote.name} <span className="ticker-sym">{d.symbol}</span></h1>
                <div className="small muted">{d.quote.exchange} · {d.quote.currency}{d.quote.marketState !== 'REGULAR' && ' · Mercado cerrado'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="price num">{money(d.quote.price, d.quote.currency)}</div>
                <div className={`num ${tone(d.quote.change)}`}>
                  {d.quote.change > 0 ? '+' : ''}{num(d.quote.change)} ({pct(d.quote.changePct)}) hoy
                </div>
                {peers.data?.score != null && (
                  <button className={`score-pill ${scoreClass(peers.data.score)}`} onClick={() => setTab('Competencia')}>
                    Score vs. competencia <b>{peers.data.score}</b>/100 · {peers.data.verdict}
                  </button>
                )}
              </div>
            </div>
            <div className="tabs" role="tablist">
              {TABS.map((t) => (
                <button key={t} role="tab" aria-selected={t === tab} className={t === tab ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
            {tab === 'Resumen' && <Overview d={d} />}
            {tab === 'Competencia' && (
              <Competition
                data={peers.data}
                loading={peers.loading}
                error={peers.error}
                onAdd={(s) => setExtraPeers((p) => [...new Set([...p, s.toUpperCase()])])}
              />
            )}
            {tab === 'Estructura patrimonial' && <Structure d={d} />}
            {tab === 'Flujo de fondos' && <CashFlow d={d} />}
            {tab === 'Deuda' && <Debt d={d} />}
            {tab === 'Informes' && <ReportsPanel symbol={d.symbol} />}
            {tab === 'Noticias' && <StockNews symbol={d.symbol} />}
          </>
        )}
      </main>
    </PeerContext.Provider>
  )
}

