/**
 * CalendarCustomizeSheet — calendar customisation for the collection list
 * view (gear entry while in calendar mode, mirrors KanbanCustomizeSheet).
 *
 * Sections (list mode):
 *   1. Default mode — Month/Week/Day segmented row (the mode the calendar
 *      opens in; week/day share the timeline surface, see CalendarView)
 *   2. Sources — drag-to-reorder rows (colour swatch, label, start → end
 *      subtitle) with edit / remove actions + an 'Add source…' row
 *   3. Visibility — one row per source with a native SwiftUI Toggle switch
 *      (registry Toggle, default toggleStyle, like the checkbox field;
 *      lucide Eye/EyeOff Pressable fallback). Toggling sets the source's
 *      `hidden` flag in the draft; CalendarView's legend seeds from it.
 *      DECISION (drag rules): visibility lives in this SEPARATE non-drag
 *      section rather than inside the Sources rows — @expo/ui must never
 *      render inside a reanimated-dnd Sortable tree, and the Sortable rows
 *      stay lucide-only (swatch/pencil/trash) exactly as before.
 *
 * Editor mode (add / edit a source):
 *   - start date-field picker (radio list over the collection's date fields,
 *     dot-paths included)
 *   - optional end date-field picker ('None — point events' + remaining
 *     date fields)
 *   - label input (auto-filled from the start field's label until touched)
 *   - colour — native SwiftUI ColorPicker via the admin-native registry
 *     (null-checked) with the curated 8-swatch fallback row
 *
 * All changes buffer into a local draft; the ✓ button flushes the draft via
 * `onSave` (the parent persists through useCalendarConfig — saving always
 * writes an EXPLICIT source list, even when the draft started from the
 * pickDefaultSources fallback).
 *
 * Drag rules (memory-bank 013 'Drag-to-Reorder'):
 *   - react-native-reanimated-dnd Sortable/SortableItem via try/catch require
 *   - onMove is a NO-OP; state updates only in onDrop (allPositions)
 *   - lucide icons ONLY inside Sortable trees (no @expo/ui there) — the
 *     native ColorPicker renders in the editor view, never inside a Sortable
 *   - items use stable string ids; useFlatList={false} inside fixed-height
 *
 * This file is the thin orchestrator; the sub-components, draft hook, styles,
 * types and helpers live in the sibling files of this folder.
 */
import React, { useMemo } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { Check, Plus } from 'lucide-react-native'
import { BottomSheet, useListColors } from '@payload-universal/admin-native'

import { SourceEditor } from './components/SourceEditor'
import { SourceList } from './components/SourceList'
import { VisibilitySection } from './components/VisibilitySection'
import { useCalendarDraft } from './hooks/useCalendarDraft'
import { createStyles, MODE_OPTIONS } from './styles'
import type { CalendarCustomizeSheetProps } from './types'

export type { CalendarCustomizeSheetProps, CalendarDateFieldOption } from './types'

export function CalendarCustomizeSheet({
  visible,
  onClose,
  dateFieldOptions,
  config,
  resolvedSources,
  onSave,
}: CalendarCustomizeSheetProps) {
  const { colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])

  const {
    draft,
    setDraft,
    editor,
    setEditor,
    fieldLabel,
    removeSource,
    setSourceVisible,
    noopMove,
    handleSourceDrop,
    openAddSource,
    openEditSource,
    handlePickStartField,
    handlePickEndField,
    handleEditorSave,
    handleSave,
  } = useCalendarDraft({ visible, dateFieldOptions, config, resolvedSources, onSave, onClose })

  // ── Editor view (add / edit a source) ─────────────────────────────────
  const editorView = editor && (
    <SourceEditor
      editor={editor}
      setEditor={setEditor}
      dateFieldOptions={dateFieldOptions}
      styles={styles}
      colors={colors}
      fieldLabel={fieldLabel}
      handlePickStartField={handlePickStartField}
      handlePickEndField={handlePickEndField}
      handleEditorSave={handleEditorSave}
    />
  )

  // ── List view ─────────────────────────────────────────────────────────
  const listView = !editor && (
    <>
      <View style={styles.sheetHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetTitle}>Calendar Settings</Text>
          <Text style={styles.sheetHint}>Date sources and default mode.</Text>
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
        {/* ── Default mode ─────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>DEFAULT MODE</Text>
        <View style={styles.segmentRow}>
          {MODE_OPTIONS.map(({ value, label }) => (
            <Pressable
              key={value}
              style={[styles.segment, draft.defaultMode === value && styles.segmentActive]}
              onPress={() => setDraft((prev) => ({ ...prev, defaultMode: value }))}
            >
              <Text
                style={[
                  styles.segmentText,
                  draft.defaultMode === value && styles.segmentTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* ── Sources ──────────────────────────────────────────────── */}
        <SourceList
          sources={draft.sources}
          styles={styles}
          colors={colors}
          fieldLabel={fieldLabel}
          openEditSource={openEditSource}
          removeSource={removeSource}
          noopMove={noopMove}
          handleSourceDrop={handleSourceDrop}
        />

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
            ON = source visible on the calendar (sets `hidden` in the draft;
            the header legend seeds from it after save). ─────────────────── */}
        <VisibilitySection
          sources={draft.sources}
          styles={styles}
          colors={colors}
          setSourceVisible={setSourceVisible}
        />
      </ScrollView>
    </>
  )

  return (
    <BottomSheet visible={visible} onClose={onClose} detents={['medium', 'large']}>
      {editor ? editorView : listView}
    </BottomSheet>
  )
}
