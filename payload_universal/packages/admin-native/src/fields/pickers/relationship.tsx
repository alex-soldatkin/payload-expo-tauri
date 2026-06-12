/**
 * Relationship field — web-admin parity:
 *
 *   - hasMany: array values (ids, or { relationTo, value } when polymorphic),
 *     removable rows with JS up/down reorder (admin.isSortable), minRows /
 *     maxRows constraints.
 *   - polymorphic relationTo arrays: collection switcher inside the picker
 *     sheet; values stored as { relationTo, value }.
 *   - filterOptions: object-form Where applied to both the RxDB prefilter
 *     (simple equals/in clauses) and the REST where param.
 *   - search: debounced server-side REST search (?where[useAsTitle][like]=)
 *     with "Load more" pagination + instant RxDB local prefilter.
 *   - allowCreate: "Create new" row calling the injected onRequestCreate
 *     callback (render-callback injection — NO expo-router in packages).
 *   - iOS polish: BottomSheet picker, rows with CollectionIcon + title +
 *     lucide checkmark, liquid glass search header (GlassView, guarded).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import type { ClientRelationshipField, FieldComponentProps } from '../../types'
import { defaultTheme as t } from '../../theme'
import { getFieldDescription, getFieldLabel } from '../../utils/schemaHelpers'
import { BottomSheet } from '../../BottomSheet'
import { CollectionIcon } from '../../CollectionIcon'
import { usePayloadNative } from '../../PayloadNativeProvider'
import { payloadApi } from '../../utils/api'
import { PreviewContextProvider, useIsInsidePreview } from '../../contexts/PreviewContext'
import { useScrollablePreview } from '../../contexts/ScrollablePreviewContext'
import { FieldShell } from '../shared'
import {
  LucideIcon,
  docDisplayTitle,
  glass,
  mergeWhere,
  sharedStyles,
  useDebouncedValue,
  useOptionalLocalDB,
  usePickerPalette,
  whereToMangoSelector,
} from './shared'

// Lazy-loaded DocumentForm to avoid circular dep (pickers → DocumentForm → fields → pickers)
let _DocumentForm: React.ComponentType<any> | null = null
const getDocumentForm = () => {
  if (!_DocumentForm) {
    try { _DocumentForm = require('../../DocumentForm').DocumentForm } catch { /* not available */ }
  }
  return _DocumentForm
}

const noopSubmit = async () => {}

type RelDoc = Record<string, unknown>

/** Normalized selected entry. `title` is set when the raw value was populated. */
type RelItem = { relationTo: string; id: string; title?: string }

const PAGE_SIZE = 30

// ---------------------------------------------------------------------------
// Value normalization
// ---------------------------------------------------------------------------

const toRelItem = (
  raw: unknown,
  fallbackCollection: string,
  titleFieldFor: (slug: string) => string | undefined,
): RelItem | null => {
  if (raw == null || raw === '') return null
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    // Polymorphic shape: { relationTo, value }
    if ('relationTo' in obj && 'value' in obj) {
      const relationTo = String(obj.relationTo)
      const inner = obj.value
      if (inner != null && typeof inner === 'object') {
        const doc = inner as RelDoc
        const id = String(doc.id ?? '')
        return id ? { relationTo, id, title: docDisplayTitle(doc, titleFieldFor(relationTo)) } : null
      }
      const id = String(inner ?? '')
      return id ? { relationTo, id } : null
    }
    // Populated doc
    const id = String(obj.id ?? '')
    return id
      ? { relationTo: fallbackCollection, id, title: docDisplayTitle(obj, titleFieldFor(fallbackCollection)) }
      : null
  }
  const id = String(raw)
  return id ? { relationTo: fallbackCollection, id } : null
}

// ---------------------------------------------------------------------------
// RelationshipField
// ---------------------------------------------------------------------------

