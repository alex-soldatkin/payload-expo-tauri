// Gantt eligibility — a gantt view needs a START and an END date, so it is only
// available when the collection has ≥2 top-level content date fields. Reuses the
// calendar's `eligibleDateFields` (same top-level, visible, non-bookkeeping date
// rule), so a field that can back a calendar can also back a gantt axis. Nested
// fields (inside groups/tabs/arrays) are out of scope, exactly like the other views.
import type { SchemaField } from '../../../form/types'
import { eligibleDateFields } from '../calendar/eligibility'

/** Top-level content date fields that can serve as a gantt start/end axis. */
export function eligibleGanttDateFields(rootFields: SchemaField[]): SchemaField[] {
  return eligibleDateFields(rootFields)
}

/** Whether the collection has enough date fields (≥2) to draw a gantt. */
export function eligibleGanttPairs(rootFields: SchemaField[]): boolean {
  return eligibleGanttDateFields(rootFields).length >= 2
}
