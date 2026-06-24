/**
 * DocumentList — prop/domain types and shared constants.
 * See ./index.tsx for the component itself.
 */
import type React from 'react'

import type { ClientField, SerializedSchemaMap } from '../types'
import type { ActiveFilter, FilterCondition } from '../hooks/useDocumentListFilters'

// ---------------------------------------------------------------------------
// Sort
// ---------------------------------------------------------------------------

export type DocumentListSort = {
  field: string
  direction: 'asc' | 'desc'
}

export const DEFAULT_SORT: DocumentListSort = { field: 'updatedAt', direction: 'desc' }

export const SORT_KEY_PREFIX = 'list_sort:'
export const PAGE_SIZE_KEY_PREFIX = 'list_page_size:'
export const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

/** Field types that can be sorted on (mirrors the web admin's sortable columns). */
export const SORTABLE_FIELD_TYPES = new Set([
  'text', 'email', 'textarea', 'code', 'number', 'date', 'select', 'radio', 'checkbox',
])

// ---------------------------------------------------------------------------
// Empty states
// ---------------------------------------------------------------------------

export type EmptyVariant = 'none' | 'search' | 'filtered'

export const EMPTY_STATE_CONTENT: Record<EmptyVariant, { title: string; systemImage: string }> = {
  none: { title: 'No Documents', systemImage: 'tray' },
  search: { title: 'No Results', systemImage: 'magnifyingglass' },
  filtered: { title: 'No Matching Documents', systemImage: 'line.3.horizontal.decrease.circle' },
}

// ---------------------------------------------------------------------------
// Summary fields picker
// ---------------------------------------------------------------------------

export const SORTABLE_ITEM_HEIGHT = 54

export type TablePins = { header: boolean; firstColumn: boolean }

// ---------------------------------------------------------------------------
// DocumentList props
// ---------------------------------------------------------------------------

export type DocumentListProps = {
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
   * long-press peek, swipe-to-delete, selection — see DocumentListTable).
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
