// Rows and collapsibles are purely presentational — their children live at the
// SAME data path as the container. View eligibility (board/calendar) must see
// through them: Events' startsAt/endsAt sit inside a row, Posts' SEO fields
// inside collapsibles. Groups/tabs/arrays are NOT flattened — they change the
// data path, and the views read top-level doc keys.
import type { SchemaField } from '../../form/types'

export function flattenTransparent(fields: SchemaField[]): SchemaField[] {
  const out: SchemaField[] = []
  for (const f of fields) {
    if ((f.type === 'row' || f.type === 'collapsible') && f.fields) {
      out.push(...flattenTransparent(f.fields))
    } else {
      out.push(f)
    }
  }
  return out
}
