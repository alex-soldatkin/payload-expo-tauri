/**
 * useViewPresets(slug) — local-first CRUD over the server 'view-presets'
 * collection. It is a normal (non payload-*) collection, so LocalDBProvider
 * replicates it to RxDB like posts/products — reads are reactive and writes
 * sync in the background.
 *
 * ACCESS: server read access is a where-query (owner OR everyone OR
 * sharedWith), so the local store only ever receives presets this user may
 * see — we still filter defensively in case a stale doc lingers after an
 * access change. update/delete are OWNER ONLY; the UI must not offer
 * edit/delete on presets in `sharedPresets`.
 *
 * LIFT MAPPING (memory-bank convention, KanbanConfig → ViewPreset):
 *   server.statusField  = config.statusField
 *   server.columnOrder  = config.columnOrder?.filter(v => !hiddenColumns.includes(v))
 *   server.columnColors = config.columnColors
 *   server.cardFields   = config.cardFields
 * `hiddenColumns` has no server counterpart — it is DROPPED on lift, and
 * applying a preset resets it to [] (options missing from columnOrder
 * re-appear appended, per buildKanbanColumns).
 *
 * CALENDAR MAPPING (CalendarConfig → ViewPreset):
 *   server.calendarSources     = calendar.sources (RESOLVED — the screen lifts
 *                                the effective sources, never null)
 *   server.calendarDefaultMode = calendar.defaultMode
 *
 * GANTT MAPPING (GanttConfig → ViewPreset):
 *   server.ganttSources = gantt.sources (RESOLVED — the screen lifts the
 *                         effective sources, never null)
 *   server.ganttOptions = { pxPerDay?, rowSort? } — null fields OMITTED;
 *                         both null → ganttOptions is null
 */
import { useCallback, useMemo } from 'react'
import { useAuth, type CalendarMode, type CalendarSource } from '@payload-universal/admin-native'
import { useLocalCollection, useLocalDB, useLocalMutations } from '@payload-universal/local-db'

import {
  sanitizeCalendarMode,
  sanitizeCalendarSources,
  type CalendarConfig,
} from '@/src/hooks/useCalendarConfig'
import { sanitizeGanttOptions, type GanttConfig } from '@/src/hooks/useGanttConfig'
import {
  type KanbanConfig,
  type ListViewMode,
} from '@/src/hooks/useKanbanConfig'

const VIEW_PRESETS_SLUG = 'view-presets'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViewPresetAccessMode = 'onlyMe' | 'specificUsers' | 'everyone'

/** Sanitised view-preset doc (json conventions validated, ids depopulated). */
export type ViewPresetDoc = {
  id: string
  title: string
  relatedCollection: string
  viewType: ListViewMode
  statusField: string | null
  columnOrder: string[] | null
  columnColors: Record<string, string>
  cardFields: string[]
  /** Calendar date sources (server json convention) — null when unset/invalid. */
  calendarSources: CalendarSource[] | null
  calendarDefaultMode: CalendarMode
  /** Gantt date sources (same ScheduleSource convention) — null when unset/invalid. */
  ganttSources: CalendarSource[] | null
  /** Gantt display options (server json convention, always shaped client-side). */
  ganttOptions: { pxPerDay: number | null; rowSort: string | null }
  where: Record<string, unknown> | null
  /** Owner user id (depopulated). Always set server-side on create. */
  owner: string | null
  accessMode: ViewPresetAccessMode
  /** User ids (depopulated). Owner is always included for specificUsers. */
  sharedWith: string[]
  updatedAt?: string
  createdAt?: string
}

/** The current view state lifted into a new/updated preset. */
export type ViewPresetSnapshot = {
  viewType: ListViewMode
  config: KanbanConfig
  /** Calendar config with RESOLVED sources (effective defaults when never customised). */
  calendar: CalendarConfig
  /** Gantt config with RESOLVED sources (effective defaults when never customised). */
  gantt: GanttConfig
  /** Structured filters serialized via filtersToWhere (search excluded). */
  where: Record<string, unknown> | null
}

export type CreateViewPresetInput = ViewPresetSnapshot & {
  title: string
  accessMode?: ViewPresetAccessMode
  sharedWith?: string[]
}

export type ViewPresetPatch = {
  title?: string
  accessMode?: ViewPresetAccessMode
  sharedWith?: string[]
  /** Re-lift the current view state into the preset ('Update from current'). */
  snapshot?: ViewPresetSnapshot
}

