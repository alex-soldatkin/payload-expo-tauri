/**
 * Picker-based fields: select, radio, relationship, upload.
 *
 * Select/Radio use @expo/ui native Picker when available (resolved
 * per-platform via shared/native). Falls back to @react-native-picker/picker.
 *
 * Relationship and Upload are platform-agnostic (BottomSheet-based).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
// Dynamic import — @react-native-picker/picker requires native module
// not available in Expo Go. Falls back to a simple Pressable-based picker.
let Picker: any = null
try { Picker = require('@react-native-picker/picker').Picker } catch { /* not available */ }

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
import { FieldShell, fieldShellStyles, nativeComponents } from './shared'
import { NativeHost } from './NativeHost'

import { PreviewContextProvider } from '../PreviewContext'

// Lazy-loaded DocumentForm to avoid circular dep (pickers → DocumentForm → fields → pickers)
let _DocumentForm: React.ComponentType<any> | null = null
const getDocumentForm = () => {
  if (!_DocumentForm) {
    try { _DocumentForm = require('../DocumentForm').DocumentForm } catch { /* not available */ }
  }
  return _DocumentForm
}

const noopSubmit = async () => {}

// ---------------------------------------------------------------------------
// Select
// ---------------------------------------------------------------------------

/** Multi-select chip toggles — shared across platforms. */
const SelectFieldMultiChips: React.FC<FieldComponentProps<ClientSelectField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const options = (field.options ?? []).map(normalizeOption)
  const isDisabled = disabled || field.admin?.readOnly
  const selected: string[] = Array.isArray(value) ? value as string[] : value ? [String(value)] : []

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((s) => s !== v) : [...selected, v])

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
      <View style={chipStyles.container}>
        {options.map((opt) => {
          const on = selected.includes(opt.value)
          return (
            <Pressable key={opt.value} style={[chipStyles.chip, on && chipStyles.chipOn]} onPress={() => !isDisabled && toggle(opt.value)} disabled={isDisabled}>
              <Text style={[chipStyles.text, on && chipStyles.textOn]}>{opt.label}</Text>
            </Pressable>
          )
        })}
      </View>
    </FieldShell>
  )
}

const SelectFieldNative: React.FC<FieldComponentProps<ClientSelectField>> = ({
  field, value, onChange, disabled, error,
}) => {
  if (field.hasMany) return <SelectFieldMultiChips field={field} value={value} onChange={onChange} disabled={disabled} error={error} />

  const NativePicker = nativeComponents.Picker!
  const NativeText = nativeComponents.Text!
  const tag = nativeComponents.tag!
  const options = (field.options ?? []).map(normalizeOption)
  const isDisabled = disabled || field.admin?.readOnly

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
      <NativeHost matchContents={{ height: true }} style={[nativePickerStyles.hostFullWidth, isDisabled && fieldShellStyles.disabledHost]}>
        <NativePicker
          selection={value != null ? String(value) : ''}
          onSelectionChange={(s: any) => { if (!isDisabled) onChange(s === '' ? null : s) }}
        >
          <NativeText modifiers={[tag('')]}>Select...</NativeText>
          {options.map((opt) => (
            <NativeText key={opt.value} modifiers={[tag(String(opt.value))]}>{opt.label}</NativeText>
          ))}
        </NativePicker>
      </NativeHost>
    </FieldShell>
  )
}

/** Pure-JS option list fallback (no native picker needed). */
const SimpleOptionList: React.FC<{
  options: Array<{ label: string; value: string }>
  selected: string | null
  onChange: (v: string | null) => void
  disabled?: boolean
}> = ({ options, selected, onChange, disabled }) => (
  <View style={chipStyles.container}>
    {options.map((opt) => {
      const isOn = selected === opt.value
      return (
        <Pressable key={opt.value} style={[chipStyles.chip, isOn && chipStyles.chipOn]} onPress={() => !disabled && onChange(isOn ? null : opt.value)} disabled={disabled}>
          <Text style={[chipStyles.text, isOn && chipStyles.textOn]}>{opt.label}</Text>
        </Pressable>
      )
    })}
  </View>
)

