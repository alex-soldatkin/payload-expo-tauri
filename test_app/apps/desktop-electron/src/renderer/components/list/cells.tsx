// Renders a single table cell for a column key against a document row. The
// rendering is driven by the column's field type (from the schema) with meta
// columns (updatedAt/createdAt/_status/id) handled as scalars.
import type { ReactNode } from 'react'
import type { SchemaField } from '../../form/types'
import { formatUpdatedAt } from '../../lib/doc'
import { resolveOptionLabel, optionValue } from '../../form/labels'
import { StatusBadge } from '../badges/StatusBadge'
import type { DisplayField } from './columns'
import { useLocalDB, useLocalDocument } from '@payload-universal/local-db'
import { docTitle } from '../../lib/doc'

/** Extract a plausible display value out of a relationship row shape. */
/**
 * Live-resolving relationship cell: local sync is depth-0 (ids only), so the
 * related doc's TITLE is looked up from the local DB — lazily opening the
 * related collection on first use. Falls back to the raw ref while loading.
 */
export function RelationCell({ relationTo, value }: { relationTo?: unknown; value: unknown }) {
  // Normalize the first ref out of string | {relationTo,value} | doc | array.
  const first = Array.isArray(value) ? value[0] : value
  let slug = typeof relationTo === 'string' ? relationTo : undefined
  let id: string | null = null
  if (typeof first === 'string' || typeof first === 'number') id = String(first)
  else if (first && typeof first === 'object') {
    const o = first as Record<string, unknown>
    if (typeof o.relationTo === 'string') slug = o.relationTo
    const v = o.value ?? o.id
    if (typeof v === 'string' || typeof v === 'number') id = String(v)
    else if (v && typeof v === 'object' && (v as Record<string, unknown>).id != null) {
      id = String((v as Record<string, unknown>).id)
    }
  }
  const localDB = useLocalDB()
  const { doc } = useLocalDocument(localDB, slug ?? '', slug ? id : null)
  if (id == null) return <>{relationshipLabel(value)}</>
  const title = doc ? docTitle(doc) : relationshipLabel(first)
  const extra = Array.isArray(value) && value.length > 1 ? ` +${value.length - 1}` : ''
  return <>{title}{extra}</>
}

function relationshipLabel(v: unknown): string {
  if (v == null) return '—'
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (Array.isArray(v)) return `${v.length} ${v.length === 1 ? 'item' : 'items'}`
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>
    const label = o.title ?? o.name ?? o.value ?? o.id
    if (label != null) return String(label)
  }
  return '—'
}

/** First ~60 chars of plain text pulled out of a Lexical/Slate richText value. */
function richTextPreview(v: unknown): string {
  const parts: string[] = []
  const walk = (node: unknown): void => {
    if (parts.join(' ').length > 80) return
    if (node == null) return
    if (typeof node === 'string') {
      parts.push(node)
      return
    }
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    if (typeof node === 'object') {
      const o = node as Record<string, unknown>
      if (typeof o.text === 'string') parts.push(o.text)
      if (Array.isArray(o.children)) o.children.forEach(walk)
      if (o.root) walk(o.root)
    }
  }
  walk(v)
  const text = parts.join(' ').replace(/\s+/g, ' ').trim()
  if (!text) return '—'
  return text.length > 60 ? `${text.slice(0, 60)}…` : text
}

function countBadge(v: unknown): ReactNode {
  const n = Array.isArray(v) ? v.length : 0
  return <span className="list-badge">{n} {n === 1 ? 'item' : 'items'}</span>
}

function selectLabel(field: SchemaField | undefined, v: unknown): string {
  const options = field?.options
  if (Array.isArray(options)) {
    for (const opt of options) {
      if (optionValue(opt) === v) return resolveOptionLabel(opt)
    }
  }
  return String(v)
}

/** Render one (or many) select/radio values as colored status pills. */
function selectBadges(field: SchemaField | undefined, v: unknown): ReactNode {
  const values = (Array.isArray(v) ? v : [v]).filter((x) => x != null && x !== '')
  if (values.length === 0) return '—'
  return (
    <span className="cell-badges">
      {values.map((x) => (
        <StatusBadge key={String(x)} value={String(x)} label={selectLabel(field, x)} />
      ))}
    </span>
  )
}

function truncate(v: unknown): string {
  if (v == null || v === '') return '—'
  const s = String(v)
  return s.length > 80 ? `${s.slice(0, 80)}…` : s
}

export function renderCell(col: DisplayField, doc: Record<string, unknown>): ReactNode {
  const v = doc[col.key]
  switch (col.type) {
    case 'date':
      return formatUpdatedAt(v)
    case 'checkbox':
      return v === true ? '✓' : '—'
    case 'select':
    case 'radio':
      return selectBadges(col.field, v)
    case 'relationship':
    case 'upload':
      return <RelationCell relationTo={col.field?.relationTo} value={v} />
    case 'array':
    case 'blocks':
      return countBadge(v)
    case 'richText':
      return richTextPreview(v)
    default:
      return truncate(v)
  }
}
