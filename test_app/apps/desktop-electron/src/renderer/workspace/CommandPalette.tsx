// Cmd/Ctrl+K global command palette (desktop twin of assemblon's search
// palette). A floating, filterable list over the whole workspace: static
// commands (toggle sidebar, open settings, open any collection) plus a live
// document search across every synced collection in the local DB.
//
// Contract is fixed by the mount site — see App wiring. Esc / backdrop
// dismisses; arrow keys move an active row (wrapping), Enter / click selects.
import type { JSX } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocalDB } from '@payload-universal/local-db'
import type { AdminSchema } from '@payload-universal/admin-schema'
import { collectionLabel, collectionLabelSingular } from '../lib/collections'
import { docTitle } from '../lib/doc'

/** A single actionable row: either a static command or a matched document. */
type PaletteItem = {
  key: string
  label: string
  /** Right-aligned dim text (collection label for docs). */
  meta?: string
  /** Group heading this row belongs to. */
  group: string
  run: () => void
}

/** One cached document, flattened for client-side substring filtering. */
type DocEntry = {
  slug: string
  collectionLabel: string
  id: string
  title: string
  /** Lowercased title for case-insensitive matching. */
  haystack: string
}

const MAX_VISIBLE = 12
const MAX_DOCS = 8

export function CommandPalette({
  schema,
  onOpenList,
  onOpenEditor,
  onOpenSettings,
  onToggleSidebar,
}: {
  schema: AdminSchema
  onOpenList: (slug: string) => void
  onOpenEditor: (slug: string, docId: string) => void
  onOpenSettings: () => void
  onToggleSidebar: () => void
}): JSX.Element | null {
  const localDB = useLocalDB()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  // Snapshot of all synced docs, refreshed each time the palette opens.
  const [docCache, setDocCache] = useState<DocEntry[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActive(0)
  }, [])

  // Cmd/Ctrl+K toggles the palette from anywhere in the window.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // On open: reset transient state, focus the input, and snapshot every
  // visible collection's docs once (client-side filtering does the rest).
  useEffect(() => {
    if (!open) return
    setQuery('')
    setActive(0)
    // Focus after paint so the freshly-mounted input exists.
    const id = requestAnimationFrame(() => inputRef.current?.focus())

    let cancelled = false
    if (!localDB) {
      setDocCache([])
      return () => cancelAnimationFrame(id)
    }
    const collections = (schema.menuModel.collections ?? []).filter((c) => !c.hidden)
    Promise.all(
      collections.map(async (c) => {
        const coll = localDB.collections[c.slug]
        if (!coll) return [] as DocEntry[]
        try {
          const docs = await coll
            .find({ selector: { _deleted: { $eq: false } }, limit: 40 })
            .exec()
          const label = collectionLabel(c)
          return docs.map((d): DocEntry => {
            const record = (typeof d.toJSON === 'function' ? d.toJSON() : d) as Record<
              string,
              unknown
            >
            const title = docTitle(record, c.useAsTitle)
            return {
              slug: c.slug,
              collectionLabel: label,
              id: String(record.id ?? ''),
              title,
              haystack: title.toLowerCase(),
            }
          })
        } catch {
          return [] as DocEntry[]
        }
      }),
    ).then((chunks) => {
      if (!cancelled) setDocCache(chunks.flat())
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(id)
    }
  }, [open, localDB, schema])

  // Static commands, always present but filtered by the query.
  const commands = useMemo<PaletteItem[]>(() => {
    const items: PaletteItem[] = [
      {
        key: 'cmd:toggle-sidebar',
        label: 'Toggle sidebar',
        group: 'Commands',
        run: onToggleSidebar,
      },
      {
        key: 'cmd:settings',
        label: 'Open Settings',
        group: 'Commands',
        run: onOpenSettings,
      },
    ]
    for (const c of schema.menuModel.collections ?? []) {
      if (c.hidden) continue
      items.push({
        key: `cmd:open:${c.slug}`,
        label: `Open ${collectionLabel(c)}`,
        meta: collectionLabelSingular(c),
        group: 'Commands',
        run: () => onOpenList(c.slug),
      })
    }
    return items
  }, [schema, onToggleSidebar, onOpenSettings, onOpenList])

  // Build the flat, ordered result list: filtered commands then (query >= 2)
  // the top document matches. Row indices map straight onto this array.
  const results = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase()
    const filteredCommands = q
      ? commands.filter((c) => c.label.toLowerCase().includes(q))
      : commands
    const commandRows = filteredCommands.slice(0, MAX_VISIBLE)

    let docRows: PaletteItem[] = []
    if (q.length >= 2) {
      docRows = docCache
        .filter((d) => d.haystack.includes(q))
        .slice(0, MAX_DOCS)
        .map((d) => ({
          key: `doc:${d.slug}:${d.id}`,
          label: d.title,
          meta: d.collectionLabel,
          group: 'Documents',
          run: () => onOpenEditor(d.slug, d.id),
        }))
    }
    return [...commandRows, ...docRows]
  }, [query, commands, docCache, onOpenEditor])

  // Keep the active index in range as results shrink/grow.
  useEffect(() => {
    setActive((a) => (results.length === 0 ? 0 : Math.min(a, results.length - 1)))
  }, [results.length])

  const select = useCallback(
    (index: number) => {
      const item = results[index]
      if (!item) return
      item.run()
      close()
    },
    [results, close],
  )

  // Keyboard nav while open: Esc closes, arrows move (wrapping), Enter selects.
  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      close()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => (results.length ? (a + 1) % results.length : 0))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => (results.length ? (a - 1 + results.length) % results.length : 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      select(active)
    }
  }

  if (!open) return null

  return (
    <div className="palette-overlay" onMouseDown={close}>
      <div className="palette" onMouseDown={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Search commands and documents…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onInputKeyDown}
          aria-label="Command palette"
        />
        <div className="palette-list">
          {results.length === 0 && <div className="palette-empty">No matches.</div>}
          {results.map((item, i) => {
            // Emit a group heading whenever the group changes.
            const showGroup = i === 0 || results[i - 1].group !== item.group
            return (
              <div key={item.key}>
                {showGroup && <div className="palette-group-label">{item.group}</div>}
                <button
                  type="button"
                  className={`palette-row${i === active ? ' selected' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => select(i)}
                >
                  <span className="palette-row-label">{item.label}</span>
                  {item.meta && <span className="meta">{item.meta}</span>}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
