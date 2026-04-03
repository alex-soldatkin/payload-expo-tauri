/**
 * DocumentList – paginated FlatList for a collection, driven by the Payload REST API.
 * Replaces the web admin's data table with a mobile-optimised list.
 *
 * Supports:
 *  - Native search bar (iOS headerSearchBarOptions, text passed via `searchText` prop)
 *  - Structured field filters via FilterBottomSheet
 *  - Active filter chip indicators
 *  - Pull-to-refresh and infinite scroll
 */
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  Alert,
} from 'react-native'
// ReanimatedSwipeable deferred — legacy Swipeable causes PanGestureHandler
// crash on iOS 26, and ReanimatedSwipeable has module interop issues.
// Swipe-to-delete uses a long-press alert fallback instead.

import type { ClientField, PaginatedDocs, SerializedSchemaMap } from './types'
import { defaultTheme as t } from './theme'
import { extractRootFields, getDocumentTitle, getFieldLabel } from './schemaHelpers'
import { usePayloadNative } from './PayloadNativeProvider'
import { payloadApi } from './api'
import { useDocumentListFilters } from './useDocumentListFilters'
import { FilterChips } from './FilterChips'
import { FilterBottomSheet } from './FilterBottomSheet'
import { BottomSheet } from './BottomSheet'

