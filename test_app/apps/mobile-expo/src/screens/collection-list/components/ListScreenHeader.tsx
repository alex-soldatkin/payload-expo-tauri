/**
 * Collection-list screen header — the iOS native Stack.Toolbar (scan, view
 * selector, presets, actions menu, sort menu, settings, filter, create) with a
 * headerRight Pressable fallback for Android and any binary lacking the
 * experimental Stack.Toolbar API. Plus the search-bar options.
 *
 * Extracted verbatim from the route file (the `!isPreview && <>…</>` block).
 * All behaviour — sort menu, selection actions, custom list actions, view-mode
 * switching, the stacked search-bar placement — is unchanged; the screen owns
 * the state and passes it down.
 */
import React from 'react'
import { Platform, Pressable, View } from 'react-native'
import { Stack, useRouter } from 'expo-router'
import type { SFSymbol } from 'sf-symbols-typescript'
import { Bookmark, CalendarDays, ChartGantt, CheckSquare, Filter, Plus, QrCode, Settings, SquareKanban, Table2 } from 'lucide-react-native'
import {
  getFieldLabel,
  useListColors,
  type ClientField,
  type DocumentListSort,
} from '@payload-universal/admin-native'
import { hasStackToolbar } from '../utils'
import type { ListViewMode } from '@/src/hooks/useKanbanConfig'

type ListAction = { key: string; label: string; icon?: string }

export type ListScreenHeaderProps = {
  slug: string
  label: string
  // View-mode flags + switching
  isKanban: boolean
  isCalendar: boolean
  isGantt: boolean
  kanbanAvailable: boolean
  calendarAvailable: boolean
  ganttAvailable: boolean
  availableViewModes: ListViewMode[]
  nextViewMode: ListViewMode
  onViewModeChange: (mode: ListViewMode) => void
  // Selection + actions
  selectionMode: boolean
  setSelectionMode: (next: boolean) => void
  exitSelectionMode: () => void
  openBulkEdit: () => void
  selectedIds: string[]
  resolvedListActions: ListAction[]
  onRunListAction: (key: string) => void
  // Sort
  sortableFields: ClientField[]
  effectiveSort: DocumentListSort
  onSortFieldPress: (fieldName: string, fieldType?: string) => void
  // Sheet openers
  onOpenScan: () => void
  onOpenPresets: () => void
  onOpenSettings: () => void
  onOpenFilter: () => void
  // Search bar
  onSearchChange: (text: string) => void
}

