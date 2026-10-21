import { useApi, type AiUsage as Usage } from '../api'

const fmt = (n: number) => n.toLocaleString('es-AR')

// Groq sends reset times like "2m59.56s" or "7.66s"; show them rounded.
const resetIn = (v: string | null) => {
  const m = v?.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:([\d.]+)s)?$/)
  if (!m) return null
  const secs = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Math.ceil(Number(m[3] ?? 0))
  if (secs < 60) return `${secs} s`
  return secs < 3600 ? `${Math.round(secs / 60)} min` : `${Math.floor(secs / 3600)} h ${Math.round((secs % 3600) / 60)} min`
}

function Meter({ label, used, limit, detail }: { label: string; used: number; limit: number; detail?: string | null }) {
  const pct = Math.min(100, (used / limit) * 100)
  const level = pct >= 90 ? 'high' : pct >= 70 ? 'mid' : ''
  return (
    <div className="usage-meter">
      <div className="usage-row">
        <span>{label}</span>
        <b>{fmt(used)} / {fmt(limit)}</b>
      </div>
      <div className={`usage-bar ${level}`} role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
        <span style={{ width: `${pct}%` }} />
      </div>
      {detail && <small>{detail}</small>}
    </div>
  )
}

// Today's Groq consumption vs. the free-tier caps.
export default function AiUsage() {
  const { data, error } = useApi<Usage>('/ai/usage', 60_000)
  if (error) return <p className="small">No se pudo leer el consumo: {error}</p>
  if (!data) return <div className="skeleton" style={{ height: 80 }} />
  if (!data.enabled) return <p className="small">La IA está desactivada (falta GROQ_API_KEY en el servidor).</p>

  const { today, limits, dailyTokenLimit, pausedUntil } = data
  return (
    <div className="ai-usage">
      {pausedUntil && (
        <p className="usage-alert">
          Límite gratuito alcanzado. Los resúmenes se reanudan a las {new Date(pausedUntil).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}.
        </p>
      )}
      {dailyTokenLimit
        ? <Meter label="Tokens hoy" used={today!.tokens} limit={dailyTokenLimit} />
        : <div className="usage-row"><span>Tokens hoy</span><b>{fmt(today!.tokens)}</b></div>}
      {limits?.requestsPerDay != null && limits.requestsLeft != null && (
        <Meter label="Pedidos del día" used={limits.requestsPerDay - limits.requestsLeft} limit={limits.requestsPerDay}
          detail={resetIn(limits.requestsReset) && `Se libera uno en ${resetIn(limits.requestsReset)}`} />
      )}
      {limits?.tokensPerMinute != null && limits.tokensLeft != null && (
        <Meter label="Tokens por minuto" used={limits.tokensPerMinute - limits.tokensLeft} limit={limits.tokensPerMinute}
          detail={resetIn(limits.tokensReset) && `Se repone en ${resetIn(limits.tokensReset)}`} />
      )}
      <p className="note">
        {fmt(today!.requests)} {today!.requests === 1 ? 'pedido' : 'pedidos'} hoy desde este servidor
        {today!.errors ? ` (${today!.errors} con error)` : ''} · modelo {data.model}.
        {limits
          ? ` Límites informados por Groq (${new Date(limits.at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })}); incluyen todo uso de la clave.`
          : ' Groq informa sus límites después del primer pedido desde que arrancó el servidor.'}
        {' '}Las respuestas guardadas no gastan cuota.
      </p>
    </div>
  )
}