// Lucide icons for the summary fields picker
let GripVerticalIcon: React.ComponentType<{ size: number; color: string }> | null = null
let CircleCheckIcon: React.ComponentType<{ size: number; color: string }> | null = null
let CircleIcon: React.ComponentType<{ size: number; color: string }> | null = null
let CheckIcon: React.ComponentType<{ size: number; color: string }> | null = null
let XIcon: React.ComponentType<{ size: number; color: string }> | null = null
try {
  const lucide = require('lucide-react-native')
  GripVerticalIcon = lucide.GripVertical
  CircleCheckIcon = lucide.CircleCheck
  CircleIcon = lucide.Circle
  CheckIcon = lucide.Check
  XIcon = lucide.X
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

const AnimatedFlatList = Animated.createAnimatedComponent(FlatList)

type Props = {
  /** Collection slug */
  collection: string
  /** Called when a row is tapped */
  onPress: (doc: Record<string, unknown>) => void
  /** Called when "Create" is tapped */
  onCreate?: () => void
  /** Called when a document is swiped to delete. If provided, enables swipe-to-delete. */
  onDelete?: (doc: Record<string, unknown>) => void
  /** Number of docs per page */
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
   * Receives the default row content, the doc, and onPress handler.
   */
  renderRow?: (props: {
    item: Record<string, unknown>
    rowContent: React.ReactElement
    onPress: () => void
  }) => React.ReactElement
  /**
   * Optional external data source (e.g. from local-db).
   * When provided, the component skips its own REST API calls
   * and uses this data directly. The parent is responsible for
   * filtering/pagination.
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
  /** Scroll event handler forwarded to the inner FlatList (e.g. for scroll-driven header blur). */
  onScroll?: (event: any) => void
  /** Scroll event throttle in ms (default 16). Only used when onScroll is provided. */
  scrollEventThrottle?: number
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
  onScroll,
  scrollEventThrottle = 16,
}) => {
  const { baseURL, auth } = usePayloadNative()
  // baseURL is also used below for resolving upload image thumbnail URLs
  const [data, setData] = useState<PaginatedDocs | null>(null)
  const [loading, setLoading] = useState(!localData)
  const [refreshing, setRefreshing] = useState(false)
  const [page, setPage] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [internalFilterOpen, setInternalFilterOpen] = useState(false)
  const filterSheetOpen = externalFilterOpen ?? internalFilterOpen
  const closeFilterSheet = onFilterSheetClose ?? (() => setInternalFilterOpen(false))
  const [internalPickerOpen, setInternalPickerOpen] = useState(false)
  const summaryPickerOpen = externalPickerOpen ?? internalPickerOpen
  const closeSummaryPicker = onSummaryPickerClose ?? (() => setInternalPickerOpen(false))

  // When local data is provided, use it as the primary data source
  const effectiveDocs = localData?.docs ?? data?.docs ?? []
  const effectiveTotalDocs = localData?.totalDocs ?? data?.totalDocs ?? 0
  const effectiveLoading = localData ? localData.loading : loading

  const {
    searchText,
    setSearchText,
    filters,
    addFilter,
    removeFilter,
    clearAllFilters,
    whereQuery,
    hasActiveFilters,
  } = useDocumentListFilters({ searchFields })

  // Sync external search text from native header search bar
  useEffect(() => {
    if (externalSearchText != null) setSearchText(externalSearchText)
  }, [externalSearchText, setSearchText])

  // Schema-derived filterable fields
  const filterableFields: ClientField[] = schemaMap
    ? extractRootFields(schemaMap, collection)
    : []

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
          limit,
          depth: 0,
          sort: '-updatedAt',
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
    [baseURL, collection, limit],
  )

  // Initial load + re-load when filters/search change (skip if using local data)
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
    if (!localData && data?.hasNextPage && !loading) {
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
    if (typeof val === 'object') {
      // Relationship (populated object) — show title/name/email
      const obj = val as Record<string, unknown>
      return String(obj.title ?? obj.name ?? obj.email ?? obj.id ?? JSON.stringify(val))
    }
    const s = String(val)
    // Date-like strings — format nicely
    if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return formatDate(s)
    return s
  }

  /** Resolve field labels and types from the schema. */
  const fieldLabelMap = new Map<string, string>()
  const fieldTypeMap = new Map<string, string>()
  if (schemaMap) {
    for (const f of extractRootFields(schemaMap, collection)) {
      if (f.name) {
        fieldLabelMap.set(f.name, getFieldLabel(f))
        fieldTypeMap.set(f.name, f.type)
      }
    }
  }

  const renderItem = ({ item }: { item: Record<string, unknown> }) => {
    const title = getDocumentTitle(item, titleField)
    const date = item.updatedAt ? formatDate(item.updatedAt as string) : undefined

    // ── Detect image thumbnail from upload summary fields ──────────
    let thumbnailUrl: string | null = null
    let thumbnailField: string | null = null
    for (const fieldName of summaryFields) {
      if (fieldTypeMap.get(fieldName) === 'upload') {
        const val = item[fieldName]
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
        value: formatFieldValue(item[fieldName]),
      }))
      .filter((line) => line.value !== '—')

    const rowContent = (
      <View style={styles.row}>
        {thumbnailUrl && (
          <Image source={{ uri: thumbnailUrl }} style={styles.thumbnail} />
        )}
        <View style={styles.rowContent}>
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
      </View>
    )

    if (renderRow) {
      return renderRow({ item, rowContent, onPress: () => onPress(item) })
    }
    return (
      <Pressable
        onPress={() => onPress(item)}
        style={({ pressed }) => pressed ? styles.rowPressed : undefined}
      >
        {rowContent}
      </Pressable>
    )
  }

  // --- Header component rendered above the list ---
  const ListHeader = () => (
    <View>
      {/* Active filter chips (only shown when filters are applied) */}
      {hasActiveFilters && (
        <View style={styles.filterRow}>
          <FilterChips
            filters={filters}
            searchText={searchText}
            onRemove={removeFilter}
            onClearAll={clearAllFilters}
            onAddFilter={closeFilterSheet}
          />
        </View>
      )}

      {/* Result count when filters active */}
      {hasActiveFilters && effectiveTotalDocs > 0 && (
        <Text style={styles.resultCount}>
          {effectiveTotalDocs} result{effectiveTotalDocs !== 1 ? 's' : ''}
        </Text>
      )}
    </View>
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

  return (
    <View style={styles.container}>
      <AnimatedFlatList
        data={effectiveDocs}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        extraData={summaryFields}
        ListHeaderComponent={ListHeader}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.4}
        contentInsetAdjustmentBehavior="automatic"
        onScroll={onScroll}
        scrollEventThrottle={onScroll ? scrollEventThrottle : undefined}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyCenter}>
            <Text style={styles.emptyText}>
              {hasActiveFilters ? 'No documents match your filters' : 'No documents yet'}
            </Text>
            {hasActiveFilters && (
              <Pressable style={styles.clearFiltersBtn} onPress={clearAllFilters}>
                <Text style={styles.clearFiltersText}>Clear filters</Text>
              </Pressable>
            )}
          </View>
        }
        ListFooterComponent={
          !localData && data?.hasNextPage ? <ActivityIndicator style={{ paddingVertical: 16 }} /> : null
        }
      />

      {/* Filter bottom sheet */}
      <FilterBottomSheet
        visible={filterSheetOpen}
        onClose={closeFilterSheet}
        fields={filterableFields}
        onApply={(f) => { addFilter(f); closeFilterSheet() }}
      />

      {/* Summary fields picker bottom sheet */}
      {onSummaryFieldsChange && (
        <SummaryFieldsPicker
          visible={summaryPickerOpen}
          onClose={closeSummaryPicker}
          fields={filterableFields}
          summaryFields={summaryFields}
          onSummaryFieldsChange={onSummaryFieldsChange}
          collection={collection}
        />
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Summary Fields Picker — sortable list with drag handles
// ---------------------------------------------------------------------------

const SORTABLE_ITEM_HEIGHT = 54

type SummaryFieldsPickerProps = {
  visible: boolean
  onClose: () => void
  fields: ClientField[]
  summaryFields: string[]
  onSummaryFieldsChange: (fields: string[]) => void
  collection: string
}

function SummaryFieldsPicker({
  visible,
  onClose,
  fields,
  summaryFields,
  onSummaryFieldsChange,
  collection,
}: SummaryFieldsPickerProps) {
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
                <GripVerticalIcon size={18} color={t.colors.textMuted} />
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
                <CircleCheckIcon size={22} color={t.colors.primary} />
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
    [noopMove, handleDrop, handleToggle],
  )

  const sortableHeight = selectedItems.length * SORTABLE_ITEM_HEIGHT

  return (
    <BottomSheet visible={visible} onClose={onClose} height={0.7}>
      {/* Header row — title + Save button (zIndex keeps it above dragged items) */}
      <View style={sfStyles.sheetHeader}>
        <View style={{ flex: 1 }}>
          <Text style={sfStyles.sheetTitle}>Card Display Fields</Text>
          <Text style={sfStyles.sheetHint}>
            Select fields to show. Drag to reorder.
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
              CheckIcon ? <CheckIcon size={20} color="#fff" /> : <Text style={sfStyles.saveBtnText}>✓</Text>
            ) : saveState === 'error' ? (
              XIcon ? <XIcon size={20} color="#fff" /> : <Text style={sfStyles.saveBtnText}>✕</Text>
            ) : (
              CheckIcon ? <CheckIcon size={20} color="#fff" /> : <Text style={sfStyles.saveBtnText}>✓</Text>
            )}
          </Animated.View>
        </Pressable>
      </View>

      <View style={{ flex: 1 }}>
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
                    <GripVerticalIcon size={18} color={t.colors.textMuted} />
                  ) : (
                    <Text style={sfStyles.dragIcon}>☰</Text>
                  )}
                </View>
                <View style={sfStyles.fieldRowInner}>
                  {CircleCheckIcon ? (
                    <View style={sfStyles.checkboxNative}>
                      <CircleCheckIcon size={22} color={t.colors.primary} />
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
                      <CircleIcon size={22} color={t.colors.border} />
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

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', alignSelf: 'stretch', backgroundColor: t.colors.background },
  listContent: { paddingTop: t.spacing.sm, paddingBottom: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.xl },

  // Create button
  createBtn: {
    paddingVertical: t.spacing.md,
    backgroundColor: t.colors.primary,
    borderRadius: t.borderRadius.sm,
    alignItems: 'center',
  },
  createText: { color: t.colors.primaryText, fontSize: t.fontSize.md, fontWeight: '600' },

  // Filter row
  filterRow: { marginVertical: t.spacing.xs, paddingHorizontal: t.spacing.lg },

  resultCount: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    marginBottom: t.spacing.sm,
    paddingHorizontal: t.spacing.lg,
  },

  // Header top row
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginTop: t.spacing.md,
    marginBottom: t.spacing.sm,
    paddingHorizontal: t.spacing.lg,
  },

  // Gear icon
  gearBtn: {
    width: 44,
    height: 44,
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.surface,
    borderWidth: 1,
    borderColor: t.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearIcon: { fontSize: 20, color: t.colors.textMuted },

  // ── Row ──────────────────────────────────────────────────────
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: t.spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.12)',
  },
  rowPressed: {
    backgroundColor: 'rgba(0,0,0,0.04)',
    borderRadius: 10,
  },

  // Image thumbnail (when an upload summary field has a URL)
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: t.colors.separator,
    marginRight: 12,
  },

  // Text content
  rowContent: { flex: 1, minWidth: 0 },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: t.colors.text,
    flex: 1,
  },
  rowDate: {
    fontSize: 12,
    color: t.colors.textMuted,
    flexShrink: 0,
  },
  rowChevron: {
    fontSize: 18,
    color: 'rgba(0,0,0,0.18)',
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
    color: t.colors.textMuted,
    marginRight: 4,
  },
  summaryValue: {
    fontSize: 12,
    color: t.colors.text,
    fontWeight: '500',
    flexShrink: 1,
    textAlign: 'right',
  },

  // ── States ───────────────────────────────────────────────────
  errorText: { color: t.colors.error, fontSize: t.fontSize.md, textAlign: 'center', marginBottom: t.spacing.md },
  retryBtn: { paddingHorizontal: t.spacing.xl, paddingVertical: t.spacing.sm, backgroundColor: t.colors.primary, borderRadius: t.borderRadius.sm },
  retryText: { color: t.colors.primaryText, fontSize: t.fontSize.md, fontWeight: '600' },
  emptyCenter: { alignItems: 'center', paddingVertical: t.spacing.xxl },
  emptyText: { color: t.colors.textMuted, fontSize: t.fontSize.md },
  clearFiltersBtn: { marginTop: t.spacing.md },
  clearFiltersText: { color: t.colors.primary, fontSize: t.fontSize.sm, fontWeight: '600' },
})


