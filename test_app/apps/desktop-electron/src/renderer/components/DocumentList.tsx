// Desktop list-view engine: a sortable, searchable, column-configurable table
// backed by the local RxDB (issue #20). Orchestrates the toolbar + table and
// persists per-collection column/sort/pageSize prefs via the desktop bridge.
import { useEffect, useMemo, useState } from 'react'
import { useDocPeek } from './preview/DocPeek'
import { useDocMenu } from './preview/DocContextMenu'
import { useLocalCollection, useLocalDB, useLocalMutations } from '@payload-universal/local-db'
import type { AdminSchema } from '@payload-universal/admin-schema'
import { collectionLabel } from '../lib/collections'
import { getRootFields } from '../lib/schemaFields'
import { ListToolbar } from './list/ListToolbar'
import { ListTable } from './list/ListTable'
import { useListConfig, type ListViewMode } from './list/useListConfig'
import {
  displayableFields,
  defaultColumns,
  metaOrFieldColumn,
  ensureTitle,
  matchesQuery,
} from './list/columns'
import { filterableFields } from './list/filters/filterFields'
import { buildSelector, matchesGroups } from './list/filters/toSelector'
import { FilterControls } from './list/filters/FilterControls'
import { FilterChips } from './list/filters/FilterChips'
import type { FilterGroups } from './list/filters/types'
import { eligibleBoardFields } from './list/board/eligibility'
import { KanbanBoard } from './list/board/KanbanBoard'
import { eligibleDateFields } from './list/calendar/eligibility'
import { CalendarView } from './list/calendar/CalendarView'
import { SelectionBar } from './list/selection/SelectionBar'
import { labelForField } from '../form/labels'

type Props = {
  schema: AdminSchema
  slug: string
  onOpen: (id: string) => void
  /** Payload server base URL (used by list action handlers). */
  serverURL?: string
}

const DEFAULT_PAGE_SIZE = 50

