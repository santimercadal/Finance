import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApi, type ScreenResult, type StyleInfo, type StyleResult } from '../api'
import { compact, money, num, pct, tone } from '../format'
import SymbolSearch from '../components/SymbolSearch'
import Icon from '../icons'

// Filter groups: [query key, Spanish label, options [value, label, Finviz code]].
type Option = [value: string, label: string, finviz: string]
const GROUPS: [key: string, label: string, options: Option[]][] = [
  ['recommendation', 'Analistas', [
    ['strong_buy', 'Compra fuerte', 'an_recom_strongbuy'], ['buy', 'Comprar', 'an_recom_buybetter'],
    ['hold', 'Mantener', 'an_recom_hold'], ['sell', 'Vender', 'an_recom_sell'],
  ]],
  ['marketcap', 'Tamaño', [
    ['mega', 'Mega +200 MM', 'cap_mega'], ['large', 'Grande 10–200 MM', 'cap_large'], ['mid', 'Mediana 2–10 MM', 'cap_mid'],
    ['small', 'Chica 0,3–2 MM', 'cap_small'], ['micro', 'Micro', 'cap_micro'],
  ]],
  ['sector', 'Sector', [
    ['technology', 'Tecnología', 'sec_technology'], ['health_care', 'Salud', 'sec_healthcare'], ['finance', 'Finanzas', 'sec_financial'],
    ['consumer_discretionary', 'Consumo discrecional', 'sec_consumercyclical'], ['consumer_staples', 'Consumo básico', 'sec_consumerdefensive'],
    ['industrials', 'Industria', 'sec_industrials'], ['energy', 'Energía', 'sec_energy'], ['utilities', 'Servicios públicos', 'sec_utilities'],
    ['real_estate', 'Inmobiliario', 'sec_realestate'], ['basic_materials', 'Materiales', 'sec_basicmaterials'],
    ['telecommunications', 'Telecomunicaciones', 'sec_communicationservices'],
  ]],
  ['exchange', 'Bolsa', [['nasdaq', 'NASDAQ', 'exch_nasd'], ['nyse', 'NYSE', 'exch_nyse'], ['amex', 'AMEX', 'exch_amex']]],
  ['region', 'Origen', [
    ['north_america', 'Norteamérica', ''], ['europe', 'Europa', 'geo_europe'], ['asia', 'Asia', 'geo_asia'], ['south_america', 'Sudamérica', 'geo_latinamerica'],
  ]],
]

const SORTS: [string, string, string][] = [
  ['cap', 'Capitalización', '-marketcap'], ['change', 'Más suben hoy', '-change'], ['volume', 'Más operadas', '-volume'],
]

type Filters = Record<string, string[]>
const SAVED = 'explore-filters'
const DEFAULT_FILTERS: Filters = { recommendation: ['strong_buy'], marketcap: ['mega', 'large'] }

function loadFilters(): { filters: Filters; sort: string } {
  try {
    const saved = JSON.parse(localStorage.getItem(SAVED) ?? 'null')
    if (saved?.filters) return saved
  } catch { /* storage unavailable */ }
  return { filters: DEFAULT_FILTERS, sort: 'cap' }
}

// Same screen on Finviz. Its free screener takes one value per filter, so
// filters with several values selected are left out of the link.
function finvizScreen(filters: Filters, sort: string) {
  const codes = GROUPS.flatMap(([key, , options]) => {
    const sel = filters[key] ?? []
    return sel.length === 1 ? options.filter(([v, , code]) => v === sel[0] && code).map(([, , code]) => code) : []
  })
  const order = SORTS.find(([k]) => k === sort)?.[2] ?? '-marketcap'
  return `https://finviz.com/screener.ashx?v=111${codes.length ? `&f=${codes.join(',')}` : ''}&o=${order}`
}

