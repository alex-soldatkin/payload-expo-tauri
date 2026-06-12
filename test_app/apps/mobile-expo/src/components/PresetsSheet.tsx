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
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  CalendarDays,
  ChartGantt,
  Check,
  Circle,
  CircleCheck,
  MoreHorizontal,
  Plus,
  SquareKanban,
  Table2,
} from 'lucide-react-native'
import {
  BottomSheet,
  payloadApi,
  usePayloadNative,
  useListColors,
  useToast,
  type ListColorPalette,
} from '@payload-universal/admin-native'
import { nativeComponents, NativeHost } from '@payload-universal/admin-native/fields'
import { useLocalDB } from '@payload-universal/local-db'

import type { CalendarConfig } from '@/src/hooks/useCalendarConfig'
import type { GanttConfig } from '@/src/hooks/useGanttConfig'
import type { KanbanConfig, ListViewMode } from '@/src/hooks/useKanbanConfig'
import {
  useViewPresets,
  type ViewPresetAccessMode,
  type ViewPresetDoc,
  type ViewPresetSnapshot,
} from '@/src/hooks/useViewPresets'

const DESTRUCTIVE_RED = '#FF3B30'

const ACCESS_MODES: Array<{ value: ViewPresetAccessMode; label: string }> = [
  { value: 'onlyMe', label: 'Only Me' },
  { value: 'specificUsers', label: 'Specific Users' },
  { value: 'everyone', label: 'Everyone' },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type PresetsSheetProps = {
  visible: boolean
  onClose: () => void
  slug: string
  /** Current view mode — lifted into new/updated presets. */
  currentViewType: ListViewMode
  /** Current board config — lifted into new/updated presets. */
  currentConfig: KanbanConfig
  /** Current calendar config (RESOLVED sources) — lifted into new/updated presets. */
  currentCalendarConfig: CalendarConfig
  /** Current gantt config (RESOLVED sources) — lifted into new/updated presets. */
  currentGanttConfig: GanttConfig
  /** Current structured filters as a Payload where (search excluded). */
  currentWhere: Record<string, unknown> | null
  /** Apply a preset: the screen writes config + view mode + filters. */
  onApply: (preset: ViewPresetDoc) => void
}

type EditorState = {
  mode: 'create' | 'edit'
  id?: string
  title: string
  accessMode: ViewPresetAccessMode
  sharedWith: string[]
}

// ---------------------------------------------------------------------------
// Row actions menu — registry Menu pattern (DocumentActionsMenu precedent)
// ---------------------------------------------------------------------------

type RowAction = {
  key: string
  label: string
  /** SF Symbol (iOS menu). */
  icon?: string
  destructive?: boolean
  onPress: () => void
}

function PresetRowMenu({ actions, color }: { actions: RowAction[]; color: string }) {
  const Menu = nativeComponents.Menu
  const MenuButton = nativeComponents.Button
  const ContextMenu = nativeComponents.ContextMenu as React.ComponentType<any> | null
  const Trigger = nativeComponents.ContextMenuTrigger
  const Items = nativeComponents.ContextMenuItems
  const JCButton = nativeComponents.JCButton

  if (Platform.OS === 'ios' && Menu && MenuButton) {
    return (
      <NativeHost matchContents>
        <Menu label="" systemImage="ellipsis.circle">
          {actions.map((action) => (
            <MenuButton
              key={action.key}
              label={action.label}
              systemImage={action.icon}
              role={action.destructive ? 'destructive' : undefined}
              onPress={action.onPress}
            />
          ))}
        </Menu>
      </NativeHost>
    )
  }

  if (Platform.OS === 'android' && ContextMenu && Trigger && Items && JCButton) {
    return (
      <ContextMenu style={menuStyles.androidAnchor}>
        <Items>
          {actions.map((action) => (
            <JCButton
              key={action.key}
              variant="borderless"
              elementColors={action.destructive ? { contentColor: DESTRUCTIVE_RED } : undefined}
              onPress={action.onPress}
            >
              {action.label}
            </JCButton>
          ))}
        </Items>
        <Trigger>
          <View style={menuStyles.trigger}>
            <MoreHorizontal size={20} color={color} />
          </View>
        </Trigger>
      </ContextMenu>
    )
  }

  // Fallback (Expo Go) — system alert with the same actions
  return (
    <Pressable
      hitSlop={8}
      style={menuStyles.trigger}
      onPress={() =>
        Alert.alert('Preset', undefined, [
          ...actions.map((action) => ({
            text: action.label,
            style: action.destructive ? ('destructive' as const) : ('default' as const),
            onPress: action.onPress,
          })),
          { text: 'Cancel', style: 'cancel' as const },
        ])
      }
    >
      <MoreHorizontal size={20} color={color} />
    </Pressable>
  )
}

const menuStyles = StyleSheet.create({
  androidAnchor: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  trigger: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
})

// ---------------------------------------------------------------------------
// User multi-picker — relationship-style searchable list over 'users'
// (local-first RxDB; REST fallback when the local collection is missing)
// ---------------------------------------------------------------------------

const userDisplayName = (doc: Record<string, unknown>): string =>
  String(doc.name ?? doc.email ?? doc.id ?? '')

function UserMultiPicker({
  selected,
  onToggle,
  excludeId,
  colors,
  styles,
}: {
  selected: string[]
  onToggle: (id: string) => void
  /** The current user — owner is always included server-side, so hide them. */
  excludeId: string | null
  colors: ListColorPalette
  styles: ReturnType<typeof createStyles>
}) {
  const { baseURL, auth } = usePayloadNative()
  const localDB = useLocalDB()
  const usersCollection = localDB?.collections?.users
  const [search, setSearch] = useState('')
  const [docs, setDocs] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        if (usersCollection) {
          const results = await usersCollection
            .find({ selector: { _deleted: { $eq: false } }, sort: [{ updatedAt: 'desc' }], limit: 100 })
            .exec()
          if (!cancelled) setDocs(results.map((r: any) => r.toJSON()))
        } else {
          const result = await payloadApi.find({ baseURL, token: auth.token }, 'users', {
            limit: 100,
            depth: 0,
            sort: 'email',
          })
          if (!cancelled) setDocs(result.docs)
        }
      } catch {
        if (!cancelled) setDocs([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [usersCollection, baseURL, auth.token])

  const filtered = useMemo(() => {
    const visible = docs.filter((d) => String(d.id) !== excludeId)
    if (!search.trim()) return visible
    const q = search.toLowerCase()
    return visible.filter((d) =>
      ['name', 'email', 'id'].some((f) => d[f] != null && String(d[f]).toLowerCase().includes(q)),
    )
  }, [docs, search, excludeId])

  return (
    <View>
      <TextInput
        style={styles.textInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search users…"
        placeholderTextColor={colors.textPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading ? (
        <ActivityIndicator style={styles.userLoading} />
      ) : filtered.length === 0 ? (
        <Text style={styles.emptyText}>No users found</Text>
      ) : (
        filtered.map((doc) => {
          const id = String(doc.id)
          const isSelected = selected.includes(id)
          return (
            <Pressable key={id} style={styles.userRow} onPress={() => onToggle(id)}>
              {isSelected ? (
                <CircleCheck size={22} color={colors.primary} />
              ) : (
                <Circle size={22} color={colors.border} />
              )}
              <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]} numberOfLines={1}>
                {userDisplayName(doc)}
              </Text>
            </Pressable>
          )
        })
      )}
    </View>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Styles — dark-mode aware palette only (zero hardcoded light colours)
// ---------------------------------------------------------------------------

const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    sheetHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 8,
      gap: 8,
    },
    sheetTitle: { flex: 1, fontSize: 18, fontWeight: '700', color: c.text },
    sheetHint: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    backBtn: { paddingRight: 4 },
    backText: { fontSize: 15, color: c.primary, fontWeight: '600' },
    saveBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveBtnDisabled: { opacity: 0.4 },

    sectionLabel: {
      fontSize: 11,
      fontWeight: '700',
      color: c.textMuted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginTop: 16,
      marginBottom: 6,
    },

    saveCurrentRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    saveCurrentText: { fontSize: 15, fontWeight: '600', color: c.primary },

    presetRow: {
      flexDirection: 'row',
      alignItems: 'center',
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    presetApply: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 4,
    },
    presetInfo: { flex: 1 },
    presetMeta: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    rowPressed: { opacity: 0.6 },
    rowLabel: { flexShrink: 1, fontSize: 15, color: c.text, fontWeight: '500' },
    rowLabelSelected: { fontWeight: '600' },

    sharedBadge: {
      borderRadius: 999,
      backgroundColor: c.pressed,
      borderWidth: 1,
      borderColor: c.border,
      paddingHorizontal: 8,
      paddingVertical: 2,
    },
    sharedBadgeText: { fontSize: 10, fontWeight: '700', color: c.textMuted, letterSpacing: 0.5 },

    emptyText: { color: c.textMuted, fontSize: 13, paddingVertical: 8, paddingHorizontal: 4 },

    textInput: {
      borderWidth: 1,
      borderColor: c.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.text,
      backgroundColor: c.surface,
    },

    segmentRow: {
      flexDirection: 'row',
      backgroundColor: c.pressed,
      borderRadius: 8,
      padding: 3,
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

    userRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 10,
      paddingHorizontal: 4,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: c.separator,
    },
    userLoading: { paddingVertical: 16 },
  })
