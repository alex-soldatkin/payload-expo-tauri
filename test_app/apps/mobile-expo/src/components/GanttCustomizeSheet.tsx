/**
 * GanttCustomizeSheet — gantt customisation for the collection list view
 * (gear entry while in gantt mode, mirrors CalendarCustomizeSheet).
 *
 * Sections (list mode):
 *   1. Zoom — S/M/L segmented row mapping day-column widths 16/28/44 px
 *      (M = GANTT_CHART_DEFAULT_PX_PER_DAY; an unset config reads as M; a
 *      preset-supplied custom width stays untouched until a segment is tapped)
 *   2. Sources — drag-to-reorder rows (colour swatch, label, start → end
 *      subtitle) with edit / remove actions + an 'Add source…' row
 *   3. Visibility — one row per source with a native SwiftUI Toggle switch
 *      (registry Toggle, default toggleStyle; lucide Eye/EyeOff Pressable
 *      fallback). Toggling sets the source's `hidden` flag in the draft;
 *      hidden sources are skipped by buildGanttRows.
 *      DECISION (drag rules): visibility lives in this SEPARATE non-drag
 *      section rather than inside the Sources rows — @expo/ui must never
 *      render inside a reanimated-dnd Sortable tree, and the Sortable rows
 *      stay lucide-only (swatch/pencil/trash) exactly as before.
 *
 * Editor mode (add / edit a source):
 *   - start date-field picker (radio list over the collection's date fields,
 *     dot-paths included)
 *   - optional end date-field picker ('None — point diamonds' + remaining
 *     date fields; sources without an end render as shiftable, non-resizable
 *     16pt diamonds on the chart)
 *   - label input (auto-filled from the start field's label until touched)
 *   - colour — native SwiftUI ColorPicker via the admin-native registry
 *     (null-checked) with the curated 8-swatch fallback row
 *
 * All changes buffer into a local draft; the ✓ button flushes the draft via
 * `onSave` (the parent persists through useGanttConfig — saving always
 * writes an EXPLICIT source list, even when the draft started from the
 * pickDefaultSources fallback). `rowSort` has no UI here — it passes through
 * unchanged so preset round-trips keep it.
 *
 * Drag rules (memory-bank 013 'Drag-to-Reorder'):
 *   - react-native-reanimated-dnd Sortable/SortableItem via try/catch require
 *   - onMove is a NO-OP; state updates only in onDrop (allPositions)
 *   - lucide icons ONLY inside Sortable trees (no @expo/ui there) — the
 *     native ColorPicker renders in the editor view, never inside a Sortable
 *   - items use stable string ids; useFlatList={false} inside fixed-height
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'
import {
  Check,
  Circle,
  CircleCheck,
  Eye,
  EyeOff,
  GripVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react-native'
import {
  BottomSheet,
  DEFAULT_CALENDAR_PALETTE,
  GANTT_CHART_DEFAULT_PX_PER_DAY,
  useListColors,
  type CalendarSource,
  type ListColorPalette,
} from '@payload-universal/admin-native'
import { nativeComponents, NativeHost } from '@payload-universal/admin-native/fields'

import type { CalendarDateFieldOption } from '@/src/components/CalendarCustomizeSheet'
import type { GanttConfig } from '@/src/hooks/useGanttConfig'

// Optional drag-to-reorder (react-native-reanimated-dnd v2 + worklets 0.7.x
// are installed in the app; keep the require guarded for Expo Go parity with
// the Kanban/CalendarCustomizeSheet precedent)
let Sortable: any = null
let SortableItem: any = null
try {
  const dnd = require('react-native-reanimated-dnd')
  Sortable = dnd.Sortable
  SortableItem = dnd.SortableItem
} catch {
  /* drag unavailable — lists stay tap-only */
}

const ROW_HEIGHT = 54
/** Curated quick-pick swatches (also the fallback when ColorPicker is null). */
const SWATCHES = DEFAULT_CALENDAR_PALETTE.slice(0, 8)

