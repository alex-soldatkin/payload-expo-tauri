// Rich text v1 — plain-text round-trip. Editing drops any rich formatting.
//
// Reading and the written Lexical node shape mirror admin-native's mobile
// fallback exactly (RichTextFieldFallback.tsx), so documents saved here open
// correctly in the web admin:
//   root.children.map(extract).join('\n'), extract(text node) → node.text
//   write: text.split('\n') → paragraph nodes wrapping one text node each.
import type { FieldComponentProps } from '../types'
import { FieldShell, useFieldValue, isReadOnly, placeholderOf } from './shared'

/** Walk value.root, joining text nodes / paragraphs with newlines. */
function richTextToPlain(value: unknown): string {
  if (value == null) return ''
  if (typeof value === 'object' && 'root' in (value as Record<string, unknown>)) {
    const extract = (node: unknown): string => {
      if (node == null) return ''
      if (typeof node === 'string') return node
      const n = node as Record<string, unknown>
      if (typeof n.text === 'string') return n.text
      if (Array.isArray(n.children)) return n.children.map(extract).join('\n')
      return ''
    }
    return extract((value as Record<string, unknown>).root)
  }
  return ''
}

/** Plain text → Lexical state, matching the mobile fallback's node shape. */
function plainToRichText(text: string): unknown {
  return {
    root: {
      type: 'root',
      children: text.split('\n').map((line) => ({
        type: 'paragraph',
        children: [{ type: 'text', text: line }],
      })),
    },
  }
}

export function RichTextField(props: FieldComponentProps) {
  const { value, setValue, onBlur } = useFieldValue<unknown>(props)
  const readOnly = isReadOnly(props)

  return (
    <FieldShell props={props}>
      <div className="field-description">
        Editing here replaces rich formatting with plain text
      </div>
      <textarea
        className="input"
        rows={8}
        value={richTextToPlain(value)}
        placeholder={placeholderOf(props) ?? 'Start writing…'}
        readOnly={readOnly}
        onBlur={onBlur}
        onChange={(e) => setValue(e.target.value === '' ? undefined : plainToRichText(e.target.value))}
      />
    </FieldShell>
  )
}
