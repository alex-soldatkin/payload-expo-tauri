/**
 * Picker-based fields that open a BottomSheet: select, radio, relationship, upload.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { Picker } from '@react-native-picker/picker'
// Dynamic import — expo-router is a peer dep, may resolve differently in workspace
let Link: any = null
try { Link = require('expo-router').Link } catch { /* previews disabled */ }

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
// Select — native Picker (single) or multi-select chips (hasMany)
// ---------------------------------------------------------------------------

export const SelectField: React.FC<FieldComponentProps<ClientSelectField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
  const options = (field.options ?? []).map(normalizeOption)
  const isMulti = field.hasMany === true
  const isDisabled = disabled || field.admin?.readOnly

  // Multi-select: value is an array of strings
  const selectedValues: string[] = isMulti
    ? (Array.isArray(value) ? value as string[] : value ? [String(value)] : [])
    : []

  const toggleMulti = (optValue: string) => {
    if (selectedValues.includes(optValue)) {
      onChange(selectedValues.filter((v) => v !== optValue))
    } else {
      onChange([...selectedValues, optValue])
    }
  }

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error}
    >
      {isMulti ? (
        /* Multi-select: chip toggles */
        <View style={selectStyles.chipContainer}>
          {options.map((opt) => {
            const isSelected = selectedValues.includes(opt.value)
            return (
              <Pressable
                key={opt.value}
                style={[selectStyles.chip, isSelected && selectStyles.chipSelected]}
                onPress={() => !isDisabled && toggleMulti(opt.value)}
                disabled={isDisabled}
              >
                <Text style={[selectStyles.chipText, isSelected && selectStyles.chipTextSelected]}>
                  {opt.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ) : (
        /* Single select: native Picker */
        <View style={[selectStyles.pickerWrapper, error && styles.pickerButtonError]}>
          <Picker
            selectedValue={value ?? ''}
            onValueChange={(v) => onChange(v === '' ? null : v)}
            enabled={!isDisabled}
            style={selectStyles.picker}
            itemStyle={selectStyles.pickerItem}
          >
            <Picker.Item label="Select..." value="" color={t.colors.textPlaceholder} />
            {options.map((opt) => (
              <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
            ))}
          </Picker>
        </View>
      )}
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Radio — native Picker (always single-select)
// ---------------------------------------------------------------------------

export const RadioField: React.FC<FieldComponentProps<ClientRadioField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
  const options = (field.options ?? []).map(normalizeOption)
  const isDisabled = disabled || field.admin?.readOnly

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error}
    >
      <View style={[selectStyles.pickerWrapper, error && styles.pickerButtonError]}>
        <Picker
          selectedValue={value ?? ''}
          onValueChange={(v) => onChange(v === '' ? null : v)}
          enabled={!isDisabled}
          style={selectStyles.picker}
          itemStyle={selectStyles.pickerItem}
        >
          <Picker.Item label="Select..." value="" color={t.colors.textPlaceholder} />
          {options.map((opt) => (
            <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
          ))}
        </Picker>
      </View>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Relationship → BottomSheet with search + paginated results
// ---------------------------------------------------------------------------

/** Extract a human-readable title from a document, respecting useAsTitle. */
const docDisplayTitle = (doc: Record<string, unknown>, useAsTitle?: string): string => {
  if (useAsTitle && doc[useAsTitle] != null) return String(doc[useAsTitle])
  return String(doc.title ?? doc.name ?? doc.email ?? doc.id ?? '')
}

/**
 * Optional import of local-db for local-first relationship queries.
 * Wrapped in try/catch so admin-native doesn't hard-depend on local-db.
 */
let _useLocalDB: (() => any) | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const localDbModule = require('@payload-universal/local-db')
  _useLocalDB = localDbModule.useLocalDB
} catch {
  // local-db not available — will fall back to REST API
}

export const RelationshipField: React.FC<FieldComponentProps<ClientRelationshipField>> = ({
  field,
  value,
  onChange,
  disabled,
  error,
}) => {
  const { baseURL, auth, schema } = usePayloadNative()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [allDocs, setAllDocs] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)
  // Cached display label for the selected value (survives value being just an ID)
  const [displayLabel, setDisplayLabel] = useState<string | null>(null)
  const relationTo = Array.isArray(field.relationTo) ? field.relationTo[0] : field.relationTo

  // Get useAsTitle from the related collection's menu model
  const useAsTitle = schema?.menuModel?.collections.find(
    (c: any) => c.slug === relationTo,
  )?.useAsTitle

  // Local-first: try to get local DB from context
  const localDB = _useLocalDB ? _useLocalDB() : null
  const localCollection = localDB?.collections?.[relationTo]

  // Load all docs for the related collection (local-first, API fallback)
  const loadDocs = useCallback(async () => {
    setLoading(true)
    try {
      if (localCollection) {
        // Local-first: query RxDB directly
        const results = await localCollection.find({
          selector: { _deleted: { $eq: false } },
          sort: [{ updatedAt: 'desc' }],
          limit: 50,
        }).exec()
        setAllDocs(results.map((r: any) => r.toJSON()))
      } else {
        // API fallback
        const result = await payloadApi.find({ baseURL, token: auth.token }, relationTo, {
          limit: 50,
          depth: 0,
          sort: '-updatedAt',
        })
        setAllDocs(result.docs)
      }
    } catch {
      setAllDocs([])
    } finally {
      setLoading(false)
    }
  }, [localCollection, baseURL, auth.token, relationTo])

  useEffect(() => {
    if (open) loadDocs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Client-side search filtering
  const filteredDocs = useMemo(() => {
    if (!search.trim()) return allDocs
    const q = search.toLowerCase()
    return allDocs.filter((doc) => {
      // Search across useAsTitle field + common fields
      const fields = new Set(['title', 'name', 'email', 'id'])
      if (useAsTitle) fields.add(useAsTitle)
      return Array.from(fields).some((f) => {
        const val = doc[f]
        return val != null && String(val).toLowerCase().includes(q)
      })
    })
  }, [allDocs, search, useAsTitle])

  // Resolve display label when the value is an object (populated) or just an ID
  const selectedId = value
    ? (typeof value === 'object' && value !== null
        ? String((value as Record<string, unknown>).id ?? '')
        : String(value))
    : null

  // If value is a populated object, extract display title immediately
  useEffect(() => {
    if (!value) {
      setDisplayLabel(null)
      return
    }
    if (typeof value === 'object' && value !== null) {
      setDisplayLabel(docDisplayTitle(value as Record<string, unknown>, useAsTitle))
      return
    }
    // Value is just an ID — resolve display title (local-first, API fallback)
    if (typeof value === 'string' && value.length > 0) {
      let cancelled = false
      const resolve = async () => {
        try {
          if (localCollection) {
            const rxDoc = await localCollection.findOne(value).exec()
            if (!cancelled && rxDoc) {
              setDisplayLabel(docDisplayTitle(rxDoc.toJSON(), useAsTitle))
              return
            }
          }
          // API fallback
          const doc = await payloadApi.findByID({ baseURL, token: auth.token }, relationTo, value, { depth: 0 })
          if (!cancelled && doc) setDisplayLabel(docDisplayTitle(doc, useAsTitle))
        } catch {
          if (!cancelled) setDisplayLabel(String(value))
        }
      }
      resolve()
      return () => { cancelled = true }
    }
  }, [value, baseURL, auth.token, relationTo, useAsTitle, localCollection])

  const displayValue = displayLabel || (selectedId ?? null)

  const selectedHref = selectedId
    ? `/(admin)/collections/${relationTo}/${selectedId}`
    : null

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error}
    >
      {/* Selected value: tap opens picker, long-press the label previews the related doc */}
      <Pressable
        style={[styles.pickerButton, error && styles.pickerButtonError]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled || field.admin?.readOnly}
      >
        {selectedHref && displayValue && Link?.Trigger ? (
          <Link href={selectedHref as any} push style={{ flex: 1 }}>
            <Link.Trigger>
              <Text style={styles.pickerText} numberOfLines={1}>{String(displayValue)}</Text>
            </Link.Trigger>
            <Link.Preview />
            <Link.Menu>
              <Link.MenuAction icon="eye" onPress={() => {}}>
                View {relationTo}
              </Link.MenuAction>
              <Link.MenuAction icon="pencil" onPress={() => !disabled && setOpen(true)}>
                Change
              </Link.MenuAction>
              <Link.MenuAction icon="xmark.circle" destructive onPress={() => onChange(null)}>
                Clear
              </Link.MenuAction>
            </Link.Menu>
          </Link>
        ) : displayValue ? (
          <Text style={styles.pickerText} numberOfLines={1}>{String(displayValue)}</Text>
        ) : (
          <Text style={[styles.pickerText, styles.pickerPlaceholder]}>
            {`Select ${relationTo}...`}
          </Text>
        )}
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      {/* Picker bottom sheet — Link.Preview not used here (modals don't support it) */}
      <BottomSheet visible={open} onClose={() => setOpen(false)} height={0.6}>
        <Text style={styles.sheetTitle}>Select {relationTo}</Text>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search..."
          placeholderTextColor={t.colors.textPlaceholder}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator style={{ marginVertical: 12 }} />}
        <FlatList
          data={filteredDocs}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => {
            const title = docDisplayTitle(item, useAsTitle)
            const isSelected = value === item.id || (typeof value === 'object' && value !== null && (value as Record<string, unknown>).id === item.id)
            return (
              <Pressable
                style={[styles.optionRow, isSelected && styles.optionSelected]}
                onPress={() => { setDisplayLabel(title); onChange(item.id); setOpen(false) }}
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

// ---------------------------------------------------------------------------
// Select / Radio native picker styles
// ---------------------------------------------------------------------------

const selectStyles = StyleSheet.create({
  pickerWrapper: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.surface,
    overflow: 'hidden',
  },
  picker: {
    ...Platform.select({
      ios: { marginHorizontal: -8 },
      android: { marginHorizontal: 4 },
    }),
  },
  pickerItem: {
    fontSize: t.fontSize.md,
    color: t.colors.text,
  },
  // Multi-select chips
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: t.spacing.xs,
  },
  chip: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs + 2,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: t.colors.border,
    backgroundColor: t.colors.surface,
  },
  chipSelected: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  chipText: {
    fontSize: t.fontSize.sm,
    color: t.colors.text,
    fontWeight: '500',
  },
  chipTextSelected: {
    color: t.colors.primaryText,
  },
})
