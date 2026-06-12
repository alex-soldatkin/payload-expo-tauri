/**
 * Document list for a collection — always local-first.
 *
 * Phone:
 *   - Card-style rows with summary fields
 *   - Header icons: ⚙ Settings, ▽ Filter, + Create
 *   - Swipe left to delete (with confirmation)
 *   - Shake to undo the last delete
 *   - Link.Preview (long-press peek) rendered inside Expo Router tree
 *
 * Tablet:
 *   - Table-style rows (title, summary fields, status, date) matching
 *     Payload web admin dashboard
 *   - Same header actions and long-press preview
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Animated as RNAnimated, Platform, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { Stack, useLocalSearchParams, useRouter, useIsPreview } from 'expo-router'
import type { SFSymbol } from 'sf-symbols-typescript'
import { useHeaderHeight } from '@react-navigation/elements'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Bookmark, CalendarDays, ChartGantt, CheckSquare, Filter, Plus, QrCode, Settings, SquareKanban, Table2 } from 'lucide-react-native'
import { DeviceMotion } from 'expo-sensors'
import {
  applyWhereToDocs,
  BottomSheet,
  CalendarView,
  closeOpenSwipeRow,
  collectionHasCalendarDateFields,
  DocumentForm,
  DocumentList,
  extractRootFields,
  FilterBottomSheet,
  FilterChips,
  filtersToWhere,
  GanttChart,
  getByPath,
  getCollectionLabel,
  getDocumentTitle,
  getFieldLabel,
  getSortableFields,
  KanbanBoard,
  normalizeOption,
  pickDefaultSources,
  PreviewContextProvider,
  setByPath,
  SwipeToDeleteRow,
  todayDateKey,
  useAdminSchema,
  useBaseURL,
  useAuth,
  useCustomComponentRegistry,
  useDocumentListFilters,
  useListActionHandlers,
  useListColors,
  useMenuModel,
  useToast,
  whereToFilterGroups,
  type ActiveFilter,
  type CalendarMode,
  type CalendarSource,
  type ClientField,
  type ClientSelectField,
  type DocumentListSort,
  type FilterCondition,
  type KanbanStatusField,
} from '@payload-universal/admin-native'
// Native @expo/ui SwiftUI components for the selection action bar
import { nativeComponents, NativeHost } from '@payload-universal/admin-native/fields'
import { useLocalDB, useLocalCollection, useLocalDBStatus, useLocalMutations, useValidatedMutations } from '@payload-universal/local-db'
import { useHeaderScrollY } from '@/components/HeaderScrollContext'
import * as ScrollablePreview from '@/modules/scrollable-preview'
// Direct module import is correct here (screens own native-module injection;
// admin-native receives it via CalendarView's nativeModule prop)
import * as calendarNativeModule from '@/modules/calendar-view'
import { useResponsive } from '@/hooks/useResponsive'
import { BulkEditSheet } from '@/src/components/BulkEditSheet'
import { CalendarCustomizeSheet } from '@/src/components/CalendarCustomizeSheet'
import { ScanLookupSheet } from '@/src/components/ScanLookupSheet'
import { useScanLookup } from '@/src/hooks/useScanLookup'
import { GanttCustomizeSheet } from '@/src/components/GanttCustomizeSheet'
import { KanbanCustomizeSheet } from '@/src/components/KanbanCustomizeSheet'
import { PresetsSheet } from '@/src/components/PresetsSheet'
import { useCalendarConfig, type CalendarConfig } from '@/src/hooks/useCalendarConfig'
import { useGanttConfig, type GanttConfig } from '@/src/hooks/useGanttConfig'
import { useKanbanConfig, useListViewMode, type ListViewMode } from '@/src/hooks/useKanbanConfig'
import {
  presetToCalendarConfig,
  presetToGanttConfig,
  presetToKanbanConfig,
  type ViewPresetDoc,
} from '@/src/hooks/useViewPresets'

const SUMMARY_FIELDS_KEY_PREFIX = 'card_summary_fields:'
// Same key prefix DocumentList uses internally — the iOS toolbar (controlled)
// and the Android internal sort UI (uncontrolled) share persisted state.
const SORT_KEY_PREFIX = 'list_sort:'
const DEFAULT_SORT: DocumentListSort = { field: 'updatedAt', direction: 'desc' }
const SHAKE_THRESHOLD = 1.5 // acceleration magnitude to trigger undo

// Table-mode pin preferences (sticky header band / frozen title column) —
// both default ON; toggled in the list settings sheet, persisted per slug.
const TABLE_PINS_KEY_PREFIX = 'table_pins:'
type TablePins = { header: boolean; firstColumn: boolean }
const DEFAULT_TABLE_PINS: TablePins = { header: true, firstColumn: true }

// Aligns the revealed swipe action with the phone card rendered by
// DocumentList (cardWrap: 16px horizontal gutter + 8px bottom margin;
// card borderRadius 16). Tablet table rows are full-bleed (no insets).
const PHONE_SWIPE_ACTION_STYLE = { marginRight: 16, marginBottom: 8, borderRadius: 16 } as const

/**
 * Stack.Toolbar is an experimental expo-router API (unstable_headerRightItems
 * → react-native-screens bar button items). Guard at runtime so the screen
 * falls back to the always-available `headerRight` path when the API is
 * missing (older expo-router / dev-client binary) instead of silently
 * rendering NO create/filter/settings affordances. Same pattern as [id].tsx.
 */
const hasStackToolbar =
  typeof (Stack as { Toolbar?: unknown }).Toolbar === 'function' &&
  Boolean((Stack as { Toolbar?: { Button?: unknown } }).Toolbar?.Button)

// ---------------------------------------------------------------------------
// Kanban helpers — mirror DocumentList's internal client-side sort semantics
// (sortDocs is not exported) so the board shows the same ordering the table
// uses within each column.
// ---------------------------------------------------------------------------

const EMPTY_DOCS: Record<string, unknown>[] = []

/** Field types whose docs can be rendered as label:value rows on cards. */
const KANBAN_CARD_FIELD_TYPES = new Set([
  'text', 'email', 'number', 'date', 'select', 'radio', 'checkbox',
  'relationship', 'upload', 'textarea', 'richText', 'point', 'json',
])

const comparableSortValue = (v: unknown): number | string | null => {
  if (v == null || v === '') return null
  if (typeof v === 'number') return v
  if (typeof v === 'boolean') return v ? 1 : 0
  if (Array.isArray(v)) return comparableSortValue(v[0])
  if (typeof v === 'object') {
    const obj = v as Record<string, unknown>
    return comparableSortValue(obj.title ?? obj.name ?? obj.id ?? null)
  }
  const s = String(v)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const ts = Date.parse(s)
    if (!Number.isNaN(ts)) return ts
  }
  return s.toLowerCase()
}

const compareSortValues = (a: unknown, b: unknown): number => {
  const av = comparableSortValue(a)
  const bv = comparableSortValue(b)
  if (av == null && bv == null) return 0
  if (av == null) return -1
  if (bv == null) return 1
  if (typeof av === 'number' && typeof bv === 'number') return av - bv
  return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
}

// ---------------------------------------------------------------------------
// Calendar helpers — date fields offered as calendar sources. Names are
// dot-paths (the server view-presets convention, e.g.
// 'scheduling.scheduledPublish'); group/tab/row/collapsible containers are
// walked, array/blocks rows are skipped (per-row dates aren't calendar-usable).
// ---------------------------------------------------------------------------

type DateFieldOption = { name: string; label: string; type: 'date' }

const collectDateFieldOptions = (
  fields: ClientField[],
  prefix = '',
  labelPrefix = '',
): DateFieldOption[] => {
  const out: DateFieldOption[] = []
  for (const f of fields) {
    if (f.admin?.hidden) continue
    if (f.type === 'date' && f.name) {
      out.push({ name: prefix + f.name, label: labelPrefix + getFieldLabel(f), type: 'date' })
      continue
    }
    if (f.type === 'group') {
      const sub = (f as { fields?: ClientField[] }).fields ?? []
      // Named groups nest the data path; unnamed groups are presentational
      if (f.name) {
        out.push(
          ...collectDateFieldOptions(sub, `${prefix}${f.name}.`, `${labelPrefix}${getFieldLabel(f)} › `),
        )
      } else {
        out.push(...collectDateFieldOptions(sub, prefix, labelPrefix))
      }
      continue
    }
    if (f.type === 'row' || f.type === 'collapsible') {
      const sub = (f as { fields?: ClientField[] }).fields ?? []
      out.push(...collectDateFieldOptions(sub, prefix, labelPrefix))
      continue
    }
    if (f.type === 'tabs') {
      const tabs =
        (f as { tabs?: Array<{ name?: string; fields?: ClientField[] }> }).tabs ?? []
      for (const tab of tabs) {
        out.push(
          ...collectDateFieldOptions(
            tab.fields ?? [],
            tab.name ? `${prefix}${tab.name}.` : prefix,
            labelPrefix,
          ),
        )
      }
    }
  }
  return out
}

