/**
 * DocumentList – paginated list for a collection, driven by the Payload REST
 * API or a local-first RxDB data source (`localData` prop).
 * Replaces the web admin's data table with a mobile-optimised card list.
 *
 * Supports:
 *  - Native search bar (iOS headerSearchBarOptions, text passed via `searchText` prop)
 *  - Structured field filters via FilterBottomSheet — multiple AND-combined
 *    filters with editable chips (tap a chip to re-open the editor pre-filled)
 *  - Sorting — native menu picker on iOS (bottom-sheet fallback elsewhere)
 *    with asc/desc toggle, persisted per collection; controllable via
 *    `sort`/`onSortChange` so screens can host a toolbar menu instead
 *  - Pagination — honours the collection's `admin.pagination.defaultLimit`,
 *    per-page selector in the settings sheet, infinite scroll with
 *    "X–Y of Z" meta
 *  - Empty states — native ContentUnavailableView (iOS 17+) with three
 *    variants (no docs / no search results / filtered out), JS fallback
 *  - Liquid-glass row cards on iOS 26+ with themed fallbacks; dark mode
 *  - Pull-to-refresh and infinite scroll
 *  - Tablet table mode (`tableMode`) — web-admin-parity rows: frozen title
 *    column (+ status pill with drafts), horizontally scrollable type-aware
 *    fixed-width field columns and a sticky tap-to-sort header band that
 *    drives the shared horizontal scroll (see DocumentListTable.tsx for the
 *    structure decision)
 */
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
// Swipe-to-delete uses the package's PanResponder-based SwipeToDeleteRow —
// react-native-gesture-handler Swipeable/ReanimatedSwipeable crash on iOS 26
// in this row tree (see SwipeToDeleteRow.tsx header for the tier rationale).
import { closeOpenSwipeRow, SwipeToDeleteRow } from './SwipeToDeleteRow'
// Tablet table mode — frozen title column + shared-translate column track
import {
  buildTableColumns,
  DocumentListTableHeader,
  DocumentListTableRow,
  summariseArrayValue,
  titleishFromObject,
} from './DocumentListTable'

import type { ClientField, PaginatedDocs, SerializedSchemaMap } from './types'
import { defaultTheme as t } from './theme'
import { extractRootFields, getByPath, getDocumentTitle, getFieldLabel } from './utils/schemaHelpers'
import { usePayloadNative } from './PayloadNativeProvider'
import { payloadApi } from './utils/api'
import { applyWhereToDocs, useDocumentListFilters } from './hooks/useDocumentListFilters'
import type { ActiveFilter, FilterCondition } from './hooks/useDocumentListFilters'
import { useListColors } from './hooks/useListColors'
import type { ListColorPalette } from './hooks/useListColors'
import { FilterChips } from './FilterChips'
import { FilterBottomSheet } from './FilterBottomSheet'
import { BottomSheet } from './BottomSheet'
import { NativeHost } from './fields/NativeHost'
import { nativeComponents } from './fields/shared'

// Lucide icons for the summary fields picker, sort control and empty states
let GripVerticalIcon: React.ComponentType<{ size: number; color: string }> | null = null
let CircleCheckIcon: React.ComponentType<{ size: number; color: string }> | null = null
let CircleIcon: React.ComponentType<{ size: number; color: string }> | null = null
let CheckIcon: React.ComponentType<{ size: number; color: string }> | null = null
let XIcon: React.ComponentType<{ size: number; color: string }> | null = null
let ArrowUpDownIcon: React.ComponentType<{ size: number; color: string }> | null = null
let InboxIcon: React.ComponentType<{ size: number; color: string }> | null = null
let SearchXIcon: React.ComponentType<{ size: number; color: string }> | null = null
let FilterXIcon: React.ComponentType<{ size: number; color: string }> | null = null
let ToggleLeftIcon: React.ComponentType<{ size: number; color: string }> | null = null
let ToggleRightIcon: React.ComponentType<{ size: number; color: string }> | null = null
try {
  const lucide = require('lucide-react-native')
  GripVerticalIcon = lucide.GripVertical
  CircleCheckIcon = lucide.CircleCheck
  CircleIcon = lucide.Circle
  CheckIcon = lucide.Check
  XIcon = lucide.X
  ArrowUpDownIcon = lucide.ArrowUpDown
  InboxIcon = lucide.Inbox
  SearchXIcon = lucide.SearchX
  FilterXIcon = lucide.FilterX
  ToggleLeftIcon = lucide.ToggleLeft
  ToggleRightIcon = lucide.ToggleRight
} catch {
  /* lucide-react-native not available */
}

// Optional: drag-to-reorder in the summary fields picker
let Sortable: any = null
let SortableItem: any = null
try {
  const dnd = require('react-native-reanimated-dnd')
  Sortable = dnd.Sortable
  SortableItem = dnd.SortableItem
} catch {
  /* react-native-reanimated-dnd not installed — checkbox-only fallback */
}

// Optional: GlassView for liquid glass row cards on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* expo-glass-effect not installed */
}

// Optional: AsyncStorage for per-collection list preferences (sort, page size).
// Same persistence pattern as the screen-level summary fields key.
type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>
  setItem: (key: string, value: string) => Promise<void>
}
let AsyncStorage: AsyncStorageLike | null = null
try {
  AsyncStorage = require('@react-native-async-storage/async-storage').default
} catch {
  /* @react-native-async-storage/async-storage not installed — prefs not persisted */
}

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList)

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

export type DocumentListSort = {
  field: string
  direction: 'asc' | 'desc'
}

const DEFAULT_SORT: DocumentListSort = { field: 'updatedAt', direction: 'desc' }

const SORT_KEY_PREFIX = 'list_sort:'
const PAGE_SIZE_KEY_PREFIX = 'list_page_size:'
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

/** Field types that can be sorted on (mirrors the web admin's sortable columns). */
const SORTABLE_FIELD_TYPES = new Set([
  'text', 'email', 'textarea', 'code', 'number', 'date', 'select', 'radio', 'checkbox',
])

/**
 * Extract the sortable fields from a collection's root fields.
 * Always includes the built-in createdAt/updatedAt timestamps.
 * Exported so screens can build their own (e.g. native toolbar) sort menus.
 */
export const getSortableFields = (fields: ClientField[]): ClientField[] => {
  const sortable = fields.filter(
    (f) => f.name && !f.admin?.hidden && SORTABLE_FIELD_TYPES.has(f.type),
  )
  const names = new Set(sortable.map((f) => f.name))
  if (!names.has('createdAt')) {
    sortable.push({ name: 'createdAt', type: 'date', label: 'Created At' } as ClientField)
  }
  if (!names.has('updatedAt')) {
    sortable.push({ name: 'updatedAt', type: 'date', label: 'Updated At' } as ClientField)
  }
  return sortable
}

/** Convert a sort spec to the Payload REST `?sort=` string ('-field' for desc). */
export const sortToQueryString = (sort: DocumentListSort): string =>
  sort.direction === 'desc' ? `-${sort.field}` : sort.field

/** Coerce a doc value to something comparable (numbers / timestamps / strings). */
const comparableValue = (v: unknown): number | string | null => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (v instanceof Date) return v.getTime()
  if (Array.isArray(v)) return comparableValue(v[0])
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    return comparableValue(obj.title ?? obj.name ?? obj.id ?? null)
  }
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const ts = Date.parse(s)
    if (!Number.isNaN(ts)) return ts
  }
  return s.toLowerCase()
}

const compareFieldValues = (a: unknown, b: unknown): number => {
  const av = comparableValue(a)
  const bv = comparableValue(b)
  if (av == null && bv == null) return 0
  if (av == null) return -1
  if (bv == null) return 1
  if (typeof av === 'number' && typeof bv === 'number') return av - bv
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
}

