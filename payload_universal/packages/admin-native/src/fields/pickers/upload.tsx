/**
 * Upload field — web-admin parity:
 *
 *   - thumbnail preview of the current value (sizes-aware: prefers the
 *     `thumbnail` image size / doc.thumbnailURL) with filename + filesize,
 *     Apple Files-style row. Respects displayPreview: false.
 *   - "Browse existing" mode: searchable grid of media docs from RxDB
 *     (instant) + REST (debounced, paginated), filterOptions applied.
 *   - camera / photo library actions (expo-image-picker) + document picker
 *     (expo-document-picker, guarded) for non-image mime types.
 *   - hasMany: horizontal thumbnail strip + add tile, removable, with
 *     minRows / maxRows constraints.
 *   - focal point: draggable dot overlay (pure RN PanResponder) PATCHing
 *     focalX/focalY when the media collection enables focalPoint.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'

import type { ClientUploadField, FieldComponentProps } from '../../types'
import { defaultTheme as t } from '../../theme'
import { getFieldDescription, getFieldLabel } from '../../utils/schemaHelpers'
import { BottomSheet } from '../../BottomSheet'
import { usePayloadNative } from '../../PayloadNativeProvider'
import { payloadApi } from '../../utils/api'
import { FieldShell } from '../shared'
import {
  LucideIcon,
  type PickerPalette,
  docDisplayTitle,
  formatFileSize,
  glass,
  mergeWhere,
  resolveAssetURL,
  sharedStyles,
  useDebouncedValue,
  useOptionalLocalDB,
  usePickerPalette,
  whereToMangoSelector,
} from './shared'

// Optional document picker (installed in the app; not a package peer dep)
let DocumentPicker: any = null
try { DocumentPicker = require('expo-document-picker') } catch { /* not available */ }

type MediaDoc = Record<string, unknown>

const BROWSE_PAGE_SIZE = 30

// ---------------------------------------------------------------------------
// Media doc helpers
// ---------------------------------------------------------------------------

const isImageDoc = (doc: MediaDoc): boolean => String(doc.mimeType ?? '').startsWith('image/')

/** Sizes-aware thumbnail URL: thumbnailURL → sizes.thumbnail → any size → url. */
const thumbnailURLFor = (baseURL: string, doc: MediaDoc): string | null => {
  const direct = resolveAssetURL(baseURL, doc.thumbnailURL)
  if (direct) return direct
  const sizes = doc.sizes as Record<string, { url?: unknown } | undefined> | undefined
  if (sizes && typeof sizes === 'object') {
    const thumb = sizes.thumbnail?.url
    const resolvedThumb = resolveAssetURL(baseURL, thumb)
    if (resolvedThumb) return resolvedThumb
    for (const size of Object.values(sizes)) {
      const resolved = resolveAssetURL(baseURL, size?.url)
      if (resolved) return resolved
    }
  }
  return resolveAssetURL(baseURL, doc.url)
}

const fullURLFor = (baseURL: string, doc: MediaDoc): string | null =>
  resolveAssetURL(baseURL, doc.url) ?? thumbnailURLFor(baseURL, doc)

// ---------------------------------------------------------------------------
// Focal point editor (pure RN — PanResponder draggable dot)
// ---------------------------------------------------------------------------

const clampPct = (v: number) => Math.max(0, Math.min(100, v))

