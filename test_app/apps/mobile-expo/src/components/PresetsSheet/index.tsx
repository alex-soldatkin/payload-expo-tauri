/**
 * PresetsSheet — save / share / apply view presets (server 'view-presets'
 * collection, local-first via useViewPresets).
 *
 * List mode:
 *   - 'Save current as preset…' row on top (opens the editor in create mode)
 *   - MY PRESETS — apply on tap; trailing native Menu with row actions
 *     (Rename / Update from current / Share… / Delete destructive) using the
 *     registry Menu pattern (iOS SwiftUI Menu → Android JC ContextMenu →
 *     Alert fallback). The menu sits OUTSIDE the apply Pressable so native
 *     gesture ownership stays unambiguous.
 *   - SHARED WITH ME — apply on tap only (update/delete are owner-only).
 *
 * Editor mode (create / rename+share):
 *   - title input
 *   - access segmented control (Only Me / Specific Users / Everyone)
 *   - searchable user multi-picker (local-first 'users' collection, REST
 *     fallback) when Specific Users — the owner is always included
 *     server-side, so the current user is omitted from the list.
 *
 * Applying delegates to the screen via onApply(preset) — the screen writes
 * the kanban config, view mode and filter pipelines.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  CalendarDays,
  ChartGantt,
  Check,
  Plus,
  SquareKanban,
  Table2,
} from 'lucide-react-native'
import {
  BottomSheet,
  useListColors,
  useToast,
} from '@payload-universal/admin-native'

import {
  useViewPresets,
  type ViewPresetDoc,
  type ViewPresetSnapshot,
} from '@/src/hooks/useViewPresets'

import { ACCESS_MODES } from './constants'
import { createStyles } from './styles'
import { PresetRowMenu } from './components/PresetRowMenu'
import { UserMultiPicker } from './components/UserMultiPicker'
import type { EditorState, PresetsSheetProps, RowAction } from './types'

export type { PresetsSheetProps } from './types'

export function PresetsSheet({
  visible,
  onClose,
  slug,
  currentViewType,
  currentConfig,
  currentCalendarConfig,
  currentGanttConfig,
  currentWhere,
  onApply,
}: PresetsSheetProps) {
  const { colors } = useListColors()
  const styles = useMemo(() => createStyles(colors), [colors])
  const toast = useToast()

  const { loaded, myPresets, sharedPresets, userId, createPreset, updatePreset, deletePreset } =
    useViewPresets(slug)

  const [editor, setEditor] = useState<EditorState | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (visible) {
      setEditor(null)
      setSaving(false)
    }
  }, [visible])

  const snapshot = useMemo<ViewPresetSnapshot>(
    () => ({
      viewType: currentViewType,
      config: currentConfig,
      calendar: currentCalendarConfig,
      gantt: currentGanttConfig,
      where: currentWhere,
    }),
    [currentViewType, currentConfig, currentCalendarConfig, currentGanttConfig, currentWhere],
  )

  // ── Editor actions ────────────────────────────────────────────────────
  const openCreate = useCallback(() => {
    setEditor({ mode: 'create', title: '', accessMode: 'onlyMe', sharedWith: [] })
  }, [])

  const openEdit = useCallback((preset: ViewPresetDoc) => {
    setEditor({
      mode: 'edit',
      id: preset.id,
      title: preset.title,
      accessMode: preset.accessMode,
      sharedWith: preset.sharedWith,
    })
  }, [])

  const handleEditorSave = useCallback(async () => {
    if (!editor || saving) return
    const title = editor.title.trim()
    if (!title) return
    setSaving(true)
    try {
      if (editor.mode === 'create') {
        await createPreset({
          title,
          ...snapshot,
          accessMode: editor.accessMode,
          sharedWith: editor.sharedWith,
        })
        toast.showToast('Preset saved', { type: 'success' })
      } else if (editor.id) {
        await updatePreset(editor.id, {
          title,
          accessMode: editor.accessMode,
          sharedWith: editor.sharedWith,
        })
        toast.showToast('Preset updated', { type: 'success' })
      }
      setEditor(null)
    } catch {
      toast.showToast('Failed to save preset', { type: 'error' })
    } finally {
      setSaving(false)
    }
  }, [editor, saving, snapshot, createPreset, updatePreset, toast])

  // ── Row actions ───────────────────────────────────────────────────────
  const handleUpdateFromCurrent = useCallback(
    async (preset: ViewPresetDoc) => {
      try {
        await updatePreset(preset.id, { snapshot })
        toast.showToast(`"${preset.title}" updated from current view`, { type: 'success' })
      } catch {
        toast.showToast('Failed to update preset', { type: 'error' })
      }
    },
    [updatePreset, snapshot, toast],
  )

  const handleDelete = useCallback(
    (preset: ViewPresetDoc) => {
      Alert.alert('Delete Preset', `Delete "${preset.title}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deletePreset(preset.id).catch(() =>
              toast.showToast('Failed to delete preset', { type: 'error' }),
            )
          },
        },
      ])
    },
    [deletePreset, toast],
  )

  const rowActionsFor = useCallback(
    (preset: ViewPresetDoc): RowAction[] => [
      { key: 'rename', label: 'Rename', icon: 'pencil', onPress: () => openEdit(preset) },
      {
        key: 'update',
        label: 'Update from current',
        icon: 'arrow.triangle.2.circlepath',
        onPress: () => handleUpdateFromCurrent(preset),
      },
      {
        key: 'share',
        label: 'Share…',
        icon: 'person.badge.plus',
        onPress: () => openEdit(preset),
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: 'trash',
        destructive: true,
        onPress: () => handleDelete(preset),
      },
    ],
    [openEdit, handleUpdateFromCurrent, handleDelete],
  )

  // ── Renderers ─────────────────────────────────────────────────────────
  const renderPresetRow = (preset: ViewPresetDoc, mine: boolean) => (
    <View key={preset.id} style={styles.presetRow}>
      <Pressable
        style={({ pressed }) => [styles.presetApply, pressed && styles.rowPressed]}
        onPress={() => onApply(preset)}
      >
        {preset.viewType === 'kanban' ? (
          <SquareKanban size={20} color={colors.textMuted} />
        ) : preset.viewType === 'calendar' ? (
          <CalendarDays size={20} color={colors.textMuted} />
        ) : preset.viewType === 'gantt' ? (
          <ChartGantt size={20} color={colors.textMuted} />
        ) : (
          <Table2 size={20} color={colors.textMuted} />
        )}
        <View style={styles.presetInfo}>
          <Text style={styles.rowLabel} numberOfLines={1}>{preset.title}</Text>
          <Text style={styles.presetMeta}>
            {preset.viewType === 'kanban'
              ? 'Kanban'
              : preset.viewType === 'calendar'
                ? 'Calendar'
                : preset.viewType === 'gantt'
                  ? 'Gantt'
                  : 'Table'}
            {preset.where != null ? ' · filtered' : ''}
          </Text>
        </View>
        {preset.accessMode !== 'onlyMe' && (
          <View style={styles.sharedBadge}>
            <Text style={styles.sharedBadgeText}>
              {preset.accessMode === 'everyone' ? 'Everyone' : 'Shared'}
            </Text>
          </View>
        )}
      </Pressable>
      {/* Owner-only actions — sibling of the apply Pressable, never nested */}
      {mine && <PresetRowMenu actions={rowActionsFor(preset)} color={colors.textMuted} />}
    </View>
  )

  // ── Editor view ───────────────────────────────────────────────────────
  const editorView = editor && (
    <>
      <View style={styles.sheetHeader}>
        <Pressable onPress={() => setEditor(null)} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.sheetTitle}>
          {editor.mode === 'create' ? 'New Preset' : 'Edit Preset'}
        </Text>
        <Pressable
          onPress={handleEditorSave}
          hitSlop={8}
          disabled={!editor.title.trim() || saving}
        >
          <View
            style={[
              styles.saveBtn,
              { backgroundColor: colors.primary },
              (!editor.title.trim() || saving) && styles.saveBtnDisabled,
            ]}
          >
            <Check size={20} color={colors.primaryText} />
          </View>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <Text style={styles.sectionLabel}>TITLE</Text>
        <TextInput
          style={styles.textInput}
          value={editor.title}
          onChangeText={(title) => setEditor((prev) => (prev ? { ...prev, title } : prev))}
          placeholder="Preset title"
          placeholderTextColor={colors.textPlaceholder}
          autoFocus={editor.mode === 'create'}
          returnKeyType="done"
        />

        <Text style={styles.sectionLabel}>WHO CAN SEE THIS VIEW</Text>
        <View style={styles.segmentRow}>
          {ACCESS_MODES.map(({ value, label }) => (
            <Pressable
              key={value}
              style={[styles.segment, editor.accessMode === value && styles.segmentActive]}
              onPress={() =>
                setEditor((prev) => (prev ? { ...prev, accessMode: value } : prev))
              }
            >
              <Text
                style={[
                  styles.segmentText,
                  editor.accessMode === value && styles.segmentTextActive,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        {editor.accessMode === 'specificUsers' && (
          <>
            <Text style={styles.sectionLabel}>SHARED WITH</Text>
            <UserMultiPicker
              selected={editor.sharedWith}
              onToggle={(id) =>
                setEditor((prev) =>
                  prev
                    ? {
                        ...prev,
                        sharedWith: prev.sharedWith.includes(id)
                          ? prev.sharedWith.filter((x) => x !== id)
                          : [...prev.sharedWith, id],
                      }
                    : prev,
                )
              }
              excludeId={userId}
              colors={colors}
              styles={styles}
            />
          </>
        )}
      </ScrollView>
    </>
  )

  // ── List view ─────────────────────────────────────────────────────────
  const listView = !editor && (
    <>
      <View style={styles.sheetHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sheetTitle}>View Presets</Text>
          <Text style={styles.sheetHint}>Saved table, kanban, calendar & gantt views for this collection.</Text>
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* Save current state as a new preset */}
        <Pressable
          style={({ pressed }) => [styles.saveCurrentRow, pressed && styles.rowPressed]}
          onPress={openCreate}
        >
          <Plus size={20} color={colors.primary} />
          <Text style={styles.saveCurrentText}>Save current as preset…</Text>
        </Pressable>

        <Text style={styles.sectionLabel}>MY PRESETS</Text>
        {!loaded ? (
          <ActivityIndicator style={styles.userLoading} />
        ) : myPresets.length === 0 ? (
          <Text style={styles.emptyText}>No presets yet</Text>
        ) : (
          myPresets.map((preset) => renderPresetRow(preset, true))
        )}

        {sharedPresets.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>SHARED WITH ME</Text>
            {sharedPresets.map((preset) => renderPresetRow(preset, false))}
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
