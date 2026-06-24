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
import React, { useCallback, useMemo, useState } from 'react'

import { getFieldDescription, getFieldLabel } from '../../../utils/schemaHelpers'
import { BottomSheet } from '../../../BottomSheet'
import { usePayloadNative } from '../../../PayloadNativeProvider'
import { useIsInsidePreview } from '../../../contexts/PreviewContext'
import { useScrollablePreview } from '../../../contexts/ScrollablePreviewContext'
import { FieldShell } from '../../shared'
import { docDisplayTitle, useOptionalLocalDB, usePickerPalette } from '../shared'
import { PickerSheet } from './components/PickerSheet'
import { PreviewSheet } from './components/PreviewSheet'
import { ManyTrigger, SingleTrigger } from './components/Triggers'
import { useLabelResolution } from './hooks/useLabelResolution'
import { usePeekDoc } from './hooks/usePeekDoc'
import { useRelationshipSearch } from './hooks/useRelationshipSearch'
import { type RelDoc, type RelItem, type RelationshipFieldProps } from './types'
import { getDocumentForm, toRelItem } from './utils'

// Re-export the public API so `from './relationship'` resolves identically.
export type { RelationshipFieldProps } from './types'

// ---------------------------------------------------------------------------
// RelationshipField
// ---------------------------------------------------------------------------

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

  // ---- results data layer (RxDB prefilter + REST search/pagination) ----

  const {
    search, setSearch, serverLoaded, hasNextPage, loading, loadingMore,
    displayDocs, loadServer, resetServer,
  } = useRelationshipSearch({
    open,
    baseURL,
    token: auth.token,
    activeCollection,
    localDB,
    filterOptions: field.filterOptions,
    sortOptions: field.admin?.sortOptions,
    titleFieldFor,
  })

  // Peeked-row document (lazy, local-first) for the native long-press peek.
  const peekDoc = usePeekDoc(peekRow, localDB, baseURL, auth.token)

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

  const { labelCache, setLabelCache } = useLabelResolution(
    selectedItems, cacheKey, titleFieldFor, localDB, baseURL, auth.token,
  )

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
    resetServer()
  }

  const maxReached = hasMany && field.maxRows != null && selectedItems.length >= field.maxRows
  const belowMin = hasMany && field.minRows != null && selectedItems.length < field.minRows

  // ---- preview ----

  const DocumentForm = getDocumentForm()
  const previewSchemaMap = previewItem ? schema?.collections?.[previewItem.relationTo] : null
  const canPreviewFor = (slug: string) => Boolean(schema?.collections?.[slug] && DocumentForm)

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error}
      layout={hasMany ? 'stacked' : 'inline'}
    >
      {hasMany ? (
        <ManyTrigger
          palette={palette}
          selectedItems={selectedItems}
          isPoly={isPoly}
          isDisabled={isDisabled}
          sortable={sortable}
          maxReached={maxReached}
          belowMin={belowMin}
          field={field}
          addLabel={collectionLabel(collections[0])}
          nativePeek={nativePeek}
          insidePreview={insidePreview}
          peekRow={peekRow}
          peekDoc={peekDoc}
          DocumentForm={DocumentForm}
          schemaFor={(slug) => schema?.collections?.[slug]}
          cacheKey={cacheKey}
          labelFor={labelFor}
          collectionLabel={collectionLabel}
          collectionMeta={collectionMeta}
          canPreviewFor={canPreviewFor}
          setPeekRow={setPeekRow}
          setPeekRowIfMatch={(key) => setPeekRow((prev) => (prev?.key === key ? null : prev))}
          onMove={moveItem}
          onRemove={removeItem}
          onAdd={() => setOpen(true)}
        />
      ) : (
        <SingleTrigger
          palette={palette}
          item={selectedItems[0]}
          isDisabled={isDisabled}
          labelFor={labelFor}
          placeholderLabel={collectionLabel(collections[0])}
          onOpen={() => setOpen(true)}
        />
      )}

      <BottomSheet visible={open} onClose={closeSheet} height={0.75}>
        {previewItem ? (
          <PreviewSheet
            palette={palette}
            previewItem={previewItem}
            DocumentForm={DocumentForm}
            previewSchemaMap={previewSchemaMap}
            titleFieldFor={titleFieldFor}
            onSelect={() => {
              selectDoc(previewItem.doc, previewItem.relationTo)
              setPreviewItem(null)
              if (!hasMany) setOpen(false)
            }}
            onBack={() => setPreviewItem(null)}
          />
        ) : (
          <PickerSheet
            palette={palette}
            activeCollection={activeCollection}
            collections={collections}
            isPoly={isPoly}
            hasMany={hasMany}
            allowCreate={allowCreate}
            loading={loading}
            loadingMore={loadingMore}
            serverLoaded={serverLoaded}
            hasNextPage={hasNextPage}
            search={search}
            setSearch={setSearch}
            displayDocs={displayDocs}
            selectedItems={selectedItems}
            maxReached={maxReached}
            collectionLabel={collectionLabel}
            collectionMeta={collectionMeta}
            titleFieldFor={titleFieldFor}
            isSelected={isSelected}
            canPreviewFor={canPreviewFor}
            onSwitchCollection={switchCollection}
            onSelectDoc={selectDoc}
            onPreview={(doc, relationTo) => setPreviewItem({ doc, relationTo })}
            onRequestCreate={() => {
              const target = activeCollection
              closeSheet()
              onRequestCreate?.(target)
            }}
            onLoadMore={() => loadServer(false)}
            onDone={closeSheet}
            onClear={() => { emit([]); closeSheet() }}
          />
        )}
      </BottomSheet>
    </FieldShell>
  )
}
