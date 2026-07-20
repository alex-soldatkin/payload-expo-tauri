// Rows, collapsibles and UNNAMED tabs are purely presentational — their
// children live at the SAME data path as the container. List columns and view
// eligibility (board/calendar) must see through them: Events' startsAt/endsAt
// sit inside a row, Posts' SEO fields inside collapsibles, and production
// configs (assemblon) keep most collection fields inside unnamed tab sets.
// Groups, NAMED tabs and arrays are NOT flattened — they nest the data path,
// and the views read top-level doc keys.
import type { SchemaField } from '../../form/types'

type TabLike = { name?: string; fields?: SchemaField[] }

export function flattenTransparent(fields: SchemaField[]): SchemaField[] {
  const out: SchemaField[] = []
  for (const f of fields) {
    if ((f.type === 'row' || f.type === 'collapsible') && f.fields) {
      out.push(...flattenTransparent(f.fields))
    } else if (f.type === 'tabs' && (f as { tabs?: TabLike[] }).tabs) {
      for (const tab of (f as { tabs?: TabLike[] }).tabs ?? []) {
        if (!tab.name && tab.fields) out.push(...flattenTransparent(tab.fields))
      }
    } else {
      out.push(f)
    }
  }
  return out
}
