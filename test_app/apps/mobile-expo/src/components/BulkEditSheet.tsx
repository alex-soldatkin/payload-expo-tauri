/**
 * BulkEditSheet — mobile-shaped parity with the web admin's EditMany drawer.
 *
 * Two-step flow inside a BottomSheet:
 *   1. Pick a bulk-editable field. Skips richText/join/ui, structural
 *      containers, upload hasMany, polymorphic relationships, unique fields,
 *      hidden/readOnly fields and anything flagged `admin.disableBulkEdit`
 *      (web EditMany parity). Layout-only containers (row, collapsible,
 *      unnamed tabs) are flattened so their root-level data fields appear.
 *   2. Edit the value with the field's normal FieldRenderer input (the sheet
 *      is an unsized Modal container, so fields render in non-native-Form
 *      fallback mode — NativeFormContext defaults to false) and apply the
 *      single-field patch to every selected document through the local-first
 *      validated mutation pipeline (useValidatedMutations.update per doc).
 *      When drafts are enabled, a segmented Save / Save Draft / Publish
 *      choice rides the patch as `_status`.
 *
 * Progress is shown per document; the result lands as a toast and the parent
 * exits selection mode via `onComplete`.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import {
  BottomSheet,
  FieldRenderer,
  getFieldLabel,
  useListColors,
  useToast,
  type ClientField,
} from '@payload-universal/admin-native'
import { useLocalDB, useValidatedMutations } from '@payload-universal/local-db'

// ---------------------------------------------------------------------------
// Bulk-editable field selection (web EditMany parity, mobile-shaped)
// ---------------------------------------------------------------------------

/**
 * Field types that can carry a single-value bulk patch. Excludes
 * richText/join/ui (per web parity) and structural containers
 * (group/array/blocks/tabs) whose nested renderers need a full form context.
 */
const BULK_EDIT_TYPES = new Set([
  'text', 'email', 'number', 'textarea', 'code', 'json', 'date', 'point',
  'select', 'radio', 'checkbox', 'relationship', 'upload',
])

const INTERNAL_FIELD_NAMES = new Set(['id', 'createdAt', 'updatedAt', '_status'])

export function collectBulkEditableFields(fields: ClientField[]): ClientField[] {
  const out: ClientField[] = []
  for (const field of fields) {
    // Layout-only containers — their children are root-level data fields
    if (field.type === 'row' || field.type === 'collapsible') {
      out.push(...collectBulkEditableFields((field as { fields?: ClientField[] }).fields ?? []))
      continue
    }
    // Unnamed tabs hold root-level data fields too; named tabs nest their
    // data under tab.name and are skipped (no single-field patch shape).
    if (field.type === 'tabs') {
      const tabs = (field as { tabs?: Array<{ name?: string; fields?: ClientField[] }> }).tabs ?? []
      for (const tab of tabs) {
        if (!tab.name) out.push(...collectBulkEditableFields(tab.fields ?? []))
      }
      continue
    }
    if (!field.name || INTERNAL_FIELD_NAMES.has(field.name)) continue
    if (!BULK_EDIT_TYPES.has(field.type)) continue
    // Same value on many docs would violate uniqueness (web parity)
    if (field.unique) continue
    if (field.admin?.hidden || field.admin?.readOnly) continue
    // Not part of the serialized admin type — read defensively (web parity flag)
    if ((field.admin as Record<string, unknown> | undefined)?.disableBulkEdit) continue
    // upload hasMany / polymorphic relationship — excluded per web parity
    if (field.type === 'upload' && (field as { hasMany?: boolean }).hasMany) continue
    if (field.type === 'relationship' && Array.isArray((field as { relationTo?: unknown }).relationTo)) continue
    out.push(field)
  }
  return out
}

/** RxDB-internal keys that must never ride a mutation payload. */
const stripRxInternals = (doc: Record<string, unknown>): Record<string, unknown> => {
  const { _rev, _meta, _attachments, _deleted, _locallyModified, ...clean } = doc as Record<string, unknown> & {
    _rev?: unknown
    _meta?: unknown
    _attachments?: unknown
    _deleted?: unknown
    _locallyModified?: unknown
  }
  return clean
}

