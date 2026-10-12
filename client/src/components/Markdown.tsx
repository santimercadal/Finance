import type { ReactNode } from 'react'

// Minimal Markdown for AI summaries: **bold**, *italic*, "- " / "1. " lists,
// "#" headings (shown as bold lines) and paragraphs. Builds React nodes, so the
// text is never injected as HTML.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*)/g).map((part, i) => {
    if (/^(\*\*|__).+\1$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>
    if (/^\*.+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>
    return part
  })
}

export default function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = []
  let list = null as { ordered: boolean; items: string[] } | null
  let para: string[] = []

  const flushPara = () => {
    if (para.length) {
      blocks.push(<p key={blocks.length}>{para.flatMap((l, i) => (i ? [<br key={i} />, ...inline(l)] : inline(l)))}</p>)
      para = []
    }
  }
  const flushList = () => {
    if (list) {
      const items = list.items.map((it, i) => <li key={i}>{inline(it)}</li>)
      blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>)
      list = null
    }
  }

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    const bullet = line.match(/^[-*•]\s+(.*)$/)
    const numbered = line.match(/^\d+[.)]\s+(.*)$/)
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    if (!line) {
      flushPara(); flushList()
    } else if (bullet || numbered) {
      flushPara()
      const ordered = !bullet
      if (list && list.ordered !== ordered) flushList()
      list ??= { ordered, items: [] }
      list.items.push((bullet ?? numbered)![1])
    } else if (heading) {
      flushPara(); flushList()
      blocks.push(<p key={blocks.length}><strong>{inline(heading[1].replace(/\*\*/g, ''))}</strong></p>)
    } else {
      flushList()
      para.push(line)
    }
  }
  flushPara(); flushList()
  return <div className={`md ${className ?? ''}`}>{blocks}</div>
}