const SelectFieldFallback: React.FC<FieldComponentProps<ClientSelectField>> = ({
  field, value, onChange, disabled, error,
}) => {
  if (field.hasMany) return <SelectFieldMultiChips field={field} value={value} onChange={onChange} disabled={disabled} error={error} />

  const options = (field.options ?? []).map(normalizeOption)
  const isDisabled = disabled || field.admin?.readOnly

  // If native Picker is available, use it; otherwise use chip-style option list
  if (!Picker) {
    return (
      <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
        <SimpleOptionList options={options} selected={value as string ?? null} onChange={onChange} disabled={isDisabled} />
      </FieldShell>
    )
  }

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
      <View style={[pickerStyles.wrapper, error && pickerStyles.wrapperError]}>
        <Picker
          selectedValue={value ?? ''} onValueChange={(v: any) => onChange(v === '' ? null : v)}
          enabled={!isDisabled} style={pickerStyles.picker} itemStyle={pickerStyles.item}
        >
          <Picker.Item label="Select..." value="" color={t.colors.textPlaceholder} />
          {options.map((opt: any) => <Picker.Item key={opt.value} label={opt.label} value={opt.value} />)}
        </Picker>
      </View>
    </FieldShell>
  )
}

export const SelectField: React.FC<FieldComponentProps<ClientSelectField>> = (props) =>
  nativeComponents.Picker && nativeComponents.Text && nativeComponents.tag
    ? <SelectFieldNative {...props} />
    : <SelectFieldFallback {...props} />

// ---------------------------------------------------------------------------
// Radio
// ---------------------------------------------------------------------------

const SEGMENTED_THRESHOLD = 5

const RadioFieldNative: React.FC<FieldComponentProps<ClientRadioField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const NativePicker = nativeComponents.Picker!
  const NativeText = nativeComponents.Text!
  const tag = nativeComponents.tag!
  const psModifier = nativeComponents.pickerStyle!
  const options = (field.options ?? []).map(normalizeOption)
  const isDisabled = disabled || field.admin?.readOnly
  const useSegmented = options.length <= SEGMENTED_THRESHOLD

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
      <NativeHost matchContents={{ height: true }} style={[nativePickerStyles.hostFullWidth, isDisabled && fieldShellStyles.disabledHost]}>
        <NativePicker
          selection={value != null ? String(value) : ''}
          onSelectionChange={(s: any) => { if (!isDisabled) onChange(s === '' ? null : s) }}
          modifiers={useSegmented ? [psModifier('segmented')] : undefined}
        >
          {!useSegmented && <NativeText modifiers={[tag('')]}>Select...</NativeText>}
          {options.map((opt) => (
            <NativeText key={opt.value} modifiers={[tag(String(opt.value))]}>{opt.label}</NativeText>
          ))}
        </NativePicker>
      </NativeHost>
    </FieldShell>
  )
}

const RadioFieldFallback: React.FC<FieldComponentProps<ClientRadioField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const options = (field.options ?? []).map(normalizeOption)
  const isDisabled = disabled || field.admin?.readOnly

  if (!Picker) {
    return (
      <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
        <SimpleOptionList options={options} selected={value as string ?? null} onChange={onChange} disabled={isDisabled} />
      </FieldShell>
    )
  }

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
      <View style={[pickerStyles.wrapper, error && pickerStyles.wrapperError]}>
        <Picker
          selectedValue={value ?? ''} onValueChange={(v: any) => onChange(v === '' ? null : v)}
          enabled={!isDisabled} style={pickerStyles.picker} itemStyle={pickerStyles.item}
        >
          <Picker.Item label="Select..." value="" color={t.colors.textPlaceholder} />
          {options.map((opt: any) => <Picker.Item key={opt.value} label={opt.label} value={opt.value} />)}
        </Picker>
      </View>
    </FieldShell>
  )
}

