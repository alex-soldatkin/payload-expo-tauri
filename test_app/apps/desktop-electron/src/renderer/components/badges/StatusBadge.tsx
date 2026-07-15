// A small colored pill for select/radio option values (status, category, …).
// The hue is derived deterministically from the *value* string so the same
// value reads identically everywhere it appears (table cells, board headers,
// calendar chips). Common semantic values are special-cased to intuitive hues
// (green = good/done, amber = in-flight, red = negative, gray = dormant) before
// falling back to a stable hash into an 8-hue palette. Colours live in
// badges.css as .badge-hue-0..7 plus the four semantic aliases.

/** Semantic value → fixed hue class, checked before the hash. */
const SEMANTIC: Record<string, string> = {
  published: 'badge-hue-ok',
  active: 'badge-hue-ok',
  done: 'badge-hue-ok',
  complete: 'badge-hue-ok',
  completed: 'badge-hue-ok',
  approved: 'badge-hue-ok',
  draft: 'badge-hue-warn',
  pending: 'badge-hue-warn',
  'in-progress': 'badge-hue-warn',
  in_progress: 'badge-hue-warn',
  inprogress: 'badge-hue-warn',
  archived: 'badge-hue-mute',
  inactive: 'badge-hue-mute',
  disabled: 'badge-hue-mute',
  cancelled: 'badge-hue-danger',
  canceled: 'badge-hue-danger',
  rejected: 'badge-hue-danger',
  failed: 'badge-hue-danger',
}

/** djb2 string hash — small, stable, dependency-free. */
function hash(s: string): number {
  let h = 5381
  for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i)
  return h >>> 0
}

/** Resolve the hue class for a value: semantic override, else hashed palette. */
function hueClass(value: string): string {
  const key = value.trim().toLowerCase()
  return SEMANTIC[key] ?? `badge-hue-${hash(key) % 8}`
}

type Props = {
  /** Raw option value — drives the colour. */
  value: string
  /** Human label shown inside the pill (defaults to the value). */
  label?: string
}

export function StatusBadge({ value, label }: Props) {
  return (
    <span className={`status-badge ${hueClass(value)}`}>{label ?? value}</span>
  )
}