export type RelationshipFieldProps = FieldComponentProps<ClientRelationshipField> & {
  /**
   * Injected by the host screen / DocumentForm: called when the user taps
   * "Create new" in the picker sheet. Navigation stays in app code —
   * packages never import expo-router (render-callback injection pattern).
   */
  onRequestCreate?: (relationTo: string) => void
}

export const RelationshipField: React.FC<RelationshipFieldProps> = ({
  field, value, onChange, disabled, error, onRequestCreate,
}) => {
  const { baseURL, auth, schema } = usePayloadNative()
  const palette = usePickerPalette()

  const collections = useMemo(
    () => (Array.isArray(field.relationTo) ? field.relationTo : [field.relationTo]),
    [field.relationTo],
  )
  const isPoly = collections.length > 1
  const hasMany = Boolean(field.hasMany)
  const isDisabled = disabled || field.admin?.readOnly
  const sortable = field.admin?.isSortable ?? true
  const allowCreate = (field.admin?.allowCreate ?? true) && typeof onRequestCreate === 'function'

  const [open, setOpen] = useState(false)
  const [activeCollection, setActiveCollection] = useState(collections[0])
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [serverDocs, setServerDocs] = useState<RelDoc[]>([])
  const [serverLoaded, setServerLoaded] = useState(false)
  const [hasNextPage, setHasNextPage] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [localDocs, setLocalDocs] = useState<RelDoc[]>([])
  const [labelCache, setLabelCache] = useState<Record<string, string>>({})
  // Pure-React preview (long-press peek). Uses inline JS rendering instead of
  // native ScrollablePreview to avoid native view-reparenting crashes inside
  // BottomSheet Modals.
  const [previewItem, setPreviewItem] = useState<{ doc: RelDoc; relationTo: string } | null>(null)
  // Native long-press peek on SELECTED hasMany rows (host app injects the
  // module via ScrollablePreviewProvider; null when absent → plain rows).
  // Skipped inside previews/sheets — PreviewContext disables nested peeks
  // (the BottomSheet picker keeps the pure-JS inline preview above: the
  // module exposes no Modal-safety capability flag to gate on).
  const nativePeek = useScrollablePreview()
  const insidePreview = useIsInsidePreview()
  const [peekRow, setPeekRow] = useState<{ key: string; item: RelItem } | null>(null)
  const [peekDoc, setPeekDoc] = useState<RelDoc | null>(null)
  const pageRef = useRef(1)
  const requestIdRef = useRef(0)

  const localDB = useOptionalLocalDB()

  // ---- schema lookups ----

  const menuCollections = schema?.menuModel?.collections
  const titleFieldFor = useCallback(
    (slug: string): string | undefined =>
      menuCollections?.find((c: { slug: string; useAsTitle?: string }) => c.slug === slug)?.useAsTitle,
    [menuCollections],
  )
  const collectionMeta = useCallback(
    (slug: string) => menuCollections?.find((c: { slug: string }) => c.slug === slug),
    [menuCollections],
  )
  const collectionLabel = useCallback((slug: string, plural = false): string => {
    const meta = collectionMeta(slug)
    const label = plural ? meta?.labels?.plural : meta?.labels?.singular
    return label || slug
  }, [collectionMeta])

  // ---- selected items ----

  const selectedItems = useMemo<RelItem[]>(() => {
    const fallback = collections[0]
    if (hasMany) {
      if (!Array.isArray(value)) return []
      return (value as unknown[])
        .map((raw) => toRelItem(raw, fallback, titleFieldFor))
        .filter((it): it is RelItem => it !== null)
    }
    const single = toRelItem(value, fallback, titleFieldFor)
    return single ? [single] : []
  }, [value, hasMany, collections, titleFieldFor])

  const cacheKey = (it: RelItem) => `${it.relationTo}:${it.id}`
  const labelFor = (it: RelItem): string => it.title ?? labelCache[cacheKey(it)] ?? it.id
  const isSelected = (relationTo: string, id: string) =>
    selectedItems.some((it) => it.relationTo === relationTo && it.id === id)

  const emit = useCallback((items: RelItem[]) => {
    if (hasMany) {
      onChange(items.map((it) => (isPoly ? { relationTo: it.relationTo, value: it.id } : it.id)))
    } else {
      const it = items[0]
      onChange(it ? (isPoly ? { relationTo: it.relationTo, value: it.id } : it.id) : null)
    }
  }, [hasMany, isPoly, onChange])

  // ---- label resolution for ids without inline docs ----

  useEffect(() => {
    const missing = selectedItems.filter((it) => it.title == null && labelCache[cacheKey(it)] == null)
    if (missing.length === 0) return
    let cancelled = false
    const resolve = async () => {
      const updates: Record<string, string> = {}
      const byCollection: Record<string, string[]> = {}
      for (const it of missing) (byCollection[it.relationTo] ??= []).push(it.id)

      for (const [slug, ids] of Object.entries(byCollection)) {
        const titleField = titleFieldFor(slug)
        const remaining: string[] = []
        const localCollection = localDB?.collections?.[slug]
        if (localCollection) {
          for (const id of ids) {
            try {
              const rxDoc = await localCollection.findOne(id).exec()
              if (rxDoc) updates[`${slug}:${id}`] = docDisplayTitle(rxDoc.toJSON(), titleField)
              else remaining.push(id)
            } catch { remaining.push(id) }
          }
        } else {
          remaining.push(...ids)
        }
        if (remaining.length > 0) {
          try {
            const result = await payloadApi.find({ baseURL, token: auth.token }, slug, {
              where: { id: { in: remaining } }, limit: remaining.length, depth: 0,
            })
            for (const doc of result.docs) {
              updates[`${slug}:${String(doc.id)}`] = docDisplayTitle(doc, titleField)
            }
          } catch { /* leave ids as labels */ }
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setLabelCache((prev) => ({ ...prev, ...updates }))
      }
    }
    resolve()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItems, localDB, baseURL, auth.token])

  // ---- server search (debounced, paginated) ----

  const buildWhere = useCallback((searchTerm: string): Record<string, unknown> | undefined => {
    const titleField = titleFieldFor(activeCollection) ?? 'id'
    const searchWhere = searchTerm.trim()
      ? { [titleField]: { like: searchTerm.trim() } }
      : undefined
    return mergeWhere(field.filterOptions, searchWhere)
  }, [activeCollection, field.filterOptions, titleFieldFor])

  const sortFor = useCallback((slug: string): string => {
    const so = field.admin?.sortOptions
    if (typeof so === 'string') return so
    if (so && typeof so === 'object') return so[slug] ?? '-updatedAt'
    return '-updatedAt'
  }, [field.admin?.sortOptions])

  const loadServer = useCallback(async (reset: boolean) => {
    const requestId = ++requestIdRef.current
    const page = reset ? 1 : pageRef.current + 1
    if (reset) setLoading(true)
    else setLoadingMore(true)
    try {
      const result = await payloadApi.find({ baseURL, token: auth.token }, activeCollection, {
        page,
        limit: PAGE_SIZE,
        depth: 0,
        sort: sortFor(activeCollection),
        where: buildWhere(debouncedSearch),
      })
      if (requestId !== requestIdRef.current) return
      pageRef.current = page
      setServerDocs((prev) => (reset ? result.docs : [...prev, ...result.docs]))
      setHasNextPage(Boolean(result.hasNextPage))
      setServerLoaded(true)
    } catch {
      if (requestId !== requestIdRef.current) return
      if (reset) { setServerDocs([]); setServerLoaded(false) }
      setHasNextPage(false)
    } finally {
      if (requestId === requestIdRef.current) { setLoading(false); setLoadingMore(false) }
    }
  }, [baseURL, auth.token, activeCollection, debouncedSearch, buildWhere, sortFor])

  useEffect(() => {
    if (!open) return
    loadServer(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeCollection, debouncedSearch])

  // ---- RxDB local prefilter (instant results while server search runs) ----

  useEffect(() => {
    if (!open) { return }
    const localCollection = localDB?.collections?.[activeCollection]
    if (!localCollection) { setLocalDocs([]); return }

    // Skip the local tier entirely when filterOptions can't be converted —
    // never show docs the server-side filter would exclude.
    const filterSelector = whereToMangoSelector(field.filterOptions)
    if (filterSelector === null) { setLocalDocs([]); return }

    let cancelled = false
    const run = async () => {
      try {
        const results = await localCollection.find({
          selector: { _deleted: { $eq: false }, ...filterSelector },
          sort: [{ updatedAt: 'desc' }],
          limit: 50,
        }).exec()
        if (cancelled) return
        let docs: RelDoc[] = results.map((r: any) => r.toJSON())
        const q = search.trim().toLowerCase()
        if (q) {
          const titleField = titleFieldFor(activeCollection)
          docs = docs.filter((doc) => {
            const fields = new Set(['title', 'name', 'email', 'id'])
            if (titleField) fields.add(titleField)
            return Array.from(fields).some((f) => {
              const val = doc[f]
              return val != null && String(val).toLowerCase().includes(q)
            })
          })
        }
        setLocalDocs(docs)
      } catch {
        if (!cancelled) setLocalDocs([])
      }
    }
    run()
    return () => { cancelled = true }
  }, [open, activeCollection, search, localDB, field.filterOptions, titleFieldFor])

  // ---- merged display list ----

  const displayDocs = useMemo(() => {
    const seen = new Set<string>()
    const out: RelDoc[] = []
    const push = (doc: RelDoc) => {
      const id = String(doc.id ?? '')
      if (id && !seen.has(id)) { seen.add(id); out.push(doc) }
    }
    if (serverLoaded) {
      serverDocs.forEach(push)
      localDocs.forEach(push) // local-only (e.g. unsynced) docs appended
    } else {
      localDocs.forEach(push)
    }
    return out
  }, [serverDocs, localDocs, serverLoaded])

  // ---- selection handlers ----

  const closeSheet = () => { setPreviewItem(null); setSearch(''); setOpen(false) }

  const selectDoc = (doc: RelDoc, relationTo: string) => {
    const id = String(doc.id ?? '')
    if (!id) return
    const title = docDisplayTitle(doc, titleFieldFor(relationTo))
    setLabelCache((prev) => ({ ...prev, [`${relationTo}:${id}`]: title }))
    if (hasMany) {
      if (isSelected(relationTo, id)) {
        emit(selectedItems.filter((it) => !(it.relationTo === relationTo && it.id === id)))
      } else {
        if (field.maxRows != null && selectedItems.length >= field.maxRows) return
        emit([...selectedItems, { relationTo, id, title }])
      }
    } else {
      emit([{ relationTo, id, title }])
      closeSheet()
    }
  }

  const removeItem = (index: number) => {
    emit(selectedItems.filter((_, i) => i !== index))
  }

  const moveItem = (index: number, delta: number) => {
    const target = index + delta
    if (target < 0 || target >= selectedItems.length) return
    const next = [...selectedItems]
    const [it] = next.splice(index, 1)
    next.splice(target, 0, it)
    emit(next)
  }

  const switchCollection = (slug: string) => {
    if (slug === activeCollection) return
    setActiveCollection(slug)
    setServerDocs([])
    setServerLoaded(false)
    setHasNextPage(false)
  }

  const maxReached = hasMany && field.maxRows != null && selectedItems.length >= field.maxRows
  const belowMin = hasMany && field.minRows != null && selectedItems.length < field.minRows

  // ---- preview ----

  const DocumentForm = getDocumentForm()
  const previewSchemaMap = previewItem ? schema?.collections?.[previewItem.relationTo] : null
  const canPreviewFor = (slug: string) => Boolean(schema?.collections?.[slug] && DocumentForm)

  // Resolve the peeked row's full document — local RxDB first, REST fallback.
  // Loaded lazily when the peek opens (selected rows only carry id + title).
  useEffect(() => {
    if (!peekRow) { setPeekDoc(null); return }
    const { relationTo, id } = peekRow.item
    let cancelled = false
    const load = async () => {
      try {
        const localCollection = localDB?.collections?.[relationTo]
        if (localCollection) {
          const rxDoc = await localCollection.findOne(id).exec()
          if (rxDoc) {
            if (!cancelled) setPeekDoc(rxDoc.toJSON() as RelDoc)
            return
          }
        }
      } catch { /* fall through to REST */ }
      try {
        const result = await payloadApi.find({ baseURL, token: auth.token }, relationTo, {
          where: { id: { equals: id } }, limit: 1, depth: 0,
        })
        if (!cancelled) setPeekDoc((result.docs[0] as RelDoc) ?? null)
      } catch {
        if (!cancelled) setPeekDoc(null)
      }
    }
    load()
    return () => { cancelled = true }
  }, [peekRow, localDB, baseURL, auth.token])

  // ---- render helpers ----

  const renderSearchHeader = () => {
    const input = (
      <View style={[styles.searchRow, !glass.available && { backgroundColor: palette.surfaceAlt }]}>
        <LucideIcon name="Search" size={16} color={palette.placeholder} />
        <TextInput
          style={[styles.searchInput, { color: palette.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder={`Search ${collectionLabel(activeCollection, true)}...`}
          placeholderTextColor={palette.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {loading && <ActivityIndicator size="small" />}
      </View>
    )
    // Liquid glass search header (iOS 26+); plain pill elsewhere.
    if (glass.available && glass.GlassView) {
      const GlassView = glass.GlassView
      return (
        <GlassView style={styles.searchGlass} glassEffectStyle="regular">
          {input}
        </GlassView>
      )
    }
    return <View style={styles.searchGlass}>{input}</View>
  }

  const renderCollectionSwitcher = () => {
    if (!isPoly) return null
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.switcherScroll} contentContainerStyle={styles.switcherRow}>
        {collections.map((slug) => {
          const active = slug === activeCollection
          return (
            <Pressable
              key={slug}
              style={[
                styles.switcherChip,
                { borderColor: palette.border },
                active && { backgroundColor: palette.primary, borderColor: palette.primary },
              ]}
              onPress={() => switchCollection(slug)}
            >
              <CollectionIcon icon={collectionMeta(slug)?.icon} size={14} color={active ? palette.primaryText : palette.textMuted} />
              <Text style={[styles.switcherText, { color: active ? palette.primaryText : palette.text }]}>
                {collectionLabel(slug, true)}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>
    )
  }

  const renderDocRow = ({ item }: { item: RelDoc }) => {
    const id = String(item.id ?? '')
    const title = docDisplayTitle(item, titleFieldFor(activeCollection))
    const selected = isSelected(activeCollection, id)
    const rowDisabled = !selected && maxReached
    return (
      <Pressable
        style={[sharedStyles.optionRow, { borderBottomColor: palette.separator }, rowDisabled && styles.rowDisabled]}
        onPress={() => !rowDisabled && selectDoc(item, activeCollection)}
        onLongPress={canPreviewFor(activeCollection) ? () => setPreviewItem({ doc: item, relationTo: activeCollection }) : undefined}
        delayLongPress={350}
      >
        <CollectionIcon icon={collectionMeta(activeCollection)?.icon} size={18} color={palette.textMuted} />
        <Text style={[sharedStyles.optionText, { color: palette.text }, selected && styles.optionTextSelected]} numberOfLines={1}>
          {title}
        </Text>
        {selected && <LucideIcon name="Check" size={18} color={palette.primary} />}
      </Pressable>
    )
  }

  // ---- trigger (field row) ----

  const renderSingleTrigger = () => {
    const item = selectedItems[0]
    return (
      <Pressable
        style={styles.triggerRow}
        onPress={() => !isDisabled && setOpen(true)}
        disabled={isDisabled}
      >
        {item ? (
          <Text style={[styles.triggerText, { color: palette.text }]} numberOfLines={1}>{labelFor(item)}</Text>
        ) : (
          <Text style={[styles.triggerText, { color: palette.placeholder }]}>
            {`Select ${collectionLabel(collections[0])}...`}
          </Text>
        )}
        <Text style={[styles.chevron, { color: palette.textMuted }]}>›</Text>
      </Pressable>
    )
  }

  const renderManyTrigger = () => (
    <View>
      {selectedItems.map((it, i) => {
        const rowKey = `${cacheKey(it)}-${i}`
        // Leading row content (icon + title + badge). The action buttons stay
        // OUTSIDE the peek trigger so their Pressables never fight the native
        // long-press/tap recognizers.
        const rowMain = (
          <View style={styles.valueMain}>
            <CollectionIcon icon={collectionMeta(it.relationTo)?.icon} size={16} color={palette.textMuted} />
            <Text style={[styles.valueTitle, { color: palette.text }]} numberOfLines={1}>{labelFor(it)}</Text>
            {isPoly && (
              <Text style={[styles.valueBadge, { color: palette.placeholder }]}>{collectionLabel(it.relationTo)}</Text>
            )}
          </View>
        )
        // Native long-press peek: read-only DocumentForm of the related doc.
        // Fallback-safe — plain row when no module/schema or inside a preview.
        const canPeek = nativePeek != null && !insidePreview && canPreviewFor(it.relationTo)
        const isPeekOpen = peekRow?.key === rowKey
        const peekSchemaMap = schema?.collections?.[it.relationTo]
        return (
          <View key={rowKey} style={[styles.valueRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: palette.separator }]}>
            <View style={styles.valueMainWrap}>
              {canPeek ? (
                <nativePeek.Trigger
                  onPreviewOpen={() => setPeekRow({ key: rowKey, item: it })}
                  onPreviewClose={() => setPeekRow((prev) => (prev?.key === rowKey ? null : prev))}
                >
                  {rowMain}
                  <nativePeek.Content>
                    <PreviewContextProvider value={true}>
                      {isPeekOpen && peekDoc && DocumentForm && peekSchemaMap ? (
                        <DocumentForm
                          schemaMap={peekSchemaMap}
                          slug={it.relationTo}
                          initialData={peekDoc}
                          onSubmit={noopSubmit}
                          disabled
                          // Peek content mounts in an unsized native container —
                          // a zero-height SwiftUI Form swallows touches.
                          nativeForm={false}
                        />
                      ) : (
                        <View style={styles.peekLoading}>
                          <ActivityIndicator />
                        </View>
                      )}
                    </PreviewContextProvider>
                  </nativePeek.Content>
                  {!isDisabled && (
                    <nativePeek.Action
                      title="Remove"
                      icon="minus.circle"
                      destructive
                      onActionPress={() => removeItem(i)}
                    />
                  )}
                </nativePeek.Trigger>
              ) : (
                rowMain
              )}
            </View>
            {!isDisabled && (
              <View style={styles.valueActions}>
                {sortable && selectedItems.length > 1 && (
                  <>
                    <Pressable onPress={() => moveItem(i, -1)} disabled={i === 0} hitSlop={6} style={i === 0 && styles.actionDisabled}>
                      <LucideIcon name="ChevronUp" size={18} color={palette.textMuted} />
                    </Pressable>
                    <Pressable onPress={() => moveItem(i, 1)} disabled={i === selectedItems.length - 1} hitSlop={6} style={i === selectedItems.length - 1 && styles.actionDisabled}>
                      <LucideIcon name="ChevronDown" size={18} color={palette.textMuted} />
                    </Pressable>
                  </>
                )}
                <Pressable onPress={() => removeItem(i)} hitSlop={6}>
                  <LucideIcon name="X" size={16} color={palette.textMuted} />
                </Pressable>
              </View>
            )}
          </View>
        )
      })}
      <Pressable
        style={[styles.addRow, (isDisabled || maxReached) && styles.actionDisabled]}
        onPress={() => { if (!isDisabled && !maxReached) setOpen(true) }}
        disabled={isDisabled || maxReached}
      >
        <LucideIcon name="Plus" size={16} color={palette.textMuted} />
        <Text style={[styles.addText, { color: palette.textMuted }]}>
          {maxReached ? `Maximum of ${field.maxRows} selected` : `Add ${collectionLabel(collections[0])}...`}
        </Text>
      </Pressable>
      {belowMin && (
        <Text style={[styles.minHint, { color: palette.placeholder }]}>
          {`Select at least ${field.minRows}`}
        </Text>
      )}
    </View>
  )

  // ---- sheet body ----

  const renderPicker = () => (
    <>
      <Text style={[sharedStyles.sheetTitle, { color: palette.text }]}>
        {`Select ${collectionLabel(activeCollection, true)}`}
        {hasMany && selectedItems.length > 0 ? `  ·  ${selectedItems.length} selected` : ''}
      </Text>
      {renderCollectionSwitcher()}
      {renderSearchHeader()}
      <FlatList
        data={displayDocs}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
        renderItem={renderDocRow}
        ListHeaderComponent={allowCreate ? (
          <Pressable
            style={[sharedStyles.optionRow, { borderBottomColor: palette.separator }]}
            onPress={() => {
              const target = activeCollection
              closeSheet()
              onRequestCreate?.(target)
            }}
          >
            <LucideIcon name="Plus" size={18} color={palette.primary} />
            <Text style={[sharedStyles.optionText, { color: palette.primary, fontWeight: '600' }]}>
              {`Create new ${collectionLabel(activeCollection)}`}
            </Text>
          </Pressable>
        ) : null}
        ListFooterComponent={serverLoaded && hasNextPage ? (
          <Pressable style={styles.loadMoreRow} onPress={() => !loadingMore && loadServer(false)}>
            {loadingMore
              ? <ActivityIndicator size="small" />
              : <Text style={[styles.loadMoreText, { color: palette.primary }]}>Load more</Text>}
          </Pressable>
        ) : null}
        ListEmptyComponent={!loading ? (
          <Text style={[sharedStyles.emptyText, { color: palette.textMuted }]}>No results</Text>
        ) : null}
      />
      {hasMany ? (
        <Pressable style={[styles.doneBtn, { backgroundColor: palette.primary }]} onPress={closeSheet}>
          <Text style={[styles.doneText, { color: palette.primaryText }]}>Done</Text>
        </Pressable>
      ) : selectedItems.length > 0 ? (
        <Pressable style={styles.clearBtn} onPress={() => { emit([]); closeSheet() }}>
          <Text style={[styles.clearText, { color: palette.destructive }]}>Clear selection</Text>
        </Pressable>
      ) : null}
    </>
  )

  const renderPreview = () => {
    if (!previewItem) return null
    return (
      <View style={{ flex: 1 }}>
        <View style={styles.previewHeader}>
          <Text style={[sharedStyles.sheetTitle, { color: palette.text }]} numberOfLines={1}>
            {docDisplayTitle(previewItem.doc, titleFieldFor(previewItem.relationTo))}
          </Text>
        </View>
        <View style={{ flex: 1, overflow: 'hidden' }}>
          <ScrollView bounces showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: 16 }}>
            {DocumentForm && previewSchemaMap ? (
              <PreviewContextProvider value={true}>
                <DocumentForm
                  schemaMap={previewSchemaMap}
                  slug={previewItem.relationTo}
                  initialData={previewItem.doc}
                  onSubmit={noopSubmit}
                  disabled
                />
              </PreviewContextProvider>
            ) : null}
          </ScrollView>
        </View>
        <View style={[styles.previewActions, { borderTopColor: palette.separator }]}>
          <Pressable
            style={[styles.previewSelectBtn, { borderRightColor: palette.separator }]}
            onPress={() => {
              selectDoc(previewItem.doc, previewItem.relationTo)
              setPreviewItem(null)
              if (!hasMany) setOpen(false)
            }}
          >
            <Text style={[styles.previewSelectText, { color: palette.primary }]}>Select</Text>
          </Pressable>
          <Pressable style={styles.previewCloseBtn} onPress={() => setPreviewItem(null)}>
            <Text style={[styles.previewCloseText, { color: palette.textMuted }]}>Back</Text>
          </Pressable>
        </View>
      </View>
    )
  }

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error}
      layout={hasMany ? 'stacked' : 'inline'}
    >
      {hasMany ? renderManyTrigger() : renderSingleTrigger()}

      <BottomSheet visible={open} onClose={closeSheet} height={0.75}>
        {previewItem ? renderPreview() : renderPicker()}
      </BottomSheet>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  triggerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  triggerText: { fontSize: t.fontSize.md, flex: 1 },
  chevron: { fontSize: 18, marginLeft: t.spacing.xs },

  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.sm + 2,
  },
  // Peek trigger wrapper — fills the row width left of the action buttons
  valueMainWrap: { flex: 1 },
  valueMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
  },
  peekLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  valueTitle: { flex: 1, fontSize: t.fontSize.md },
  valueBadge: { fontSize: t.fontSize.xs },
  valueActions: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  actionDisabled: { opacity: 0.35 },

  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingVertical: t.spacing.sm + 2,
  },
  addText: { fontSize: t.fontSize.sm, fontWeight: '500' },
  minHint: { fontSize: t.fontSize.xs, marginTop: 2 },

  switcherScroll: { flexGrow: 0, marginBottom: t.spacing.sm },
  switcherRow: { flexDirection: 'row', gap: t.spacing.xs },
  switcherChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.xs,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs + 2,
    borderRadius: 20,
    borderWidth: 1,
  },
  switcherText: { fontSize: t.fontSize.sm, fontWeight: '500' },

  searchGlass: { borderRadius: t.borderRadius.md, overflow: 'hidden', marginBottom: t.spacing.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.borderRadius.md,
  },
  searchInput: { flex: 1, paddingVertical: t.spacing.sm + 2, fontSize: t.fontSize.md },

  optionTextSelected: { fontWeight: '600' },
  rowDisabled: { opacity: 0.4 },

  loadMoreRow: { paddingVertical: t.spacing.md, alignItems: 'center' },
  loadMoreText: { fontSize: t.fontSize.sm, fontWeight: '600' },

  doneBtn: {
    marginTop: t.spacing.sm,
    borderRadius: t.borderRadius.md,
    paddingVertical: t.spacing.md,
    alignItems: 'center',
  },
  doneText: { fontSize: t.fontSize.md, fontWeight: '600' },

  clearBtn: { paddingVertical: t.spacing.md, alignItems: 'center' },
  clearText: { fontSize: t.fontSize.sm },

  previewHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: t.spacing.sm },
  previewActions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginHorizontal: -16,
    marginBottom: -16,
  },
  previewSelectBtn: {
    flex: 1,
    paddingVertical: t.spacing.md,
    alignItems: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  previewSelectText: { fontSize: t.fontSize.md, fontWeight: '600' },
  previewCloseBtn: { flex: 1, paddingVertical: t.spacing.md, alignItems: 'center' },
  previewCloseText: { fontSize: t.fontSize.md },
})
