import { dateKeyFromDayIndex, parseDateKey } from '../../scheduling'

/**
 * Weekend stripes spanning the body VIEWPORT height (they sit behind the
 * FlatList, so they read as continuous columns while rows scroll).
 * Consecutive weekend days merge into one stripe (~totalDays/7 views).
 */
export const computeWeekendStripes = (
  windowStartKey: string,
  totalDays: number,
  px: number,
): Array<{ left: number; width: number }> => {
  const out: Array<{ left: number; width: number }> = []
  let runStart = -1
  for (let i = 0; i < totalDays; i += 1) {
    const d = parseDateKey(dateKeyFromDayIndex(i, windowStartKey))
    const weekend = d ? d.getDay() === 0 || d.getDay() === 6 : false
    if (weekend && runStart === -1) runStart = i
    if (!weekend && runStart !== -1) {
      out.push({ left: runStart * px, width: (i - runStart) * px })
      runStart = -1
    }
  }
  if (runStart !== -1) out.push({ left: runStart * px, width: (totalDays - runStart) * px })
  return out
}
