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
import React, { useCallback, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'

import type { ClientUploadField, FieldComponentProps } from '../../../types'
import { defaultTheme as t } from '../../../theme'
import { getFieldDescription, getFieldLabel } from '../../../utils/schemaHelpers'
import { BottomSheet } from '../../../BottomSheet'
import { usePayloadNative } from '../../../PayloadNativeProvider'
import { FieldShell } from '../../shared'
import { useOptionalLocalDB, usePickerPalette } from '../shared'
import { ActionsSheet } from './components/ActionsSheet'
import { BrowseSheet } from './components/BrowseSheet'
import { EmptySingle, ManyValue, SingleValue } from './components/ValueRows'
import { FocalPointEditor } from './components/FocalPointEditor'
import { useBrowse } from './hooks/useBrowse'
import { useResolveDocs } from './hooks/useResolveDocs'
import { styles } from './styles'
import { type MediaDoc, type SheetMode } from './types'
import { DocumentPicker } from './utils'

// Re-export the public API so `from './upload'` resolves identically.
export type { MediaDoc, SheetMode } from './types'

// ---------------------------------------------------------------------------
// UploadField
// ---------------------------------------------------------------------------

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

  const { setDocsById, docFor } = useResolveDocs(items, localDB, baseURL, auth.token, relationTo)

  const browse = useBrowse({
    sheetOpen,
    mode,
    baseURL,
    token: auth.token,
    relationTo,
    localDB,
    filterOptions: field.filterOptions,
    titleField,
  })
  const { search, setSearch, resetSearch, loadBrowse } = browse

  const emit = useCallback((ids: string[]) => {
    if (hasMany) onChange(ids)
    else onChange(ids[0] ?? null)
  }, [hasMany, onChange])

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
  const closeSheet = () => { setSheetOpen(false); setMode('actions'); setFocalDoc(null); resetSearch() }

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

  // ---- focal save ----

  const onFocalSaved = (doc: MediaDoc) => {
    const id = String(doc.id ?? '')
    if (id) setDocsById((prev) => ({ ...prev, [id]: doc }))
    closeSheet()
  }

  const tileSize = Math.floor((Math.min(windowWidth, 600) - 32 - 2 * t.spacing.sm) / 3)

  const sheetHeight = mode === 'actions' ? 0.38 : mode === 'focal' ? 0.75 : 0.8

  const sharedRowProps = {
    field, palette, baseURL, relationTo, titleField, displayPreview, isDisabled, uploading,
  }

  // Row contract: single upload is an INLINE row (label left, value row as
  // the control); hasMany keeps its thumbnail strip under a STACKED label.
  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error || uploadError || undefined}
      layout={hasMany ? 'stacked' : 'inline'}
    >
      {hasMany ? (
        <ManyValue
          {...sharedRowProps}
          items={items}
          docFor={docFor}
          maxReached={maxReached}
          belowMin={belowMin}
          removeAt={removeAt}
          openSheet={openSheet}
        />
      ) : items.length > 0 ? (
        <SingleValue
          {...sharedRowProps}
          items={items}
          docFor={docFor}
          focalEnabled={focalEnabled}
          openSheet={openSheet}
          openFocal={(doc) => { setFocalDoc(doc); setMode('focal'); setSheetOpen(true) }}
          clear={() => { emit([]); setUploadError(null) }}
        />
      ) : (
        <EmptySingle
          palette={palette}
          relationTo={relationTo}
          isDisabled={isDisabled}
          uploading={uploading}
          uploadingName={uploadingName}
          openSheet={openSheet}
        />
      )}

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
        ) : mode === 'browse' ? (
          <BrowseSheet
            relationTo={relationTo}
            baseURL={baseURL}
            palette={palette}
            tileSize={tileSize}
            search={search}
            setSearch={setSearch}
            browseLoading={browse.browseLoading}
            browseLoaded={browse.browseLoaded}
            browseHasNext={browse.browseHasNext}
            browseLoadingMore={browse.browseLoadingMore}
            browseDisplayDocs={browse.browseDisplayDocs}
            titleField={titleField}
            items={items}
            onBack={() => setMode('actions')}
            onSelect={selectDoc}
            onLoadMore={() => loadBrowse(false)}
          />
        ) : (
          <ActionsSheet
            relationTo={relationTo}
            palette={palette}
            onBrowse={() => setMode('browse')}
            onPickFromLibrary={pickFromLibrary}
            onTakePhoto={takePhoto}
            onPickDocument={pickDocument}
            onCancel={closeSheet}
          />
        )}
      </BottomSheet>
    </FieldShell>
  )
}