/** S/M/L zoom presets — day-column width in px (M = the component default). */
const ZOOM_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 16, label: 'S' },
  { value: GANTT_CHART_DEFAULT_PX_PER_DAY, label: 'M' },
  { value: 44, label: 'L' },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type GanttCustomizeSheetProps = {
  visible: boolean
  onClose: () => void
  /** The collection's date fields (dot-paths for nested group fields). */
  dateFieldOptions: CalendarDateFieldOption[]
  config: GanttConfig
  /** Effective sources (config.sources ?? pickDefaultSources) seeding the draft. */
  resolvedSources: CalendarSource[]
  onSave: (next: GanttConfig) => void
}

type Draft = { sources: CalendarSource[]; pxPerDay: number | null }

type SourceEditorState = {
  /** Index into draft.sources when editing; null = adding a new source. */
  index: number | null
  startField: string | null
  endField: string | null
  label: string
  /** True once the user typed in the label input (stops auto-fill). */
  labelTouched: boolean
  color: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Stable unique ids — Sortable requires them; server presets may not. */
const ensureUniqueIds = (sources: CalendarSource[]): CalendarSource[] => {
  const seen = new Set<string>()
  return sources.map((source) => {
    let id = source.id
    let n = 2
    while (seen.has(id)) id = `${source.id}-${n++}`
    seen.add(id)
    return id === source.id ? source : { ...source, id }
  })
}

/** First palette colour not used by the given sources (cycled fallback). */
const nextPaletteColor = (sources: CalendarSource[]): string => {
  const used = new Set(sources.map((s) => s.color.toLowerCase()))
  const free = DEFAULT_CALENDAR_PALETTE.find((hex) => !used.has(hex.toLowerCase()))
  return free ?? DEFAULT_CALENDAR_PALETTE[sources.length % DEFAULT_CALENDAR_PALETTE.length]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GanttCustomizeSheet({
  visible,
  onClose,
  dateFieldOptions,
  config,
  resolvedSources,
  onSave,
}: GanttCustomizeSheetProps) {
  const { colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  // ── Buffered draft (flushed on ✓) ────────────────────────────────────
  const [draft, setDraft] = useState<Draft>({ sources: [], pxPerDay: null })
  const [editor, setEditor] = useState<SourceEditorState | null>(null)

  useEffect(() => {
    if (visible) {
      setDraft({
        sources: ensureUniqueIds(resolvedSources),
        pxPerDay: config.pxPerDay,
      })
      setEditor(null)
    }
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  const labelByFieldName = useMemo(
    () => new Map(dateFieldOptions.map((f) => [f.name, f.label])),
    [dateFieldOptions],
  )
  const fieldLabel = useCallback(
    (name: string | null | undefined): string =>
      (name ? labelByFieldName.get(name) : undefined) ?? name ?? '',
    [labelByFieldName],
  )

  // ── Sources list ──────────────────────────────────────────────────────
  const removeSource = useCallback((id: string) => {
    setDraft((prev) => ({ ...prev, sources: prev.sources.filter((s) => s.id !== id) }))
  }, [])

  // Visibility section — `hidden: true` only when off (visible omits the key
  // so configs stay minimal and pre-`hidden` entries mean visible).
  const setSourceVisible = useCallback((id: string, visible: boolean) => {
    setDraft((prev) => ({
      ...prev,
      sources: prev.sources.map((s) => {
        if (s.id !== id) return s
        if (visible) {
          const { hidden: _hidden, ...rest } = s
          return rest
        }
        return { ...s, hidden: true }
      }),
    }))
  }, [])

  // onMove must stay a no-op (state updates mid-drag remount the Sortable);
  // the final order is read once from onDrop's allPositions.
  const noopMove = useCallback(() => {}, [])

  const handleSourceDrop = useCallback(
    (_id: string, _position: number, allPositions?: Record<string, number>) => {
      if (!allPositions) return
      setDraft((prev) => {
        const byId = new Map(prev.sources.map((s) => [s.id, s]))
        const orderedIds = Object.keys(allPositions).sort(
          (a, b) => allPositions[a] - allPositions[b],
        )
        const ordered = orderedIds
          .map((id) => byId.get(id))
          .filter((s): s is CalendarSource => s != null)
        // Defensive: keep any sources the positions map missed (shouldn't happen)
        const rest = prev.sources.filter((s) => allPositions[s.id] == null)
        return { ...prev, sources: [...ordered, ...rest] }
      })
    },
    [],
  )

  // ── Source editor ─────────────────────────────────────────────────────
  const openAddSource = useCallback(() => {
    setEditor({
      index: null,
      startField: null,
      endField: null,
      label: '',
      labelTouched: false,
      color: nextPaletteColor(draft.sources),
    })
  }, [draft.sources])

  const openEditSource = useCallback((source: CalendarSource, index: number) => {
    setEditor({
      index,
      startField: source.startField,
      endField: source.endField ?? null,
      label: source.label,
      labelTouched: true,
      color: source.color,
    })
  }, [])

  const handlePickStartField = useCallback(
    (name: string) => {
      setEditor((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          startField: name,
          // The end field must differ from the start field
          endField: prev.endField === name ? null : prev.endField,
          // Auto-label from the field's label until the user types one
          label: prev.labelTouched ? prev.label : fieldLabel(name),
        }
      })
    },
    [fieldLabel],
  )

  const handlePickEndField = useCallback((name: string | null) => {
    setEditor((prev) => (prev ? { ...prev, endField: name } : prev))
  }, [])

  const handleEditorSave = useCallback(() => {
    if (!editor || !editor.startField) return
    const startField = editor.startField
    setDraft((prev) => {
      const label = editor.label.trim() || fieldLabel(startField)
      if (editor.index != null && prev.sources[editor.index]) {
        const next = [...prev.sources]
        next[editor.index] = {
          ...next[editor.index],
          label,
          startField,
          ...(editor.endField ? { endField: editor.endField } : {}),
          color: editor.color,
        }
        if (!editor.endField) delete next[editor.index].endField
        return { ...prev, sources: next }
      }
      // New source — id from the start field name, deduped against existing ids
      const existing = new Set(prev.sources.map((s) => s.id))
      let id = startField
      let n = 2
      while (existing.has(id)) id = `${startField}-${n++}`
      const source: CalendarSource = {
        id,
        label,
        startField,
        ...(editor.endField ? { endField: editor.endField } : {}),
        color: editor.color,
      }
      return { ...prev, sources: [...prev.sources, source] }
    })
    setEditor(null)
  }, [editor, fieldLabel])

  // ── Save (flush draft; rowSort passes through unchanged) ──────────────
  const handleSave = useCallback(() => {
    onSave({ sources: draft.sources, pxPerDay: draft.pxPerDay, rowSort: config.rowSort })
    onClose()
  }, [draft, config.rowSort, onSave, onClose])

  // ── Renderers ─────────────────────────────────────────────────────────

  const renderSourceRowInner = useCallback(
    (source: CalendarSource, index: number) => (
      <>
        <Pressable
          style={styles.rowInner}
          hitSlop={4}
          onPress={() => openEditSource(source, index)}
        >
          <View style={[styles.swatch, { backgroundColor: source.color }]} />
          <View style={styles.fieldInfo}>
            <Text style={styles.rowLabel} numberOfLines={1}>
              {source.label}
            </Text>
            <Text style={styles.fieldType} numberOfLines={1}>
              {fieldLabel(source.startField)}
              {source.endField ? ` → ${fieldLabel(source.endField)}` : ''}
            </Text>
          </View>
          <Pencil size={16} color={colors.textMuted} />
        </Pressable>
        <Pressable
          hitSlop={8}
          style={styles.rowAction}
          onPress={() => removeSource(source.id)}
          accessibilityRole="button"
          accessibilityLabel={`Remove ${source.label}`}
        >
          <Trash2 size={18} color={colors.destructive} />
        </Pressable>
      </>
    ),
    [openEditSource, removeSource, fieldLabel, colors, styles],
  )

  // Sortable render callback — spread ...props; handle is a direct child.
  const renderSortableSource = useCallback(
    ({ item, ...props }: any) => (
      <SortableItem
        key={item.id}
        id={item.id}
        data={item}
        onMove={noopMove}
        onDrop={handleSourceDrop}
        {...props}
      >
        <View style={styles.row}>
          <SortableItem.Handle>
            <View style={styles.dragHandle}>
              <GripVertical size={18} color={colors.textMuted} />
            </View>
          </SortableItem.Handle>
          {renderSourceRowInner(item.source, item.index)}
        </View>
      </SortableItem>
    ),
    [noopMove, handleSourceDrop, renderSourceRowInner, colors, styles],
  )

  const sourceItems = useMemo(
    () =>
      draft.sources.map((source, index) => ({ id: source.id, source, index })),
    [draft.sources],
  )

  const dndAvailable = Boolean(Sortable && SortableItem)

  // ── Editor view (add / edit a source) ─────────────────────────────────
  const NativeColorPicker = nativeComponents.ColorPicker
  // Visibility switches (list view) — registry SwiftUI Toggle with the
  // DEFAULT toggleStyle (a switch), exactly like the checkbox field. Rendered
  // ONLY in the non-drag Visibility section (never inside Sortable trees).
  const NativeToggle = nativeComponents.Toggle

  const editorView = editor && (
    <>
      <View style={styles.sheetHeader}>
        <Pressable onPress={() => setEditor(null)} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.sheetTitleCentered}>
          {editor.index == null ? 'New Source' : 'Edit Source'}
        </Text>
        <Pressable onPress={handleEditorSave} hitSlop={8} disabled={!editor.startField}>
          <View
            style={[
              styles.saveBtn,
              { backgroundColor: colors.primary },
              !editor.startField && styles.saveBtnDisabled,
            ]}
          >
            <Check size={20} color={colors.primaryText} />
          </View>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* ── Start field ──────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>START DATE FIELD</Text>
        {dateFieldOptions.map((field) => {
          const selected = editor.startField === field.name
          return (
            <Pressable
              key={field.name}
              style={styles.row}
              onPress={() => handlePickStartField(field.name)}
            >
              <View style={styles.checkbox}>
                {selected ? (
                  <CircleCheck size={22} color={colors.primary} />
                ) : (
                  <Circle size={22} color={colors.border} />
                )}
              </View>
              <View style={styles.fieldInfo}>
                <Text style={styles.rowLabel}>{field.label}</Text>
                <Text style={styles.fieldType}>{field.name}</Text>
              </View>
            </Pressable>
          )
        })}

        {/* ── End field (optional) ─────────────────────────────────── */}
        <Text style={styles.sectionLabel}>END DATE FIELD — optional</Text>
        <Pressable style={styles.row} onPress={() => handlePickEndField(null)}>
          <View style={styles.checkbox}>
            {editor.endField == null ? (
              <CircleCheck size={22} color={colors.primary} />
            ) : (
              <Circle size={22} color={colors.border} />
            )}
          </View>
          <View style={styles.fieldInfo}>
            <Text style={styles.rowLabel}>None</Text>
            <Text style={styles.fieldType}>point diamonds — shiftable, not resizable</Text>
          </View>
        </Pressable>
        {dateFieldOptions
          .filter((field) => field.name !== editor.startField)
          .map((field) => {
            const selected = editor.endField === field.name
            return (
              <Pressable
                key={field.name}
                style={styles.row}
                onPress={() => handlePickEndField(field.name)}
              >
                <View style={styles.checkbox}>
                  {selected ? (
                    <CircleCheck size={22} color={colors.primary} />
                  ) : (
                    <Circle size={22} color={colors.border} />
                  )}
                </View>
                <View style={styles.fieldInfo}>
                  <Text style={styles.rowLabel}>{field.label}</Text>
                  <Text style={styles.fieldType}>{field.name}</Text>
                </View>
              </Pressable>
            )
          })}

        {/* ── Label ────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>LABEL</Text>
        <TextInput
          style={styles.textInput}
          value={editor.label}
          onChangeText={(label) =>
            setEditor((prev) => (prev ? { ...prev, label, labelTouched: true } : prev))
          }
          placeholder={fieldLabel(editor.startField) || 'Source label'}
          placeholderTextColor={colors.textPlaceholder}
          returnKeyType="done"
        />

        {/* ── Colour (OUTSIDE any Sortable tree — @expo/ui allowed) ── */}
        <Text style={styles.sectionLabel}>COLOR</Text>
        {NativeColorPicker ? (
          <View style={styles.colorPickerWrap}>
            <NativeHost matchContents>
              <NativeColorPicker
                selection={editor.color}
                label="Source color"
                supportsOpacity={false}
                onSelectionChange={(hex) =>
                  setEditor((prev) => (prev ? { ...prev, color: hex } : prev))
                }
              />
            </NativeHost>
          </View>
        ) : (
          <View style={styles.swatchRow}>
            {SWATCHES.map((hex) => {
              const selected = editor.color.toLowerCase() === hex.toLowerCase()
              return (
                <Pressable
                  key={hex}
                  onPress={() => setEditor((prev) => (prev ? { ...prev, color: hex } : prev))}
                  style={[
                    styles.swatchLarge,
                    { backgroundColor: hex },
                    selected && { borderColor: colors.text, borderWidth: 2 },
                  ]}
                />
              )
            })}
          </View>
        )}
      </ScrollView>
    </>
  )

  // ── List view ─────────────────────────────────────────────────────────
  // Active zoom segment: an unset pxPerDay reads as M (the component
  // default); a preset-supplied custom width matches no segment until tapped.
  const effectivePx = draft.pxPerDay ?? GANTT_CHART_DEFAULT_PX_PER_DAY
  const listView = !editor && (
    <>
      <View style={styles.sheetHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetTitle}>Gantt Settings</Text>
          <Text style={styles.sheetHint}>Date sources and timeline zoom.</Text>
        </View>
        <Pressable onPress={handleSave} hitSlop={8}>
          <View style={[styles.saveBtn, { backgroundColor: colors.primary }]}>
            <Check size={20} color={colors.primaryText} />
          </View>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* ── Zoom (px per day) ─────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>ZOOM</Text>
        <View style={styles.segmentRow}>
          {ZOOM_OPTIONS.map(({ value, label }) => (
            <Pressable
              key={label}
              style={[styles.segment, effectivePx === value && styles.segmentActive]}
              onPress={() => setDraft((prev) => ({ ...prev, pxPerDay: value }))}
            >
              <Text
                style={[
                  styles.segmentText,
                  effectivePx === value && styles.segmentTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Sources ──────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>
          {dndAvailable && sourceItems.length > 1 ? 'SOURCES — drag to reorder' : 'SOURCES'}
        </Text>
        {sourceItems.length === 0 && (
          <Text style={styles.emptyText}>No sources — add one below.</Text>
        )}
        {dndAvailable && sourceItems.length > 0 ? (
          <View style={{ height: sourceItems.length * ROW_HEIGHT }}>
            <Sortable
              data={sourceItems}
              renderItem={renderSortableSource}
              itemHeight={ROW_HEIGHT}
              useFlatList={false}
              style={{ backgroundColor: 'transparent' }}
              contentContainerStyle={{ backgroundColor: 'transparent' }}
            />
          </View>
        ) : (
          sourceItems.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.dragHandlePlaceholder} />
              {renderSourceRowInner(item.source, item.index)}
            </View>
          ))
        )}

        {/* Add source */}
        <Pressable
          style={({ pressed }) => [styles.addRow, pressed && styles.rowPressed]}
          onPress={openAddSource}
        >
          <Plus size={20} color={colors.primary} />
          <Text style={styles.addText}>Add source…</Text>
        </Pressable>

        {/* ── Visibility — SEPARATE non-drag section (see docblock): native
            SwiftUI Toggle switches are safe here, OUTSIDE the Sortable tree.
            ON = source visible on the gantt (sets `hidden` in the draft;
            buildGanttRows skips hidden sources after save). ──────────────── */}
        {draft.sources.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>VISIBILITY</Text>
            {draft.sources.map((source) => {
              const sourceVisible = source.hidden !== true
              return (
                <View key={source.id} style={styles.row}>
                  <View style={styles.rowInner}>
                    <View style={[styles.swatch, { backgroundColor: source.color }]} />
                    <View style={styles.fieldInfo}>
                      <Text
                        style={[styles.rowLabel, !sourceVisible && styles.rowLabelHidden]}
                        numberOfLines={1}
                      >
                        {source.label}
                      </Text>
                    </View>
                  </View>
                  {NativeToggle ? (
                    <NativeHost matchContents>
                      <NativeToggle
                        isOn={sourceVisible}
                        onIsOnChange={(isOn: boolean) => setSourceVisible(source.id, isOn)}
                      />
                    </NativeHost>
                  ) : (
                    <Pressable
                      hitSlop={8}
                      style={styles.rowAction}
                      onPress={() => setSourceVisible(source.id, !sourceVisible)}
                      accessibilityRole="switch"
                      accessibilityState={{ checked: sourceVisible }}
                      accessibilityLabel={`${sourceVisible ? 'Hide' : 'Show'} ${source.label}`}
                    >
                      {sourceVisible ? (
                        <Eye size={20} color={colors.primary} />
                      ) : (
                        <EyeOff size={20} color={colors.textPlaceholder} />
                      )}
                    </Pressable>
                  )}
                </View>
              )
            })}
          </>
        )}
      </ScrollView>
    </>
  )

  return (
    <BottomSheet visible={visible} onClose={onClose} detents={['medium', 'large']}>
      {editor ? editorView : listView}
    </BottomSheet>
  )
}

// ---------------------------------------------------------------------------
// Styles — dark-mode aware palette only (zero hardcoded light colours)
// ---------------------------------------------------------------------------

const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: 8,
      gap: 8,
      zIndex: 10,
    },
    sheetTitle: { fontSize: 18, fontWeight: '700', color: c.text, marginBottom: 4 },
    sheetTitleCentered: {
      flex: 1,
      fontSize: 18,
      fontWeight: '700',
      color: c.text,
      textAlign: 'center',
    },
    sheetHint: { fontSize: 13, color: c.textMuted },
    backBtn: { paddingRight: 4, paddingTop: 8 },
    backText: { fontSize: 15, color: c.primary, fontWeight: '600' },
    saveBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 12,
    },
    saveBtnDisabled: { opacity: 0.4 },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginTop: 14,
      marginBottom: 4,
      paddingHorizontal: 8,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      height: ROW_HEIGHT,
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
      backgroundColor: 'transparent',
    },
    rowInner: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    rowAction: {
      width: 36,
      height: ROW_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowLabel: { fontSize: 15, color: c.text, fontWeight: '500' },
    /** Visibility section: hidden sources read muted (mirrors calendar sheet). */
    rowLabelHidden: { color: c.textPlaceholder },
    rowPressed: { opacity: 0.6 },

    dragHandle: {
      width: 32,
      height: ROW_HEIGHT,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dragHandlePlaceholder: { width: 32 },

    checkbox: { marginRight: 12, marginLeft: 4 },
    fieldInfo: { flex: 1, minWidth: 0 },
    fieldType: { fontSize: 11, color: c.textMuted, marginTop: 1 },

    swatch: {
      width: 24,
      height: 24,
      borderRadius: 12,
    },
    colorPickerWrap: { paddingHorizontal: 8, paddingVertical: 6 },
    swatchRow: {
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 8,
      paddingVertical: 8,
      flexWrap: 'wrap',
    },
    swatchLarge: {
      width: 34,
      height: 34,
      borderRadius: 17,
    },

    addRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    addText: { fontSize: 15, fontWeight: '600', color: c.primary },

    emptyText: { color: c.textMuted, fontSize: 13, paddingVertical: 8, paddingHorizontal: 8 },

    textInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.text,
      backgroundColor: c.surface,
      marginHorizontal: 8,
    },

    segmentRow: {
      flexDirection: 'row',
      backgroundColor: c.pressed,
      borderRadius: 8,
      padding: 3,
      marginHorizontal: 8,
    },
    segment: {
      flex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      borderRadius: 6,
    },
    segmentActive: { backgroundColor: c.surface },
    segmentText: { fontSize: 12, color: c.textMuted, fontWeight: '500' },
    segmentTextActive: { color: c.text, fontWeight: '600' },
  })