/** Eligible kanban status fields: plain selects (hasMany false) and radios. */
const isEligibleStatusField = (f: ClientField): boolean => {
  if (!f.name || f.admin?.hidden) return false
  if (f.type === 'select') {
    const sel = f as ClientSelectField
    return !sel.hasMany && Array.isArray(sel.options) && sel.options.length > 0
  }
  if (f.type === 'radio') {
    const rad = f as { options?: unknown[] }
    return Array.isArray(rad.options) && rad.options.length > 0
  }
  return false
}

// ---------------------------------------------------------------------------
// Selection action bar — native SwiftUI buttons with Pressable fallback
// ---------------------------------------------------------------------------

type SelectionActionBarProps = {
  selectedCount: number
  actions: Array<{ key: string; label: string; icon?: string; destructive?: boolean }>
  onAction: (key: string) => void
  onDone: () => void
}

const NativeButton = nativeComponents.Button
const btnStyle = nativeComponents.buttonStyle
const ctrlSize = nativeComponents.controlSize
const tintMod = nativeComponents.tint

function SelectionActionBar({ selectedCount, actions, onAction, onDone }: SelectionActionBarProps) {
  // Use native SwiftUI Button when available (iOS), Pressable fallback otherwise
  const useNative = NativeButton != null && btnStyle != null && ctrlSize != null && tintMod != null
  // Dark-mode aware bar colours (never hardcode the light palette)
  const { dark, colors: c } = useListColors()

  return (
    <View style={[selectionStyles.bar, { backgroundColor: c.background, borderBottomColor: c.hairline }]}>
      <Text style={[selectionStyles.count, { color: c.text }]}>
        {selectedCount} selected
      </Text>
      <View style={selectionStyles.actions}>
        {useNative ? (
          // ── Native SwiftUI buttons — each in its own NativeHost ────────
          <>
            {actions.map((action) => (
              <NativeHost key={action.key} matchContents>
                <NativeButton
                  label={action.label}
                  role={action.destructive ? 'destructive' : 'default'}
                  systemImage={action.icon as any}
                  onPress={() => onAction(action.key)}
                  modifiers={[
                    btnStyle('borderedProminent'),
                    ctrlSize('regular'),
                    ...(action.destructive ? [] : [tintMod('#007AFF')]),
                  ]}
                />
              </NativeHost>
            ))}
            <NativeHost matchContents>
              <NativeButton
                label="Done"
                role="cancel"
                onPress={onDone}
                modifiers={[
                  btnStyle('bordered'),
                  ctrlSize('regular'),
                ]}
              />
            </NativeHost>
          </>
        ) : (
          // ── Pressable fallback (Android / @expo/ui unavailable) ─────────
          <>
            {actions.map((action) => (
              <Pressable
                key={action.key}
                style={[
                  selectionStyles.actionBtn,
                  action.destructive && selectionStyles.actionBtnDestructive,
                ]}
                onPress={() => onAction(action.key)}
              >
                <Text style={selectionStyles.actionLabel}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[selectionStyles.cancelBtn, { backgroundColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}
              onPress={onDone}
            >
              <Text style={[selectionStyles.cancelLabel, { color: c.text }]}>Done</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CollectionDocumentsScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const headerScrollY = useHeaderScrollY()
  const scrollHandler = useMemo(
    () =>
      RNAnimated.event(
        [{ nativeEvent: { contentOffset: { y: headerScrollY } } }],
        { useNativeDriver: true },
      ),
    [headerScrollY],
  )
  const router = useRouter()
  const menuModel = useMenuModel()
  const schema = useAdminSchema()
  const headerHeight = useHeaderHeight()
  const toast = useToast()
  const isPreview = useIsPreview()
  const [searchText, setSearchText] = useState('')
  const { showSidebar } = useResponsive()
  // Dark-mode aware palette for the screen chrome / table rows
  const { colors: tc } = useListColors()
  // iOS native header toolbar only when the experimental API exists;
  // otherwise (and on Android) the headerRight fallback below renders.
  const useNativeHeaderToolbar = Platform.OS === 'ios' && hasStackToolbar

  const baseURL = useBaseURL()
  const { token } = useAuth()

  const label = menuModel ? getCollectionLabel(menuModel, slug, true) : slug
  const schemaMap = schema?.collections[slug]
  const collectionMeta = menuModel?.collections.find((c) => c.slug === slug)
  const useAsTitle = collectionMeta?.useAsTitle
  const hasDrafts = collectionMeta?.drafts ?? false

  // Custom list actions from the admin schema + action handler registry
  const listActions = collectionMeta?.listActions ?? []
  const listHandlers = useListActionHandlers(slug)
  // Transpiled custom components — provide labels extracted from web components
  const componentRegistry = useCustomComponentRegistry()
  const listActionEntries = componentRegistry?.listActions?.[slug] ?? []

  // Merge action metadata with labels from transpiled components.
  // Component label takes precedence (single source of truth: the Payload custom component).
  const resolvedListActions = useMemo(
    () =>
      listActions.map((action, i) => ({
        ...action,
        label: listActionEntries[i]?.label ?? action.label,
      })),
    [listActions, listActionEntries],
  )

  // Multi-select state for bulk actions
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  // Bulk edit (web EditMany parity) — generic, available for every collection
  const [bulkEditOpen, setBulkEditOpen] = useState(false)

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id],
    )
  }, [])

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds([])
  }, [])

  const openBulkEdit = useCallback(() => {
    if (selectedIds.length === 0) {
      Alert.alert('No Selection', 'Select one or more items to edit.')
      return
    }
    setBulkEditOpen(true)
  }, [selectedIds.length])

  // Always use local data — reactive, instant updates
  const localDB = useLocalDB()
  const { isReady } = useLocalDBStatus()
  const localResult = useLocalCollection(localDB, slug)
  const { remove } = useLocalMutations(localDB, slug)

  // Stable reference for localData — prevents DocumentList from re-rendering
  // on every parent render. Only changes when the actual data changes.
  const localData = useMemo(() => ({
    docs: localResult.docs as Record<string, unknown>[],
    totalDocs: localResult.totalDocs,
    loading: localResult.loading || !isReady,
    refetch: localResult.refetch,
  }), [localResult.docs, localResult.totalDocs, localResult.loading, isReady, localResult.refetch])

  // Persisted summary field selection
  const [summaryFields, setSummaryFields] = useState<string[]>([])
  const [summaryPickerOpen, setSummaryPickerOpen] = useState(false)
  const [filterSheetOpen, setFilterSheetOpen] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(SUMMARY_FIELDS_KEY_PREFIX + slug)
      .then((val) => {
        if (val) setSummaryFields(JSON.parse(val))
      })
      .catch(() => {})
  }, [slug])

  const handleSummaryFieldsChange = useCallback(
    (fields: string[]) => {
      setSummaryFields(fields)
      AsyncStorage.setItem(SUMMARY_FIELDS_KEY_PREFIX + slug, JSON.stringify(fields)).catch(() => {})
    },
    [slug],
  )

  // ── Sort — native toolbar menu (iOS) driving DocumentList's controlled
  // sort/onSortChange props; persisted per collection (shared key with the
  // package's internal sort so Android stays in sync) ─────────────────────
  const rootFields = useMemo(
    () => (schemaMap ? extractRootFields(schemaMap, slug) : []),
    [schemaMap, slug],
  )
  const sortableFields = useMemo(() => getSortableFields(rootFields), [rootFields])

  const [sort, setSort] = useState<DocumentListSort | null>(null)

  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem(SORT_KEY_PREFIX + slug)
      .then((val) => {
        if (cancelled || !val) return
        try {
          const parsed = JSON.parse(val) as DocumentListSort
          if (
            parsed &&
            typeof parsed.field === 'string' &&
            (parsed.direction === 'asc' || parsed.direction === 'desc')
          ) {
            setSort(parsed)
          }
        } catch {
          /* corrupt entry — ignore */
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [slug])

  const effectiveSort = useMemo<DocumentListSort>(() => {
    if (!sort) return DEFAULT_SORT
    // Persisted field may no longer exist in the schema — fall back safely
    if (sortableFields.length > 0 && !sortableFields.some((f) => f.name === sort.field)) {
      return DEFAULT_SORT
    }
    return sort
  }, [sort, sortableFields])

  const handleSortChange = useCallback(
    (s: DocumentListSort) => {
      setSort(s)
      AsyncStorage.setItem(SORT_KEY_PREFIX + slug, JSON.stringify(s)).catch(() => {})
    },
    [slug],
  )

  const handleSortFieldPress = useCallback(
    (fieldName: string, fieldType?: string) => {
      const next: DocumentListSort =
        effectiveSort.field === fieldName
          ? { field: fieldName, direction: effectiveSort.direction === 'asc' ? 'desc' : 'asc' }
          : { field: fieldName, direction: fieldType === 'date' ? 'desc' : 'asc' }
      handleSortChange(next)
    },
    [effectiveSort, handleSortChange],
  )

  // ── Table pin preferences — sticky header band + frozen title column.
  // Both default ON; flipped via the list settings sheet's pin toggles
  // (DocumentList → onTablePinsChange), persisted per collection. ──────────
  const [tablePins, setTablePins] = useState<TablePins>(DEFAULT_TABLE_PINS)

  useEffect(() => {
    let cancelled = false
    AsyncStorage.getItem(TABLE_PINS_KEY_PREFIX + slug)
      .then((val) => {
        if (cancelled) return
        if (!val) {
          setTablePins(DEFAULT_TABLE_PINS)
          return
        }
        try {
          const parsed = JSON.parse(val) as Partial<TablePins>
          setTablePins({
            header: parsed.header !== false,
            firstColumn: parsed.firstColumn !== false,
          })
        } catch {
          /* corrupt entry — keep defaults */
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [slug])

  const handleTablePinsChange = useCallback(
    (pins: TablePins) => {
      setTablePins(pins)
      AsyncStorage.setItem(TABLE_PINS_KEY_PREFIX + slug, JSON.stringify(pins)).catch(() => {})
    },
    [slug],
  )

  // ── Kanban view — per-collection view mode + board config ──────────────
  const [viewMode, setViewMode] = useListViewMode(slug)
  const { config: kanbanConfig, setConfig: setKanbanConfig } = useKanbanConfig(slug)
  const [kanbanCustomizeOpen, setKanbanCustomizeOpen] = useState(false)

  const statusFieldCandidates = useMemo(
    () => rootFields.filter(isEligibleStatusField),
    [rootFields],
  )
  const kanbanAvailable = statusFieldCandidates.length > 0

  // Configured status field, falling back to the first eligible one when the
  // stored name no longer exists in the schema.
  const activeStatusFieldDef = useMemo(() => {
    if (statusFieldCandidates.length === 0) return null
    const configured = kanbanConfig.statusField
      ? statusFieldCandidates.find((f) => f.name === kanbanConfig.statusField)
      : undefined
    return configured ?? statusFieldCandidates[0]
  }, [statusFieldCandidates, kanbanConfig.statusField])

  const kanbanStatusField = useMemo<KanbanStatusField | null>(() => {
    if (!activeStatusFieldDef?.name) return null
    const rawOptions = (activeStatusFieldDef as ClientSelectField).options ?? []
    return {
      name: activeStatusFieldDef.name,
      label: getFieldLabel(activeStatusFieldDef),
      options: rawOptions.map(normalizeOption),
    }
  }, [activeStatusFieldDef])

  const isKanban = viewMode === 'kanban' && kanbanAvailable && kanbanStatusField != null

  // ── Calendar view — per-collection config + date-field candidates ──────
  const { config: calendarConfig, setConfig: setCalendarConfig } = useCalendarConfig(slug)
  const [calendarCustomizeOpen, setCalendarCustomizeOpen] = useState(false)

  const dateFieldOptions = useMemo(() => collectDateFieldOptions(rootFields), [rootFields])
  // Eligible only with >=1 REAL date field — Payload bookkeeping dates
  // (createdAt/updatedAt, auth resetPasswordExpiration/lockUntil) don't
  // count, so e.g. Users offers no Calendar at all.
  const calendarAvailable = collectionHasCalendarDateFields(dateFieldOptions)
  const isCalendar = viewMode === 'calendar' && calendarAvailable

  // Effective sources: explicit config, else heuristic defaults over the
  // collection's date fields (range pairs + point sources, palette colours)
  const calendarSources = useMemo(
    () => calendarConfig.sources ?? pickDefaultSources(dateFieldOptions),
    [calendarConfig.sources, dateFieldOptions],
  )

  // Mode shown by the calendar: a session override on top of the persisted
  // defaultMode (reset when a new config/preset arrives so its default wins)
  const [calendarModeOverride, setCalendarModeOverride] = useState<CalendarMode | null>(null)
  const calendarMode: CalendarMode = calendarModeOverride ?? calendarConfig.defaultMode
  const [calendarDate, setCalendarDate] = useState<string>(() => todayDateKey())

  const handleSaveCalendarConfig = useCallback(
    (next: CalendarConfig) => {
      setCalendarConfig(next)
      setCalendarModeOverride(null)
    },
    [setCalendarConfig],
  )

  // ── Gantt view — per-collection config; SAME eligibility gate as the
  // calendar (>=1 real date field — range pairs preferred, single-date
  // point sources allowed) ────────────────────────────────────────────────
  const { config: ganttConfig, setConfig: setGanttConfig } = useGanttConfig(slug)
  const [ganttCustomizeOpen, setGanttCustomizeOpen] = useState(false)
  const ganttAvailable = calendarAvailable
  const isGantt = viewMode === 'gantt' && ganttAvailable

  // Effective sources: explicit config, else the same heuristic defaults the
  // calendar uses (range pairs + point sources, palette colours)
  const ganttSources = useMemo(
    () => ganttConfig.sources ?? pickDefaultSources(dateFieldOptions),
    [ganttConfig.sources, dateFieldOptions],
  )

  const handleViewModeChange = useCallback(
    (mode: ListViewMode) => {
      // Selection mode + swipe-delete are table-only surfaces
      if (mode !== 'table') exitSelectionMode()
      setViewMode(mode)
    },
    [exitSelectionMode, setViewMode],
  )

  // Android header cycles through the available view modes; iOS uses the
  // native toolbar menu instead.
  const normalizedViewMode: ListViewMode = isKanban
    ? 'kanban'
    : isCalendar
      ? 'calendar'
      : isGantt
        ? 'gantt'
        : 'table'
  const availableViewModes = useMemo<ListViewMode[]>(
    () => [
      'table',
      ...(kanbanAvailable ? (['kanban'] as ListViewMode[]) : []),
      ...(calendarAvailable ? (['calendar'] as ListViewMode[]) : []),
      ...(ganttAvailable ? (['gantt'] as ListViewMode[]) : []),
    ],
    [kanbanAvailable, calendarAvailable, ganttAvailable],
  )
  const nextViewMode: ListViewMode =
    availableViewModes[
      (availableViewModes.indexOf(normalizedViewMode) + 1) % availableViewModes.length
    ]

  // Display labels for card field rows
  const kanbanFieldLabels = useMemo(() => {
    const labels: Record<string, string> = {}
    for (const f of rootFields) {
      if (f.name) labels[f.name] = getFieldLabel(f)
    }
    return labels
  }, [rootFields])

  // Fields offered in the customize sheet's card-fields multi-select
  const cardFieldCandidates = useMemo(
    () =>
      rootFields.filter(
        (f) =>
          f.name &&
          !['id', 'createdAt', 'updatedAt'].includes(f.name) &&
          KANBAN_CARD_FIELD_TYPES.has(f.type),
      ),
    [rootFields],
  )

  // ── Kanban/calendar/gantt search/filters — screen-hosted instance of the
  // same pipeline DocumentList runs internally in table mode (chips + sheet +
  // where). All overlay views share this one instance ──
  const {
    searchText: kanbanSearchText,
    setSearchText: setKanbanSearchText,
    filters: kanbanFilters,
    addFilter: addKanbanFilter,
    updateFilter: updateKanbanFilter,
    removeFilter: removeKanbanFilter,
    setFilterGroups: setKanbanFilterGroups,
    clearAllFilters: clearKanbanFilters,
    whereQuery: kanbanWhereQuery,
    hasActiveFilters: kanbanHasActiveFilters,
  } = useDocumentListFilters({ searchFields: useAsTitle ? [useAsTitle] : undefined })

  // Native header search bar feeds both modes
  useEffect(() => {
    setKanbanSearchText(searchText)
  }, [searchText, setKanbanSearchText])

  const [kanbanEditingFilter, setKanbanEditingFilter] = useState<ActiveFilter | null>(null)
  const [kanbanFilterInternalOpen, setKanbanFilterInternalOpen] = useState(false)
  const closeKanbanFilterSheet = useCallback(() => {
    setKanbanFilterInternalOpen(false)
    setKanbanEditingFilter(null)
    setFilterSheetOpen(false)
  }, [])

  // ── View presets — save/share/apply the whole view (mode + board config +
  // filters). Table-mode filters live inside DocumentList; it reports them
  // up via onFiltersChange and accepts preset filters via appliedFilters. ──
  const [presetsSheetOpen, setPresetsSheetOpen] = useState(false)
  const [tableFilters, setTableFilters] = useState<ActiveFilter[]>([])
  const [appliedTableFilters, setAppliedTableFilters] = useState<{
    epoch: number
    groups: FilterCondition[][]
  }>({ epoch: 0, groups: [] })

  // Structured filters of the ACTIVE mode as a Payload where (search excluded)
  const presetWhere = useMemo(
    () =>
      (filtersToWhere(isKanban || isCalendar || isGantt ? kanbanFilters : tableFilters) as
        | Record<string, unknown>
        | undefined) ?? null,
    [isKanban, isCalendar, isGantt, kanbanFilters, tableFilters],
  )

  // Calendar state lifted into new/updated presets (RESOLVED sources +
  // the mode currently shown, so "save current" captures what you see)
  const currentCalendarSnapshot = useMemo<CalendarConfig>(
    () => ({ sources: calendarSources, defaultMode: calendarMode }),
    [calendarSources, calendarMode],
  )

  // Gantt state lifted into new/updated presets (RESOLVED sources; pxPerDay/
  // rowSort stay null unless customised — null lifts as "client default")
  const currentGanttSnapshot = useMemo<GanttConfig>(
    () => ({ sources: ganttSources, pxPerDay: ganttConfig.pxPerDay, rowSort: ganttConfig.rowSort }),
    [ganttSources, ganttConfig.pxPerDay, ganttConfig.rowSort],
  )

  const handleApplyPreset = useCallback(
    (preset: ViewPresetDoc) => {
      const targetMode: ListViewMode =
        preset.viewType === 'kanban' && kanbanAvailable
          ? 'kanban'
          : preset.viewType === 'calendar' && calendarAvailable
            ? 'calendar'
            : preset.viewType === 'gantt' && ganttAvailable
              ? 'gantt'
              : 'table'
      handleViewModeChange(targetMode)
      setKanbanConfig(presetToKanbanConfig(preset))
      setCalendarConfig(presetToCalendarConfig(preset))
      setGanttConfig(presetToGanttConfig(preset))
      // Let the preset's calendarDefaultMode take effect immediately
      setCalendarModeOverride(null)
      // Apply the preset's where to BOTH filter pipelines (kanban/calendar
      // hook here, DocumentList's internal hook via the epoch-bumped prop)
      const { groups, unsupported } = whereToFilterGroups(preset.where ?? undefined, rootFields)
      setKanbanFilterGroups(groups)
      setAppliedTableFilters((prev) => ({ epoch: prev.epoch + 1, groups }))
      setPresetsSheetOpen(false)
      if (unsupported.length > 0) {
        toast.showToast(
          `Applied "${preset.title}" — some filters can't run on-device (${unsupported.join(', ')})`,
          { type: 'info', duration: 4000 },
        )
      } else {
        toast.showToast(`Applied "${preset.title}"`, { type: 'success', duration: 2000 })
      }
    },
    [kanbanAvailable, calendarAvailable, ganttAvailable, handleViewModeChange, setKanbanConfig, setCalendarConfig, setGanttConfig, rootFields, setKanbanFilterGroups, toast],
  )

  // Same local-first source the table uses, filtered + sorted client-side
  // (feeds the kanban board, the calendar AND the gantt). In gantt mode a
  // configured ganttOptions.rowSort (dot-path, ascending) overrides the
  // list sort — that's the server preset convention for row ordering.
  const boardDocs = useMemo(() => {
    if (!isKanban && !isCalendar && !isGantt) return EMPTY_DOCS
    const filtered = applyWhereToDocs(
      localData.docs,
      kanbanWhereQuery as Record<string, unknown> | undefined,
    )
    const ganttRowSort = isGantt ? ganttConfig.rowSort : null
    const sortField = ganttRowSort ?? effectiveSort.field
    const dir = ganttRowSort ? 1 : effectiveSort.direction === 'desc' ? -1 : 1
    return [...filtered].sort(
      (a, b) =>
        dir * compareSortValues(getByPath(a, sortField), getByPath(b, sortField)),
    )
  }, [isKanban, isCalendar, isGantt, ganttConfig.rowSort, localData.docs, kanbanWhereQuery, effectiveSort])

  // ── Card moves — optimistic local-first patch via validated mutations ──
  const { update: validatedUpdate } = useValidatedMutations(localDB, slug, rootFields)
  const [movingDocIds, setMovingDocIds] = useState<string[]>([])

  const handleMoveCard = useCallback(
    async (doc: Record<string, unknown>, toValue: string | null) => {
      if (!kanbanStatusField) return
      const id = String(doc.id)
      setMovingDocIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      try {
        const result = await validatedUpdate(id, { [kanbanStatusField.name]: toValue }, doc)
        if (result.success === false) {
          const firstError = result.errors._form ?? Object.values(result.errors)[0]
          toast.showToast(
            typeof firstError === 'string' ? firstError : 'Move failed',
            { type: 'error', icon: 'error' },
          )
        }
      } catch {
        toast.showToast('Move failed', { type: 'error', icon: 'error' })
      } finally {
        setMovingDocIds((prev) => prev.filter((x) => x !== id))
      }
    },
    [kanbanStatusField, validatedUpdate, toast],
  )

  // ── Gantt date edits — optimistic local-first patch via the same validated
  // mutation pipeline. Fired ONCE per completed drag with day-snapped ISO
  // datetimes; bars derive purely from docs, so a validation failure simply
  // re-renders the old dates (spring-back) after the toast. ──
  const handleGanttUpdateDates = useCallback(
    async (
      doc: Record<string, unknown>,
      source: CalendarSource,
      next: { start: string; end: string },
    ) => {
      const id = String(doc.id)
      setMovingDocIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      try {
        // Dot-path WRITES mirror the calendar's dot-path reads (getByPath):
        // nested paths patch their whole root key via setByPath — RxDB's
        // incrementalPatch merges top-level keys only, so the rebuilt root
        // object keeps sibling fields intact while a plain 'a.b' key would
        // land as a literal dotted property.
        const patch: Record<string, unknown> = {}
        const writeField = (path: string, value: string) => {
          if (!path.includes('.')) {
            patch[path] = value
            return
          }
          const root = path.split('.')[0]
          // Seed from the patch-so-far so start+end under the same root
          // (e.g. scheduling.start / scheduling.end) compose, else the doc.
          const base = { [root]: root in patch ? patch[root] : doc[root] }
          patch[root] = setByPath(base, path, value)[root]
        }
        writeField(source.startField, next.start)
        // Point sources (no endField) write only the start — GanttBar already
        // disables resize for them (bar.point), so next.end mirrors next.start.
        if (source.endField) writeField(source.endField, next.end)
        const result = await validatedUpdate(id, patch, doc)
        if (result.success === false) {
          const firstError = result.errors._form ?? Object.values(result.errors)[0]
          toast.showToast(
            typeof firstError === 'string' ? firstError : 'Date update failed',
            { type: 'error', icon: 'error' },
          )
        }
      } catch {
        toast.showToast('Date update failed', { type: 'error', icon: 'error' })
      } finally {
        setMovingDocIds((prev) => prev.filter((x) => x !== id))
      }
    },
    [validatedUpdate, toast],
  )

  // --- Swipe to delete + shake to undo ---
  const lastDeletedRef = useRef<{ id: string; data: Record<string, unknown> } | null>(null)

  const handleDelete = useCallback(
    async (doc: Record<string, unknown>) => {
      const id = String(doc.id)
      // Stash the doc data for undo
      lastDeletedRef.current = { id, data: { ...doc } }
      await remove(id)
      toast.showToast('Deleted — shake to undo', { type: 'info', icon: 'delete', duration: 4000 })
    },
    [remove, toast],
  )

  // Shake to undo: listen for device motion and detect shake gesture
  useEffect(() => {
    if (isPreview) return

    let lastShake = 0
    const sub = DeviceMotion.addListener(({ acceleration }) => {
      if (!acceleration) return
      const mag = Math.sqrt(
        (acceleration.x ?? 0) ** 2 +
        (acceleration.y ?? 0) ** 2 +
        (acceleration.z ?? 0) ** 2,
      )
      const now = Date.now()
      if (mag > SHAKE_THRESHOLD && now - lastShake > 2000) {
        lastShake = now
        const deleted = lastDeletedRef.current
        if (deleted) {
          lastDeletedRef.current = null
          // Re-insert the deleted document
          const col = localDB?.collections[slug]
          if (col) {
            const { _deleted, _rev, _meta, _attachments, _locallyModified, ...cleanData } = deleted.data as any
            col.upsert({
              ...cleanData,
              id: deleted.id,
              _deleted: false,
              _locallyModified: true,
              updatedAt: new Date().toISOString(),
            } as any).then(() => {
              toast.showToast('Undo successful', { type: 'success', icon: 'undo', duration: 2000 })
            }).catch(() => {
              toast.showToast('Undo failed', { type: 'error', icon: 'undo' })
            })
          }
        }
      }
    })

    DeviceMotion.setUpdateInterval(100)

    return () => sub.remove()
  }, [isPreview, localDB, slug, toast])

  // Preview dimensions
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const PREVIEW_W = Math.round(windowWidth * 0.92)
  const PREVIEW_H = Math.round(windowHeight * 0.65)
  const noopSubmit = useCallback(async () => {}, [])

  // Track which item's preview is open so only ONE DocumentForm
  // is mounted at a time (not one per row — that was killing perf).
  const [previewItemId, setPreviewItemId] = useState<string | null>(null)

  // Board preview (kanban cards AND gantt bars) — opened by a STATIC
  // long-press (hold, release without moving; the PanResponder drag and the
  // preview share the long-press, disambiguated by finger travel) or from
  // the kanban card's ellipsis menu ("Preview"). Cards/bars are NOT wrapped
  // in ScrollablePreview.Trigger: the module's raw
  // UILongPressGestureRecognizer (0.35s) claims long-press at the UIKit
  // layer before the Pressable that drives drag-or-peek, so preview is a
  // pure-JS BottomSheet + read-only DocumentForm (same inline pattern as the
  // relationship picker, memory-bank 013).
  const [boardPreviewDoc, setBoardPreviewDoc] = useState<Record<string, unknown> | null>(null)

  const renderRow = useCallback(
    ({ item, rowContent }: { item: Record<string, unknown>; rowContent: React.ReactElement; onPress: () => void }) => {
      const itemId = String(item.id)
      const isThisPreviewOpen = previewItemId === itemId
      const isSelected = selectedIds.includes(itemId)

      // Wrap row content with a selection checkbox when in selection mode
      const wrapWithSelection = (content: React.ReactElement) => {
        if (!selectionMode) return content
        return (
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center' }}
            onPress={() => toggleSelection(itemId)}
          >
            <View style={{
              width: 24, height: 24, borderRadius: 12,
              borderWidth: 2, borderColor: isSelected ? '#007AFF' : tc.tertiary,
              backgroundColor: isSelected ? '#007AFF' : 'transparent',
              alignItems: 'center', justifyContent: 'center',
              marginRight: 10, marginLeft: 4,
            }}>
              {isSelected && <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{'\u2713'}</Text>}
            </View>
            <View style={{ flex: 1 }}>{content}</View>
          </Pressable>
        )
      }

      // rowContent comes fully formed from DocumentList — phone card or
      // (tableMode) frozen-title table row; no screen-side row markup.

      // In selection mode: tap toggles selection instead of navigating
      // (swipe-to-delete is disabled — rows render without the wrapper)
      if (selectionMode) {
        return wrapWithSelection(rowContent)
      }

      // Swipe-to-delete wraps OUTSIDE the peek trigger: the revealed Delete
      // button must never sit inside the trigger's native tap/long-press
      // recognizer subtree, and the trigger (with its long-press peek)
      // translates as part of the swiped content. The confirm dialog lives
      // in SwipeToDeleteRow; delete flows through the same local-first
      // handleDelete (shake-to-undo toast preserved).
      return (
        <SwipeToDeleteRow
          onDelete={() => handleDelete(item)}
          confirmTitle="Delete"
          confirmMessage="Are you sure?"
          actionStyle={showSidebar ? undefined : PHONE_SWIPE_ACTION_STYLE}
        >
          <ScrollablePreview.Trigger
            previewWidth={PREVIEW_W}
            previewHeight={PREVIEW_H}
            onPrimaryAction={() => {
              // A tap while a swipe row is open just closes it
              if (closeOpenSwipeRow()) return
              if (!isPreview) router.push(`/(admin)/collections/${slug}/${itemId}`)
            }}
            onPreviewOpen={() => setPreviewItemId(itemId)}
            onPreviewClose={() => setPreviewItemId(null)}
          >
            {rowContent}
            <ScrollablePreview.Content>
              <PreviewContextProvider value={true}>
                {schemaMap && isThisPreviewOpen ? (
                  <DocumentForm
                    schemaMap={schemaMap}
                    slug={slug}
                    initialData={item}
                    onSubmit={noopSubmit}
                    disabled
                    // Preview content mounts in an unsized native container —
                    // a zero-height SwiftUI Form swallows touches.
                    nativeForm={false}
                  />
                ) : null}
              </PreviewContextProvider>
            </ScrollablePreview.Content>
            <ScrollablePreview.Action
              title="Open"
              icon="doc.text"
              onActionPress={() => {
                if (!isPreview) router.push(`/(admin)/collections/${slug}/${itemId}`)
              }}
            />
            <ScrollablePreview.Action
              title="Delete"
              icon="trash"
              destructive
              onActionPress={() => {
                Alert.alert('Delete', 'Are you sure?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
                ])
              }}
            />
          </ScrollablePreview.Trigger>
        </SwipeToDeleteRow>
      )
    },
    [slug, handleDelete, schemaMap, noopSubmit, isPreview, router, PREVIEW_W, PREVIEW_H, previewItemId, showSidebar, selectionMode, selectedIds, toggleSelection, tc],
  )

  // ── Calendar row wrapper — long-press peek via ScrollablePreview.Trigger
  // (same pattern as list rows). NOT used for kanban cards: the trigger's
  // native UILongPressGestureRecognizer would steal the long-press that
  // drives the board's PanResponder drag-or-peek (cards preview via a
  // static long-press or the ellipsis menu instead — see boardPreviewDoc
  // above). Tap can fire from both the trigger's primary action and the
  // inner row's Pressable — the timestamp guard collapses doubles. ──
  const lastNavRef = useRef(0)
  const navigateToDoc = useCallback(
    (id: string) => {
      if (isPreview) return
      const now = Date.now()
      if (now - lastNavRef.current < 600) return
      lastNavRef.current = now
      router.push(`/(admin)/collections/${slug}/${id}`)
    },
    [isPreview, router, slug],
  )

  const renderDocWithPeek = useCallback(
    (doc: Record<string, unknown>, defaultCard: React.ReactElement) => {
      const itemId = String(doc.id)
      const isThisPreviewOpen = previewItemId === itemId
      return (
        <ScrollablePreview.Trigger
          previewWidth={PREVIEW_W}
          previewHeight={PREVIEW_H}
          onPrimaryAction={() => navigateToDoc(itemId)}
          onPreviewOpen={() => setPreviewItemId(itemId)}
          onPreviewClose={() => setPreviewItemId(null)}
        >
          {defaultCard}
          <ScrollablePreview.Content>
            <PreviewContextProvider value={true}>
              {schemaMap && isThisPreviewOpen ? (
                <DocumentForm
                  schemaMap={schemaMap}
                  slug={slug}
                  initialData={doc}
                  onSubmit={noopSubmit}
                  disabled
                  // Preview content mounts in an unsized native container —
                  // a zero-height SwiftUI Form swallows touches.
                  nativeForm={false}
                />
              ) : null}
            </PreviewContextProvider>
          </ScrollablePreview.Content>
          <ScrollablePreview.Action
            title="Open"
            icon="doc.text"
            onActionPress={() => navigateToDoc(itemId)}
          />
          <ScrollablePreview.Action
            title="Delete"
            icon="trash"
            destructive
            onActionPress={() => {
              Alert.alert('Delete', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => handleDelete(doc) },
              ])
            }}
          />
        </ScrollablePreview.Trigger>
      )
    },
    [previewItemId, PREVIEW_W, PREVIEW_H, navigateToDoc, schemaMap, slug, noopSubmit, handleDelete],
  )

  // ── Scan-to-lookup — toolbar scanner popup resolving barcode/QR payloads
  // to documents (local-first with REST fallback, see useScanLookup).
  // 'found' navigates through the SAME double-nav guard rows use;
  // 'multiple' closes the scanner and opens a picker sheet; 'none' toasts
  // and KEEPS the scanner open for an immediate retry. ─────────────────────
  const [scanOpen, setScanOpen] = useState(false)
  const [scanMatches, setScanMatches] = useState<Record<string, unknown>[] | null>(null)
  const { resolveScannedCode } = useScanLookup()

  const handleScanned = useCallback(
    async (value: string) => {
      const res = await resolveScannedCode(slug, value)
      if (res.status === 'found') {
        setScanOpen(false)
        navigateToDoc(String(res.doc.id))
      } else if (res.status === 'multiple') {
        setScanOpen(false)
        setScanMatches(res.docs)
      } else {
        toast.showToast(`No match for "${value}"`, { type: 'error' })
      }
    },
    [resolveScannedCode, slug, navigateToDoc, toast],
  )

  return (
    <View style={{ flex: 1, backgroundColor: tc.background, width: '100%' }}>
      {!isPreview && (
        <>
          <Stack.Screen
            options={{
              title: label,
              // Android path AND the iOS fallback whenever the experimental
              // Stack.Toolbar pipeline is unavailable — the create '+' (and
              // friends) must never depend solely on an unstable native API.
              ...(!useNativeHeaderToolbar ? {
                headerRight: () => (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 4 }}>
                    {/* Scan-to-lookup — mirrors the native toolbar's first item */}
                    <Pressable
                      onPress={() => setScanOpen(true)}
                      hitSlop={8}
                      accessibilityLabel="Scan code"
                    >
                      <QrCode size={22} color={tc.text} />
                    </Pressable>
                    {/* View presets — save/share/apply saved views */}
                    <Pressable onPress={() => setPresetsSheetOpen(true)} hitSlop={8}>
                      <Bookmark size={22} color={tc.text} />
                    </Pressable>
                    {/* View toggle — cycles table → kanban → calendar → gantt
                        (only through the modes this collection supports); the
                        icon shows the NEXT mode, before the action icons */}
                    {availableViewModes.length > 1 && (
                      <Pressable
                        onPress={() => handleViewModeChange(nextViewMode)}
                        hitSlop={8}
                      >
                        {nextViewMode === 'kanban' ? (
                          <SquareKanban size={22} color={tc.text} />
                        ) : nextViewMode === 'calendar' ? (
                          <CalendarDays size={22} color={tc.text} />
                        ) : nextViewMode === 'gantt' ? (
                          <ChartGantt size={22} color={tc.text} />
                        ) : (
                          <Table2 size={22} color={tc.text} />
                        )}
                      </Pressable>
                    )}
                    {/* Selection mode is a table-only surface */}
                    {!isKanban && !isCalendar && !isGantt && (
                      <Pressable
                        onPress={() => setSelectionMode(!selectionMode)}
                        hitSlop={8}
                      >
                        <CheckSquare size={22} color={selectionMode ? '#007AFF' : tc.text} />
                      </Pressable>
                    )}
                    <Pressable
                      onPress={() =>
                        isKanban
                          ? setKanbanCustomizeOpen(true)
                          : isCalendar
                            ? setCalendarCustomizeOpen(true)
                            : isGantt
                              ? setGanttCustomizeOpen(true)
                              : setSummaryPickerOpen(true)
                      }
                      hitSlop={8}
                    >
                      <Settings size={22} color={tc.text} />
                    </Pressable>
                    <Pressable onPress={() => setFilterSheetOpen(true)} hitSlop={8}>
                      <Filter size={22} color={tc.text} />
                    </Pressable>
                    <Pressable onPress={() => router.push(`/(admin)/collections/${slug}/create`)} hitSlop={8}>
                      <Plus size={22} color={tc.text} />
                    </Pressable>
                  </View>
                ),
              } : {}),
              headerSearchBarOptions: {
                placeholder: `Search ${label}...`,
                hideWhenScrolling: true,
                autoCapitalize: 'none',
                // Pin the search field BELOW the nav bar. The default
                // ('automatic') lets iPadOS integrate the search into the
                // TRAILING nav-bar area when the bar is wide enough — i.e.
                // landscape — where its container sits over the trailing
                // UIBarButtonItems and eats taps on the create '+' (the
                // rightmost item). Portrait resolves to stacked anyway, so
                // this makes landscape behave like the known-good portrait.
                // No-op on iPhone (no nav toolbar → automatic == stacked).
                placement: 'stacked',
                onChangeText: (e) => setSearchText(e.nativeEvent.text),
                onCancelButtonPress: () => setSearchText(''),
              },
            }}
          />
          {useNativeHeaderToolbar && (
            <Stack.Toolbar placement="right">
              {/* Scan-to-lookup — FIRST item of the single right toolbar
                  (sibling placement="right" toolbars override each other) */}
              <Stack.Toolbar.Button
                icon="qrcode.viewfinder"
                tintColor={tc.text}
                separateBackground
                onPress={() => setScanOpen(true)}
                accessibilityLabel="Scan code"
              />
              {/* View selector — its own group BEFORE the Actions menu.
                  Two sibling <Stack.Toolbar placement="right"> elements
                  override each other (both set unstable_headerRightItems),
                  so the group renders first inside the single toolbar with
                  separateBackground + a spacer for visual distinction. */}
              {(kanbanAvailable || calendarAvailable || ganttAvailable) && (
                <Stack.Toolbar.Menu
                  icon={
                    isCalendar
                      ? 'calendar'
                      : isGantt
                        ? 'chart.bar.doc.horizontal'
                        : isKanban
                          ? 'square.grid.2x2'
                          : 'tablecells'
                  }
                  title="View"
                  tintColor={tc.text}
                  separateBackground
                >
                  <Stack.Toolbar.MenuAction
                    icon="tablecells"
                    isOn={!isKanban && !isCalendar && !isGantt}
                    onPress={() => handleViewModeChange('table')}
                  >
                    Table
                  </Stack.Toolbar.MenuAction>
                  {kanbanAvailable && (
                    <Stack.Toolbar.MenuAction
                      icon="square.grid.2x2"
                      isOn={isKanban}
                      onPress={() => handleViewModeChange('kanban')}
                    >
                      Kanban
                    </Stack.Toolbar.MenuAction>
                  )}
                  {/* Calendar — only for collections with >=1 date field */}
                  {calendarAvailable && (
                    <Stack.Toolbar.MenuAction
                      icon="calendar"
                      isOn={isCalendar}
                      onPress={() => handleViewModeChange('calendar')}
                    >
                      Calendar
                    </Stack.Toolbar.MenuAction>
                  )}
                  {/* Gantt — same date-field gate as the calendar */}
                  {ganttAvailable && (
                    <Stack.Toolbar.MenuAction
                      icon="chart.bar.doc.horizontal"
                      isOn={isGantt}
                      onPress={() => handleViewModeChange('gantt')}
                    >
                      Gantt
                    </Stack.Toolbar.MenuAction>
                  )}
                </Stack.Toolbar.Menu>
              )}
              {/* Presets — part of the view-selector group (before Actions):
                  saved table/kanban views incl. board config + filters */}
              <Stack.Toolbar.Button
                icon="bookmark"
                tintColor={tc.text}
                separateBackground
                onPress={() => setPresetsSheetOpen(true)}
              />
              <Stack.Toolbar.Spacer width={12} />
              {/* Actions menu — selection mode, generic bulk edit, and custom
                  list actions (labels from Payload custom components) */}
              <Stack.Toolbar.Menu icon="ellipsis.circle" title="Actions" tintColor={tc.text}>
                {!selectionMode && !isKanban && !isCalendar && !isGantt && (
                  <Stack.Toolbar.MenuAction
                    icon="checkmark.circle"
                    onPress={() => setSelectionMode(true)}
                  >
                    Select Items...
                  </Stack.Toolbar.MenuAction>
                )}
                {selectionMode && (
                  <Stack.Toolbar.MenuAction
                    icon="square.and.pencil"
                    onPress={openBulkEdit}
                  >
                    Edit Selected ({selectedIds.length})
                  </Stack.Toolbar.MenuAction>
                )}
                {selectionMode && (
                  <Stack.Toolbar.MenuAction
                    icon="xmark.circle"
                    onPress={exitSelectionMode}
                  >
                    Cancel Selection ({selectedIds.length})
                  </Stack.Toolbar.MenuAction>
                )}
                {resolvedListActions.map((action) => (
                  <Stack.Toolbar.MenuAction
                    key={action.key}
                    icon={(action.icon || 'bolt') as SFSymbol}
                    onPress={() => {
                      const handler = listHandlers[action.key]
                      if (handler) {
                        handler({
                          collectionSlug: slug,
                          selectedIds,
                          allDocs: (localResult.docs ?? []) as Record<string, unknown>[],
                          localDB,
                          baseURL,
                          token,
                        })
                      }
                    }}
                  >
                    {action.label}{selectionMode && selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
                  </Stack.Toolbar.MenuAction>
                ))}
              </Stack.Toolbar.Menu>
              {/* Sort menu — schema-driven sortable fields */}
              {sortableFields.length > 0 && (
                <Stack.Toolbar.Menu icon="arrow.up.arrow.down" title="Sort By" tintColor={tc.text}>
                  {sortableFields.map((f) => (
                    <Stack.Toolbar.MenuAction
                      key={f.name}
                      isOn={effectiveSort.field === f.name}
                      icon={
                        effectiveSort.field === f.name
                          ? effectiveSort.direction === 'asc'
                            ? 'chevron.up'
                            : 'chevron.down'
                          : undefined
                      }
                      onPress={() => handleSortFieldPress(f.name!, f.type)}
                    >
                      {getFieldLabel(f)}
                    </Stack.Toolbar.MenuAction>
                  ))}
                </Stack.Toolbar.Menu>
              )}
              <Stack.Toolbar.Button
                icon="gearshape"
                tintColor={tc.text}
                onPress={() =>
                  isKanban
                    ? setKanbanCustomizeOpen(true)
                    : isCalendar
                      ? setCalendarCustomizeOpen(true)
                      : isGantt
                        ? setGanttCustomizeOpen(true)
                        : setSummaryPickerOpen(true)
                }
              />
              <Stack.Toolbar.Button
                icon="line.3.horizontal.decrease"
                tintColor={tc.text}
                onPress={() => setFilterSheetOpen(true)}
              />
              {/* Create — the trailing-most item; the stacked search-bar
                  placement above guarantees nothing overlays its hit area
                  in iPad landscape. */}
              <Stack.Toolbar.Button
                icon="plus"
                tintColor={tc.text}
                accessibilityLabel="Create"
                onPress={() => router.push(`/(admin)/collections/${slug}/create`)}
              />
            </Stack.Toolbar>
          )}
        </>
      )}
      {/* Selection mode action bar — generic Edit Selected + custom actions
          (table-mode-only, like swipe-delete) */}
      {selectionMode && !isKanban && !isCalendar && !isGantt && (
        <SelectionActionBar
          selectedCount={selectedIds.length}
          actions={[
            { key: '__bulkEdit', label: 'Edit Selected', icon: 'square.and.pencil' },
            ...resolvedListActions,
          ]}
          onAction={(actionKey) => {
            if (actionKey === '__bulkEdit') {
              openBulkEdit()
              return
            }
            const handler = listHandlers[actionKey]
            if (handler) {
              handler({
                collectionSlug: slug,
                selectedIds,
                allDocs: (localResult.docs ?? []) as Record<string, unknown>[],
                localDB,
                baseURL,
                token,
              })
            }
          }}
          onDone={exitSelectionMode}
        />
      )}
      {isKanban && kanbanStatusField ? (
        // ── Kanban board — same local-first docs, filtered + sorted like the
        // table; the toolbar search/sort/filter controls stay live above it ──
        <View style={{ flex: 1, paddingTop: headerHeight }}>
          {kanbanHasActiveFilters && (
            <View style={{ marginBottom: 4 }}>
              <FilterChips
                filters={kanbanFilters}
                searchText={kanbanSearchText}
                onRemove={removeKanbanFilter}
                onClearAll={clearKanbanFilters}
                onAddFilter={() => setKanbanFilterInternalOpen(true)}
                onEdit={(f) => {
                  setKanbanEditingFilter(f)
                  setKanbanFilterInternalOpen(true)
                }}
              />
            </View>
          )}
          <KanbanBoard
            docs={boardDocs}
            statusField={kanbanStatusField}
            columnOrder={kanbanConfig.columnOrder ?? undefined}
            columnColors={kanbanConfig.columnColors}
            hiddenColumns={kanbanConfig.hiddenColumns}
            cardFields={kanbanConfig.cardFields}
            fieldLabels={kanbanFieldLabels}
            useAsTitle={useAsTitle}
            onPressCard={(doc) => navigateToDoc(String(doc.id))}
            onMoveCard={handleMoveCard}
            // No ScrollablePreview.Trigger wrap here — its native long-press
            // recognizer kills the drag. Preview = static long-press (hold +
            // release without moving) or the ellipsis menu's "Preview".
            onPreviewCard={setBoardPreviewDoc}
            loadingDocIds={movingDocIds}
          />
        </View>
      ) : isCalendar ? (
        // ── Calendar — same local-first docs through the same screen-hosted
        // filter pipeline; sources from useCalendarConfig (defaults via
        // pickDefaultSources); native month/day views injected from the app's
        // calendar-view module with JS fallbacks inside CalendarView ──
        <View style={{ flex: 1, paddingTop: headerHeight }}>
          {kanbanHasActiveFilters && (
            <View style={{ marginBottom: 4 }}>
              <FilterChips
                filters={kanbanFilters}
                searchText={kanbanSearchText}
                onRemove={removeKanbanFilter}
                onClearAll={clearKanbanFilters}
                onAddFilter={() => setKanbanFilterInternalOpen(true)}
                onEdit={(f) => {
                  setKanbanEditingFilter(f)
                  setKanbanFilterInternalOpen(true)
                }}
              />
            </View>
          )}
          <CalendarView
            docs={boardDocs}
            sources={calendarSources}
            useAsTitle={useAsTitle}
            mode={calendarMode}
            onChangeMode={setCalendarModeOverride}
            selectedDate={calendarDate}
            onChangeSelectedDate={setCalendarDate}
            onPressDoc={(doc) => navigateToDoc(String(doc.id))}
            // Day-list rows get the same long-press peek as list rows/cards
            renderDocRow={renderDocWithPeek}
            nativeModule={calendarNativeModule}
          />
        </View>
      ) : isGantt ? (
        // ── Gantt — same local-first docs through the same screen-hosted
        // filter pipeline; sources from useGanttConfig (defaults via
        // pickDefaultSources). Drag editing lives inside GanttChart
        // (PanResponder-only); completed drags land in handleGanttUpdateDates
        // and bars spring back on failure via the docs re-render. ──
        <View style={{ flex: 1, paddingTop: headerHeight }}>
          {kanbanHasActiveFilters && (
            <View style={{ marginBottom: 4 }}>
              <FilterChips
                filters={kanbanFilters}
                searchText={kanbanSearchText}
                onRemove={removeKanbanFilter}
                onClearAll={clearKanbanFilters}
                onAddFilter={() => setKanbanFilterInternalOpen(true)}
                onEdit={(f) => {
                  setKanbanEditingFilter(f)
                  setKanbanFilterInternalOpen(true)
                }}
              />
            </View>
          )}
          <GanttChart
            docs={boardDocs}
            sources={ganttSources}
            useAsTitle={useAsTitle}
            onPressBar={(doc) => navigateToDoc(String(doc.id))}
            // No ScrollablePreview.Trigger wrap here — its native long-press
            // recognizer would pre-empt the bar's drag-or-peek hold. Preview
            // = static long-press (hold + release without moving) → the same
            // JS BottomSheet the kanban cards use.
            onPreviewDoc={setBoardPreviewDoc}
            onUpdateDates={handleGanttUpdateDates}
            readOnlyDocIds={movingDocIds}
            // Preset/config zoom; undefined → component default (28)
            pxPerDay={ganttConfig.pxPerDay ?? undefined}
          />
        </View>
      ) : (
        <DocumentList
          collection={slug}
          searchText={searchText}
          schemaMap={schemaMap}
          titleField={useAsTitle}
          searchFields={useAsTitle ? [useAsTitle] : undefined}
          onPress={(doc) => {
            if (!isPreview) router.push(`/(admin)/collections/${slug}/${doc.id as string}`)
          }}
          onDelete={handleDelete}
          renderRow={renderRow}
          summaryFields={summaryFields}
          onSummaryFieldsChange={handleSummaryFieldsChange}
          summaryPickerOpen={summaryPickerOpen}
          onSummaryPickerClose={() => setSummaryPickerOpen(false)}
          filterSheetOpen={filterSheetOpen}
          onFilterSheetClose={() => setFilterSheetOpen(false)}
          localData={localData}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          // Tablet table mode — web-admin-parity rows rendered by
          // DocumentList itself (frozen title + shared horizontal track)
          tableMode={showSidebar}
          // Pin customisation — sticky header band / frozen title column,
          // both default ON, toggled in the list settings sheet
          stickyHeader={tablePins.header}
          pinFirstColumn={tablePins.firstColumn}
          onTablePinsChange={handleTablePinsChange}
          // Native Payload query presets (payload-query-presets, REST-only)
          // in the filter sheet + view-preset filter application/lifting
          queryPresetsCollection={slug}
          appliedFilters={appliedTableFilters}
          onFiltersChange={setTableFilters}
          // iOS: sort is controlled by the native toolbar menu above.
          // Android: leave uncontrolled so DocumentList's internal sort UI
          // (persisted under the same key) keeps working.
          {...(Platform.OS === 'ios'
            ? { sort: effectiveSort, onSortChange: handleSortChange }
            : {})}
        />
      )}
      {/* Kanban/calendar/gantt filter editor — the screen hosts the same
          FilterBottomSheet DocumentList opens internally in table mode */}
      {(isKanban || isCalendar || isGantt) && (
        <FilterBottomSheet
          visible={filterSheetOpen || kanbanFilterInternalOpen}
          onClose={closeKanbanFilterSheet}
          fields={rootFields}
          initialFilter={kanbanEditingFilter}
          activeFilters={kanbanFilters}
          onRemoveFilter={removeKanbanFilter}
          // Native Payload query presets (payload-query-presets, REST-only)
          presetsCollection={slug}
          presetsColumns={summaryFields}
          onApplyFilterGroups={setKanbanFilterGroups}
          onApply={(payload) => {
            const { id, ...rest } = payload
            if (id) updateKanbanFilter(id, rest)
            else addKanbanFilter(rest)
            closeKanbanFilterSheet()
          }}
        />
      )}
      {/* View presets — save/share/apply table, kanban, calendar & gantt
          views (server 'view-presets' collection, local-first) */}
      <PresetsSheet
        visible={presetsSheetOpen}
        onClose={() => setPresetsSheetOpen(false)}
        slug={slug}
        currentViewType={normalizedViewMode}
        currentConfig={kanbanConfig}
        currentCalendarConfig={currentCalendarSnapshot}
        currentGanttConfig={currentGanttSnapshot}
        currentWhere={presetWhere}
        onApply={handleApplyPreset}
      />
      {/* Board customisation — status field, columns, colors, card fields */}
      {kanbanAvailable && (
        <KanbanCustomizeSheet
          visible={kanbanCustomizeOpen}
          onClose={() => setKanbanCustomizeOpen(false)}
          statusFieldCandidates={statusFieldCandidates}
          cardFieldCandidates={cardFieldCandidates}
          config={kanbanConfig}
          onSave={setKanbanConfig}
        />
      )}
      {/* Calendar customisation — date sources (start/end/label/colour) and
          the default month/week/day mode */}
      {calendarAvailable && (
        <CalendarCustomizeSheet
          visible={calendarCustomizeOpen}
          onClose={() => setCalendarCustomizeOpen(false)}
          dateFieldOptions={dateFieldOptions}
          config={calendarConfig}
          resolvedSources={calendarSources}
          onSave={handleSaveCalendarConfig}
        />
      )}
      {/* Gantt customisation — date sources (start/end/label/colour),
          visibility toggles and the S/M/L timeline zoom */}
      {ganttAvailable && (
        <GanttCustomizeSheet
          visible={ganttCustomizeOpen}
          onClose={() => setGanttCustomizeOpen(false)}
          dateFieldOptions={dateFieldOptions}
          config={ganttConfig}
          resolvedSources={ganttSources}
          onSave={setGanttConfig}
        />
      )}
      {/* Bulk edit flow — field picker → FieldRenderer input → apply to all
          selected docs via the local-first validated mutation pipeline */}
      <BulkEditSheet
        visible={bulkEditOpen}
        onClose={() => setBulkEditOpen(false)}
        slug={slug}
        fields={rootFields}
        selectedIds={selectedIds}
        docs={(localResult.docs ?? []) as Record<string, unknown>[]}
        hasDrafts={hasDrafts}
        onComplete={() => {
          setBulkEditOpen(false)
          exitSelectionMode()
        }}
      />
      {/* Board preview (kanban cards + gantt bars) — pure-JS inline preview
          (BottomSheet + read-only DocumentForm), opened by a static
          long-press or the kanban card's ellipsis menu. Long-press belongs
          to the drag gesture on both surfaces, so the native
          ScrollablePreview peek is never mounted on cards or bars. */}
      <BottomSheet
        visible={boardPreviewDoc != null}
        onClose={() => setBoardPreviewDoc(null)}
        height={0.75}
      >
        {boardPreviewDoc && schemaMap ? (
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                marginBottom: 8,
              }}
            >
              <Text
                style={{ flex: 1, fontSize: 17, fontWeight: '700', color: tc.text }}
                numberOfLines={1}
              >
                {getDocumentTitle(boardPreviewDoc, useAsTitle)}
              </Text>
              <Pressable
                onPress={() => {
                  const id = String(boardPreviewDoc.id)
                  setBoardPreviewDoc(null)
                  navigateToDoc(id)
                }}
                hitSlop={8}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: '#007AFF' }}>Open</Text>
              </Pressable>
            </View>
            <View style={{ flex: 1, overflow: 'hidden' }}>
              <ScrollView bounces showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: 16 }}>
                <PreviewContextProvider value={true}>
                  <DocumentForm
                    schemaMap={schemaMap}
                    slug={slug}
                    initialData={boardPreviewDoc}
                    onSubmit={noopSubmit}
                    disabled
                    nativeForm={false}
                  />
                </PreviewContextProvider>
              </ScrollView>
            </View>
          </View>
        ) : null}
      </BottomSheet>
      {/* Scan-to-lookup popup — camera scanner (phone: centered peek-style,
          tablet: floating top-right popup). Resolution lives in handleScanned;
          'none' keeps the popup open so the user can retry immediately. */}
      <ScanLookupSheet
        visible={scanOpen}
        onClose={() => setScanOpen(false)}
        onScanned={handleScanned}
      />
      {/* Multiple scan matches — picker sheet (same inline list pattern as
          the board preview sheet); tapping a row navigates through the
          shared double-nav guard. */}
      <BottomSheet
        visible={scanMatches != null}
        onClose={() => setScanMatches(null)}
        height={0.5}
      >
        <Text style={{ fontSize: 17, fontWeight: '700', color: tc.text, marginBottom: 4 }}>
          Multiple matches
        </Text>
        <Text style={{ fontSize: 13, color: tc.textMuted, marginBottom: 8 }}>
          Several documents match the scanned code — pick one to open.
        </Text>
        <ScrollView bounces showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: 16 }}>
          {(scanMatches ?? []).map((doc) => {
            const id = String(doc.id)
            return (
              <Pressable
                key={id}
                onPress={() => {
                  setScanMatches(null)
                  navigateToDoc(id)
                }}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  paddingVertical: 14,
                  paddingHorizontal: 4,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: tc.separator,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Text
                  style={{ flex: 1, fontSize: 15, fontWeight: '600', color: tc.text }}
                  numberOfLines={1}
                >
                  {getDocumentTitle(doc, useAsTitle)}
                </Text>
                <Text style={{ fontSize: 18, color: tc.tertiary, fontWeight: '300' }}>›</Text>
              </Pressable>
            )
          })}
        </ScrollView>
      </BottomSheet>
    </View>
  )
}

// ---------------------------------------------------------------------------
// Selection action bar styles
// ---------------------------------------------------------------------------

const selectionStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  count: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  actionBtnDestructive: {
    backgroundColor: '#FF3B30',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  actionLabelDestructive: {
    color: '#fff',
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  cancelLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f1f1f',
  },
})
