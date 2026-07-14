// Desktop list-view engine: a sortable, searchable, column-configurable table
// backed by the local RxDB (issue #20). Orchestrates the toolbar + table and
// persists per-collection column/sort/pageSize prefs via the desktop bridge.
import { useMemo, useState } from 'react'
import { useLocalCollection, useLocalDB, useLocalMutations } from '@payload-universal/local-db'
import type { AdminSchema } from '@payload-universal/admin-schema'
import { collectionLabel } from '../lib/collections'
import { getRootFields } from '../lib/schemaFields'
import { ListToolbar } from './list/ListToolbar'
import { ListTable } from './list/ListTable'
import { useListConfig } from './list/useListConfig'
import {
  displayableFields,
  defaultColumns,
  metaOrFieldColumn,
  ensureTitle,
  matchesQuery,
} from './list/columns'

type Props = {
  schema: AdminSchema
  slug: string
  onOpen: (id: string) => void
}

const DEFAULT_PAGE_SIZE = 50

export function DocumentList({ schema, slug, onOpen }: Props) {
  const localDB = useLocalDB()
  const { create } = useLocalMutations(localDB, slug)
  const { config, ready, update } = useListConfig(slug)

  const meta = schema.menuModel.collections.find((c) => c.slug === slug)
  const label = meta ? collectionLabel(meta) : slug
  const titleKey = meta?.useAsTitle ?? 'id'

  const displayable = useMemo(() => displayableFields(getRootFields(schema, slug)), [schema, slug])
  const defaults = useMemo(
    () => defaultColumns(schema, slug, displayable),
    [schema, slug, displayable],
  )

  const columns = ensureTitle(config.columns ?? defaults, titleKey)
  const sort = config.sort ?? '-updatedAt'
  const pageSize = config.pageSize ?? DEFAULT_PAGE_SIZE
  const sortDesc = sort.startsWith('-')
  const sortField = sortDesc ? sort.slice(1) : sort

  const { docs, loading, totalDocs, refetch, page, setPage, hasNextPage } = useLocalCollection(
    localDB,
    slug,
    { sort, limit: pageSize },
  )

  const [search, setSearch] = useState('')
  const visible = useMemo(
    () => docs.filter((d) => matchesQuery(d as Record<string, unknown>, search, meta?.useAsTitle)),
    [docs, search, meta?.useAsTitle],
  )

  const columnDefs = useMemo(
    () => columns.map((key) => metaOrFieldColumn(key, displayable)),
    [columns, displayable],
  )

  // ---- toolbar handlers ---------------------------------------------------
  const onSort = (key: string) => {
    if (sortField !== key) update({ sort: `-${key}` }) // new column → desc first
    else if (sortDesc) update({ sort: key }) // desc → asc
    else update({ sort: '-updatedAt' }) // asc → off (default)
  }
  const onToggleColumn = (key: string) => {
    const next = columns.includes(key) ? columns.filter((c) => c !== key) : [...columns, key]
    update({ columns: ensureTitle(next, titleKey) })
  }
  const onMoveColumn = (key: string, dir: -1 | 1) => {
    const i = columns.indexOf(key)
    const j = i + dir
    if (i < 0 || j < 0 || j >= columns.length) return
    const next = [...columns]
    ;[next[i], next[j]] = [next[j], next[i]]
    update({ columns: next })
  }

  const createNew = async () => {
    if (!localDB) return
    try {
      const id = await create(meta?.drafts ? { _status: 'draft' } : {})
      onOpen(id)
    } catch (err) {
      console.error('Failed to create document:', err)
    }
  }

  const totalPages = Math.max(1, Math.ceil(totalDocs / pageSize))

  return (
    <div className="main">
      <div className="main-header">
        <h2>{label}</h2>
        <span className="list-count">
          {totalDocs} {totalDocs === 1 ? 'item' : 'items'}
        </span>
        {totalDocs > pageSize && <span className="list-count">Page {page}</span>}
      </div>

      <ListToolbar
        search={search}
        onSearch={setSearch}
        displayable={displayable}
        columns={columns}
        titleKey={titleKey}
        onToggleColumn={onToggleColumn}
        onMoveColumn={onMoveColumn}
        onResetColumns={() => update({ columns: defaults })}
        pageSize={pageSize}
        onPageSize={(n) => update({ pageSize: n })}
        onRefresh={refetch}
        onCreate={createNew}
        canCreate={Boolean(localDB)}
      />

      <div className="main-scroll">
        {!localDB || !ready || loading ? (
          <div className="empty">Loading…</div>
        ) : visible.length === 0 ? (
          <div className="empty">
            {search ? 'No matches on this page.' : 'No documents yet. Create one to get started.'}
          </div>
        ) : (
          <ListTable
            columns={columnDefs}
            docs={visible as Record<string, unknown>[]}
            sortField={sortField}
            sortDir={sortDesc ? 'desc' : 'asc'}
            onSort={onSort}
            onOpen={onOpen}
          />
        )}
      </div>

      {totalDocs > pageSize && (
        <div className="list-pager">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>
            ‹ Prev
          </button>
          <span className="list-pager-info">
            Page {page} of {totalPages}
          </span>
          <button disabled={!hasNextPage} onClick={() => setPage(page + 1)}>
            Next ›
          </button>
        </div>
      )}
    </div>
  )
}