export function ListScreenHeader({
  slug,
  label,
  isKanban,
  isCalendar,
  isGantt,
  kanbanAvailable,
  calendarAvailable,
  ganttAvailable,
  availableViewModes,
  nextViewMode,
  onViewModeChange,
  selectionMode,
  setSelectionMode,
  exitSelectionMode,
  openBulkEdit,
  selectedIds,
  resolvedListActions,
  onRunListAction,
  sortableFields,
  effectiveSort,
  onSortFieldPress,
  onOpenScan,
  onOpenPresets,
  onOpenSettings,
  onOpenFilter,
  onSearchChange,
}: ListScreenHeaderProps) {
  const router = useRouter()
  const { colors: tc } = useListColors()
  // iOS native header toolbar only when the experimental API exists;
  // otherwise (and on Android) the headerRight fallback below renders.
  const useNativeHeaderToolbar = Platform.OS === 'ios' && hasStackToolbar

  return (
    <>
      <Stack.Screen
        options={{
          title: label,
          // Android path AND the iOS fallback whenever the experimental
          // Stack.Toolbar pipeline is unavailable — the create '+' (and
          // friends) must never depend solely on an unstable native API.
          ...(!useNativeHeaderToolbar ? {
            headerRight: () => (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 4 }}>
                {/* Scan-to-lookup — mirrors the native toolbar's first item */}
                <Pressable
                  onPress={onOpenScan}
                  hitSlop={8}
                  accessibilityLabel="Scan code"
                >
                  <QrCode size={22} color={tc.text} />
                </Pressable>
                {/* View presets — save/share/apply saved views */}
                <Pressable onPress={onOpenPresets} hitSlop={8}>
                  <Bookmark size={22} color={tc.text} />
                </Pressable>
                {/* View toggle — cycles table → kanban → calendar → gantt
                    (only through the modes this collection supports); the
                    icon shows the NEXT mode, before the action icons */}
                {availableViewModes.length > 1 && (
                  <Pressable
                    onPress={() => onViewModeChange(nextViewMode)}
                    hitSlop={8}
                  >
                    {nextViewMode === 'kanban' ? (
                      <SquareKanban size={22} color={tc.text} />
                    ) : nextViewMode === 'calendar' ? (
                      <CalendarDays size={22} color={tc.text} />
                    ) : nextViewMode === 'gantt' ? (
                      <ChartGantt size={22} color={tc.text} />
                    ) : (
                      <Table2 size={22} color={tc.text} />
                    )}
                  </Pressable>
                )}
                {/* Selection mode is a table-only surface */}
                {!isKanban && !isCalendar && !isGantt && (
                  <Pressable
                    onPress={() => setSelectionMode(!selectionMode)}
                    hitSlop={8}
                  >
                    <CheckSquare size={22} color={selectionMode ? '#007AFF' : tc.text} />
                  </Pressable>
                )}
                <Pressable
                  onPress={onOpenSettings}
                  hitSlop={8}
                >
                  <Settings size={22} color={tc.text} />
                </Pressable>
                <Pressable onPress={onOpenFilter} hitSlop={8}>
                  <Filter size={22} color={tc.text} />
                </Pressable>
                <Pressable onPress={() => router.push(`/(admin)/collections/${slug}/create`)} hitSlop={8}>
                  <Plus size={22} color={tc.text} />
                </Pressable>
              </View>
            ),
          } : {}),
          headerSearchBarOptions: {
            placeholder: `Search ${label}...`,
            hideWhenScrolling: true,
            autoCapitalize: 'none',
            // Pin the search field BELOW the nav bar. The default
            // ('automatic') lets iPadOS integrate the search into the
            // TRAILING nav-bar area when the bar is wide enough — i.e.
            // landscape — where its container sits over the trailing
            // UIBarButtonItems and eats taps on the create '+' (the
            // rightmost item). Portrait resolves to stacked anyway, so
            // this makes landscape behave like the known-good portrait.
            // No-op on iPhone (no nav toolbar → automatic == stacked).
            placement: 'stacked',
            onChangeText: (e) => onSearchChange(e.nativeEvent.text),
            onCancelButtonPress: () => onSearchChange(''),
          },
        }}
      />
      {useNativeHeaderToolbar && (
        <Stack.Toolbar placement="right">
          {/* Scan-to-lookup — FIRST item of the single right toolbar
              (sibling placement="right" toolbars override each other) */}
          <Stack.Toolbar.Button
            icon="qrcode.viewfinder"
            tintColor={tc.text}
            separateBackground
            onPress={onOpenScan}
            accessibilityLabel="Scan code"
          />
          {/* View selector — its own group BEFORE the Actions menu.
              Two sibling <Stack.Toolbar placement="right"> elements
              override each other (both set unstable_headerRightItems),
              so the group renders first inside the single toolbar with
              separateBackground + a spacer for visual distinction. */}
          {(kanbanAvailable || calendarAvailable || ganttAvailable) && (
            <Stack.Toolbar.Menu
              icon={
                isCalendar
                  ? 'calendar'
                  : isGantt
                    ? 'chart.bar.doc.horizontal'
                    : isKanban
                      ? 'square.grid.2x2'
                      : 'tablecells'
              }
              title="View"
              tintColor={tc.text}
              separateBackground
            >
              <Stack.Toolbar.MenuAction
                icon="tablecells"
                isOn={!isKanban && !isCalendar && !isGantt}
                onPress={() => onViewModeChange('table')}
              >
                Table
              </Stack.Toolbar.MenuAction>
              {kanbanAvailable && (
                <Stack.Toolbar.MenuAction
                  icon="square.grid.2x2"
                  isOn={isKanban}
                  onPress={() => onViewModeChange('kanban')}
                >
                  Kanban
                </Stack.Toolbar.MenuAction>
              )}
              {/* Calendar — only for collections with >=1 date field */}
              {calendarAvailable && (
                <Stack.Toolbar.MenuAction
                  icon="calendar"
                  isOn={isCalendar}
                  onPress={() => onViewModeChange('calendar')}
                >
                  Calendar
                </Stack.Toolbar.MenuAction>
              )}
              {/* Gantt — same date-field gate as the calendar */}
              {ganttAvailable && (
                <Stack.Toolbar.MenuAction
                  icon="chart.bar.doc.horizontal"
                  isOn={isGantt}
                  onPress={() => onViewModeChange('gantt')}
                >
                  Gantt
                </Stack.Toolbar.MenuAction>
              )}
            </Stack.Toolbar.Menu>
          )}
          {/* Presets — part of the view-selector group (before Actions):
              saved table/kanban views incl. board config + filters */}
          <Stack.Toolbar.Button
            icon="bookmark"
            tintColor={tc.text}
            separateBackground
            onPress={onOpenPresets}
          />
          <Stack.Toolbar.Spacer width={12} />
          {/* Actions menu — selection mode, generic bulk edit, and custom
              list actions (labels from Payload custom components) */}
          <Stack.Toolbar.Menu icon="ellipsis.circle" title="Actions" tintColor={tc.text}>
            {!selectionMode && !isKanban && !isCalendar && !isGantt && (
              <Stack.Toolbar.MenuAction
                icon="checkmark.circle"
                onPress={() => setSelectionMode(true)}
              >
                Select Items...
              </Stack.Toolbar.MenuAction>
            )}
            {selectionMode && (
              <Stack.Toolbar.MenuAction
                icon="square.and.pencil"
                onPress={openBulkEdit}
              >
                Edit Selected ({selectedIds.length})
              </Stack.Toolbar.MenuAction>
            )}
            {selectionMode && (
              <Stack.Toolbar.MenuAction
                icon="xmark.circle"
                onPress={exitSelectionMode}
              >
                Cancel Selection ({selectedIds.length})
              </Stack.Toolbar.MenuAction>
            )}
            {resolvedListActions.map((action) => (
              <Stack.Toolbar.MenuAction
                key={action.key}
                icon={(action.icon || 'bolt') as SFSymbol}
                onPress={() => onRunListAction(action.key)}
              >
                {action.label}{selectionMode && selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
          {/* Sort menu — schema-driven sortable fields */}
          {sortableFields.length > 0 && (
            <Stack.Toolbar.Menu icon="arrow.up.arrow.down" title="Sort By" tintColor={tc.text}>
              {sortableFields.map((f) => (
                <Stack.Toolbar.MenuAction
                  key={f.name}
                  isOn={effectiveSort.field === f.name}
                  icon={
                    effectiveSort.field === f.name
                      ? effectiveSort.direction === 'asc'
                        ? 'chevron.up'
                        : 'chevron.down'
                      : undefined
                  }
                  onPress={() => onSortFieldPress(f.name!, f.type)}
                >
                  {getFieldLabel(f)}
                </Stack.Toolbar.MenuAction>
              ))}
            </Stack.Toolbar.Menu>
          )}
          <Stack.Toolbar.Button
            icon="gearshape"
            tintColor={tc.text}
            onPress={onOpenSettings}
          />
          <Stack.Toolbar.Button
            icon="line.3.horizontal.decrease"
            tintColor={tc.text}
            onPress={onOpenFilter}
          />
          {/* Create — the trailing-most item; the stacked search-bar
              placement above guarantees nothing overlays its hit area
              in iPad landscape. */}
          <Stack.Toolbar.Button
            icon="plus"
            tintColor={tc.text}
            accessibilityLabel="Create"
            onPress={() => router.push(`/(admin)/collections/${slug}/create`)}
          />
        </Stack.Toolbar>
      )}
    </>
  )
}
