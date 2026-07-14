// DOM port of server SessionRowLabel — labels rows of events.sessions.
// The original showed `data.title || 'Session NN'` (2-digit padded) plus the
// speaker. Here we keep that title/fallback and append the formatted startTime
// when present ('{title} — {startTime}'), guarding every missing value.
import type { RowLabelProps } from '../registry'

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

function formatTime(v: unknown): string | undefined {
  const s = str(v)
  if (!s) return undefined
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

export function SessionRowLabel({ data, index }: RowLabelProps) {
  const title = str(data.title) ?? `Session ${String(index + 1).padStart(2, '0')}`
  const time = formatTime(data.startTime)
  const speaker = str(data.speaker)

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontWeight: 600, fontSize: 13 }}>
        {title}
        {time ? ` — ${time}` : ''}
      </span>
      {speaker && <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>{speaker}</span>}
    </span>
  )
}

export default SessionRowLabel