function FilterScreen() {
  const [{ filters, sort }, setState] = useState(loadFilters)
  const [open, setOpen] = useState(false)
  useEffect(() => {
    try { localStorage.setItem(SAVED, JSON.stringify({ filters, sort })) } catch { /* storage unavailable */ }
  }, [filters, sort])

  const query = useMemo(() => {
    const qs = new URLSearchParams({ sort, limit: '60' })
    for (const [k, v] of Object.entries(filters)) if (v.length) qs.set(k, v.join(','))
    return `/screener?${qs}`
  }, [filters, sort])
  const { data, error, loading } = useApi<ScreenResult>(query)

  const toggle = (key: string, value: string) =>
    setState((s) => {
      const cur = s.filters[key] ?? []
      return { ...s, filters: { ...s.filters, [key]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value] } }
    })
  const active = Object.values(filters).reduce((n, v) => n + v.length, 0)
  const labels = GROUPS.flatMap(([key, , options]) => options.filter(([v]) => filters[key]?.includes(v)).map(([v, label]) => [key, v, label]))

  return (
    <section className="screen">
      <div className="screen-bar">
        <button className={`btn ghost filter-btn ${open ? 'on' : ''}`} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Icon name="filter" size={16} /> Filtros {active > 0 && <span className="count num">{active}</span>}
        </button>
        <div className="seg">
          {SORTS.map(([k, label]) => (
            <button key={k} className={sort === k ? 'on' : ''} onClick={() => setState((s) => ({ ...s, sort: k }))}>{label}</button>
          ))}
        </div>
      </div>

      {!open && labels.length > 0 && (
        <div className="active-filters">
          {labels.map(([key, v, label]) => (
            <button key={`${key}:${v}`} className="chip removable" onClick={() => toggle(key, v)} aria-label={`Quitar filtro ${label}`}>
              {label} <Icon name="x" size={12} />
            </button>
          ))}
          <button className="link-btn" onClick={() => setState((s) => ({ ...s, filters: {} }))}>Limpiar</button>
        </div>
      )}

      {open && (
        <div className="filter-panel card">
          {GROUPS.map(([key, label, options]) => (
            <fieldset key={key}>
              <legend>{label}</legend>
              <div className="chip-group">
                {options.map(([v, l]) => {
                  const on = filters[key]?.includes(v) ?? false
                  return (
                    <button key={v} className={`chip toggle ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => toggle(key, v)}>
                      {on && <Icon name="check" size={12} />}{l}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          ))}
          <div className="filter-actions">
            <button className="btn ghost" onClick={() => setState((s) => ({ ...s, filters: {} }))}>Limpiar</button>
            <button className="btn" onClick={() => setOpen(false)}>Ver {data ? num(data.total, 0) : ''} resultados</button>
          </div>
        </div>
      )}

      <div className="results-head small muted">
        <span>{loading ? 'Buscando…' : data ? `${num(data.total, 0)} acciones · mostrando ${data.results.length}` : ''}</span>
        <a href={finvizScreen(filters, sort)} target="_blank" rel="noreferrer" className="link-ext">Ver en Finviz <Icon name="external" size={13} /></a>
      </div>
      {error && <div className="error">{error}</div>}
      {!data && !error && <div className="skeleton" style={{ height: 240 }} />}
      {data && data.results.length === 0 && <div className="card empty">Ninguna acción cumple todos los filtros.</div>}
      {data && (
        <ol className="result-list">
          {data.results.map((r) => (
            <li key={r.symbol}>
              <Link to={`/accion/${encodeURIComponent(r.symbol)}`} className="result">
                <span className={`ticker-tile num ${tone(r.changePct)}`}>{r.symbol.slice(0, 4)}</span>
                <span className="result-id">
                  <b className="num">{r.symbol}</b>
                  <span className="name">{r.name}</span>
                  <span className="result-meta">{[r.sector, r.marketCap ? `Cap. ${compact(r.marketCap)}` : null].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="result-right">
                  <span className="num">{money(r.price)}</span>
                  <span className={`badge ${tone(r.changePct)}`}>{pct(r.changePct)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <p className="note">Datos del buscador público de Nasdaq (acciones que cotizan en EE.UU.), demorados unos minutos.</p>
    </section>
  )
}

function StyleScreen() {
  const styles = useApi<StyleInfo[]>('/screener/styles')
  const [style, setStyle] = useState<string>(() => {
    try { return sessionStorage.getItem('explore-style') ?? 'growth' } catch { return 'growth' }
  })
  const pick = (s: string) => {
    setStyle(s)
    try { sessionStorage.setItem('explore-style', s) } catch { /* storage unavailable */ }
  }
  const { data, error } = useApi<StyleResult>(`/screener/styles/${style}`)
  const dividends = style === 'dividends'

  return (
    <section className="screen">
      <div className="style-rail" role="tablist" aria-label="Estilo de inversión">
        {(styles.data ?? []).map((s) => (
          <button key={s.key} role="tab" aria-selected={s.key === style} className={`style-card ${s.key === style ? 'on' : ''}`} onClick={() => pick(s.key)}>
            <b>{s.name}</b>
            <span className="style-profile">{s.profile}</span>
          </button>
        ))}
        {!styles.data && [0, 1, 2].map((i) => <div key={i} className="style-card"><div className="skeleton" /></div>)}
      </div>

      {data && (
        <div className="results-head small muted">
          <span>{data.description}</span>
          <a href={data.finvizUrl} target="_blank" rel="noreferrer" className="link-ext">Ver en Finviz <Icon name="external" size={13} /></a>
        </div>
      )}
      {error && <div className="error">{error}</div>}
      {!data && !error && <div className="skeleton" style={{ height: 240 }} />}
      {data && (
        <ol className="result-list">
          {data.results.map((r) => (
            <li key={r.symbol}>
              <Link to={`/accion/${encodeURIComponent(r.symbol)}`} className="result">
                <span className={`ticker-tile num ${tone(r.changePct)}`}>{r.symbol.replace(/\..*$/, '').slice(0, 4)}</span>
                <span className="result-id">
                  <b className="num">{r.symbol}</b>
                  <span className="name">{r.name}</span>
                  <span className="result-stats">
                    {dividends && <span>Div <b>{pct(r.dividendYield, 1, false)}</b></span>}
                    <span>P/E <b>{num(r.pe, 1)}</b></span>
                    {!dividends && <span>P/E fut. <b>{num(r.forwardPe, 1)}</b></span>}
                    <span>1 año <b className={tone(r.yearChangePct)}>{pct(r.yearChangePct, 0)}</b></span>
                  </span>
                </span>
                <span className="result-right">
                  <span className="num">{money(r.price, r.currency)}</span>
                  {r.analystLabel ? <span className={`badge ${r.analystScore != null && r.analystScore <= 2.5 ? 'up' : r.analystScore != null && r.analystScore >= 3.5 ? 'down' : 'mid'}`}>{analystEs(r.analystLabel)}</span>
                    : <span className={`badge ${tone(r.changePct)}`}>{pct(r.changePct)}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
      <p className="note">Pantallas predefinidas de Yahoo Finance. La etiqueta es el consenso de analistas (1 = compra fuerte, 5 = venta).</p>
    </section>
  )
}

const ANALYST_ES: Record<string, string> = { 'Strong Buy': 'Compra fuerte', Buy: 'Comprar', Hold: 'Mantener', Underperform: 'Bajo rendimiento', Sell: 'Vender' }
const analystEs = (s: string) => ANALYST_ES[s] ?? s

export default function ExplorePage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'styles' | 'filters'>(() => {
    try { return sessionStorage.getItem('explore-mode') === 'filters' ? 'filters' : 'styles' } catch { return 'styles' }
  })
  const pick = (m: typeof mode) => {
    setMode(m)
    try { sessionStorage.setItem('explore-mode', m) } catch { /* storage unavailable */ }
  }

  return (
    <main className="page">
      <header className="page-head">
        <span className="eyebrow">Explorar</span>
        <h1>Encontrá tu próxima acción</h1>
        <p>Buscá por nombre, elegí un estilo de inversión o armá tu propio filtro como en Finviz.</p>
      </header>
      <SymbolSearch className="search search-lg" placeholder="Buscar empresa o ticker (ej. Apple, MELI, SPY)"
        onSelect={(s) => navigate(`/accion/${encodeURIComponent(s.symbol)}`)} />
      <div className="seg seg-full two" role="tablist">
        <button role="tab" aria-selected={mode === 'styles'} className={mode === 'styles' ? 'on' : ''} onClick={() => pick('styles')}>Por estilo</button>
        <button role="tab" aria-selected={mode === 'filters'} className={mode === 'filters' ? 'on' : ''} onClick={() => pick('filters')}>Con filtros</button>
      </div>
      {mode === 'styles' ? <StyleScreen /> : <FilterScreen />}
    </main>
  )
}