// Summary field picker styles
const sfStyles = StyleSheet.create({
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: t.spacing.sm,
    zIndex: 10,
  },
  sheetTitle: { fontSize: t.fontSize.lg, fontWeight: '700', color: t.colors.text, marginBottom: 4 },
  sheetHint: { fontSize: t.fontSize.sm, color: t.colors.textMuted },
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: t.colors.primary,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    marginLeft: t.spacing.md,
  },
  saveBtnSuccess: {
    backgroundColor: '#16a34a',
  },
  saveBtnError: {
    backgroundColor: '#dc2626',
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: t.colors.textMuted,
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    marginTop: t.spacing.md,
    marginBottom: t.spacing.xs,
    paddingHorizontal: t.spacing.sm,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: SORTABLE_ITEM_HEIGHT,
    paddingHorizontal: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.separator,
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
    color: t.colors.textMuted,
  },
  dragHandlePlaceholder: {
    width: 32,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: t.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: t.spacing.md,
  },
  checkboxSelected: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  checkboxNative: {
    marginRight: t.spacing.md,
  },
  checkmark: { fontSize: 13, color: '#fff', fontWeight: '700' },
  fieldInfo: { flex: 1 },
  fieldLabel: { fontSize: t.fontSize.md, color: t.colors.text, fontWeight: '500' },
  fieldType: { fontSize: t.fontSize.xs, color: t.colors.textMuted, marginTop: 1 },
  clearBtn: { paddingVertical: t.spacing.md, alignItems: 'center' },
  clearText: { fontSize: t.fontSize.sm, color: t.colors.destructive, fontWeight: '600' },
  emptyText: { textAlign: 'center', paddingVertical: t.spacing.xl, color: t.colors.textMuted, fontSize: t.fontSize.sm },
})