const FocalPointEditor: React.FC<{
  doc: MediaDoc
  collection: string
  baseURL: string
  token: string | null
  palette: PickerPalette
  onSaved: (doc: MediaDoc) => void
  onCancel: () => void
}> = ({ doc, collection, baseURL, token, palette, onSaved, onCancel }) => {
  const initialX = typeof doc.focalX === 'number' ? doc.focalX : 50
  const initialY = typeof doc.focalY === 'number' ? doc.focalY : 50
  const [focal, setFocal] = useState({ x: clampPct(initialX), y: clampPct(initialY) })
  const [boxWidth, setBoxWidth] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const sizeRef = useRef({ w: 0, h: 0 })

  const aspect = (() => {
    const w = Number(doc.width)
    const h = Number(doc.height)
    return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? w / h : 4 / 3
  })()

  let dispW = boxWidth
  let dispH = boxWidth > 0 ? boxWidth / aspect : 0
  if (dispH > 320) { dispH = 320; dispW = 320 * aspect }
  sizeRef.current = { w: dispW, h: dispH }

  const updateFromTouch = (x: number, y: number) => {
    const { w, h } = sizeRef.current
    if (w <= 0 || h <= 0) return
    setFocal({ x: clampPct((x / w) * 100), y: clampPct((y / h) * 100) })
  }

  // The Image + dot below are pointerEvents="none", so locationX/Y stay
  // relative to this responder container.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => updateFromTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
      onPanResponderMove: (evt) => updateFromTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
    }),
  ).current

  const save = async () => {
    const id = String(doc.id ?? '')
    if (!id) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await payloadApi.update({ baseURL, token }, collection, id, {
        focalX: Math.round(focal.x),
        focalY: Math.round(focal.y),
      })
      onSaved(updated)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save focal point')
    } finally {
      setSaving(false)
    }
  }

  const uri = fullURLFor(baseURL, doc)

  return (
    <View style={{ flex: 1 }}>
      <Text style={[sharedStyles.sheetTitle, { color: palette.text }]}>Focal point</Text>
      <View style={styles.focalBox} onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}>
        {uri && dispW > 0 ? (
          <View
            style={{ width: dispW, height: dispH, alignSelf: 'center' }}
            {...pan.panHandlers}
          >
            <View pointerEvents="none">
              <Image source={{ uri }} style={{ width: dispW, height: dispH, borderRadius: t.borderRadius.sm }} />
            </View>
            <View
              pointerEvents="none"
              style={[
                styles.focalDot,
                {
                  left: (focal.x / 100) * dispW - 14,
                  top: (focal.y / 100) * dispH - 14,
                  borderColor: palette.dark ? '#fff' : '#fff',
                },
              ]}
            >
              <View style={styles.focalDotInner} />
            </View>
          </View>
        ) : (
          <ActivityIndicator style={{ marginVertical: t.spacing.xl }} />
        )}
      </View>
      <Text style={[styles.focalHint, { color: palette.textMuted }]}>
        {`Drag the dot to set the focal point (${Math.round(focal.x)}%, ${Math.round(focal.y)}%)`}
      </Text>
      {saveError && <Text style={[styles.focalHint, { color: palette.destructive }]}>{saveError}</Text>}
      <View style={styles.focalActions}>
        <Pressable
          style={[styles.focalSaveBtn, { backgroundColor: palette.primary }, saving && { opacity: 0.6 }]}
          onPress={save}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={palette.primaryText} />
            : <Text style={[styles.focalSaveText, { color: palette.primaryText }]}>Save</Text>}
        </Pressable>
        <Pressable style={styles.focalCancelBtn} onPress={onCancel} disabled={saving}>
          <Text style={[styles.focalCancelText, { color: palette.textMuted }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------
// UploadField
// ---------------------------------------------------------------------------

type SheetMode = 'actions' | 'browse' | 'focal'

export const UploadField: React.FC<FieldComponentProps<ClientUploadField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const { baseURL, auth, schema } = usePayloadNative()
  const palette = usePickerPalette()
  const { width: windowWidth } = useWindowDimensions()
  const relationTo = field.relationTo
  const hasMany = Boolean(field.hasMany)
  const isDisabled = disabled || field.admin?.readOnly
  const displayPreview = field.displayPreview !== false

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadingName, setUploadingName] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mode, setMode] = useState<SheetMode>('actions')
  const [focalDoc, setFocalDoc] = useState<MediaDoc | null>(null)
  const [docsById, setDocsById] = useState<Record<string, MediaDoc | null>>({})

  // Browse state
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)
  const [browseDocs, setBrowseDocs] = useState<MediaDoc[]>([])
  const [browseLoaded, setBrowseLoaded] = useState(false)
  const [browseLocalDocs, setBrowseLocalDocs] = useState<MediaDoc[]>([])
  const [browseLoading, setBrowseLoading] = useState(false)
  const [browseLoadingMore, setBrowseLoadingMore] = useState(false)
  const [browseHasNext, setBrowseHasNext] = useState(false)
  const browsePageRef = useRef(1)
  const browseRequestRef = useRef(0)

  const localDB = useOptionalLocalDB()

  // ---- collection metadata ----

  const uploadConfig = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const clientCollections = (schema as any)?.clientConfig?.collections as Array<Record<string, unknown>> | undefined
    const col = clientCollections?.find((c) => c.slug === relationTo)
    return col?.upload && typeof col.upload === 'object' ? (col.upload as Record<string, unknown>) : null
  }, [schema, relationTo])

  const focalEnabled = Boolean(uploadConfig?.focalPoint)
  const mimeTypes = Array.isArray(uploadConfig?.mimeTypes)
    ? (uploadConfig?.mimeTypes as string[])
    : undefined
  const titleField = schema?.menuModel?.collections.find(
    (c: { slug: string; useAsTitle?: string }) => c.slug === relationTo,
  )?.useAsTitle ?? 'filename'

  // ---- value normalization ----

  const items = useMemo<Array<{ id: string; doc: MediaDoc | null }>>(() => {
    const raws: unknown[] = hasMany
      ? (Array.isArray(value) ? (value as unknown[]) : [])
      : value != null && value !== '' ? [value] : []
    return raws
      .map((raw) => {
        if (raw != null && typeof raw === 'object') {
          const doc = raw as MediaDoc
          const id = String(doc.id ?? '')
          return id ? { id, doc } : null
        }
        const id = String(raw ?? '')
        return id ? { id, doc: null } : null
      })
      .filter((it): it is { id: string; doc: MediaDoc | null } => it !== null)
  }, [value, hasMany])

  const docFor = useCallback(
    (id: string): MediaDoc | null => docsById[id] ?? items.find((it) => it.id === id)?.doc ?? null,
    [docsById, items],
  )

  const emit = useCallback((ids: string[]) => {
    if (hasMany) onChange(ids)
    else onChange(ids[0] ?? null)
  }, [hasMany, onChange])

  // ---- resolve missing media docs (local-db → REST) ----

  useEffect(() => {
    const missing = items.filter((it) => it.doc == null && docsById[it.id] === undefined)
    if (missing.length === 0) return
    let cancelled = false
    const resolve = async () => {
      const updates: Record<string, MediaDoc | null> = {}
      const localCollection = localDB?.collections?.[relationTo]
      for (const it of missing) {
        try {
          if (localCollection) {
            const rxDoc = await localCollection.findOne(it.id).exec()
            if (rxDoc) { updates[it.id] = rxDoc.toJSON(); continue }
          }
          updates[it.id] = await payloadApi.findByID({ baseURL, token: auth.token }, relationTo, it.id, { depth: 0 })
        } catch {
          updates[it.id] = null
        }
      }
      if (!cancelled && Object.keys(updates).length > 0) {
        setDocsById((prev) => ({ ...prev, ...updates }))
      }
    }
    resolve()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, localDB, baseURL, auth.token, relationTo])

  // ---- selection ----

  const maxReached = hasMany && field.maxRows != null && items.length >= field.maxRows
  const belowMin = hasMany && field.minRows != null && items.length < field.minRows

  const selectDoc = (doc: MediaDoc) => {
    const id = String(doc.id ?? '')
    if (!id) return
    setDocsById((prev) => ({ ...prev, [id]: doc }))
    setUploadError(null)
    if (hasMany) {
      if (items.some((it) => it.id === id)) { closeSheet(); return }
      if (field.maxRows != null && items.length >= field.maxRows) { closeSheet(); return }
      emit([...items.map((it) => it.id), id])
    } else {
      emit([id])
    }
    closeSheet()
  }

  const removeAt = (index: number) => {
    emit(items.filter((_, i) => i !== index).map((it) => it.id))
    setUploadError(null)
  }

  const openSheet = () => { setMode('actions'); setSheetOpen(true) }
  const closeSheet = () => { setSheetOpen(false); setMode('actions'); setFocalDoc(null); setSearch('') }

  // ---- upload ----

  const uploadFile = async (uri: string, name: string, mimeType: string) => {
    setUploadingName(name); setUploading(true); setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', { uri, name, type: mimeType } as unknown as Blob)
      formData.append('alt', name.replace(/\.[^.]+$/, ''))
      const response = await fetch(`${baseURL}/api/${relationTo}`, {
        method: 'POST',
        headers: auth.token ? { Authorization: `JWT ${auth.token}` } : {},
        body: formData,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.errors?.[0]?.message || `Upload failed (${response.status})`)
      }
      const data = await response.json()
      const doc: MediaDoc | null = data.doc && typeof data.doc === 'object' ? data.doc : null
      const id = String(doc?.id ?? data.doc ?? '')
      if (id) {
        if (doc) setDocsById((prev) => ({ ...prev, [id]: doc }))
        if (hasMany) emit([...items.map((it) => it.id), id])
        else emit([id])
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setUploadingName(null)
    }
  }

  const imagePickerMediaTypes = (): Array<'images' | 'videos'> => {
    if (!mimeTypes || mimeTypes.length === 0) return ['images', 'videos']
    const allowsImages = mimeTypes.some((m) => m.startsWith('image/') || m === '*/*')
    const allowsVideos = mimeTypes.some((m) => m.startsWith('video/') || m === '*/*')
    if (allowsImages && !allowsVideos) return ['images']
    if (allowsVideos && !allowsImages) return ['videos']
    return ['images', 'videos']
  }

  const pickFromLibrary = async () => {
    closeSheet()
    try {
      const ImagePicker = await import('expo-image-picker')
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') { setUploadError('Permission to access media library was denied'); return }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: imagePickerMediaTypes(), quality: 0.8 })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      await uploadFile(
        asset.uri,
        asset.fileName || `upload-${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
        asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      )
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to pick image')
    }
  }

  const takePhoto = async () => {
    closeSheet()
    try {
      const ImagePicker = await import('expo-image-picker')
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') { setUploadError('Permission to access camera was denied'); return }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      await uploadFile(asset.uri, asset.fileName || `photo-${Date.now()}.jpg`, asset.mimeType || 'image/jpeg')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to take photo')
    }
  }

  const pickDocument = async () => {
    closeSheet()
    if (!DocumentPicker?.getDocumentAsync) return
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: mimeTypes && mimeTypes.length > 0 ? mimeTypes : '*/*',
        copyToCacheDirectory: true,
        multiple: false,
      })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      await uploadFile(asset.uri, asset.name || `file-${Date.now()}`, asset.mimeType || 'application/octet-stream')
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to pick file')
    }
  }

  // ---- browse existing (RxDB prefilter + REST search/pagination) ----

  const loadBrowse = useCallback(async (reset: boolean) => {
    const requestId = ++browseRequestRef.current
    const page = reset ? 1 : browsePageRef.current + 1
    if (reset) setBrowseLoading(true)
    else setBrowseLoadingMore(true)
    try {
      const q = debouncedSearch.trim()
      const result = await payloadApi.find({ baseURL, token: auth.token }, relationTo, {
        page,
        limit: BROWSE_PAGE_SIZE,
        depth: 0,
        sort: '-updatedAt',
        where: mergeWhere(field.filterOptions, q ? { [titleField]: { like: q } } : undefined),
      })
      if (requestId !== browseRequestRef.current) return
      browsePageRef.current = page
      setBrowseDocs((prev) => (reset ? result.docs : [...prev, ...result.docs]))
      setBrowseHasNext(Boolean(result.hasNextPage))
      setBrowseLoaded(true)
    } catch {
      if (requestId !== browseRequestRef.current) return
      if (reset) { setBrowseDocs([]); setBrowseLoaded(false) }
      setBrowseHasNext(false)
    } finally {
      if (requestId === browseRequestRef.current) { setBrowseLoading(false); setBrowseLoadingMore(false) }
    }
  }, [baseURL, auth.token, relationTo, debouncedSearch, field.filterOptions, titleField])

  useEffect(() => {
    if (!sheetOpen || mode !== 'browse') return
    loadBrowse(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, mode, debouncedSearch])

  useEffect(() => {
    if (!sheetOpen || mode !== 'browse') return
    const localCollection = localDB?.collections?.[relationTo]
    if (!localCollection) { setBrowseLocalDocs([]); return }
    const filterSelector = whereToMangoSelector(field.filterOptions)
    if (filterSelector === null) { setBrowseLocalDocs([]); return }

    let cancelled = false
    const run = async () => {
      try {
        const results = await localCollection.find({
          selector: { _deleted: { $eq: false }, ...filterSelector },
          sort: [{ updatedAt: 'desc' }],
          limit: 60,
        }).exec()
        if (cancelled) return
        let docs: MediaDoc[] = results.map((r: any) => r.toJSON())
        const q = search.trim().toLowerCase()
        if (q) {
          docs = docs.filter((doc) =>
            ['filename', 'alt', titleField].some((f) => {
              const v = doc[f]
              return v != null && String(v).toLowerCase().includes(q)
            }),
          )
        }
        setBrowseLocalDocs(docs)
      } catch {
        if (!cancelled) setBrowseLocalDocs([])
      }
    }
    run()
    return () => { cancelled = true }
  }, [sheetOpen, mode, search, localDB, relationTo, field.filterOptions, titleField])

  const browseDisplayDocs = useMemo(() => {
    const seen = new Set<string>()
    const out: MediaDoc[] = []
    const push = (doc: MediaDoc) => {
      const id = String(doc.id ?? '')
      if (id && !seen.has(id)) { seen.add(id); out.push(doc) }
    }
    if (browseLoaded) { browseDocs.forEach(push); browseLocalDocs.forEach(push) }
    else browseLocalDocs.forEach(push)
    return out
  }, [browseDocs, browseLocalDocs, browseLoaded])

  // ---- focal save ----

  const onFocalSaved = (doc: MediaDoc) => {
    const id = String(doc.id ?? '')
    if (id) setDocsById((prev) => ({ ...prev, [id]: doc }))
    closeSheet()
  }

  // ---- render: value previews ----

  const renderThumb = (doc: MediaDoc | null, size: number) => {
    const uri = doc && displayPreview && isImageDoc(doc) ? thumbnailURLFor(baseURL, doc) : null
    if (uri) {
      return <Image source={{ uri }} style={{ width: size, height: size, borderRadius: t.borderRadius.sm }} />
    }
    return (
      <View style={[styles.fileIconBox, { width: size, height: size, backgroundColor: palette.surfaceAlt }]}>
        <LucideIcon name={doc && !isImageDoc(doc) ? 'FileText' : 'Image'} size={size * 0.42} color={palette.placeholder} />
      </View>
    )
  }

  const renderSingleValue = () => {
    const item = items[0]
    const doc = item ? docFor(item.id) : null
    const filename = doc ? docDisplayTitle(doc, titleField) : item?.id
    const sizeLabel = doc ? formatFileSize(doc.filesize) : null
    const mime = doc ? String(doc.mimeType ?? '') : ''

    return (
      <Pressable
        style={[styles.fileRow, { borderColor: palette.border, backgroundColor: palette.surface }]}
        onPress={() => { if (!isDisabled && !uploading) openSheet() }}
        disabled={isDisabled || uploading}
      >
        {renderThumb(doc, 48)}
        <View style={styles.fileInfo}>
          <Text style={[styles.fileName, { color: palette.text }]} numberOfLines={1}>{filename}</Text>
          <Text style={[styles.fileMeta, { color: palette.textMuted }]} numberOfLines={1}>
            {[sizeLabel, mime || relationTo].filter(Boolean).join(' · ')}
          </Text>
        </View>
        {!isDisabled && focalEnabled && displayPreview && doc != null && isImageDoc(doc) && (
          <Pressable
            onPress={() => { setFocalDoc(doc); setMode('focal'); setSheetOpen(true) }}
            hitSlop={8}
            style={styles.inlineAction}
          >
            <LucideIcon name="Crosshair" size={18} color={palette.textMuted} />
          </Pressable>
        )}
        {!isDisabled && (
          <Pressable onPress={() => { emit([]); setUploadError(null) }} hitSlop={8} style={styles.inlineAction}>
            <LucideIcon name="X" size={16} color={palette.textMuted} />
          </Pressable>
        )}
      </Pressable>
    )
  }

  const renderManyValue = () => (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {items.map((it, i) => {
          const doc = docFor(it.id)
          return (
            <View key={`${it.id}-${i}`} style={styles.stripTile}>
              {renderThumb(doc, 84)}
              <Text style={[styles.stripCaption, { color: palette.textMuted }]} numberOfLines={1}>
                {doc ? docDisplayTitle(doc, titleField) : it.id}
              </Text>
              {!isDisabled && (
                <Pressable
                  style={[styles.stripRemove, { backgroundColor: palette.dark ? 'rgba(0,0,0,0.7)' : 'rgba(255,255,255,0.9)' }]}
                  onPress={() => removeAt(i)}
                  hitSlop={6}
                >
                  <LucideIcon name="X" size={12} color={palette.text} />
                </Pressable>
              )}
            </View>
          )
        })}
        {!isDisabled && !maxReached && (
          <Pressable
            style={[styles.addTile, { borderColor: palette.border }]}
            onPress={() => !uploading && openSheet()}
            disabled={uploading}
          >
            {uploading
              ? <ActivityIndicator size="small" />
              : <LucideIcon name="Plus" size={24} color={palette.placeholder} />}
          </Pressable>
        )}
      </ScrollView>
      {belowMin && (
        <Text style={[styles.minHint, { color: palette.placeholder }]}>{`Add at least ${field.minRows}`}</Text>
      )}
    </View>
  )

  const renderEmptySingle = () => (
    <Pressable
      style={[styles.uploadButton, { borderColor: palette.separator }]}
      onPress={() => { if (!isDisabled && !uploading) openSheet() }}
      disabled={isDisabled || uploading}
    >
      {uploading ? (
        <View style={styles.uploadPlaceholder}>
          <ActivityIndicator size="small" />
          <Text style={[styles.uploadHint, { color: palette.textMuted }]}>{`Uploading ${uploadingName ?? 'file'}...`}</Text>
        </View>
      ) : (
        <View style={styles.uploadPlaceholder}>
          <LucideIcon name="Upload" size={22} color={palette.textMuted} />
          <Text style={[styles.uploadHint, { color: palette.textMuted }]}>{`Tap to add from ${relationTo}`}</Text>
        </View>
      )}
    </Pressable>
  )

  // ---- render: sheet modes ----

  const sheetAction = (icon: string, label: string, onPress: () => void, last = false) => (
    <Pressable
      style={[sharedStyles.optionRow, { borderBottomColor: palette.separator }, last && { borderBottomWidth: 0 }]}
      onPress={onPress}
    >
      <LucideIcon name={icon} size={18} color={palette.textMuted} />
      <Text style={[sharedStyles.optionText, { color: palette.text }]}>{label}</Text>
    </Pressable>
  )

  const renderActions = () => (
    <>
      <Text style={[sharedStyles.sheetTitle, { color: palette.text }]}>{`Add to ${relationTo}`}</Text>
      {sheetAction('Images', 'Browse existing', () => setMode('browse'))}
      {sheetAction('ImagePlus', 'Choose from Library', pickFromLibrary)}
      {sheetAction('Camera', 'Take Photo', takePhoto)}
      {DocumentPicker?.getDocumentAsync != null && sheetAction('FileText', 'Choose File', pickDocument)}
      <Pressable style={[sharedStyles.optionRow, { borderBottomWidth: 0 }]} onPress={closeSheet}>
        <Text style={[sharedStyles.optionText, { color: palette.textMuted }]}>Cancel</Text>
      </Pressable>
    </>
  )

  const tileSize = Math.floor((Math.min(windowWidth, 600) - 32 - 2 * t.spacing.sm) / 3)

  const renderBrowse = () => {
    const searchBox = (
      <View style={[styles.searchRow, !glass.available && { backgroundColor: palette.surfaceAlt }]}>
        <LucideIcon name="Search" size={16} color={palette.placeholder} />
        <TextInput
          style={[styles.searchInput, { color: palette.text }]}
          value={search}
          onChangeText={setSearch}
          placeholder={`Search ${relationTo}...`}
          placeholderTextColor={palette.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {browseLoading && <ActivityIndicator size="small" />}
      </View>
    )
    const GlassView = glass.GlassView
    return (
      <>
        <View style={styles.browseHeader}>
          <Pressable onPress={() => setMode('actions')} hitSlop={8}>
            <LucideIcon name="ChevronLeft" size={22} color={palette.textMuted} />
          </Pressable>
          <Text style={[sharedStyles.sheetTitle, { color: palette.text, marginBottom: 0, flex: 1 }]}>
            {`Browse ${relationTo}`}
          </Text>
        </View>
        {glass.available && GlassView
          ? <GlassView style={styles.searchGlass} glassEffectStyle="regular">{searchBox}</GlassView>
          : <View style={styles.searchGlass}>{searchBox}</View>}
        <FlatList
          data={browseDisplayDocs}
          keyExtractor={(item) => String(item.id)}
          numColumns={3}
          keyboardShouldPersistTaps="handled"
          columnWrapperStyle={{ gap: t.spacing.sm }}
          contentContainerStyle={{ gap: t.spacing.sm, paddingBottom: t.spacing.lg }}
          renderItem={({ item }) => {
            const uri = isImageDoc(item) ? thumbnailURLFor(baseURL, item) : null
            const selected = items.some((it) => it.id === String(item.id))
            return (
              <Pressable style={{ width: tileSize }} onPress={() => selectDoc(item)}>
                {uri ? (
                  <Image source={{ uri }} style={[styles.browseThumb, { width: tileSize, height: tileSize }]} />
                ) : (
                  <View style={[styles.browseThumb, styles.fileIconBox, { width: tileSize, height: tileSize, backgroundColor: palette.surfaceAlt }]}>
                    <LucideIcon name="FileText" size={tileSize * 0.34} color={palette.placeholder} />
                  </View>
                )}
                {selected && (
                  <View style={styles.browseCheck}>
                    <LucideIcon name="CircleCheck" size={20} color="#fff" />
                  </View>
                )}
                <Text style={[styles.browseCaption, { color: palette.textMuted }]} numberOfLines={1}>
                  {docDisplayTitle(item, titleField)}
                </Text>
              </Pressable>
            )
          }}
          ListFooterComponent={browseLoaded && browseHasNext ? (
            <Pressable style={styles.loadMoreRow} onPress={() => !browseLoadingMore && loadBrowse(false)}>
              {browseLoadingMore
                ? <ActivityIndicator size="small" />
                : <Text style={[styles.loadMoreText, { color: palette.primary }]}>Load more</Text>}
            </Pressable>
          ) : null}
          ListEmptyComponent={!browseLoading ? (
            <Text style={[sharedStyles.emptyText, { color: palette.textMuted }]}>No results</Text>
          ) : null}
        />
      </>
    )
  }

  const sheetHeight = mode === 'actions' ? 0.38 : mode === 'focal' ? 0.75 : 0.8

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error || uploadError || undefined}
      layout="stacked"
    >
      {hasMany
        ? renderManyValue()
        : items.length > 0
          ? renderSingleValue()
          : renderEmptySingle()}

      {hasMany && uploading && (
        <View style={styles.uploadingRow}>
          <ActivityIndicator size="small" />
          <Text style={[styles.uploadHint, { color: palette.textMuted }]}>{`Uploading ${uploadingName ?? 'file'}...`}</Text>
        </View>
      )}

      <BottomSheet visible={sheetOpen} onClose={closeSheet} height={sheetHeight}>
        {mode === 'focal' && focalDoc ? (
          <FocalPointEditor
            doc={focalDoc}
            collection={relationTo}
            baseURL={baseURL}
            token={auth.token}
            palette={palette}
            onSaved={onFocalSaved}
            onCancel={closeSheet}
          />
        ) : mode === 'browse' ? renderBrowse() : renderActions()}
      </BottomSheet>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  uploadButton: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: t.borderRadius.sm,
    borderStyle: 'dashed',
    padding: t.spacing.md,
    backgroundColor: 'transparent',
  },
  uploadPlaceholder: { alignItems: 'center', gap: t.spacing.xs },
  uploadHint: { fontSize: t.fontSize.sm },
  uploadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.xs,
  },

  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    padding: t.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: t.borderRadius.md,
  },
  fileInfo: { flex: 1, gap: 2 },
  fileName: { fontSize: t.fontSize.md, fontWeight: '600' },
  fileMeta: { fontSize: t.fontSize.xs },
  fileIconBox: { alignItems: 'center', justifyContent: 'center', borderRadius: t.borderRadius.sm },
  inlineAction: { padding: t.spacing.xs },

  strip: { flexDirection: 'row', gap: t.spacing.sm, paddingVertical: t.spacing.xs },
  stripTile: { width: 84 },
  stripCaption: { fontSize: t.fontSize.xs, marginTop: 2 },
  stripRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addTile: {
    width: 84,
    height: 84,
    borderRadius: t.borderRadius.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  minHint: { fontSize: t.fontSize.xs, marginTop: 2 },

  browseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    marginBottom: t.spacing.md,
  },
  searchGlass: { borderRadius: t.borderRadius.md, overflow: 'hidden', marginBottom: t.spacing.md },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
    borderRadius: t.borderRadius.md,
  },
  searchInput: { flex: 1, paddingVertical: t.spacing.sm + 2, fontSize: t.fontSize.md },

  browseThumb: { borderRadius: t.borderRadius.sm },
  browseCaption: { fontSize: t.fontSize.xs, marginTop: 2 },
  browseCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12,
  },

  loadMoreRow: { paddingVertical: t.spacing.md, alignItems: 'center' },
  loadMoreText: { fontSize: t.fontSize.sm, fontWeight: '600' },

  focalBox: { alignItems: 'stretch' },
  focalDot: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  focalDotInner: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' },
  focalHint: { fontSize: t.fontSize.xs, textAlign: 'center', marginTop: t.spacing.sm },
  focalActions: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginTop: t.spacing.lg },
  focalSaveBtn: {
    flex: 1,
    borderRadius: t.borderRadius.md,
    paddingVertical: t.spacing.md,
    alignItems: 'center',
  },
  focalSaveText: { fontSize: t.fontSize.md, fontWeight: '600' },
  focalCancelBtn: { paddingVertical: t.spacing.md, paddingHorizontal: t.spacing.lg },
  focalCancelText: { fontSize: t.fontSize.md },
})
