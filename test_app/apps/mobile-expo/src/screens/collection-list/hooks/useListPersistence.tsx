/**
 * Per-collection persisted list preferences for the collection-list screen:
 *   - summary fields (card field selection)
 *   - sort (shared AsyncStorage key with DocumentList's internal sort so the
 *     iOS controlled toolbar and the Android uncontrolled UI stay in sync)
 *   - table pins (sticky header band / frozen title column)
 *
 * Extracted verbatim from the route file — same keys, same effects, same
 * fallback semantics.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  getSortableFields,
  type ClientField,
  type DocumentListSort,
} from '@payload-universal/admin-native'
import {
  DEFAULT_SORT,
  DEFAULT_TABLE_PINS,
  SORT_KEY_PREFIX,
  SUMMARY_FIELDS_KEY_PREFIX,
  TABLE_PINS_KEY_PREFIX,
} from '../utils'
import type { TablePins } from '../types'

export function useListPersistence(slug: string, rootFields: ClientField[]) {
  // Persisted summary field selection
  const [summaryFields, setSummaryFields] = useState<string[]>([])

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

  return {
    summaryFields,
    handleSummaryFieldsChange,
    sortableFields,
    effectiveSort,
    handleSortChange,
    handleSortFieldPress,
    tablePins,
    handleTablePinsChange,
  }
}
