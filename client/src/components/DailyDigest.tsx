import { useApi } from '../api'
import Markdown from './Markdown'

interface Digest { digest: string | null; ai: boolean }

// AI briefing over the day's headlines. With `setupTip`, explains how to turn
// it on when the server has no AI key configured.
export default function DailyDigest({ setupTip = false }: { setupTip?: boolean }) {
  const { data } = useApi<Digest>('/news/digest')
  if (data?.digest) {
    return (
      <div className="digest-block">
        <h3>✨ Resumen del día</h3>
        <Markdown className="digest" text={data.digest} />
      </div>
    )
  }
  if (setupTip && data && !data.ai) {
    return (
      <div className="note">
        Tip: configura <code>GROQ_API_KEY</code> (gratis en console.groq.com) para obtener un resumen del día y resúmenes con IA en español.
      </div>
    )
  }
  return null
}
