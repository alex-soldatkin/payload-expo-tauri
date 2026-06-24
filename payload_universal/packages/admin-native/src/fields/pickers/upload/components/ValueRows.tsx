import React from 'react'
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native'

import type { ClientUploadField } from '../../../../types'
import { defaultTheme as t } from '../../../../theme'
import { LucideIcon, type PickerPalette, docDisplayTitle, formatFileSize } from '../../shared'
import { styles } from '../styles'
import type { MediaDoc } from '../types'
import { isImageDoc, thumbnailURLFor } from '../utils'

type Item = { id: string; doc: MediaDoc | null }

/** Sizes-aware thumbnail (image preview) or a file-type icon box fallback. */
export const renderThumb = (
  doc: MediaDoc | null,
  size: number,
  opts: { baseURL: string; palette: PickerPalette; displayPreview: boolean },
) => {
  const { baseURL, palette, displayPreview } = opts
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

type SharedProps = {
  field: ClientUploadField
  palette: PickerPalette
  baseURL: string
  relationTo: string
  titleField: string
  displayPreview: boolean
  isDisabled: boolean | undefined
  uploading: boolean
}

/**
 * Single value row — borderless thumbnail + filename/meta, with inline focal
 * point + clear actions. Tapping opens the picker sheet.
 */
export const SingleValue: React.FC<SharedProps & {
  items: Item[]
  docFor: (id: string) => MediaDoc | null
  focalEnabled: boolean
  openSheet: () => void
  openFocal: (doc: MediaDoc) => void
  clear: () => void
}> = ({
  field, palette, baseURL, relationTo, titleField, displayPreview, isDisabled, uploading,
  items, docFor, focalEnabled, openSheet, openFocal, clear,
}) => {
  const item = items[0]
  const doc = item ? docFor(item.id) : null
  const filename = doc ? docDisplayTitle(doc, titleField) : item?.id
  const sizeLabel = doc ? formatFileSize(doc.filesize) : null
  const mime = doc ? String(doc.mimeType ?? '') : ''

  // Borderless value row (row contract: the field adds NO card borders —
  // FormSection owns the card; FieldShell owns the label).
  return (
    <Pressable
      style={styles.fileRow}
      onPress={() => { if (!isDisabled && !uploading) openSheet() }}
      disabled={isDisabled || uploading}
    >
      {renderThumb(doc, 48, { baseURL, palette, displayPreview })}
      <View style={styles.fileInfo}>
        <Text style={[styles.fileName, { color: palette.text }]} numberOfLines={1}>{filename}</Text>
        <Text style={[styles.fileMeta, { color: palette.textMuted }]} numberOfLines={1}>
          {[sizeLabel, mime || relationTo].filter(Boolean).join(' · ')}
        </Text>
      </View>
      {!isDisabled && focalEnabled && displayPreview && doc != null && isImageDoc(doc) && (
        <Pressable
          onPress={() => openFocal(doc)}
          hitSlop={8}
          style={styles.inlineAction}
        >
          <LucideIcon name="Crosshair" size={18} color={palette.textMuted} />
        </Pressable>
      )}
      {!isDisabled && (
        <Pressable onPress={clear} hitSlop={8} style={styles.inlineAction}>
          <LucideIcon name="X" size={16} color={palette.textMuted} />
        </Pressable>
      )}
    </Pressable>
  )
}

/** hasMany horizontal thumbnail strip + add tile, with minRows hint. */
export const ManyValue: React.FC<SharedProps & {
  items: Item[]
  docFor: (id: string) => MediaDoc | null
  maxReached: boolean | undefined
  belowMin: boolean | undefined
  removeAt: (i: number) => void
  openSheet: () => void
}> = ({
  field, palette, baseURL, titleField, displayPreview, isDisabled, uploading,
  items, docFor, maxReached, belowMin, removeAt, openSheet,
}) => (
  <View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {items.map((it, i) => {
        const doc = docFor(it.id)
        return (
          <View key={`${it.id}-${i}`} style={styles.stripTile}>
            {renderThumb(doc, 84, { baseURL, palette, displayPreview })}
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
          style={[styles.addTile, { backgroundColor: palette.fill }]}
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

/**
 * Empty single state — plain tappable muted row (no dashed boxes; mirrors the
 * relationship single-trigger pattern so empty pickers align row-to-row).
 */
export const EmptySingle: React.FC<{
  palette: PickerPalette
  relationTo: string
  isDisabled: boolean | undefined
  uploading: boolean
  uploadingName: string | null
  openSheet: () => void
}> = ({ palette, relationTo, isDisabled, uploading, uploadingName, openSheet }) => (
  <Pressable
    style={styles.emptyRow}
    onPress={() => { if (!isDisabled && !uploading) openSheet() }}
    disabled={isDisabled || uploading}
  >
    {uploading ? (
      <>
        <ActivityIndicator size="small" />
        <Text style={[styles.emptyText, { color: palette.textMuted }]} numberOfLines={1}>
          {`Uploading ${uploadingName ?? 'file'}...`}
        </Text>
      </>
    ) : (
      <>
        <Text style={[styles.emptyText, { color: palette.placeholder }]} numberOfLines={1}>
          {`Add from ${relationTo}...`}
        </Text>
        <Text style={[styles.chevron, { color: palette.textMuted }]}>›</Text>
      </>
    )}
  </Pressable>
)