export type UseViewPresetsResult = {
  /** False until the reactive local query settles. */
  loaded: boolean
  /** Presets I own (update/delete allowed). */
  myPresets: ViewPresetDoc[]
  /** Presets visible to me but owned by someone else (apply only). */
  sharedPresets: ViewPresetDoc[]
  /** Authenticated user id (null while logged out / loading). */
  userId: string | null
  createPreset: (input: CreateViewPresetInput) => Promise<string>
  updatePreset: (id: string, patch: ViewPresetPatch) => Promise<void>
  deletePreset: (id: string) => Promise<void>
}

// ---------------------------------------------------------------------------
// Sanitising — json fields are the loose Payload json union; validate the
// documented conventions before use.
// ---------------------------------------------------------------------------

const toStringArray = (v: unknown): string[] | null =>
  Array.isArray(v) && v.every((x) => typeof x === 'string') ? (v as string[]) : null

const toColorRecord = (v: unknown): Record<string, string> => {
  const out: Record<string, string> = {}
  if (v != null && typeof v === 'object' && !Array.isArray(v)) {
    for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
      if (typeof val === 'string') out[key] = val
    }
  }
  return out
}

const toWhereObject = (v: unknown): Record<string, unknown> | null =>
  v != null && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null

/** Depopulate a relationship value ({ id } | id → id string). */
const toRelId = (v: unknown): string | null => {
  if (v == null) return null
  if (typeof v === 'object') {
    const id = (v as Record<string, unknown>).id
    return id != null ? String(id) : null
  }
  return String(v)
}

const toRelIdArray = (v: unknown): string[] =>
  Array.isArray(v)
    ? v.map(toRelId).filter((id): id is string => id != null)
    : []

const sanitizePreset = (raw: Record<string, unknown>): ViewPresetDoc => ({
  id: String(raw.id ?? ''),
  title: typeof raw.title === 'string' ? raw.title : '',
  relatedCollection: typeof raw.relatedCollection === 'string' ? raw.relatedCollection : '',
  // Server default is 'kanban'; anything unrecognised falls back to it
  viewType:
    raw.viewType === 'table'
      ? 'table'
      : raw.viewType === 'calendar'
        ? 'calendar'
        : raw.viewType === 'gantt'
          ? 'gantt'
          : 'kanban',
  statusField: typeof raw.statusField === 'string' ? raw.statusField : null,
  columnOrder: toStringArray(raw.columnOrder),
  columnColors: toColorRecord(raw.columnColors),
  cardFields: toStringArray(raw.cardFields) ?? [],
  calendarSources: sanitizeCalendarSources(raw.calendarSources),
  calendarDefaultMode: sanitizeCalendarMode(raw.calendarDefaultMode),
  // Same ScheduleSource entry shape as calendarSources — same sanitizer
  ganttSources: sanitizeCalendarSources(raw.ganttSources),
  ganttOptions: sanitizeGanttOptions(raw.ganttOptions),
  where: toWhereObject(raw.where),
  owner: toRelId(raw.owner),
  accessMode:
    raw.accessMode === 'everyone' || raw.accessMode === 'specificUsers'
      ? raw.accessMode
      : 'onlyMe',
  sharedWith: toRelIdArray(raw.sharedWith),
  updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : undefined,
  createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : undefined,
})

/** Defensive mirror of the server's read access where-query. */
const canRead = (preset: ViewPresetDoc, userId: string | null): boolean => {
  if (preset.accessMode === 'everyone') return true
  if (userId == null) return false
  if (preset.owner != null && preset.owner === userId) return true
  return preset.accessMode === 'specificUsers' && preset.sharedWith.includes(userId)
}

// ---------------------------------------------------------------------------
// Lift / apply mapping
// ---------------------------------------------------------------------------

/** Kanban + calendar configs + view mode → the server json convention fields. */
const liftSnapshot = (snapshot: ViewPresetSnapshot): Record<string, unknown> => ({
  viewType: snapshot.viewType,
  statusField: snapshot.config.statusField,
  // hiddenColumns is mobile-only — hidden values are excluded from the
  // persisted order (and the sentinel '__no_status__' never appears in it)
  columnOrder: snapshot.config.columnOrder
    ? snapshot.config.columnOrder.filter((v) => !snapshot.config.hiddenColumns.includes(v))
    : null,
  columnColors: snapshot.config.columnColors,
  cardFields: snapshot.config.cardFields,
  calendarSources: snapshot.calendar.sources,
  calendarDefaultMode: snapshot.calendar.defaultMode,
  ganttSources: snapshot.gantt.sources,
  // null fields are omitted (server-absent means "client default");
  // both null collapses the whole json to null
  ganttOptions:
    snapshot.gantt.pxPerDay != null || snapshot.gantt.rowSort != null
      ? {
          ...(snapshot.gantt.pxPerDay != null ? { pxPerDay: snapshot.gantt.pxPerDay } : {}),
          ...(snapshot.gantt.rowSort != null ? { rowSort: snapshot.gantt.rowSort } : {}),
        }
      : null,
  where: snapshot.where,
})