export const RadioField: React.FC<FieldComponentProps<ClientRadioField>> = (props) =>
  nativeComponents.Picker && nativeComponents.Text && nativeComponents.tag
    ? <RadioFieldNative {...props} />
    : <RadioFieldFallback {...props} />

// ---------------------------------------------------------------------------
// Relationship — BottomSheet with search + paginated results
// ---------------------------------------------------------------------------

const docDisplayTitle = (doc: Record<string, unknown>, useAsTitle?: string): string => {
  if (useAsTitle && doc[useAsTitle] != null) return String(doc[useAsTitle])
  return String(doc.title ?? doc.name ?? doc.email ?? doc.id ?? '')
}

let _useLocalDB: (() => any) | null = null
try {
  _useLocalDB = require('@payload-universal/local-db').useLocalDB
} catch { /* local-db not available */ }

export const RelationshipField: React.FC<FieldComponentProps<ClientRelationshipField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const { baseURL, auth, schema } = usePayloadNative()
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [allDocs, setAllDocs] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(false)
  const [displayLabel, setDisplayLabel] = useState<string | null>(null)
  // Pure-React preview: stores the item being peeked (long-press).
  // Uses a React Modal instead of native ScrollablePreview to avoid
  // the native view-reparenting crash inside BottomSheet Modals.
  const [previewItem, setPreviewItem] = useState<Record<string, unknown> | null>(null)
  const relationTo = Array.isArray(field.relationTo) ? field.relationTo[0] : field.relationTo

  const useAsTitle = schema?.menuModel?.collections.find(
    (c: any) => c.slug === relationTo,
  )?.useAsTitle

  const localDB = _useLocalDB ? _useLocalDB() : null
  const localCollection = localDB?.collections?.[relationTo]

  const loadDocs = useCallback(async () => {
    setLoading(true)
    try {
      if (localCollection) {
        const results = await localCollection.find({
          selector: { _deleted: { $eq: false } },
          sort: [{ updatedAt: 'desc' }],
          limit: 50,
        }).exec()
        setAllDocs(results.map((r: any) => r.toJSON()))
      } else {
        const result = await payloadApi.find({ baseURL, token: auth.token }, relationTo, {
          limit: 50, depth: 0, sort: '-updatedAt',
        })
        setAllDocs(result.docs)
      }
    } catch {
      setAllDocs([])
    } finally {
      setLoading(false)
    }
  }, [localCollection, baseURL, auth.token, relationTo])

  useEffect(() => { if (open) loadDocs() }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const filteredDocs = useMemo(() => {
    if (!search.trim()) return allDocs
    const q = search.toLowerCase()
    return allDocs.filter((doc) => {
      const fields = new Set(['title', 'name', 'email', 'id'])
      if (useAsTitle) fields.add(useAsTitle)
      return Array.from(fields).some((f) => {
        const val = doc[f]
        return val != null && String(val).toLowerCase().includes(q)
      })
    })
  }, [allDocs, search, useAsTitle])

  const selectedId = value
    ? (typeof value === 'object' && value !== null ? String((value as Record<string, unknown>).id ?? '') : String(value))
    : null

  useEffect(() => {
    if (!value) { setDisplayLabel(null); return }
    if (typeof value === 'object' && value !== null) {
      setDisplayLabel(docDisplayTitle(value as Record<string, unknown>, useAsTitle))
      return
    }
    if (typeof value === 'string' && value.length > 0) {
      let cancelled = false
      const resolve = async () => {
        try {
          if (localCollection) {
            const rxDoc = await localCollection.findOne(value).exec()
            if (!cancelled && rxDoc) { setDisplayLabel(docDisplayTitle(rxDoc.toJSON(), useAsTitle)); return }
          }
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
  const relSchemaMap = schema?.collections?.[relationTo]
  const DocumentForm = getDocumentForm()
  const canPreview = !!(relSchemaMap && DocumentForm)
  const previewW = Math.round(windowWidth * 0.92)
  const previewH = Math.round(windowHeight * 0.6)

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error}>
      <Pressable
        style={[styles.pickerButton, error && pickerStyles.wrapperError]}
        onPress={() => !disabled && setOpen(true)}
        disabled={disabled || field.admin?.readOnly}
      >
        {displayValue ? (
          <Text style={[styles.pickerText, { flex: 1 }]} numberOfLines={1}>{String(displayValue)}</Text>
        ) : (
          <Text style={[styles.pickerText, styles.pickerPlaceholder]}>{`Select ${relationTo}...`}</Text>
        )}
        <Text style={styles.chevron}>›</Text>
      </Pressable>

      <BottomSheet visible={open} onClose={() => { setPreviewItem(null); setOpen(false) }} height={0.75}>
        {previewItem ? (
          /* ── Inline preview (replaces list while peeking) ── */
          <View style={{ flex: 1 }}>
            <View style={previewStyles.header}>
              <Text style={styles.sheetTitle} numberOfLines={1}>
                {docDisplayTitle(previewItem, useAsTitle)}
              </Text>
            </View>
            <View style={{ flex: 1, overflow: 'hidden' }}>
              <ScrollView
                bounces
                showsVerticalScrollIndicator
                contentContainerStyle={{ paddingBottom: 16 }}
              >
                {DocumentForm && relSchemaMap ? (
                  <PreviewContextProvider value={true}>
                    <DocumentForm
                      schemaMap={relSchemaMap}
                      slug={relationTo}
                      initialData={previewItem}
                      onSubmit={noopSubmit}
                      disabled
                    />
                  </PreviewContextProvider>
                ) : null}
              </ScrollView>
            </View>
            <View style={previewStyles.actions}>
              <Pressable
                style={previewStyles.selectBtn}
                onPress={() => {
                  const title = docDisplayTitle(previewItem, useAsTitle)
                  setDisplayLabel(title)
                  onChange(previewItem.id)
                  setPreviewItem(null)
                  setOpen(false)
                }}
              >
                <Text style={previewStyles.selectText}>Select</Text>
              </Pressable>
              <Pressable style={previewStyles.closeBtn} onPress={() => setPreviewItem(null)}>
                <Text style={previewStyles.closeText}>Back</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          /* ── Normal picker list ── */
          <>
            <Text style={styles.sheetTitle}>Select {relationTo}</Text>
            <TextInput
              style={styles.searchInput} value={search} onChangeText={setSearch}
              placeholder="Search..." placeholderTextColor={t.colors.textPlaceholder} autoCapitalize="none"
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
                    onLongPress={canPreview ? () => setPreviewItem(item) : undefined}
                    delayLongPress={350}
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
          </>
        )}
      </BottomSheet>
    </FieldShell>
  )
}

// ---------------------------------------------------------------------------
// Upload — image picker + upload to Payload
// ---------------------------------------------------------------------------

export const UploadField: React.FC<FieldComponentProps<ClientUploadField>> = ({
  field, value, onChange, disabled, error,
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
    setFileName(name); setUploading(true); setUploadError(null)
    try {
      const formData = new FormData()
      formData.append('file', { uri, name, type: mimeType } as unknown as Blob)
      formData.append('alt', name.replace(/\.[^.]+$/, ''))
      const response = await fetch(`${baseURL}/api/${field.relationTo}`, {
        method: 'POST',
        headers: auth.token ? { Authorization: `JWT ${auth.token}` } : {},
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
      if (status !== 'granted') { setUploadError('Permission to access media library was denied'); return }
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.8 })
      if (result.canceled || !result.assets?.[0]) return
      const asset = result.assets[0]
      await uploadFile(asset.uri, asset.fileName || `upload-${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`, asset.mimeType || (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'))
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Failed to pick image')
    }
  }

  const takePhoto = async () => {
    setShowOptions(false)
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

  return (
    <FieldShell label={getFieldLabel(field)} description={getFieldDescription(field)} required={field.required} error={error || uploadError || undefined}>
      <Pressable
        style={[styles.uploadButton, error && pickerStyles.wrapperError]}
        onPress={() => { if (!disabled && !field.admin?.readOnly && !uploading) setShowOptions(true) }}
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
              <Text style={styles.uploadFileName} numberOfLines={1}>{fileName || String(displayValue)}</Text>
              <Text style={styles.uploadHint}>{field.relationTo}</Text>
            </View>
            <Pressable onPress={() => { onChange(null); setFileName(null); setUploadError(null) }} hitSlop={8}>
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
  pickerButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 0,
    backgroundColor: 'transparent',
  },
  pickerText: { fontSize: t.fontSize.md, color: t.colors.text, flex: 1 },
  pickerPlaceholder: { color: t.colors.textPlaceholder },
  chevron: { fontSize: 18, color: t.colors.textMuted, marginLeft: t.spacing.xs },

  sheetTitle: { fontSize: t.fontSize.lg, fontWeight: '700', color: t.colors.text, marginBottom: t.spacing.md },
  searchInput: {
    borderWidth: 1, borderColor: t.colors.border, borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm,
    fontSize: t.fontSize.md, marginBottom: t.spacing.md,
  },
  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: t.spacing.md, paddingHorizontal: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.separator,
  },
  optionSelected: { backgroundColor: '#f5f5f5' },
  optionText: { fontSize: t.fontSize.md, color: t.colors.text, flex: 1 },
  optionTextSelected: { fontWeight: '600' },
  checkMark: { fontSize: 16, color: t.colors.primary, marginLeft: t.spacing.sm },

  clearBtn: { paddingVertical: t.spacing.md, alignItems: 'center' },
  clearText: { fontSize: t.fontSize.sm, color: t.colors.destructive },

  uploadButton: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.separator, borderRadius: t.borderRadius.sm,
    borderStyle: 'dashed', padding: t.spacing.md, backgroundColor: 'transparent',
  },
  uploadPlaceholder: { alignItems: 'center', gap: t.spacing.xs },
  uploadIcon: { fontSize: 24, color: t.colors.textMuted },
  uploadHint: { fontSize: t.fontSize.sm, color: t.colors.textMuted },
  uploadSelected: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md },
  uploadSelectedInfo: { flex: 1 },
  uploadFileName: { fontSize: t.fontSize.md, fontWeight: '600', color: t.colors.text },
  uploadClear: { fontSize: 16, color: t.colors.textMuted, fontWeight: '700', padding: t.spacing.xs },

  emptyText: { textAlign: 'center', paddingVertical: t.spacing.xl, color: t.colors.textMuted, fontSize: t.fontSize.sm },
})

const pickerStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: 'transparent', overflow: 'hidden',
  },
  wrapperError: { },
  picker: Platform.select({ ios: { marginHorizontal: -8 }, android: { marginHorizontal: 4 } }) as any,
  item: { fontSize: t.fontSize.md, color: t.colors.text },
})

const nativePickerStyles = StyleSheet.create({
  hostFullWidth: { alignSelf: 'stretch' },
})

const chipStyles = StyleSheet.create({
  container: { flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs },
  chip: {
    paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.xs + 2,
    borderRadius: 20, borderWidth: 1, borderColor: t.colors.border, backgroundColor: t.colors.surface,
  },
  chipOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  text: { fontSize: t.fontSize.sm, color: t.colors.text, fontWeight: '500' },
  textOn: { color: t.colors.primaryText },
})

const previewStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: t.spacing.sm,
  },
  actions: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.separator,
    marginHorizontal: -16,
    marginBottom: -16,
  },
  selectBtn: {
    flex: 1,
    paddingVertical: t.spacing.md,
    alignItems: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: t.colors.separator,
  },
  selectText: {
    fontSize: t.fontSize.md,
    fontWeight: '600',
    color: t.colors.primary,
  },
  closeBtn: {
    flex: 1,
    paddingVertical: t.spacing.md,
    alignItems: 'center',
  },
  closeText: {
    fontSize: t.fontSize.md,
    color: t.colors.textMuted,
  },
})
