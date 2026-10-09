import type { FundIndicators, StockDetail } from '../api'
import { compact, money, num, pct, tone } from '../format'
import MetricStat from './MetricStat'

// Dates come as YYYY-MM-DD; read them at noon so the time zone can't shift the day.
const date = (d: string | null | undefined) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('es', { dateStyle: 'medium' }) : '—')

const SECTORS: Record<string, string> = {
  technology: 'Tecnología', financial_services: 'Servicios financieros', communication_services: 'Comunicaciones',
  healthcare: 'Salud', consumer_cyclical: 'Consumo cíclico', industrials: 'Industria', consumer_defensive: 'Consumo defensivo',
  energy: 'Energía', utilities: 'Servicios públicos', realestate: 'Inmobiliario', basic_materials: 'Materiales',
}

// Indicators specific to ETFs (and crypto): returns, risk, income and, when
// available, the fund's cost, size and composition.
export default function FundOverview({ d, f }: { d: StockDetail; f: FundIndicators }) {
  const isEtf = f.kind === 'etf'
  const r = f.risk
  return (
    <>
      <section className="card">
        <div className="card-head">
          <h2>Rendimiento total</h2>
          <span className="small muted">Con dividendos reinvertidos · 3A y 5A anualizados</span>
        </div>
        <div className="stats">
          {Object.entries(f.returns).map(([k, v]) => (
            <MetricStat key={k} id="totalReturn" label={k} value={pct(v, 1)} cls={tone(v)} />
          ))}
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2>Riesgo</h2><span className="small muted">vs. S&amp;P 500</span></div>
        <div className="stats">
          <MetricStat id="volatility" value={pct(r.volatility, 1, false)} />
          <MetricStat id="maxDrawdown" label="Caída máxima (1 año)" value={pct(r.maxDrawdown1y, 1)} cls={tone(r.maxDrawdown1y)} />
          <MetricStat id="maxDrawdown" label="Caída máxima (5 años)" value={pct(r.maxDrawdown5y, 1)} cls={tone(r.maxDrawdown5y)} />
          <MetricStat id="assetBeta" value={num(r.beta, 2)} hint="5 años, mensual" />
          <MetricStat id="correlation" value={num(r.correlation, 2)} />
          <MetricStat id="sharpe" value={num(r.sharpe, 2)} cls={tone(r.sharpe)}
            hint={r.riskFree != null ? `Tasa libre de riesgo ${pct(r.riskFree, 2, false)}` : undefined} />
          <MetricStat id="range52" value={`${num(d.quote.fiftyTwoWeekLow)} – ${num(d.quote.fiftyTwoWeekHigh)}`} />
          <MetricStat id="inception" value={date(f.inception)} />
        </div>
      </section>

      {isEtf && (
        <section className="card">
          <div className="card-head"><h2>Dividendos y costos</h2></div>
          <div className="stats">
            <MetricStat id="fundYield" value={pct(f.dividends.yield, 2, false)}
              hint={f.dividends.ttmAmount ? `${money(f.dividends.ttmAmount, d.quote.currency)} en 12 meses` : undefined} />
            <MetricStat id="divFrequency" value={f.dividends.frequency ?? 'No paga'}
              hint={f.dividends.last ? `Último: ${money(f.dividends.last.amount, d.quote.currency, 3)} el ${date(f.dividends.last.date)}` : undefined} />
            <MetricStat id="expenseRatio" value={pct(f.fund?.expenseRatio, 2, false)} />
            <MetricStat id="fundAssets" value={compact(f.fund?.totalAssets, d.quote.currency)} />
          </div>
          {f.fund && !f.fund.available && (
            <div className="note">
              El costo anual, el patrimonio y la composición del fondo no están disponibles desde el servidor
              (Yahoo los bloquea para servidores en la nube). Puedes verlos en la página del emisor o en{' '}
              <a href={`https://finance.yahoo.com/quote/${encodeURIComponent(d.symbol)}/holdings/`} target="_blank" rel="noreferrer">Yahoo Finance</a>.
            </div>
          )}
          {f.fund?.family && <div className="note">{[f.fund.family, f.fund.category].filter(Boolean).join(' · ')}</div>}
        </section>
      )}

      {isEtf && f.fund && (f.fund.holdings.length > 0 || f.fund.sectors.length > 0) && (
        <div className="grid-half">
          {f.fund.holdings.length > 0 && (
            <section className="card">
              <div className="card-head"><h2>Principales posiciones</h2></div>
              <div className="ratio-bars">
                {f.fund.holdings.map((h) => (
                  <WeightRow key={h.symbol || h.name} label={h.symbol ? `${h.symbol} · ${h.name}` : h.name} weight={h.weight} />
                ))}
              </div>
            </section>
          )}
          {f.fund.sectors.length > 0 && (
            <section className="card">
              <div className="card-head"><h2>Sectores</h2></div>
              <div className="ratio-bars">
                {f.fund.sectors.map((s) => <WeightRow key={s.sector} label={SECTORS[s.sector] ?? s.sector.replace(/_/g, ' ')} weight={s.weight} />)}
              </div>
            </section>
          )}
        </div>
      )}
    </>
  )
}

function WeightRow({ label, weight }: { label: string; weight: number }) {
  return (
    <div>
      <div className="ratio-bar-head"><span>{label}</span><b className="num">{pct(weight, 1, false)}</b></div>
      <div className="weight-bar"><div style={{ width: `${Math.min(weight, 100)}%` }} /></div>
    </div>
  )
}
