import React, { useState } from 'react'
import { Pressable, Text } from 'react-native'

import { nativeComponents } from '../../../shared'
import { NativeHost } from '../../../NativeHost'
import { BottomSheet } from '../../../../BottomSheet'
import { usePalette } from '../palette'
import { commonStyles } from '../styles'

// ---------------------------------------------------------------------------
// Row actions — Move Up / Move Down / Duplicate / Insert Below / Remove.
// Shared by ArrayField and BlocksField rows.
// ---------------------------------------------------------------------------

export type RowAction = {
  key: string
  label: string
  /** SF Symbol name (iOS native menu). */
  systemImage?: string
  /** Material icon name (Android JC menu), e.g. 'filled.Delete'. */
  materialIcon?: string
  destructive?: boolean
  disabled?: boolean
  onPress: () => void
}

export const buildRowActions = (opts: {
  index: number
  count: number
  /** Lowercased noun for menu labels, e.g. 'row' or 'block'. */
  noun?: string
  minRows?: number
  maxRows?: number
  onMove: (from: number, to: number) => void
  onDuplicate: (index: number) => void
  /** Omit to skip the "Insert Below" entry (blocks add via the picker). */
  onInsertBelow?: (index: number) => void
  onRemove: (index: number) => void
}): RowAction[] => {
  const { index, count, minRows, maxRows, onMove, onDuplicate, onInsertBelow, onRemove } = opts
  const atMax = maxRows != null && count >= maxRows
  const atMin = minRows != null && count <= minRows
  const actions: RowAction[] = [
    {
      key: 'move-up',
      label: 'Move Up',
      systemImage: 'arrow.up',
      materialIcon: 'filled.KeyboardArrowUp',
      disabled: index === 0,
      onPress: () => onMove(index, index - 1),
    },
    {
      key: 'move-down',
      label: 'Move Down',
      systemImage: 'arrow.down',
      materialIcon: 'filled.KeyboardArrowDown',
      disabled: index >= count - 1,
      onPress: () => onMove(index, index + 1),
    },
    {
      key: 'duplicate',
      label: 'Duplicate',
      systemImage: 'plus.square.on.square',
      materialIcon: 'filled.AddCircle',
      disabled: atMax,
      onPress: () => onDuplicate(index),
    },
  ]
  if (onInsertBelow) {
    actions.push({
      key: 'insert-below',
      label: 'Insert Below',
      systemImage: 'arrow.turn.down.right',
      materialIcon: 'filled.Add',
      disabled: atMax,
      onPress: () => onInsertBelow(index),
    })
  }
  actions.push({
    key: 'remove',
    label: 'Remove',
    systemImage: 'trash',
    materialIcon: 'filled.Delete',
    destructive: true,
    disabled: atMin,
    onPress: () => onRemove(index),
  })
  return actions
}

/**
 * Per-row actions affordance.
 *
 * Tiers (registry-gated, platform-free):
 *  1. SwiftUI Menu — TAP on the ellipsis opens the native anchored
 *     quick-action menu (same pattern as DocumentActionsMenu). The Menu
 *     trigger also opens on touch-and-hold natively, so the previous
 *     long-press ContextMenu wrapper is redundant — and nesting both would
 *     put two competing native gesture owners on the same anchor.
 *  2. JC ContextMenu — tap the trigger opens the native Material dropdown.
 *  3. Pure JS — ellipsis Pressable opens the package BottomSheet.
 */
export const RowActionsMenu: React.FC<{
  actions: RowAction[]
  /** Sheet header, e.g. the row title. */
  title?: string
}> = ({ actions, title }) => {
  const palette = usePalette()
  const [sheetVisible, setSheetVisible] = useState(false)

  const openSheet = () => setSheetVisible(true)
  const closeSheet = () => setSheetVisible(false)

  // Tier 1 — SwiftUI Menu (iOS-shaped keys are null on Android / Expo Go).
  const Menu = nativeComponents.Menu
  const NativeButton = nativeComponents.Button
  const MenuDivider = nativeComponents.Divider
  const disabledMod = nativeComponents.disabled
  const tintMod = nativeComponents.tint
  if (Menu && NativeButton) {
    // Disabled entries grey out via the `disabled` modifier; when the factory
    // is missing they are omitted instead (never render tappable no-ops).
    const visible = actions.filter((a) => !a.disabled || disabledMod)
    const items: React.ReactNode[] = []
    visible.forEach((a, i) => {
      // Destructive entries (Remove) sit in their own group below a divider.
      if (a.destructive && i > 0 && MenuDivider) {
        items.push(<MenuDivider key={`divider-${a.key}`} />)
      }
      items.push(
        <NativeButton
          key={a.key}
          label={a.label}
          systemImage={a.systemImage}
          role={a.destructive ? 'destructive' : 'default'}
          onPress={a.disabled ? undefined : a.onPress}
          modifiers={a.disabled && disabledMod ? [disabledMod(true)] : undefined}
        />,
      )
    })
    return (
      <NativeHost matchContents>
        <Menu
          label=""
          systemImage="ellipsis.circle"
          modifiers={tintMod ? [tintMod(palette.textMuted)] : undefined}
        >
          {items}
        </Menu>
      </NativeHost>
    )
  }

  // Tier 2 — JC ContextMenu (tap-to-open dropdown). Items must be JC Buttons;
  // the trigger child must be non-interactive so the wrapper pressable wins.
  const ContextMenu = nativeComponents.ContextMenu
  const ContextMenuTrigger = nativeComponents.ContextMenuTrigger
  const ContextMenuItems = nativeComponents.ContextMenuItems
  const JCButton = nativeComponents.JCButton
  const NativeText = nativeComponents.Text
  if (ContextMenu && ContextMenuTrigger && ContextMenuItems && JCButton && NativeText) {
    return (
      <NativeHost matchContents>
        <ContextMenu>
          <ContextMenuItems>
            {actions.map((a) => (
              <JCButton
                key={a.key}
                variant="borderless"
                leadingIcon={a.materialIcon}
                disabled={a.disabled}
                onPress={a.onPress}
                color={a.destructive ? palette.destructive : undefined}
              >
                {a.label}
              </JCButton>
            ))}
          </ContextMenuItems>
          <ContextMenuTrigger>
            <NativeText>{'⋯'}</NativeText>
          </ContextMenuTrigger>
        </ContextMenu>
      </NativeHost>
    )
  }

  // Tier 3 — pure JS fallback (Expo Go safe): ellipsis opens the BottomSheet.
  const sheetHeight = Math.min(0.5, (actions.length * 52 + 110) / 800)
  return (
    <>
      <Pressable onPress={openSheet} hitSlop={8} style={commonStyles.ellipsisBtn}>
        <Text style={[commonStyles.ellipsisText, { color: palette.textMuted }]}>{'⋯'}</Text>
      </Pressable>
      <BottomSheet visible={sheetVisible} onClose={closeSheet} height={sheetHeight}>
        <Text style={[commonStyles.sheetTitle, { color: palette.text }]}>{title || 'Row Actions'}</Text>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            disabled={action.disabled}
            style={({ pressed }) => [
              commonStyles.sheetRow,
              pressed && { backgroundColor: palette.cardBg },
            ]}
            onPress={() => {
              closeSheet()
              action.onPress()
            }}
          >
            <Text
              style={[
                commonStyles.sheetRowLabel,
                { color: action.destructive ? palette.destructive : palette.text },
                action.disabled && { color: palette.textFaint },
              ]}
            >
              {action.label}
            </Text>
          </Pressable>
        ))}
      </BottomSheet>
    </>
  )
}