type SaveMode = 'save' | 'draft' | 'publish'

const SAVE_MODES: Array<{ key: SaveMode; label: string }> = [
  { key: 'save', label: 'Save' },
  { key: 'draft', label: 'Save Draft' },
  { key: 'publish', label: 'Publish' },
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type Props = {
  visible: boolean
  onClose: () => void
  /** Collection slug the selected documents belong to. */
  slug: string
  /** Root client fields from the admin schema (drives picker + validation). */
  fields: ClientField[]
  /** IDs of the selected documents. */
  selectedIds: string[]
  /** All currently loaded documents (source for original data merge). */
  docs: Record<string, unknown>[]
  /** Whether the collection has versions.drafts enabled. */
  hasDrafts: boolean
  /** Called after a completed apply run — parent exits selection mode. */
  onComplete: () => void
}

export function BulkEditSheet({
  visible,
  onClose,
  slug,
  fields,
  selectedIds,
  docs,
  hasDrafts,
  onComplete,
}: Props) {
  const { colors: c } = useListColors()
  const toast = useToast()
  const localDB = useLocalDB()
  const { update } = useValidatedMutations(localDB, slug, fields)

  const editableFields = useMemo(() => collectBulkEditableFields(fields), [fields])
  const docById = useMemo(() => {
    const map = new Map<string, Record<string, unknown>>()
    for (const doc of docs) map.set(String(doc.id), doc)
    return map
  }, [docs])

  // Step state: no activeField → field picker; activeField set → value editor
  const [activeField, setActiveField] = useState<ClientField | null>(null)
  const [value, setValue] = useState<unknown>(undefined)
  const [saveMode, setSaveMode] = useState<SaveMode>('save')
  const [applying, setApplying] = useState(false)
  const [progress, setProgress] = useState(0)

  // Reset the flow every time the sheet opens
  useEffect(() => {
    if (visible) {
      setActiveField(null)
      setValue(undefined)
      setSaveMode('save')
      setApplying(false)
      setProgress(0)
    }
  }, [visible])

  const handleClose = useCallback(() => {
    if (applying) return // don't dismiss mid-run
    onClose()
  }, [applying, onClose])

  const handleApply = useCallback(async () => {
    if (!activeField?.name || selectedIds.length === 0 || applying) return
    setApplying(true)
    let ok = 0
    let failed = 0
    // undefined would be dropped by the patch — null explicitly clears
    const patchValue = value === undefined ? null : value
    for (let i = 0; i < selectedIds.length; i++) {
      setProgress(i + 1)
      const id = selectedIds[i]
      const original = docById.get(id)
      if (!original) {
        failed++
        continue
      }
      // Merge over the full doc so whole-doc validation sees existing values
      const writeData: Record<string, unknown> = {
        ...stripRxInternals(original),
        [activeField.name]: patchValue,
      }
      if (hasDrafts && saveMode !== 'save') {
        writeData._status = saveMode === 'publish' ? 'published' : 'draft'
      }
      try {
        const result = await update(id, writeData, original)
        if (result.success === false) failed++
        else ok++
      } catch {
        failed++
      }
    }
    setApplying(false)
    toast.showToast(
      failed === 0
        ? `${ok} document${ok !== 1 ? 's' : ''} updated`
        : `${ok} updated · ${failed} failed`,
      { type: failed === 0 ? 'success' : 'error', icon: failed === 0 ? 'success' : 'error' },
    )
    onComplete()
  }, [activeField, selectedIds, applying, value, docById, hasDrafts, saveMode, update, toast, onComplete])

  // ── Step 1: field picker ───────────────────────────────────────────────
  const renderFieldPicker = () => (
    <View style={styles.flex}>
      <Text style={[styles.title, { color: c.text }]}>
        {`Edit ${selectedIds.length} Selected`}
      </Text>
      <Text style={[styles.subtitle, { color: c.textMuted }]}>
        Choose a field to update on every selected document
      </Text>
      <FlatList
        data={editableFields}
        keyExtractor={(f) => f.name as string}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [
              styles.fieldRow,
              { borderBottomColor: c.separator },
              pressed && { backgroundColor: c.pressed },
            ]}
            onPress={() => {
              setActiveField(item)
              setValue(undefined)
            }}
          >
            <View style={styles.flex}>
              <Text style={[styles.fieldLabel, { color: c.text }]} numberOfLines={1}>
                {getFieldLabel(item)}
              </Text>
              <Text style={[styles.fieldType, { color: c.textMuted }]}>{item.type}</Text>
            </View>
            <Text style={[styles.chevron, { color: c.tertiary }]}>{'›'}</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={[styles.empty, { color: c.textMuted }]}>
            No bulk-editable fields in this collection
          </Text>
        }
      />
    </View>
  )

  // ── Step 2: value editor + apply ───────────────────────────────────────
  const renderValueEditor = () => {
    if (!activeField) return null
    return (
      <View style={styles.flex}>
        <Pressable
          style={styles.backRow}
          hitSlop={8}
          disabled={applying}
          onPress={() => {
            setActiveField(null)
            setValue(undefined)
          }}
        >
          <Text style={[styles.backText, { color: c.primary }]}>{'‹ Choose another field'}</Text>
        </Pressable>
        <Text style={[styles.title, { color: c.text }]}>{getFieldLabel(activeField)}</Text>
        <Text style={[styles.subtitle, { color: c.textMuted }]}>
          {`Applies to ${selectedIds.length} document${selectedIds.length !== 1 ? 's' : ''}`}
        </Text>
        <ScrollView
          style={styles.flex}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.editorContent}
        >
          <FieldRenderer
            field={activeField}
            value={value}
            onChange={setValue}
            path={activeField.name as string}
            collectionSlug={slug}
            disabled={applying}
          />
        </ScrollView>
        {hasDrafts && (
          <View style={[styles.segmentRow, { backgroundColor: c.pressed }]}>
            {SAVE_MODES.map((mode) => {
              const active = saveMode === mode.key
              return (
                <Pressable
                  key={mode.key}
                  style={[styles.segment, active && { backgroundColor: c.card }]}
                  disabled={applying}
                  onPress={() => setSaveMode(mode.key)}
                >
                  <Text
                    style={[
                      styles.segmentLabel,
                      { color: active ? c.text : c.textMuted },
                      active && styles.segmentLabelActive,
                    ]}
                  >
                    {mode.label}
                  </Text>
                </Pressable>
              )
            })}
          </View>
        )}
        <Pressable
          style={[styles.applyBtn, { backgroundColor: c.primary }, applying && styles.applyBtnBusy]}
          disabled={applying}
          onPress={handleApply}
        >
          <Text style={[styles.applyLabel, { color: c.primaryText }]}>
            {applying
              ? `Updating ${progress} of ${selectedIds.length}…`
              : `Apply to ${selectedIds.length} document${selectedIds.length !== 1 ? 's' : ''}`}
          </Text>
        </Pressable>
      </View>
    )
  }

  return (
    <BottomSheet visible={visible} onClose={handleClose} detents={['medium', 'large']}>
      {activeField ? renderValueEditor() : renderFieldPicker()}
    </BottomSheet>
  )
}

// ---------------------------------------------------------------------------
// Styles (colours come from useListColors — dark-mode aware)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  flex: { flex: 1 },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
    marginBottom: 12,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  fieldLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  fieldType: {
    fontSize: 12,
    marginTop: 1,
  },
  chevron: {
    fontSize: 20,
    fontWeight: '300',
    marginLeft: 8,
  },
  empty: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 32,
  },
  backRow: {
    paddingVertical: 4,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  backText: {
    fontSize: 14,
    fontWeight: '600',
  },
  editorContent: {
    paddingBottom: 16,
  },
  segmentRow: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 10,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  segmentLabelActive: {
    fontWeight: '700',
  },
  applyBtn: {
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  applyBtnBusy: {
    opacity: 0.7,
  },
  applyLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
})

export default BulkEditSheet