/**
 * ViewPreset → KanbanConfig for applyPreset. hiddenColumns resets to [] —
 * the server convention has no visibility concept (dropped on lift).
 */
export const presetToKanbanConfig = (preset: ViewPresetDoc): KanbanConfig => ({
  statusField: preset.statusField,
  columnOrder: preset.columnOrder,
  hiddenColumns: [],
  columnColors: preset.columnColors,
  cardFields: preset.cardFields,
})

/**
 * ViewPreset → CalendarConfig for applyPreset. A preset without (valid)
 * calendarSources applies as `sources: null` — the screen falls back to
 * pickDefaultSources for that collection.
 */
export const presetToCalendarConfig = (preset: ViewPresetDoc): CalendarConfig => ({
  sources: preset.calendarSources,
  defaultMode: preset.calendarDefaultMode,
})

/**
 * ViewPreset → GanttConfig for applyPreset. A preset without (valid)
 * ganttSources applies as `sources: null` — the screen falls back to
 * pickDefaultSources; null pxPerDay/rowSort mean component default /
 * the screen's active sort.
 */
export const presetToGanttConfig = (preset: ViewPresetDoc): GanttConfig => ({
  sources: preset.ganttSources,
  pxPerDay: preset.ganttOptions.pxPerDay,
  rowSort: preset.ganttOptions.rowSort,
})

/** Owner must always be present in sharedWith when mode is specificUsers. */
const buildSharedWith = (
  accessMode: ViewPresetAccessMode,
  sharedWith: string[] | undefined,
  ownerId: string | null,
): string[] => {
  if (accessMode !== 'specificUsers') return []
  const ids = new Set(sharedWith ?? [])
  if (ownerId) ids.add(ownerId)
  return Array.from(ids)
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useViewPresets(slug: string): UseViewPresetsResult {
  const localDB = useLocalDB()
  const { user } = useAuth()
  const userId = user?.id != null ? String(user.id) : null

  // Memoised so useLocalCollection's effect doesn't re-subscribe every render.
  // Sort stays on the indexed default (-updatedAt) — RxDB sorts need indexed
  // fields; title ordering happens client-side below.
  const where = useMemo(() => ({ relatedCollection: { equals: slug } }), [slug])
  const result = useLocalCollection(localDB, VIEW_PRESETS_SLUG, {
    where,
    limit: 200,
  })
  const { create, update, remove } = useLocalMutations(localDB, VIEW_PRESETS_SLUG)

  const presets = useMemo(
    () =>
      (result.docs as Record<string, unknown>[])
        .map(sanitizePreset)
        .filter((p) => p.id && p.relatedCollection === slug && canRead(p, userId))
        .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' })),
    [result.docs, slug, userId],
  )

  const myPresets = useMemo(
    () => presets.filter((p) => p.owner != null && p.owner === userId),
    [presets, userId],
  )
  const sharedPresets = useMemo(
    () => presets.filter((p) => p.owner == null || p.owner !== userId),
    [presets, userId],
  )

  const createPreset = useCallback(
    async (input: CreateViewPresetInput): Promise<string> => {
      const accessMode = input.accessMode ?? 'onlyMe'
      return create({
        title: input.title.trim(),
        relatedCollection: slug,
        ...liftSnapshot(input),
        // The server beforeChange forces req.user.id anyway; setting it
        // locally keeps the optimistic doc owned (and visible) immediately.
        ...(userId ? { owner: userId } : {}),
        accessMode,
        sharedWith: buildSharedWith(accessMode, input.sharedWith, userId),
      })
    },
    [create, slug, userId],
  )

  const updatePreset = useCallback(
    async (id: string, patch: ViewPresetPatch): Promise<void> => {
      const data: Record<string, unknown> = {}
      if (patch.title != null) data.title = patch.title.trim()
      if (patch.accessMode != null) {
        data.accessMode = patch.accessMode
        data.sharedWith = buildSharedWith(patch.accessMode, patch.sharedWith, userId)
      } else if (patch.sharedWith != null) {
        data.sharedWith = buildSharedWith('specificUsers', patch.sharedWith, userId)
      }
      if (patch.snapshot) Object.assign(data, liftSnapshot(patch.snapshot))
      if (Object.keys(data).length === 0) return
      await update(id, data)
    },
    [update, userId],
  )

  const deletePreset = useCallback(async (id: string) => remove(id), [remove])

  return {
    loaded: !result.loading,
    myPresets,
    sharedPresets,
    userId,
    createPreset,
    updatePreset,
    deletePreset,
  }
}