export function DocumentList({ schema, slug, onOpen, serverURL = '' }: Props) {
  const localDB = useLocalDB()
  const { create, update: updateDoc, remove: removeDoc } = useLocalMutations(localDB, slug)
  const { config, ready, update } = useListConfig(slug)
  const { openPeek } = useDocPeek()
  const onPeek = (id: string) => openPeek(slug, id)
  const { openDocMenu } = useDocMenu()
  const onDocMenu = (id: string, x: number, y: number) => openDocMenu(slug, id, x, y)

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

  // ---- filters -----------------------------------------------------------
  const filterFields = useMemo(
    () => filterableFields(displayable, Boolean(meta?.drafts)),
    [displayable, meta?.drafts],
  )
  const groups: FilterGroups = config.activeFilters ?? []
  const presets = config.presets ?? []
  // Pushdown selector for RxDB (contains excluded — applied client-side below).
  const { selector, containsGroups, hasContains } = useMemo(() => buildSelector(groups), [groups])

  const { docs, loading, totalDocs, refetch, page, setPage, hasNextPage } = useLocalCollection(
    localDB,
    slug,
    { sort, limit: pageSize, where: selector },
  )

  const [search, setSearch] = useState('')
  const visible = useMemo(() => {
    let rows = docs as Record<string, unknown>[]
    // Client-side residue: apply `contains` groups (SQL can't express $regex),
    // and re-check the full group model so the visible page stays correct even
    // when the local-db hook can't push OR-groups down to SQL.
    if (groups.length > 0) {
      rows = rows.filter((d) => matchesGroups(d, groups))
    } else if (hasContains) {
      rows = rows.filter((d) => matchesGroups(d, containsGroups))
    }
    return rows.filter((d) => matchesQuery(d, search, meta?.useAsTitle))
  }, [docs, groups, hasContains, containsGroups, search, meta?.useAsTitle])

  const columnDefs = useMemo(
    () => columns.map((key) => metaOrFieldColumn(key, displayable)),
    [columns, displayable],
  )

  // ---- row selection + bulk actions --------------------------------------
  // Selection lives here (the list owns it); cleared whenever the collection or
  // page changes so stale ids never leak across views.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  useEffect(() => {
    setSelectedIds(new Set())
  }, [slug, page])
  const listActions = meta?.listActions ?? []
  const selectedDocs = useMemo(
    () => (visible as Record<string, unknown>[]).filter((d) => selectedIds.has(String(d.id ?? ''))),
    [visible, selectedIds],
  )
  const toggleOne = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  const toggleAll = (checked: boolean) =>
    setSelectedIds(
      checked
        ? new Set((visible as Record<string, unknown>[]).map((d) => String(d.id ?? '')))
        : new Set(),
    )
  const clearSelection = () => setSelectedIds(new Set())

  // ---- board (Kanban) + calendar -----------------------------------------
  // Top-level select/radio fields that can drive a board; empty → no Kanban.
  const rootFields = useMemo(() => getRootFields(schema, slug), [schema, slug])
  const boardFields = useMemo(() => eligibleBoardFields(rootFields), [rootFields])
  // Top-level date fields (any pickerAppearance) that can drive a calendar.
  const dateFields = useMemo(() => eligibleDateFields(rootFields), [rootFields])
  const canBoard = boardFields.length > 0
  const canCalendar = dateFields.length > 0
  // Fall back to 'table' if the stored mode is no longer available (e.g. the
  // eligible field was removed from the schema).
  const storedMode = config.viewMode ?? 'table'
  const viewMode: ListViewMode =
    (storedMode === 'board' && !canBoard) || (storedMode === 'calendar' && !canCalendar)
      ? 'table'
      : storedMode
  // Persisted board field, falling back to the first eligible one when the
  // stored name no longer exists (mirrors the mobile config fallback).
  const boardField =
    boardFields.find((f) => f.name === config.boardField) ?? boardFields[0]
  // Persisted calendar field, same first-eligible fallback.
  const calendarField =
    dateFields.find((f) => f.name === config.calendarField) ?? dateFields[0]

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
  const onReorderColumn = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= columns.length || to >= columns.length) return
    const next = [...columns]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
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

  // ---- filter handlers ---------------------------------------------------
  const setGroups = (next: FilterGroups) =>
    update({ activeFilters: next.filter((g) => g.length > 0) })
  const removeRule = (gi: number, ri: number) => {
    const next = groups.map((g) => g.slice())
    next[gi].splice(ri, 1)
    setGroups(next.filter((g) => g.length > 0))
  }
  const savePreset = (name: string) => {
    const rest = presets.filter((p) => p.name !== name)
    update({ presets: [...rest, { name, groups }] })
  }
  const deletePreset = (name: string) =>
    update({ presets: presets.filter((p) => p.name !== name) })

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
        {(canBoard || canCalendar) && (
          <div className="view-switch">
            <button
              type="button"
              className={`chip toggle${viewMode === 'table' ? ' on' : ''}`}
              onClick={() => update({ viewMode: 'table' })}
            >
              Table
            </button>
            {canBoard && (
              <button
                type="button"
                className={`chip toggle${viewMode === 'board' ? ' on' : ''}`}
                onClick={() => update({ viewMode: 'board' })}
              >
                Board
              </button>
            )}
            {canCalendar && (
              <button
                type="button"
                className={`chip toggle${viewMode === 'calendar' ? ' on' : ''}`}
                onClick={() => update({ viewMode: 'calendar' })}
              >
                Calendar
              </button>
            )}
          </div>
        )}
        {viewMode === 'board' && boardField && boardFields.length > 1 && (
          <select
            className="board-field-picker"
            value={boardField.name}
            onChange={(e) => update({ boardField: e.target.value })}
          >
            {boardFields.map((f) => (
              <option key={f.name} value={f.name}>
                {labelForField(f)}
              </option>
            ))}
          </select>
        )}
        {viewMode === 'calendar' && calendarField && dateFields.length > 1 && (
          <select
            className="board-field-picker"
            value={calendarField.name}
            onChange={(e) => update({ calendarField: e.target.value })}
          >
            {dateFields.map((f) => (
              <option key={f.name} value={f.name}>
                {labelForField(f)}
              </option>
            ))}
          </select>
        )}
      </div>

      <ListToolbar
        search={search}
        onSearch={setSearch}
        displayable={displayable}
        columns={columns}
        titleKey={titleKey}
        onToggleColumn={onToggleColumn}
        onMoveColumn={onMoveColumn}
        onReorderColumn={onReorderColumn}
        onResetColumns={() => update({ columns: defaults })}
        pageSize={pageSize}
        onPageSize={(n) => update({ pageSize: n })}
        onRefresh={refetch}
        onCreate={createNew}
        canCreate={Boolean(localDB)}
      />

      <div className="list-filter-bar">
        <FilterControls
          fields={filterFields}
          groups={groups}
          onChange={setGroups}
          presets={presets}
          onApplyPreset={setGroups}
          onSavePreset={savePreset}
          onDeletePreset={deletePreset}
        />
        <FilterChips
          fields={filterFields}
          groups={groups}
          onRemove={removeRule}
          onClear={() => setGroups([])}
        />
      </div>

      {viewMode === 'table' && selectedIds.size > 0 && (
        <SelectionBar
          slug={slug}
          serverURL={serverURL}
          selected={selectedDocs}
          actions={listActions}
          update={updateDoc}
          remove={removeDoc}
          onClear={clearSelection}
        />
      )}

      <div className="main-scroll">
        {!localDB || !ready || loading ? (
          <div className="empty">Loading…</div>
        ) : viewMode === 'board' && boardField ? (
          <KanbanBoard
            slug={slug}
            field={boardField}
            docs={visible as Record<string, unknown>[]}
            useAsTitle={meta?.useAsTitle}
            onOpen={onOpen}
            onPeek={onPeek}
            onDocMenu={onDocMenu}
          />
        ) : viewMode === 'calendar' && calendarField?.name ? (
          <CalendarView
            fieldName={calendarField.name}
            docs={visible as Record<string, unknown>[]}
            useAsTitle={meta?.useAsTitle}
            onOpen={onOpen}
            onPeek={onPeek}
            onDocMenu={onDocMenu}
          />
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
            onPeek={onPeek}
            onDocMenu={onDocMenu}
            selectedIds={selectedIds}
            onToggleOne={toggleOne}
            onToggleAll={toggleAll}
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
