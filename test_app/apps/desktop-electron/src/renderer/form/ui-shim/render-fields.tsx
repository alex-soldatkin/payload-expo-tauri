// @payloadcms/ui `RenderFields` shim. In the Next admin this walks a Payload
// field array against the client field map; on desktop we delegate to the same
// FieldRenderer the DocumentForm uses, so a custom GROUP component (e.g.
// StructureFilesCollapsibleGroup) that renders its own children via
// <RenderFields fields={field.fields} parentPath={path} /> mounts the real
// desktop editors for those children — including the nested Ketcher `ketcherTool`
// UI field, which only renders because its parent group delegates back here.
import { renderField } from '../FieldRenderer'
import type { SchemaField } from '../types'

type RenderFieldsProps = {
  /** Payload passes the child field CONFIG array (same shape as SchemaField). */
  fields?: unknown[]
  /** Runtime form path of the parent container; children render beneath it. */
  parentPath?: string
  // The rest of Payload's RenderFields props (parentSchemaPath, permissions,
  // readOnly, parentIndexPath, …) are irrelevant to the desktop renderer.
  [key: string]: unknown
}

export function RenderFields({ fields, parentPath }: RenderFieldsProps) {
  if (!Array.isArray(fields)) return null
  return <>{fields.map((child) => renderField(child as SchemaField, parentPath ?? ''))}</>
}
