// Relationship editor: handles all four Payload value shapes
// (mono/poly × single/hasMany). Candidates come from the already-synced local
// RxDB — never over HTTP. filterOptions of the {field:{equals:v}} shape are
// applied client-side (fail-open on shapes we can't interpret).
import { useMemo, useState } from 'react'
import { useLocalCollection, useLocalDB, useLocalDocument } from '@payload-universal/local-db'
import type { PayloadDoc } from '@payload-universal/local-db'
import type { FieldComponentProps } from '../types'
import { FieldShell, isReadOnly, useFieldValue } from './shared'
import { InlineCreateModal } from '../InlineCreateModal'
import { docTitle } from '../../lib/doc'

/** A normalized reference: which collection it points at + the target id. */
type Ref = { relationTo: string; value: string }

/** Read a possibly-populated relationship id defensively (depth>0 → object). */
function idOf(v: unknown): string {
  if (v && typeof v === 'object') return String((v as { id?: unknown }).id ?? '')
  return String(v ?? '')
}

/** Normalize any stored value into a flat list of Refs. */
function toRefs(value: unknown, targets: string[], poly: boolean): Ref[] {
  const items = Array.isArray(value) ? value : value == null ? [] : [value]
  const out: Ref[] = []
  for (const item of items) {
    if (poly && item && typeof item === 'object' && 'relationTo' in item) {
      const rel = item as { relationTo: unknown; value: unknown }
      out.push({ relationTo: String(rel.relationTo), value: idOf(rel.value) })
    } else {
      out.push({ relationTo: targets[0], value: idOf(item) })
    }
  }
  return out.filter((r) => r.value)
}

/** Serialize Refs back to Payload's on-disk shape for this field config. */
function fromRefs(refs: Ref[], poly: boolean, hasMany: boolean): unknown {
  const shape = (r: Ref): unknown => (poly ? { relationTo: r.relationTo, value: r.value } : r.value)
  if (hasMany) return refs.map(shape)
  return refs.length ? shape(refs[0]) : null
}

function sameRef(a: Ref, b: Ref): boolean {
  return a.relationTo === b.relationTo && a.value === b.value
}

/** Apply a {field:{equals:value}} filterOptions map client-side (fail-open). */
function passesFilter(doc: PayloadDoc, filter: Record<string, unknown> | undefined): boolean {
  if (!filter) return true
  for (const [field, cond] of Object.entries(filter)) {
    if (!cond || typeof cond !== 'object') continue // shape we can't read → ignore
    const eq = (cond as { equals?: unknown }).equals
    if (eq === undefined) continue // only `equals` supported → ignore other ops
    if (doc[field] !== eq) return false
  }
  return true
}

export function RelationshipField(props: FieldComponentProps) {
  const { field } = props
  const { value, setValue } = useFieldValue(props)
  const readOnly = isReadOnly(props)

  const targets = useMemo(
    () => (Array.isArray(field.relationTo) ? field.relationTo : field.relationTo ? [field.relationTo] : []),
    [field.relationTo],
  )
  const poly = Array.isArray(field.relationTo)
  const hasMany = Boolean(field.hasMany)

  const refs = useMemo(() => toRefs(value, targets, poly), [value, targets, poly])

  const commit = (next: Ref[]) => setValue(fromRefs(next, poly, hasMany))

  const addRef = (ref: Ref) => {
    if (refs.some((r) => sameRef(r, ref))) return
    commit(hasMany ? [...refs, ref] : [ref])
  }
  const removeRef = (ref: Ref) => commit(refs.filter((r) => !sameRef(r, ref)))

  return (
    <FieldShell props={props}>
      <div className="chips">
        {refs.length === 0 && <span className="doc-meta">None selected</span>}
        {refs.map((ref) => (
          <RefChip
            key={`${ref.relationTo}:${ref.value}`}
            ref_={ref}
            poly={poly}
            onRemove={readOnly ? undefined : () => removeRef(ref)}
          />
        ))}
      </div>
      {!readOnly && (
        <Picker
          targets={targets}
          poly={poly}
          filter={field.filterOptions}
          selected={refs}
          onPick={addRef}
          single={!hasMany}
        />
      )}
    </FieldShell>
  )
}

/** One current-value chip; resolves its display title from the local DB. */
function RefChip({ ref_, poly, onRemove }: { ref_: Ref; poly: boolean; onRemove?: () => void }) {
  const localDB = useLocalDB()
  const { doc } = useLocalDocument(localDB, ref_.relationTo, ref_.value)
  const title = doc ? docTitle(doc) : ref_.value
  return (
    <span className="chip">
      {poly && <span className="doc-meta">{ref_.relationTo}:</span>}
      {title}
      {onRemove && (
        <button type="button" onClick={onRemove} title="Remove">
          ×
        </button>
      )}
    </span>
  )
}

/** Dropdown that lists local candidate docs for the active target collection. */
function Picker({
  targets,
  poly,
  filter,
  selected,
  onPick,
  single,
}: {
  targets: string[]
  poly: boolean
  filter: Record<string, unknown> | undefined
  selected: Ref[]
  onPick: (ref: Ref) => void
  single: boolean
}) {
  const localDB = useLocalDB()
  const [open, setOpen] = useState(false)
  const [activeTarget, setActiveTarget] = useState(targets[0] ?? '')
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)

  const target = poly ? activeTarget : targets[0] ?? ''
  const { docs } = useLocalCollection(localDB, target, { limit: 50 })

  const candidates = useMemo(() => {
    const q = search.trim().toLowerCase()
    return docs.filter((d) => {
      if (!passesFilter(d, filter)) return false
      if (q && !docTitle(d).toLowerCase().includes(q)) return false
      return true
    })
  }, [docs, filter, search])

  const changeLabel = single && selected.length > 0 ? 'Change' : 'Add'

  return (
    <div className="picker-dropdown">
      <button type="button" onClick={() => setOpen((o) => !o)}>
        {changeLabel}
      </button>
      {open && (
        <div className="picker-menu">
          {poly && targets.length > 1 && (
            <div className="chips" style={{ padding: '8px 10px' }}>
              {targets.map((slug) => (
                <button
                  key={slug}
                  type="button"
                  className={`chip toggle${slug === activeTarget ? ' on' : ''}`}
                  onClick={() => setActiveTarget(slug)}
                >
                  {slug}
                </button>
              ))}
            </div>
          )}
          <input
            className="input"
            style={{ margin: '8px 10px', width: 'calc(100% - 20px)' }}
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {candidates.length === 0 && <div className="option doc-meta">No matches.</div>}
          {candidates.map((doc) => (
            <button
              key={doc.id}
              type="button"
              className="option"
              onClick={() => {
                onPick({ relationTo: target, value: doc.id })
                setSearch('')
                if (single) setOpen(false)
              }}
            >
              {docTitle(doc)}
            </button>
          ))}
          {target && (
            <button
              type="button"
              className="option option-create"
              onClick={() => setCreating(true)}
            >
              + Create new…
            </button>
          )}
        </div>
      )}
      {creating && target && (
        <InlineCreateModal
          slug={target}
          onCreated={(id) => {
            onPick({ relationTo: target, value: id })
            setCreating(false)
            setSearch('')
            if (single) setOpen(false)
          }}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  )
}
