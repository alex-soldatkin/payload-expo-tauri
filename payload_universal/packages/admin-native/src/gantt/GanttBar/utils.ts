import { parseDateKey } from '../../scheduling'

/** Tooltip pill width (centered over the live bar). */
export const TOOLTIP_WIDTH = 156

/** 'Jun 12' per device locale, from a 'YYYY-MM-DD' key. */
export const fmtDayKey = (key: string): string => {
  const d = parseDateKey(key)
  if (!d) return key
  try {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  } catch {
    return key
  }
}
