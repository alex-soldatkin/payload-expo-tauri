/**
 * Picker-based fields that open a BottomSheet: select, radio, relationship, upload.
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import type {
  ClientRadioField,
  ClientRelationshipField,
  ClientSelectField,
  ClientUploadField,
  FieldComponentProps,
} from '../types'
import { defaultTheme as t } from '../theme'
import { getFieldDescription, getFieldLabel, normalizeOption } from '../schemaHelpers'
import { BottomSheet } from '../BottomSheet'
import { usePayloadNative } from '../PayloadNativeProvider'
import { payloadApi } from '../api'

// ---------------------------------------------------------------------------
// Shared field shell
// ---------------------------------------------------------------------------

const FieldShell: React.FC<{
  label: string
  description?: string
  required?: boolean
  error?: string
  children: React.ReactNode
}> = ({ label, description, required, error, children }) => (
  <View style={styles.container}>
    <Text style={styles.label}>
      {label}
      {required && <Text style={styles.required}> *</Text>}
    </Text>
    {children}
    {description && <Text style={styles.description}>{description}</Text>}
    {error && <Text style={styles.error}>{error}</Text>}
  </View>
)

// ---------------------------------------------------------------------------
// Select → BottomSheet with option list
// ---------------------------------------------------------------------------

export const SelectField: React.FC<FieldComponentProps<ClientSelectField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
  const [open, setOpen] = useState(false)
  const options = (field.options ?? []).map(normalizeOption)
  const selected = options.find((o) => o.value === value)

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error}
    >
      <Pressable
        style={[styles.pickerButton, error && styles.pickerButtonError]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled || field.admin?.readOnly}
      >
        <Text style={[styles.pickerText, !selected && styles.pickerPlaceholder]}>
          {selected?.label ?? 'Select...'}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} height={0.45}>
        <Text style={styles.sheetTitle}>{getFieldLabel(field)}</Text>
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.optionRow, item.value === value && styles.optionSelected]}
              onPress={() => { onChange(item.value); setOpen(false) }}
            >
              <Text style={[styles.optionText, item.value === value && styles.optionTextSelected]}>
                {item.label}
              </Text>
              {item.value === value && <Text style={styles.checkMark}>✓</Text>}
            </Pressable>
          )}
        />
        {value != null && (
          <Pressable style={styles.clearBtn} onPress={() => { onChange(null); setOpen(false) }}>
            <Text style={styles.clearText}>Clear selection</Text>
          </Pressable>
        )}
      </BottomSheet>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Radio → BottomSheet with option list (single-select, no clear)
// ---------------------------------------------------------------------------

export const RadioField: React.FC<FieldComponentProps<ClientRadioField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
  const [open, setOpen] = useState(false)
  const options = (field.options ?? []).map(normalizeOption)
  const selected = options.find((o) => o.value === value)

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error}
    >
      <Pressable
        style={[styles.pickerButton, error && styles.pickerButtonError]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled || field.admin?.readOnly}
      >
        <Text style={[styles.pickerText, !selected && styles.pickerPlaceholder]}>
          {selected?.label ?? 'Select...'}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} height={0.45}>
        <Text style={styles.sheetTitle}>{getFieldLabel(field)}</Text>
        <FlatList
          data={options}
          keyExtractor={(item) => item.value}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.optionRow, item.value === value && styles.optionSelected]}
              onPress={() => { onChange(item.value); setOpen(false) }}
            >
              <View style={[styles.radioCircle, item.value === value && styles.radioCircleSelected]}>
                {item.value === value && <View style={styles.radioDot} />}
              </View>
              <Text style={styles.optionText}>{item.label}</Text>
            </Pressable>
          )}
        />
      </BottomSheet>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Relationship → BottomSheet with search + paginated results
// ---------------------------------------------------------------------------

export const RelationshipField: React.FC<FieldComponentProps<ClientRelationshipField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
  const { baseURL, auth } = usePayloadNative()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [docs, setDocs] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)
  const relationTo = Array.isArray(field.relationTo) ? field.relationTo[0] : field.relationTo

  const loadDocs = useCallback(async (q?: string) => {
    setLoading(true)
    try {
      const where = q ? { or: [
        { title: { contains: q } },
        { name: { contains: q } },
        { email: { contains: q } },
      ]} : undefined
      const result = await payloadApi.find({ baseURL, token: auth.token }, relationTo, {
        limit: 25,
        where: where as Record<string, unknown> | undefined,
        depth: 0,
      })
      setDocs(result.docs)
    } catch {
      setDocs([])
    } finally {
      setLoading(false)
    }
  }, [baseURL, auth.token, relationTo])

  useEffect(() => {
    if (open) loadDocs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const displayValue = value
    ? (typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>).title ?? (value as Record<string, unknown>).name ?? (value as Record<string, unknown>).email ?? (value as Record<string, unknown>).id
        : value)
    : null

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error}
    >
      <Pressable
        style={[styles.pickerButton, error && styles.pickerButtonError]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled || field.admin?.readOnly}
      >
        <Text style={[styles.pickerText, !displayValue && styles.pickerPlaceholder]}>
          {displayValue ? String(displayValue) : `Select ${relationTo}...`}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <BottomSheet visible={open} onClose={() => setOpen(false)} height={0.6}>
        <Text style={styles.sheetTitle}>Select {relationTo}</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={(v) => { setSearch(v); loadDocs(v) }}
          placeholder="Search..."
          placeholderTextColor={t.colors.textPlaceholder}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator style={{ marginVertical: 12 }} />}
        <FlatList
          data={docs}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const title = String(item.title ?? item.name ?? item.email ?? item.id)
            const isSelected = value === item.id || (typeof value === 'object' && value !== null && (value as Record<string, unknown>).id === item.id)
            return (
              <Pressable
                style={[styles.optionRow, isSelected && styles.optionSelected]}
                onPress={() => { onChange(item.id); setOpen(false) }}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{title}</Text>
                {isSelected && <Text style={styles.checkMark}>✓</Text>}
              </Pressable>
            )
          }}
          ListEmptyComponent={!loading ? <Text style={styles.emptyText}>No results</Text> : null}
        />
        {value != null && (
          <Pressable style={styles.clearBtn} onPress={() => { onChange(null); setOpen(false) }}>
            <Text style={styles.clearText}>Clear selection</Text>
          </Pressable>
        )}
      </BottomSheet>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Upload → Image picker (from library or camera) + upload to Payload
// ---------------------------------------------------------------------------

export const UploadField: React.FC<FieldComponentProps<ClientUploadField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
  const { baseURL, auth } = usePayloadNative()
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [showOptions, setShowOptions] = useState(false)

  const displayValue = value
    ? (typeof value === 'object' && value !== null
        ? (value as Record<string, unknown>).filename ?? (value as Record<string, unknown>).alt ?? (value as Record<string, unknown>).id
        : value)
    : null

  const uploadFile = async (uri: string, name: string, mimeType: string) => {
    setFileName(name)
    setUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append('file', {
        uri,
        name,
        type: mimeType,
      } as unknown as Blob)
      formData.append('alt', name.replace(/\.[^.]+$/, ''))

      const response = await fetch(`${baseURL}/api/${field.relationTo}`, {
        method: 'POST',
        headers: {
          ...(auth.token ? { Authorization: `JWT ${auth.token}` } : {}),
        },
        body: formData,
      })

      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.errors?.[0]?.message || `Upload failed (${response.status})`)
      }

      const data = await response.json()
      onChange(data.doc?.id ?? data.doc)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const pickFromLibrary = async () => {
    setShowOptions(false)
    try {
      const ImagePicker = await import('expo-image-picker')
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        setUploadError('Permission to access media library was denied')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        quality: 0.8,
      })

      if (result.canceled || !result.assets?.[0]) return

      const asset = result.assets[0]
      const name = asset.fileName || `upload-${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`
      const mime = asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg')
      await uploadFile(asset.uri, name, mime)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to pick image')
    }
  }

  const takePhoto = async () => {
    setShowOptions(false)
    try {
      const ImagePicker = await import('expo-image-picker')
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        setUploadError('Permission to access camera was denied')
        return
      }

      const result = await ImagePicker.launchCameraAsync({
        quality: 0.8,
      })

      if (result.canceled || !result.assets?.[0]) return

      const asset = result.assets[0]
      const name = asset.fileName || `photo-${Date.now()}.jpg`
      const mime = asset.mimeType || 'image/jpeg'
      await uploadFile(asset.uri, name, mime)
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to take photo')
    }
  }

  const handleClear = () => {
    onChange(null)
    setFileName(null)
    setUploadError(null)
  }

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error || uploadError || undefined}
    >
      <Pressable
        style={[styles.uploadButton, error && styles.pickerButtonError]}
        onPress={() => {
          if (!disabled && !field.admin?.readOnly && !uploading) {
            setShowOptions(true)
          }
        }}
        disabled={disabled || field.admin?.readOnly || uploading}
      >
        {uploading ? (
          <View style={styles.uploadPlaceholder}>
            <ActivityIndicator size="small" />
            <Text style={styles.uploadHint}>Uploading {fileName ?? 'file'}...</Text>
          </View>
        ) : displayValue ? (
          <View style={styles.uploadSelected}>
            <View style={styles.uploadSelectedInfo}>
              <Text style={styles.uploadFileName} numberOfLines={1}>
                {fileName || String(displayValue)}
              </Text>
              <Text style={styles.uploadHint}>{field.relationTo}</Text>
            </View>
            <Pressable onPress={handleClear} hitSlop={8}>
              <Text style={styles.uploadClear}>✕</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.uploadPlaceholder}>
            <Text style={styles.uploadIcon}>↑</Text>
            <Text style={styles.uploadHint}>Tap to upload to {field.relationTo}</Text>
          </View>
        )}
      </Pressable>

      {/* Upload source picker */}
      <BottomSheet visible={showOptions} onClose={() => setShowOptions(false)} height={0.3}>
        <Text style={styles.sheetTitle}>Upload to {field.relationTo}</Text>
        <Pressable style={styles.optionRow} onPress={pickFromLibrary}>
          <Text style={styles.optionText}>Choose from Library</Text>
        </Pressable>
        <Pressable style={styles.optionRow} onPress={takePhoto}>
          <Text style={styles.optionText}>Take Photo</Text>
        </Pressable>
        <Pressable style={[styles.optionRow, { borderBottomWidth: 0 }]} onPress={() => setShowOptions(false)}>
          <Text style={[styles.optionText, { color: t.colors.textMuted }]}>Cancel</Text>
        </Pressable>
      </BottomSheet>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { marginBottom: t.spacing.lg },
  label: { fontSize: t.fontSize.sm, fontWeight: '600', color: t.colors.text, marginBottom: t.spacing.xs },
  required: { color: t.colors.error },
  description: { fontSize: t.fontSize.xs, color: t.colors.textMuted, marginTop: t.spacing.xs },
  error: { fontSize: t.fontSize.xs, color: t.colors.error, marginTop: t.spacing.xs },

  // Picker button
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
    backgroundColor: t.colors.surface,
  },
  pickerButtonError: { borderColor: t.colors.error },
  pickerText: { fontSize: t.fontSize.md, color: t.colors.text, flex: 1 },
  pickerPlaceholder: { color: t.colors.textPlaceholder },
  chevron: { fontSize: 20, color: t.colors.textMuted, marginLeft: t.spacing.sm },

  // BottomSheet content
  sheetTitle: { fontSize: t.fontSize.lg, fontWeight: '700', color: t.colors.text, marginBottom: t.spacing.md },
  searchInput: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    fontSize: t.fontSize.md,
    marginBottom: t.spacing.md,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.separator,
  },
  optionSelected: { backgroundColor: '#f5f5f5' },
  optionText: { fontSize: t.fontSize.md, color: t.colors.text, flex: 1 },
  optionTextSelected: { fontWeight: '600' },
  checkMark: { fontSize: 16, color: t.colors.primary, marginLeft: t.spacing.sm },

  // Radio
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: t.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: t.spacing.md,
  },
  radioCircleSelected: { borderColor: t.colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.colors.primary },

  // Clear
  clearBtn: { paddingVertical: t.spacing.md, alignItems: 'center' },
  clearText: { fontSize: t.fontSize.sm, color: t.colors.destructive },

  // Upload
  uploadButton: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.sm,
    borderStyle: 'dashed',
    padding: t.spacing.lg,
    backgroundColor: t.colors.surface,
  },
  uploadPlaceholder: { alignItems: 'center', gap: t.spacing.xs },
  uploadIcon: { fontSize: 24, color: t.colors.textMuted },
  uploadHint: { fontSize: t.fontSize.sm, color: t.colors.textMuted },
  uploadSelected: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
  },
  uploadSelectedInfo: { flex: 1 },
  uploadFileName: { fontSize: t.fontSize.md, fontWeight: '600', color: t.colors.text },
  uploadClear: { fontSize: 16, color: t.colors.textMuted, fontWeight: '700', padding: t.spacing.xs },

  emptyText: { textAlign: 'center', paddingVertical: t.spacing.xl, color: t.colors.textMuted, fontSize: t.fontSize.sm },
})