/** Sort a local doc array with the same semantics as the REST `?sort=` param. */
const sortDocs = (
  docs: Record<string, unknown>[],
  sort: DocumentListSort,
): Record<string, unknown>[] => {
  const dir = sort.direction === 'desc' ? -1 : 1
  return [...docs].sort(
    (a, b) => dir * compareFieldValues(getByPath(a, sort.field), getByPath(b, sort.field)),
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  /** Collection slug */
  collection: string
  /** Called when a row is tapped */
  onPress: (doc: Record<string, unknown>) => void
  /** Called when "Create" is tapped */
  onCreate?: () => void
  /**
   * Called after the user confirms a swipe-to-delete. When provided AND no
   * `renderRow` is given, rows wrap in SwipeToDeleteRow internally. When
   * `renderRow` IS provided, the parent owns the swipe wrapping (it may
   * embed rows in native preview triggers whose gesture recognizers must
   * stay INSIDE the swipe content — see SwipeToDeleteRow.tsx).
   */
  onDelete?: (doc: Record<string, unknown>) => void
  /** Fallback number of docs per page (overridden by the collection's
   * `admin.pagination.defaultLimit` and the user's per-page selection). */
  limit?: number
  /** Field name used as the display title for each row */
  titleField?: string
  /** Optional subtitle renderer */
  renderSubtitle?: (doc: Record<string, unknown>) => string | undefined
  /** Extra top padding (e.g. for transparent headers) */
  contentInsetTop?: number
  /** Schema map for this collection (enables field-based filters) */
  schemaMap?: SerializedSchemaMap<unknown>
  /** Externally controlled search text (from native header search bar) */
  searchText?: string
  /** Fields to search across for text search */
  searchFields?: string[]
  /**
   * Build an href for a document row (informational — used by renderRow if provided).
   */
  docHref?: (doc: Record<string, unknown>) => string
  /**
   * Custom row renderer — allows the parent to wrap rows with Link.Preview etc.
   * Receives the default row content, the doc, the onPress handler and the
   * row index (useful for selection UIs in the screen layer).
   */
  renderRow?: (props: {
    item: Record<string, unknown>
    rowContent: React.ReactElement
    onPress: () => void
    index: number
  }) => React.ReactElement
  /**
   * Optional external data source (e.g. from local-db).
   * When provided, the component skips its own REST API calls and uses this
   * data directly. Search/filters/sort/pagination are applied client-side
   * over the provided docs.
   */
  localData?: {
    docs: Record<string, unknown>[]
    totalDocs: number
    loading: boolean
    refetch: () => void
  }
  /**
   * Field names to display as summary on each card (below the title).
   * Controlled externally — use with onSummaryFieldsChange for persistence.
   */
  summaryFields?: string[]
  /** Called when the user changes the summary field selection via the gear icon. */
  onSummaryFieldsChange?: (fields: string[]) => void
  /** Externally controlled: whether the summary picker bottom sheet is open. */
  summaryPickerOpen?: boolean
  /** Called when the summary picker should close. */
  onSummaryPickerClose?: () => void
  /** Externally controlled: whether the filter bottom sheet is open. */
  filterSheetOpen?: boolean
  /** Called when the filter sheet should close. */
  onFilterSheetClose?: () => void
  /**
   * Externally controlled sort (e.g. from a native toolbar menu in the
   * screen). When omitted, DocumentList manages sort internally and persists
   * it per collection in AsyncStorage (`list_sort:{collection}`).
   */
  sort?: DocumentListSort | null
  /** Called whenever the user changes sort via the in-list control. */
  onSortChange?: (sort: DocumentListSort) => void
  /** Scroll event handler forwarded to the inner FlatList (e.g. for scroll-driven header blur). */
  onScroll?: (event: any) => void
  /** Scroll event throttle in ms (default 16). Only used when onScroll is provided. */
  scrollEventThrottle?: number
  /**
   * Collection slug whose Payload-native query presets
   * ('payload-query-presets', REST-only) appear in the filter sheet's
   * Presets section. Also enables the sheet's OR-group overview step and
   * passes the current summary fields as the preset's saved columns.
   */
  queryPresetsCollection?: string
  /**
   * Externally applied filter groups (view/query presets from the screen).
   * Bump `epoch` to replace the active filters with `groups`; epoch 0 is
   * ignored (initial mount). See `whereToFilterGroups`.
   */
  appliedFilters?: { epoch: number; groups: FilterCondition[][] }
  /**
   * Notifies the screen whenever the active structured filters change —
   * lets a Presets surface lift the table-mode filters into a saved preset.
   */
  onFiltersChange?: (filters: ActiveFilter[]) => void
  /**
   * Tablet table mode — replaces the card rows with web-admin-parity table
   * rows: a frozen ~160pt title column (useAsTitle value + status pill when
   * the collection has drafts) plus horizontally scrollable, type-aware
   * fixed-width columns for every summary field, under a sticky tap-to-sort
   * header band. Column order = the summary-fields picker order. The header
   * band is the horizontal pan surface (rows keep their gestures: tap,
   * long-press peek, swipe-to-delete, selection — see DocumentListTable.tsx).
   * Default false = phone card mode (unchanged).
   */
  tableMode?: boolean
  /**
   * Table mode: pin (freeze) the title column (default true). False → the
   * title cell becomes the first cell INSIDE the horizontally scrolling
   * track — the whole row pans, nothing is frozen.
   */
  pinFirstColumn?: boolean
  /**
   * Table mode: pin the tap-to-sort header band at the top (default true).
   * False → the band (still the horizontal scroll driver) scrolls away
   * vertically with the content.
   */
  stickyHeader?: boolean
  /**
   * Called when the user flips the pin toggles in the list settings sheet
   * (table mode only). The screen persists the pair and feeds it back via
   * `stickyHeader` / `pinFirstColumn`. Omitting it hides the toggles.
   */
  onTablePinsChange?: (pins: { header: boolean; firstColumn: boolean }) => void
}


export const DocumentList: React.FC<Props> = ({
  collection,
  onPress,
  onCreate,
  onDelete,
  limit = 20,
  titleField,
  renderSubtitle,
  contentInsetTop = 0,
  schemaMap,
  searchText: externalSearchText,
  searchFields,
  docHref,
  renderRow,
  localData,
  summaryFields = [],
  onSummaryFieldsChange,
  summaryPickerOpen: externalPickerOpen,
  onSummaryPickerClose,
  filterSheetOpen: externalFilterOpen,
  onFilterSheetClose,
  sort: sortProp,
  onSortChange,
  onScroll,
  scrollEventThrottle = 16,
  queryPresetsCollection,
  appliedFilters,
  onFiltersChange,
  tableMode = false,
  pinFirstColumn = true,
  stickyHeader = true,
  onTablePinsChange,
}) => {
  const { baseURL, auth, schema } = usePayloadNative()
  const { dark, colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  // baseURL is also used below for resolving upload image thumbnail URLs
  const [data, setData] = useState<PaginatedDocs | null>(null)
  const [loading, setLoading] = useState(!localData)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)

  // Filter sheet visibility — internal opens (chip tap / "+ Filter") are
  // OR-ed with the externally controlled prop so chips can re-open the
  // editor even when the screen owns the toolbar button.
  const [internalFilterOpen, setInternalFilterOpen] = useState(false)
  const [editingFilter, setEditingFilter] = useState<ActiveFilter | null>(null)
  const filterSheetVisible = Boolean(externalFilterOpen) || internalFilterOpen
  const closeFilterSheet = useCallback(() => {
    setInternalFilterOpen(false)
    setEditingFilter(null)
    onFilterSheetClose?.()
  }, [onFilterSheetClose])
  const openFilterEditor = useCallback((filter: ActiveFilter | null) => {
    setEditingFilter(filter)
    setInternalFilterOpen(true)
  }, [])

  const [internalPickerOpen, setInternalPickerOpen] = useState(false)
  const summaryPickerOpen = externalPickerOpen ?? internalPickerOpen
  const closeSummaryPicker = onSummaryPickerClose ?? (() => setInternalPickerOpen(false))

  const {
    searchText,
    setSearchText,
    filters,
    addFilter,
    updateFilter,
    removeFilter,
    setFilterGroups,
    clearAllFilters,
    whereQuery,
    hasActiveFilters,
  } = useDocumentListFilters({ searchFields })

  // Sync external search text from native header search bar
  useEffect(() => {
    if (externalSearchText != null) setSearchText(externalSearchText)
  }, [externalSearchText, setSearchText])

  // ── Preset application / lifting ──
  // Replace the active filters whenever the screen bumps appliedFilters.epoch
  // (epoch 0 = never applied — skipped so mounts don't clobber state).
  const appliedEpochRef = useRef(0)
  useEffect(() => {
    if (!appliedFilters || appliedFilters.epoch === appliedEpochRef.current) return
    appliedEpochRef.current = appliedFilters.epoch
    setFilterGroups(appliedFilters.groups)
  }, [appliedFilters, setFilterGroups])

  // Report filter changes upward so the screen can save them into a preset
  useEffect(() => {
    onFiltersChange?.(filters)
  }, [filters, onFiltersChange])

  // Schema-derived filterable/sortable fields
  const filterableFields: ClientField[] = useMemo(
    () => (schemaMap ? extractRootFields(schemaMap, collection) : []),
    [schemaMap, collection],
  )
  const sortableFields = useMemo(() => getSortableFields(filterableFields), [filterableFields])

  /** Resolve field labels and types from the schema. */
  const { fieldLabelMap, fieldTypeMap } = useMemo(() => {
    const labels = new Map<string, string>()
    const types = new Map<string, string>()
    for (const f of filterableFields) {
      if (f.name) {
        labels.set(f.name, getFieldLabel(f))
        types.set(f.name, f.type)
      }
    }
    return { fieldLabelMap: labels, fieldTypeMap: types }
  }, [filterableFields])

  // ── Tablet table mode — column model + shared horizontal scroll ──────
  // The title field / drafts flag come from props with a menu-model fallback,
  // so screens only need to pass `tableMode` to opt in.
  const menuCollection = useMemo(
    () => schema?.menuModel?.collections.find((c) => c.slug === collection),
    [schema, collection],
  )
  const tableTitleField = titleField ?? menuCollection?.useAsTitle
  const tableHasDrafts = Boolean(menuCollection?.drafts)

  const sortableFieldNames = useMemo(
    () => new Set(sortableFields.map((f) => f.name).filter((n): n is string => Boolean(n))),
    [sortableFields],
  )

  const tableColumns = useMemo(
    () =>
      tableMode
        ? buildTableColumns({
            summaryFields,
            titleField: tableTitleField,
            hasDrafts: tableHasDrafts,
            fieldLabelMap,
            fieldTypeMap,
            sortableFieldNames,
          })
        : [],
    [tableMode, summaryFields, tableTitleField, tableHasDrafts, fieldLabelMap, fieldTypeMap, sortableFieldNames],
  )
  const tableTrackWidth = useMemo(
    () => tableColumns.reduce((sum, c) => sum + c.width, 0),
    [tableColumns],
  )

  // ONE shared horizontal scroll position: the sticky header band's
  // ScrollView writes scrollX (native-driver Animated.event); every row's
  // column track consumes its negation as translateX. The header component
  // resets the offset whenever the column set changes.
  const tableScrollX = useRef(new Animated.Value(0)).current
  const tableTranslateX = useMemo(
    () => Animated.multiply<number>(tableScrollX, -1),
    [tableScrollX],
  )

  // ── Pagination — schema defaultLimit + persisted per-page selection ──
  const paginationCfg = useMemo(() => {
    const clientCollections = (schema?.clientConfig as unknown as {
      collections?: Array<{
        slug: string
        admin?: { pagination?: { defaultLimit?: number; limits?: number[] } }
      }>
    } | undefined)?.collections
    return clientCollections?.find((c) => c.slug === collection)?.admin?.pagination
  }, [schema, collection])

  const [storedPageSize, setStoredPageSize] = useState<number | null>(null)
  useEffect(() => {
    if (!AsyncStorage) return
    let cancelled = false
    AsyncStorage.getItem(PAGE_SIZE_KEY_PREFIX + collection)
      .then((val) => {
        if (cancelled || !val) return
        const n = Number(val)
        if (Number.isFinite(n) && n > 0) setStoredPageSize(n)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [collection])

  const pageSize = storedPageSize ?? paginationCfg?.defaultLimit ?? limit
  const pageSizeOptions = useMemo(() => {
    const base = paginationCfg?.limits?.length ? paginationCfg.limits : DEFAULT_PAGE_SIZE_OPTIONS
    return base.includes(pageSize) ? base : [...base, pageSize].sort((a, b) => a - b)
  }, [paginationCfg, pageSize])

  const handlePageSizeChange = useCallback(
    (n: number) => {
      setStoredPageSize(n)
      AsyncStorage?.setItem(PAGE_SIZE_KEY_PREFIX + collection, String(n)).catch(() => {})
    },
    [collection],
  )

  // ── Sort — controlled via props, or internal + persisted per collection ──
  const sortControlled = sortProp !== undefined
  const [internalSort, setInternalSort] = useState<DocumentListSort | null>(null)

  useEffect(() => {
    if (sortControlled || !AsyncStorage) return
    let cancelled = false
    AsyncStorage.getItem(SORT_KEY_PREFIX + collection)
      .then((val) => {
        if (cancelled || !val) return
        try {
          const parsed = JSON.parse(val) as DocumentListSort
          if (
            parsed &&
            typeof parsed.field === 'string' &&
            (parsed.direction === 'asc' || parsed.direction === 'desc')
          ) {
            setInternalSort(parsed)
          }
        } catch {
          /* corrupt entry — ignore */
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [collection, sortControlled])

  const effectiveSort = useMemo<DocumentListSort>(() => {
    const s = sortControlled ? sortProp : internalSort
    if (!s) return DEFAULT_SORT
    // Persisted/external sort field may no longer exist — fall back safely
    if (sortableFields.length > 0 && !sortableFields.some((f) => f.name === s.field)) {
      return DEFAULT_SORT
    }
    return s
  }, [sortControlled, sortProp, internalSort, sortableFields])

  const handleSortChange = useCallback(
    (s: DocumentListSort) => {
      onSortChange?.(s)
      if (!sortControlled) {
        setInternalSort(s)
        AsyncStorage?.setItem(SORT_KEY_PREFIX + collection, JSON.stringify(s)).catch(() => {})
      }
    },
    [onSortChange, sortControlled, collection],
  )

  // Table-mode header tap-to-sort: toggle direction on the active column,
  // otherwise select it with a sensible default (desc for dates, asc else) —
  // mirrors the web admin column header behaviour.
  const handleHeaderSortPress = useCallback(
    (field: string, type: string) => {
      const next: DocumentListSort =
        effectiveSort.field === field
          ? { field, direction: effectiveSort.direction === 'asc' ? 'desc' : 'asc' }
          : { field, direction: type === 'date' ? 'desc' : 'asc' }
      handleSortChange(next)
    },
    [effectiveSort, handleSortChange],
  )

  const sortString = sortToQueryString(effectiveSort)

  // ── Local-first pipeline: filter + sort + paginate the provided docs ──
  const whereForDocs = whereQuery as Record<string, unknown> | undefined

  const sortedLocalDocs = useMemo(() => {
    if (!localData) return null
    const filtered = applyWhereToDocs(localData.docs, whereForDocs)
    return sortDocs(filtered, effectiveSort)
  }, [localData, whereForDocs, effectiveSort])

  const [visibleCount, setVisibleCount] = useState(pageSize)
  useEffect(() => {
    setVisibleCount(pageSize)
  }, [pageSize, collection, whereForDocs, sortString])

  const effectiveDocs = sortedLocalDocs
    ? sortedLocalDocs.slice(0, visibleCount)
    : data?.docs ?? []
  const effectiveTotalDocs = sortedLocalDocs ? sortedLocalDocs.length : data?.totalDocs ?? 0
  const effectiveLoading = localData ? localData.loading : loading

  const tokenRef = useRef(auth.token)
  tokenRef.current = auth.token

  // Stable request counter to discard stale responses
  const requestIdRef = useRef(0)

  const load = useCallback(
    async (p: number, append = false, where?: Record<string, unknown>) => {
      const token = tokenRef.current
      if (!token) {
        setError('Not authenticated')
        setLoading(false)
        return
      }
      const reqId = ++requestIdRef.current
      try {
        setError(null)
        const result = await payloadApi.find({ baseURL, token }, collection, {
          page: p,
          limit: pageSize,
          depth: 0,
          sort: sortString,
          where,
        })
        // Discard if a newer request was started
        if (reqId !== requestIdRef.current) return
        setData((prev) =>
          append && prev
            ? { ...result, docs: [...prev.docs, ...result.docs] }
            : result,
        )
      } catch (err) {
        if (reqId !== requestIdRef.current) return
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        if (reqId === requestIdRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [baseURL, collection, pageSize, sortString],
  )

  // Initial load + re-load when filters/search/sort/page-size change
  // (skip if using local data)
  useEffect(() => {
    if (localData) return
    if (!auth.token) return
    setLoading(true)
    setPage(1)
    load(1, false, whereQuery as Record<string, unknown> | undefined)
  }, [localData, auth.token, load, whereQuery])

  const handleRefresh = () => {
    if (localData) {
      localData.refetch()
      return
    }
    setRefreshing(true)
    setPage(1)
    load(1, false, whereQuery as Record<string, unknown> | undefined)
  }

  const handleEndReached = () => {
    if (localData) {
      // Client-side "load more" over the locally filtered/sorted docs
      if (sortedLocalDocs && visibleCount < sortedLocalDocs.length) {
        setVisibleCount((c) => Math.min(c + pageSize, sortedLocalDocs.length))
      }
      return
    }
    if (data?.hasNextPage && !loading) {
      const next = page + 1
      setPage(next)
      load(next, true, whereQuery as Record<string, unknown> | undefined)
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return iso
    }
  }

  /** Format a field value for display on the card. */
  const formatFieldValue = (val: unknown): string => {
    if (val === null || val === undefined) return '—'
    if (typeof val === 'boolean') return val ? 'Yes' : 'No'
    // Arrays (array/blocks fields, hasMany values) — compact summary,
    // never a raw JSON dump
    if (Array.isArray(val)) return summariseArrayValue(val)
    if (typeof val === 'object') {
      // Relationship / upload (populated object) — title-ish display value;
      // unrecognisable objects (e.g. rich-text trees) show an em dash
      // instead of a JSON dump
      return titleishFromObject(val as Record<string, unknown>) ?? '—'
    }
    const s = String(val)
    // Date-like strings — format nicely
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return formatDate(s)
    return s
  }

  const renderItem = ({ item, index }: { item: unknown; index: number }) => {
    const doc = item as Record<string, unknown>

    // ── Tablet table mode — frozen title + shared-translate column track.
    // The row stays ONE viewport-width unit so screen-level wrapping
    // (swipe-to-delete, long-press peek, selection checkbox) keeps working
    // verbatim around `rowContent`.
    if (tableMode) {
      const tableRow = (
        <DocumentListTableRow
          doc={doc}
          title={getDocumentTitle(doc, tableTitleField)}
          columns={tableColumns}
          trackWidth={tableTrackWidth}
          showStatus={tableHasDrafts}
          translateX={tableTranslateX}
          formatValue={formatFieldValue}
          colors={colors}
          pinFirstColumn={pinFirstColumn}
        />
      )
      if (renderRow) {
        return renderRow({ item: doc, rowContent: tableRow, onPress: () => onPress(doc), index })
      }
      // Default path: full-bleed swipe action (no card insets in table mode)
      const wrappedRow =
        onDelete != null ? (
          <SwipeToDeleteRow
            onDelete={() => onDelete(doc)}
            confirmTitle="Delete"
            confirmMessage="Are you sure?"
          >
            {tableRow}
          </SwipeToDeleteRow>
        ) : (
          tableRow
        )
      return (
        <Pressable
          onPress={() => {
            if (closeOpenSwipeRow()) return
            onPress(doc)
          }}
          style={({ pressed }) => (pressed ? styles.rowPressed : undefined)}
        >
          {wrappedRow}
        </Pressable>
      )
    }

    const title = getDocumentTitle(doc, titleField)
    const date = doc.updatedAt ? formatDate(doc.updatedAt as string) : undefined

    // ── Detect image thumbnail from upload summary fields ──────────
    let thumbnailUrl: string | null = null
    let thumbnailField: string | null = null
    for (const fieldName of summaryFields) {
      if (fieldTypeMap.get(fieldName) === 'upload') {
        const val = doc[fieldName]
        if (val && typeof val === 'object') {
          const obj = val as Record<string, unknown>
          if (typeof obj.url === 'string') {
            const raw = obj.url
            thumbnailUrl = raw.startsWith('http') ? raw : `${baseURL}${raw}`
            thumbnailField = fieldName
            break
          }
        }
      }
    }

    // ── Build summary lines (exclude title field and image field) ──
    const summaryLines = summaryFields
      .filter((f) => f !== titleField && f !== thumbnailField)
      .map((fieldName) => ({
        key: fieldName,
        label: fieldLabelMap.get(fieldName) ?? fieldName,
        value: formatFieldValue(doc[fieldName]),
      }))
      .filter((line) => line.value !== '—')

    const rowInner = (
      <>
        {thumbnailUrl && (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
        )}
        <View style={styles.rowBody}>
          {/* Title + date on one line */}
          <View style={styles.rowHeader}>
            <Text style={styles.rowTitle} numberOfLines={1}>{title}</Text>
            {date && <Text style={styles.rowDate}>{date}</Text>}
          </View>

          {/* Two-column summary grid */}
          {summaryLines.length > 0 && (
            <View style={styles.summaryGrid}>
              {summaryLines.map((line) => (
                <View key={line.key} style={styles.summaryCell}>
                  <Text style={styles.summaryLabel} numberOfLines={1}>{line.label}</Text>
                  <Text style={styles.summaryValue} numberOfLines={1}>{line.value}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
        <Text style={styles.rowChevron}>›</Text>
      </>
    )

    // Liquid glass card (iOS 26+) with a themed card fallback — consistent
    // with the dashboard's collection cards.
    const card = liquidGlassAvailable && GlassView ? (
      <GlassView style={styles.card} isInteractive glassEffectStyle="regular">
        {rowInner}
      </GlassView>
    ) : (
      <View style={[styles.card, styles.cardFallback]}>{rowInner}</View>
    )

    // Default path only: swipe-to-delete wraps the card when onDelete is
    // provided (the confirm dialog lives inside SwipeToDeleteRow). With a
    // renderRow the parent wraps instead — never double-wrap.
    const rowContent = (
      <View style={styles.cardWrap}>
        {!renderRow && onDelete ? (
          <SwipeToDeleteRow
            onDelete={() => onDelete(doc)}
            confirmTitle="Delete"
            confirmMessage="Are you sure?"
            actionStyle={styles.swipeAction}
          >
            {card}
          </SwipeToDeleteRow>
        ) : (
          card
        )}
      </View>
    )

    if (renderRow) {
      return renderRow({ item: doc, rowContent, onPress: () => onPress(doc), index })
    }
    return (
      <Pressable
        onPress={() => {
          // A tap while a swipe row is open just closes it (iOS Mail parity)
          if (closeOpenSwipeRow()) return
          onPress(doc)
        }}
        style={({ pressed }) => (pressed ? styles.rowPressed : undefined)}
      >
        {rowContent}
      </Pressable>
    )
  }

  // "X–Y of Z" pagination meta
  const shownCount = Math.min(effectiveDocs.length, effectiveTotalDocs)
  const rangeLabel =
    effectiveTotalDocs > 0 ? `1–${shownCount} of ${effectiveTotalDocs}` : null

  // --- Header rendered above the list (element, not component — avoids
  // remounting the native sort picker on every render) ---
  // Table mode: the WHOLE header sticks (stickyHeaderIndices=[0]) — the
  // column band hosts the horizontal scroll driver and must stay reachable;
  // active filter chips pin with it (web admin parity: the filter bar stays
  // above the table). The in-list SortControl row is dropped — column
  // headers are tap-to-sort, and the range meta already lives in the footer.
  const listHeader = tableMode ? (
    <View>
      {hasActiveFilters && (
        <View style={styles.tableChipsWrap}>
          <FilterChips
            filters={filters}
            searchText={searchText}
            onRemove={removeFilter}
            onClearAll={clearAllFilters}
            onAddFilter={() => openFilterEditor(null)}
            onEdit={(f) => openFilterEditor(f)}
          />
        </View>
      )}
      <DocumentListTableHeader
        columns={tableColumns}
        titleLabel={
          tableTitleField ? fieldLabelMap.get(tableTitleField) ?? tableTitleField : 'ID'
        }
        titleSortField={
          tableTitleField && sortableFieldNames.has(tableTitleField) ? tableTitleField : undefined
        }
        titleSortType={tableTitleField ? fieldTypeMap.get(tableTitleField) : undefined}
        sort={effectiveSort}
        onSortPress={handleHeaderSortPress}
        scrollX={tableScrollX}
        colors={colors}
        pinFirstColumn={pinFirstColumn}
      />
    </View>
  ) : (
    <View>
      {/* Sort control + pagination meta */}
      <View style={styles.controlsRow}>
        <SortControl
          sort={effectiveSort}
          sortableFields={sortableFields}
          onChange={handleSortChange}
          colors={colors}
          styles={styles}
        />
        <View style={styles.controlsSpacer} />
        {rangeLabel != null && <Text style={styles.rangeMeta}>{rangeLabel}</Text>}
      </View>

      {/* Active filter chips (only shown when filters are applied) */}
      {hasActiveFilters && (
        <View style={styles.filterRow}>
          <FilterChips
            filters={filters}
            searchText={searchText}
            onRemove={removeFilter}
            onClearAll={clearAllFilters}
            onAddFilter={() => openFilterEditor(null)}
            onEdit={(f) => openFilterEditor(f)}
          />
        </View>
      )}
    </View>
  )

  const extraData = useMemo(
    () => ({ summaryFields, dark, tableMode, pinFirstColumn }),
    [summaryFields, dark, tableMode, pinFirstColumn],
  )

  if (effectiveLoading && effectiveDocs.length === 0) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={() => { setLoading(true); load(1, false, whereQuery as Record<string, unknown> | undefined) }}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    )
  }

  const emptyVariant: EmptyVariant =
    searchText.trim().length > 0 ? 'search' : filters.length > 0 ? 'filtered' : 'none'

  return (
    <View style={styles.container}>
      <AnimatedFlatList
        data={effectiveDocs}
        keyExtractor={(item) => String((item as Record<string, unknown>).id)}
        renderItem={renderItem}
        extraData={extraData}
        ListHeaderComponent={listHeader}
        // Table mode pins the column header band (and any filter chips) at
        // the adjusted top — index 0 is the ListHeaderComponent, the only
        // sticky index that survives virtualization. stickyHeader=false
        // drops the pin so the band scrolls away with the content.
        stickyHeaderIndices={tableMode && stickyHeader ? [0] : undefined}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        contentInsetAdjustmentBehavior="automatic"
        onScroll={onScroll}
        scrollEventThrottle={onScroll ? scrollEventThrottle : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={tableMode ? styles.tableListContent : styles.listContent}
        ListEmptyComponent={
          <EmptyState
            variant={emptyVariant}
            searchText={searchText.trim()}
            onClearFilters={emptyVariant === 'none' ? undefined : clearAllFilters}
            colors={colors}
            styles={styles}
          />
        }
        ListFooterComponent={
          <View style={styles.footer}>
            {!localData && data?.hasNextPage ? (
              <ActivityIndicator style={styles.footerSpinner} />
            ) : null}
            {rangeLabel != null && effectiveDocs.length > 0 ? (
              <Text style={styles.footerMeta}>{rangeLabel}</Text>
            ) : null}
          </View>
        }
      />

      {/* Filter bottom sheet — adds new filters or edits an existing chip.
          With queryPresetsCollection set it gains the OR-group overview +
          a Presets section (payload-query-presets, REST-only). */}
      <FilterBottomSheet
        visible={filterSheetVisible}
        onClose={closeFilterSheet}
        fields={filterableFields}
        initialFilter={editingFilter}
        onApply={(payload) => {
          const { id, ...rest } = payload
          if (id) updateFilter(id, rest)
          else addFilter(rest)
          closeFilterSheet()
        }}
        {...(queryPresetsCollection
          ? {
              activeFilters: filters,
              onRemoveFilter: removeFilter,
              presetsCollection: queryPresetsCollection,
              presetsColumns: summaryFields,
              onApplyFilterGroups: setFilterGroups,
            }
          : {})}
      />

      {/* Summary fields picker + list settings bottom sheet */}
      {onSummaryFieldsChange && (
        <SummaryFieldsPicker
          visible={summaryPickerOpen}
          onClose={closeSummaryPicker}
          fields={filterableFields}
          summaryFields={summaryFields}
          onSummaryFieldsChange={onSummaryFieldsChange}
          collection={collection}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageSizeChange={handlePageSizeChange}
          // Table pin toggles — only meaningful (and only shown) in table
          // mode, when the screen wires up persistence.
          tablePins={
            tableMode && onTablePinsChange
              ? { header: stickyHeader, firstColumn: pinFirstColumn }
              : undefined
          }
          onTablePinsChange={onTablePinsChange}
        />
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Sort control — native menu picker (iOS) with bottom-sheet fallback
// ---------------------------------------------------------------------------

type SortControlProps = {
  sort: DocumentListSort
  sortableFields: ClientField[]
  onChange: (sort: DocumentListSort) => void
  colors: ListColorPalette
  styles: ReturnType<typeof createStyles>
}

function SortControl({ sort, sortableFields, onChange, colors, styles }: SortControlProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const current = sortableFields.find((f) => f.name === sort.field)
  const currentLabel = current ? getFieldLabel(current) : sort.field
  const toggleDirection = () =>
    onChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' })

  const NativePicker = nativeComponents.Picker
  const NativeText = nativeComponents.Text
  const NativeButton = nativeComponents.Button
  const tagMod = nativeComponents.tag
  const psMod = nativeComponents.pickerStyle
  const btnStyleMod = nativeComponents.buttonStyle

  // ── Native path: SwiftUI menu-style picker + direction button ────────
  if (NativePicker && NativeText && tagMod && psMod) {
    return (
      <View style={styles.sortRow}>
        <NativeHost matchContents>
          <NativePicker
            selection={sort.field}
            onSelectionChange={(v) => {
              if (v != null) onChange({ ...sort, field: String(v) })
            }}
            label="Sort"
            systemImage="arrow.up.arrow.down"
            modifiers={[psMod('menu')]}
          >
            {sortableFields.map((f) => (
              <NativeText key={f.name} modifiers={[tagMod(f.name!)]}>
                {getFieldLabel(f)}
              </NativeText>
            ))}
          </NativePicker>
        </NativeHost>
        {NativeButton && btnStyleMod ? (
          <NativeHost matchContents>
            <NativeButton
              systemImage={sort.direction === 'desc' ? 'arrow.down' : 'arrow.up'}
              onPress={toggleDirection}
              modifiers={[btnStyleMod(liquidGlassAvailable ? 'glass' : 'bordered')]}
            />
          </NativeHost>
        ) : (
          <Pressable style={styles.sortDirBtn} onPress={toggleDirection} hitSlop={8}>
            <Text style={styles.sortDirText}>{sort.direction === 'desc' ? '↓' : '↑'}</Text>
          </Pressable>
        )}
      </View>
    )
  }

  // ── JS fallback: chip opens a bottom sheet ────────────────────────────
  const chipInner = (
    <>
      {ArrowUpDownIcon ? <ArrowUpDownIcon size={13} color={colors.textMuted} /> : null}
      <Text style={styles.sortChipText} numberOfLines={1}>
        {currentLabel} {sort.direction === 'desc' ? '↓' : '↑'}
      </Text>
    </>
  )

  return (
    <>
      <Pressable onPress={() => setSheetOpen(true)} hitSlop={4}>
        {liquidGlassAvailable && GlassView ? (
          <GlassView style={styles.sortChip} glassEffectStyle="regular">
            {chipInner}
          </GlassView>
        ) : (
          <View style={[styles.sortChip, styles.sortChipFallback]}>{chipInner}</View>
        )}
      </Pressable>

      <BottomSheet visible={sheetOpen} onClose={() => setSheetOpen(false)} height={0.6}>
        <Text style={styles.sortSheetTitle}>Sort by</Text>
        <View style={styles.sortSegmentRow}>
          {(['asc', 'desc'] as const).map((dir) => (
            <Pressable
              key={dir}
              style={[styles.sortSegment, sort.direction === dir && styles.sortSegmentActive]}
              onPress={() => onChange({ ...sort, direction: dir })}
            >
              <Text
                style={[
                  styles.sortSegmentText,
                  sort.direction === dir && styles.sortSegmentTextActive,
                ]}
              >
                {dir === 'asc' ? 'Ascending ↑' : 'Descending ↓'}
              </Text>
            </Pressable>
          ))}
        </View>
        <FlatList
          data={sortableFields}
          keyExtractor={(item) => item.name || item.type}
          renderItem={({ item }) => {
            const active = item.name === sort.field
            return (
              <Pressable
                style={styles.sortFieldRow}
                onPress={() => {
                  if (item.name) onChange({ ...sort, field: item.name })
                  setSheetOpen(false)
                }}
              >
                <Text style={[styles.sortFieldLabel, active && styles.sortFieldLabelActive]}>
                  {getFieldLabel(item)}
                </Text>
                {active && <Text style={styles.sortCheck}>✓</Text>}
              </Pressable>
            )
          }}
        />
      </BottomSheet>
    </>
  )
}

// ---------------------------------------------------------------------------
// Empty states — native ContentUnavailableView (iOS 17+) with JS fallback
// ---------------------------------------------------------------------------

type EmptyVariant = 'none' | 'search' | 'filtered'

const EMPTY_STATE_CONTENT: Record<EmptyVariant, { title: string; systemImage: string }> = {
  none: { title: 'No Documents', systemImage: 'tray' },
  search: { title: 'No Results', systemImage: 'magnifyingglass' },
  filtered: { title: 'No Matching Documents', systemImage: 'line.3.horizontal.decrease.circle' },
}

function EmptyState({
  variant,
  searchText,
  onClearFilters,
  colors,
  styles,
}: {
  variant: EmptyVariant
  searchText?: string
  onClearFilters?: () => void
  colors: ListColorPalette
  styles: ReturnType<typeof createStyles>
}) {
  const { title, systemImage } = EMPTY_STATE_CONTENT[variant]
  const description =
    variant === 'search'
      ? `No matches for “${searchText}”.`
      : variant === 'filtered'
        ? 'Try adjusting or clearing your filters.'
        : 'Documents you create will appear here.'

  const ContentUnavailable = nativeComponents.ContentUnavailableView
  const FallbackIcon =
    variant === 'search' ? SearchXIcon : variant === 'filtered' ? FilterXIcon : InboxIcon

  return (
    <View style={styles.emptyContainer}>
      {ContentUnavailable ? (
        // Fixed-height box so the stretched Host has an explicit frame
        <View style={styles.emptyNativeBox}>
          <NativeHost matchContents={false} style={{ flex: 1 }}>
            <ContentUnavailable
              title={title}
              systemImage={systemImage}
              description={description}
            />
          </NativeHost>
        </View>
      ) : (
        <View style={styles.emptyCenter}>
          {FallbackIcon ? <FallbackIcon size={40} color={colors.textMuted} /> : null}
          <Text style={styles.emptyTitle}>{title}</Text>
          <Text style={styles.emptyText}>{description}</Text>
        </View>
      )}
      {onClearFilters && (
        <Pressable style={styles.clearFiltersBtn} onPress={onClearFilters}>
          <Text style={styles.clearFiltersText}>Clear filters</Text>
        </Pressable>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Summary Fields Picker — sortable list with drag handles + list settings
// ---------------------------------------------------------------------------

const SORTABLE_ITEM_HEIGHT = 54

type TablePins = { header: boolean; firstColumn: boolean }

type SummaryFieldsPickerProps = {
  visible: boolean
  onClose: () => void
  fields: ClientField[]
  summaryFields: string[]
  onSummaryFieldsChange: (fields: string[]) => void
  collection: string
  pageSize: number
  pageSizeOptions: number[]
  onPageSizeChange: (pageSize: number) => void
  /** Table-mode pin state — section hidden when undefined (card mode). */
  tablePins?: TablePins
  /** Applies immediately (like the per-page selector — not draft-buffered). */
  onTablePinsChange?: (pins: TablePins) => void
}

function SummaryFieldsPicker({
  visible,
  onClose,
  fields,
  summaryFields,
  onSummaryFieldsChange,
  collection,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
  tablePins,
  onTablePinsChange,
}: SummaryFieldsPickerProps) {
  const { colors } = useListColors()
  const sfStyles = useMemo(() => createSfStyles(colors), [colors])

  // ── Local draft state — changes are buffered until "Save" ──────────
  const [draft, setDraft] = useState<string[]>(summaryFields)

  // Sync draft when the sheet opens or external state changes while closed
  useEffect(() => {
    if (visible) setDraft(summaryFields)
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  // Animated save button state: 'idle' | 'success' | 'error'
  const [saveState, setSaveState] = useState<'idle' | 'success' | 'error'>('idle')
  const saveBtnScale = useRef(new Animated.Value(1)).current

  const handleSave = useCallback(() => {
    // Bounce animation
    Animated.sequence([
      Animated.timing(saveBtnScale, { toValue: 0.8, duration: 80, useNativeDriver: true }),
      Animated.spring(saveBtnScale, { toValue: 1, friction: 3, tension: 200, useNativeDriver: true }),
    ]).start()

    try {
      onSummaryFieldsChange(draft)
      setSaveState('success')
      // Flash green then close
      setTimeout(() => {
        setSaveState('idle')
        onClose()
      }, 600)
    } catch {
      setSaveState('error')
      // Flash red then reset
      setTimeout(() => setSaveState('idle'), 1200)
    }
  }, [draft, onSummaryFieldsChange, onClose, saveBtnScale])

  // Reset save state when sheet opens
  useEffect(() => {
    if (visible) setSaveState('idle')
  }, [visible])

  // ── Derived data from draft (not summaryFields) ────────────────────
  const displayableFields = fields.filter(
    (f) =>
      f.name &&
      !['id', 'createdAt', 'updatedAt'].includes(f.name) &&
      ['text', 'email', 'number', 'date', 'select', 'radio', 'checkbox', 'relationship', 'upload', 'textarea', 'richText', 'point', 'json'].includes(f.type),
  )
  const fieldMap = new Map(displayableFields.map((f) => [f.name!, f]))

  // Memoize selectedItems so Sortable doesn't remount on every render.
  // Sortable uses a hash of all item IDs as a React key — new object refs
  // with the same IDs still trigger a full remount, killing animations.
  const selectedItems = useMemo(
    () => draft
      .filter((name) => fieldMap.has(name))
      .map((name) => ({ id: name, field: fieldMap.get(name)! })),
    [draft, fieldMap],
  )

  const unselectedItems = displayableFields.filter(
    (f) => f.name && !draft.includes(f.name),
  )

  const handleToggle = useCallback((fieldName: string) => {
    setDraft((prev) => {
      const isSelected = prev.includes(fieldName)
      return isSelected
        ? prev.filter((f) => f !== fieldName)
        : [...prev, fieldName]
    })
  }, [])

  // onMove: the library requires this to update the data array (gotcha #11).
  // However, updating state during drag triggers Sortable remount (gotcha #23),
  // killing the animation. So onMove is a no-op — we defer to onDrop.
  const noopMove = useCallback(() => {}, [])

  // onDrop: called when the item is released. allPositions maps id → final index.
  // We read the final ordering from allPositions and update draft once.
  const handleDrop = useCallback(
    (_id: string, _position: number, allPositions?: Record<string, number>) => {
      if (!allPositions) return
      setDraft((prev) => {
        // allPositions maps item id → new index. Build the reordered array.
        const items = prev.filter((name) => allPositions[name] != null)
        const sorted = items.sort((a, b) => allPositions[a] - allPositions[b])
        // Preserve any fields in draft that aren't in the sortable (shouldn't happen, but safe)
        const rest = prev.filter((name) => allPositions[name] == null)
        return [...sorted, ...rest]
      })
    },
    [],
  )

  const handleClear = useCallback(() => setDraft([]), [])

  // Sortable render callback — must spread ...props (gotcha from SKILL.md)
  const renderSortableItem = useCallback(
    ({ item, ...props }: any) => (
      <SortableItem
        key={item.id}
        id={item.id}
        data={item}
        onMove={noopMove}
        onDrop={handleDrop}
        {...props}
      >
        <View style={sfStyles.fieldRow}>
          <SortableItem.Handle>
            <View style={sfStyles.dragHandle}>
              {GripVerticalIcon ? (
                <GripVerticalIcon size={18} color={colors.textMuted} />
              ) : (
                <Text style={sfStyles.dragIcon}>☰</Text>
              )}
            </View>
          </SortableItem.Handle>
          <Pressable
            style={sfStyles.fieldRowInner}
            onPress={() => handleToggle(item.id)}
          >
            {CircleCheckIcon ? (
              <View style={sfStyles.checkboxNative}>
                <CircleCheckIcon size={22} color={colors.primary} />
              </View>
            ) : (
              <View style={[sfStyles.checkbox, sfStyles.checkboxSelected]}>
                <Text style={sfStyles.checkmark}>✓</Text>
              </View>
            )}
            <View style={sfStyles.fieldInfo}>
              <Text style={sfStyles.fieldLabel}>{getFieldLabel(item.field)}</Text>
              <Text style={sfStyles.fieldType}>{item.field.type}</Text>
            </View>
          </Pressable>
        </View>
      </SortableItem>
    ),
    [noopMove, handleDrop, handleToggle, sfStyles, colors],
  )

  const sortableHeight = selectedItems.length * SORTABLE_ITEM_HEIGHT

  return (
    <BottomSheet visible={visible} onClose={onClose} height={0.7}>
      {/* Header row — title + Save button (zIndex keeps it above dragged items) */}
      <View style={sfStyles.sheetHeader}>
        <View style={{ flex: 1 }}>
          <Text style={sfStyles.sheetTitle}>List Settings</Text>
          <Text style={sfStyles.sheetHint}>
            Select fields to show as card details or table columns. Drag to reorder.
          </Text>
        </View>
        <Pressable onPress={handleSave}>
          <Animated.View style={[
            sfStyles.saveBtn,
            saveState === 'success' && sfStyles.saveBtnSuccess,
            saveState === 'error' && sfStyles.saveBtnError,
            { transform: [{ scale: saveBtnScale }] },
          ]}>
            {saveState === 'success' ? (
              CheckIcon ? <CheckIcon size={20} color={colors.primaryText} /> : <Text style={sfStyles.saveBtnText}>✓</Text>
            ) : saveState === 'error' ? (
              XIcon ? <XIcon size={20} color={colors.primaryText} /> : <Text style={sfStyles.saveBtnText}>✕</Text>
            ) : (
              CheckIcon ? <CheckIcon size={20} color={colors.primaryText} /> : <Text style={sfStyles.saveBtnText}>✓</Text>
            )}
          </Animated.View>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
        {/* Per-page selector — applies immediately */}
        <Text style={sfStyles.sectionLabel}>DOCUMENTS PER PAGE</Text>
        <PageSizeSelector
          pageSize={pageSize}
          options={pageSizeOptions}
          onChange={onPageSizeChange}
          sfStyles={sfStyles}
        />

        {/* Table pin toggles — table mode only; applies immediately. Plain
            rows OUTSIDE the Sortable tree below (native switches must never
            sit inside drag trees). */}
        {tablePins && onTablePinsChange && (
          <>
            <Text style={sfStyles.sectionLabel}>TABLE PINNING</Text>
            <PinToggleRow
              label="Pin header"
              value={tablePins.header}
              onChange={(v) => onTablePinsChange({ ...tablePins, header: v })}
              colors={colors}
              sfStyles={sfStyles}
            />
            <PinToggleRow
              label="Pin first column"
              value={tablePins.firstColumn}
              onChange={(v) => onTablePinsChange({ ...tablePins, firstColumn: v })}
              colors={colors}
              sfStyles={sfStyles}
            />
          </>
        )}

        {/* Active fields — Sortable with drag handles */}
        {selectedItems.length > 0 && Sortable && SortableItem ? (
          <>
            <Text style={sfStyles.sectionLabel}>ACTIVE — drag to reorder</Text>
            <View style={{ height: sortableHeight }}>
              <Sortable
                data={selectedItems}
                renderItem={renderSortableItem}
                itemHeight={SORTABLE_ITEM_HEIGHT}
                useFlatList={false}
                style={{ backgroundColor: 'transparent' }}
                contentContainerStyle={{ backgroundColor: 'transparent' }}
              />
            </View>
          </>
        ) : selectedItems.length > 0 ? (
          <>
            <Text style={sfStyles.sectionLabel}>ACTIVE</Text>
            {selectedItems.map((si) => (
              <Pressable key={si.id} style={sfStyles.fieldRow} onPress={() => handleToggle(si.id)}>
                <View style={sfStyles.dragHandle}>
                  {GripVerticalIcon ? (
                    <GripVerticalIcon size={18} color={colors.textMuted} />
                  ) : (
                    <Text style={sfStyles.dragIcon}>☰</Text>
                  )}
                </View>
                <View style={sfStyles.fieldRowInner}>
                  {CircleCheckIcon ? (
                    <View style={sfStyles.checkboxNative}>
                      <CircleCheckIcon size={22} color={colors.primary} />
                    </View>
                  ) : (
                    <View style={[sfStyles.checkbox, sfStyles.checkboxSelected]}>
                      <Text style={sfStyles.checkmark}>✓</Text>
                    </View>
                  )}
                  <View style={sfStyles.fieldInfo}>
                    <Text style={sfStyles.fieldLabel}>{getFieldLabel(si.field)}</Text>
                    <Text style={sfStyles.fieldType}>{si.field.type}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </>
        ) : null}

        {/* Available fields — plain list */}
        {unselectedItems.length > 0 && (
          <>
            <Text style={sfStyles.sectionLabel}>AVAILABLE</Text>
            {unselectedItems.map((field) => (
              <Pressable
                key={field.name}
                style={sfStyles.fieldRow}
                onPress={() => handleToggle(field.name!)}
              >
                <View style={sfStyles.dragHandlePlaceholder} />
                <View style={sfStyles.fieldRowInner}>
                  {CircleIcon ? (
                    <View style={sfStyles.checkboxNative}>
                      <CircleIcon size={22} color={colors.border} />
                    </View>
                  ) : (
                    <View style={sfStyles.checkbox} />
                  )}
                  <View style={sfStyles.fieldInfo}>
                    <Text style={sfStyles.fieldLabel}>{getFieldLabel(field)}</Text>
                    <Text style={sfStyles.fieldType}>{field.type}</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </>
        )}

        {displayableFields.length === 0 && (
          <Text style={sfStyles.emptyText}>No displayable fields</Text>
        )}

        {draft.length > 0 && (
          <Pressable style={sfStyles.clearBtn} onPress={handleClear}>
            <Text style={sfStyles.clearText}>Clear all</Text>
          </Pressable>
        )}
      </View>
    </BottomSheet>
  )
}

// ---------------------------------------------------------------------------
// Pin toggle row — registry SwiftUI Toggle (switch) with a lucide fallback.
// Rendered only in plain sections, never inside Sortable trees.
// ---------------------------------------------------------------------------

function PinToggleRow({
  label,
  value,
  onChange,
  colors,
  sfStyles,
}: {
  label: string
  value: boolean
  onChange: (value: boolean) => void
  colors: ListColorPalette
  sfStyles: ReturnType<typeof createSfStyles>
}) {
  const NativeToggle = nativeComponents.Toggle

  return (
    <View style={sfStyles.pinRow}>
      <Text style={sfStyles.pinLabel}>{label}</Text>
      {NativeToggle ? (
        <NativeHost matchContents>
          <NativeToggle isOn={value} onIsOnChange={onChange} />
        </NativeHost>
      ) : (
        <Pressable
          hitSlop={8}
          onPress={() => onChange(!value)}
          accessibilityRole="switch"
          accessibilityState={{ checked: value }}
          accessibilityLabel={label}
        >
          {value ? (
            ToggleRightIcon ? (
              <ToggleRightIcon size={30} color={colors.primary} />
            ) : (
              <Text style={[sfStyles.pinFallbackText, { color: colors.primary }]}>On</Text>
            )
          ) : ToggleLeftIcon ? (
            <ToggleLeftIcon size={30} color={colors.textMuted} />
          ) : (
            <Text style={[sfStyles.pinFallbackText, { color: colors.textMuted }]}>Off</Text>
          )}
        </Pressable>
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Page size selector — native segmented picker with chip-row fallback
// ---------------------------------------------------------------------------

function PageSizeSelector({
  pageSize,
  options,
  onChange,
  sfStyles,
}: {
  pageSize: number
  options: number[]
  onChange: (pageSize: number) => void
  sfStyles: ReturnType<typeof createSfStyles>
}) {
  const NativePicker = nativeComponents.Picker
  const NativeText = nativeComponents.Text
  const tagMod = nativeComponents.tag
  const psMod = nativeComponents.pickerStyle

  if (NativePicker && NativeText && tagMod && psMod) {
    return (
      <View style={sfStyles.pageSizeWrap}>
        <NativeHost matchContents={{ height: true }}>
          <NativePicker
            selection={String(pageSize)}
            onSelectionChange={(v) => {
              const n = Number(v)
              if (Number.isFinite(n) && n > 0) onChange(n)
            }}
            modifiers={[psMod('segmented')]}
          >
            {options.map((o) => (
              <NativeText key={o} modifiers={[tagMod(String(o))]}>
                {String(o)}
              </NativeText>
            ))}
          </NativePicker>
        </NativeHost>
      </View>
    )
  }

  return (
    <View style={sfStyles.pageSizeRow}>
      {options.map((o) => {
        const active = o === pageSize
        return (
          <Pressable
            key={o}
            style={[sfStyles.pageSizeChip, active && sfStyles.pageSizeChipActive]}
            onPress={() => onChange(o)}
          >
            <Text style={[sfStyles.pageSizeText, active && sfStyles.pageSizeTextActive]}>
              {o}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Styles — built from the dark-mode aware palette
// ---------------------------------------------------------------------------

const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    container: { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: c.background },
    listContent: { paddingTop: t.spacing.sm, paddingBottom: 100 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl },

    // Filter row
    filterRow: { marginVertical: t.spacing.xs },

    // ── Tablet table mode ─────────────────────────────────────────
    // Header band sits flush under the nav bar; rows are full-bleed.
    tableListContent: { paddingBottom: 100 },
    // Chips pinned with the sticky band need an opaque backdrop (content
    // scrolls underneath) — padding, not margin, so nothing shows through.
    tableChipsWrap: { backgroundColor: c.background, paddingVertical: t.spacing.xs },

    // Sort + meta controls row
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: t.spacing.lg,
      marginBottom: t.spacing.sm,
      gap: t.spacing.sm,
    },
    controlsSpacer: { flex: 1 },
    rangeMeta: { fontSize: t.fontSize.xs, color: c.textMuted },

    sortRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm },
    sortDirBtn: {
      width: 30,
      height: 30,
      borderRadius: 15,
      borderWidth: 1,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.surface,
    },
    sortDirText: { fontSize: 14, color: c.text, fontWeight: '600' },
    sortChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: t.spacing.xs,
      borderRadius: 16,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs + 2,
      overflow: 'hidden',
    },
    sortChipFallback: {
      backgroundColor: c.surface,
      borderWidth: 1,
      borderColor: c.border,
    },
    sortChipText: { fontSize: t.fontSize.sm, color: c.text, fontWeight: '500' },

    sortSheetTitle: {
      fontSize: t.fontSize.lg,
      fontWeight: '700',
      color: c.text,
      marginBottom: t.spacing.md,
    },
    sortSegmentRow: {
      flexDirection: 'row',
      backgroundColor: c.pressed,
      borderRadius: t.borderRadius.sm,
      padding: 3,
      marginBottom: t.spacing.md,
    },
    sortSegment: {
      flex: 1,
      paddingVertical: t.spacing.sm,
      alignItems: 'center',
      borderRadius: t.borderRadius.sm - 2,
    },
    sortSegmentActive: { backgroundColor: c.surface },
    sortSegmentText: { fontSize: t.fontSize.sm, color: c.textMuted, fontWeight: '500' },
    sortSegmentTextActive: { color: c.text, fontWeight: '600' },
    sortFieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    sortFieldLabel: { fontSize: t.fontSize.md, color: c.text },
    sortFieldLabelActive: { fontWeight: '600' },
    sortCheck: { fontSize: 16, color: c.primary },

    // ── Row cards (liquid glass / themed fallback) ────────────────
    cardWrap: {
      paddingHorizontal: t.spacing.lg,
      marginBottom: t.spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      borderRadius: 16,
      paddingVertical: 12,
      paddingHorizontal: t.spacing.lg,
      overflow: 'hidden',
    },
    cardFallback: {
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    rowPressed: { opacity: 0.7 },
    // Revealed swipe action aligns with the card's rounded corners
    swipeAction: { borderRadius: 16 },

    // Image thumbnail (when an upload summary field has a URL)
    thumbnail: {
      width: 48,
      height: 48,
      borderRadius: 10,
      backgroundColor: c.separator,
    },

    // Text content
    rowBody: { flex: 1, minWidth: 0 },
    rowHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: 8,
    },
    rowTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: c.text,
      flex: 1,
    },
    rowDate: {
      fontSize: 12,
      color: c.textMuted,
      flexShrink: 0,
    },
    rowChevron: {
      fontSize: 18,
      color: c.tertiary,
      marginLeft: 6,
      fontWeight: '300',
    },

    // ── Two-column summary grid ──────────────────────────────────
    summaryGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 4,
    },
    summaryCell: {
      width: '50%' as any,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingRight: 14,
      marginTop: 2,
    },
    summaryLabel: {
      fontSize: 12,
      color: c.textMuted,
      marginRight: 4,
    },
    summaryValue: {
      fontSize: 12,
      color: c.text,
      fontWeight: '500',
      flexShrink: 1,
      textAlign: 'right',
    },

    // ── Footer (pagination meta) ─────────────────────────────────
    footer: { alignItems: 'center', paddingVertical: t.spacing.sm },
    footerSpinner: { paddingVertical: t.spacing.sm },
    footerMeta: { fontSize: t.fontSize.xs, color: c.textMuted },

    // ── States ───────────────────────────────────────────────────
    errorText: { color: c.error, fontSize: t.fontSize.md, textAlign: 'center', marginBottom: t.spacing.md },
    retryBtn: { paddingHorizontal: t.spacing.xl, paddingVertical: t.spacing.sm, backgroundColor: c.primary, borderRadius: t.borderRadius.sm },
    retryText: { color: c.primaryText, fontSize: t.fontSize.md, fontWeight: '600' },

    emptyContainer: { alignItems: 'center', paddingVertical: t.spacing.xl },
    emptyNativeBox: { height: 280, alignSelf: 'stretch' },
    emptyCenter: { alignItems: 'center', paddingVertical: t.spacing.xxl, gap: t.spacing.sm },
    emptyTitle: { color: c.text, fontSize: t.fontSize.lg, fontWeight: '600' },
    emptyText: {
      color: c.textMuted,
      fontSize: t.fontSize.md,
      textAlign: 'center',
      paddingHorizontal: t.spacing.xl,
    },
    clearFiltersBtn: { marginTop: t.spacing.md },
    clearFiltersText: { color: c.primary, fontSize: t.fontSize.sm, fontWeight: '600' },
  })


// Summary field picker styles
const createSfStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: t.spacing.sm,
      zIndex: 10,
    },
    sheetTitle: { fontSize: t.fontSize.lg, fontWeight: '700', color: c.text, marginBottom: 4 },
    sheetHint: { fontSize: t.fontSize.sm, color: c.textMuted },
    saveBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: c.primary,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      marginLeft: t.spacing.md,
    },
    saveBtnSuccess: {
      backgroundColor: c.success,
    },
    saveBtnError: {
      backgroundColor: c.destructive,
    },
    saveBtnText: {
      color: c.primaryText,
      fontSize: 18,
      fontWeight: '700',
    },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      letterSpacing: 0.5,
      textTransform: 'uppercase' as const,
      marginTop: t.spacing.md,
      marginBottom: t.spacing.xs,
      paddingHorizontal: t.spacing.sm,
    },
    pageSizeWrap: {
      paddingHorizontal: t.spacing.sm,
      marginBottom: t.spacing.xs,
    },
    pageSizeRow: {
      flexDirection: 'row',
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.sm,
      marginBottom: t.spacing.xs,
    },
    pageSizeChip: {
      flex: 1,
      paddingVertical: t.spacing.sm,
      borderRadius: t.borderRadius.sm,
      borderWidth: 1,
      borderColor: c.border,
      backgroundColor: c.surface,
      alignItems: 'center',
    },
    pageSizeChipActive: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    pageSizeText: { fontSize: t.fontSize.sm, color: c.text, fontWeight: '500' },
    pageSizeTextActive: { color: c.primaryText, fontWeight: '600' },
    pinRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: t.spacing.sm,
      paddingVertical: t.spacing.xs + 2,
      minHeight: 40,
    },
    pinLabel: { fontSize: t.fontSize.md, color: c.text, fontWeight: '500' },
    pinFallbackText: { fontSize: t.fontSize.sm, fontWeight: '600' },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      height: SORTABLE_ITEM_HEIGHT,
      paddingHorizontal: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
      backgroundColor: 'transparent',
    },
    fieldRowInner: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    dragHandle: {
      width: 32,
      height: SORTABLE_ITEM_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dragIcon: {
      fontSize: 18,
      color: c.textMuted,
    },
    dragHandlePlaceholder: {
      width: 32,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: c.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: t.spacing.md,
    },
    checkboxSelected: {
      backgroundColor: c.primary,
      borderColor: c.primary,
    },
    checkboxNative: {
      marginRight: t.spacing.md,
    },
    checkmark: { fontSize: 13, color: c.primaryText, fontWeight: '700' },
    fieldInfo: { flex: 1 },
    fieldLabel: { fontSize: t.fontSize.md, color: c.text, fontWeight: '500' },
    fieldType: { fontSize: t.fontSize.xs, color: c.textMuted, marginTop: 1 },
    clearBtn: { paddingVertical: t.spacing.md, alignItems: 'center' },
    clearText: { fontSize: t.fontSize.sm, color: c.destructive, fontWeight: '600' },
    emptyText: { textAlign: 'center', paddingVertical: t.spacing.xl, color: c.textMuted, fontSize: t.fontSize.sm },
  })
