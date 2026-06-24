// ---------------------------------------------------------------------------
// Row actions menu — registry Menu pattern (DocumentActionsMenu precedent)
// ---------------------------------------------------------------------------
import React from 'react'
import { Alert, Platform, Pressable, View } from 'react-native'
import { MoreHorizontal } from 'lucide-react-native'
import { nativeComponents, NativeHost } from '@payload-universal/admin-native/fields'

import { DESTRUCTIVE_RED } from '../constants'
import { menuStyles } from '../styles'
import type { RowAction } from '../types'

export function PresetRowMenu({ actions, color }: { actions: RowAction[]; color: string }) {
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
