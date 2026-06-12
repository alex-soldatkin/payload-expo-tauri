/**
 * DocumentActionsMenu — native menu for the document edit header.
 *
 * iOS: @expo/ui SwiftUI Menu (tap-to-open pulldown) with real menu items —
 * SF Symbol icons, destructive roles and Divider-separated groups.
 * Android: @expo/ui Jetpack Compose ContextMenu (press-to-open dropdown).
 * Falls back to a BottomSheet when @expo/ui is unavailable (Expo Go).
 *
 * Shows contextual actions based on collection capabilities:
 *  - "Versions" (when the collection has versions enabled)
 *  - "Save as Draft" / "Publish" / "Unpublish" (when drafts are enabled)
 *  - custom `extraActions` from Payload config (editMenuItems)
 */
import React, { useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native'

import { BottomSheet } from './BottomSheet'
import { NativeHost } from './fields/NativeHost'
import { nativeComponents } from './fields/shared'
import { defaultTheme as t } from './theme'

const DESTRUCTIVE_RED = '#FF3B30'

// ---------------------------------------------------------------------------
// Action item type
// ---------------------------------------------------------------------------

/** Built-in groups, separated by dividers in the native menus. */
type ActionGroup = 'versions' | 'drafts' | 'extra'

type ActionItem = {
  key: string
  label: string
  /** SF Symbol name (iOS native menu). */
  icon?: string
  destructive?: boolean
  group: ActionGroup
  onPress: () => void
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** An extra action item passed from the screen (e.g. custom edit actions). */
type ExtraAction = {
  label: string
  icon?: string
  destructive?: boolean
  onPress: () => void
}

type Props = {
  /** Whether the collection has versions enabled. */
  hasVersions?: boolean
  /** Whether the collection has drafts enabled. */
  hasDrafts?: boolean
  /** Current document _status. */
  currentStatus?: 'draft' | 'published' | string
  /** Callbacks for each action. */
  onViewVersions?: () => void
  onSaveDraft?: () => void
  onPublish?: () => void
  onUnpublish?: () => void
  /** Additional action items from custom Payload config (editMenuItems). */
  extraActions?: ExtraAction[]
}

// ---------------------------------------------------------------------------
// Build action list from props
// ---------------------------------------------------------------------------

const useActions = (props: Props): ActionItem[] => {
  const { hasVersions, hasDrafts, currentStatus, onViewVersions, onSaveDraft, onPublish, onUnpublish, extraActions } = props

  return useMemo(() => {
    const actions: ActionItem[] = []

    if (hasVersions && onViewVersions) {
      actions.push({
        key: 'versions',
        label: 'Versions',
        icon: 'clock.arrow.circlepath',
        group: 'versions',
        onPress: onViewVersions,
      })
    }
    if (hasDrafts) {
      if (currentStatus === 'published' && onSaveDraft) {
        actions.push({
          key: 'save-draft',
          label: 'Save as Draft',
          icon: 'arrow.down.doc',
          group: 'drafts',
          onPress: onSaveDraft,
        })
      }
      if (currentStatus === 'draft' && onPublish) {
        actions.push({
          key: 'publish',
          label: 'Publish',
          icon: 'arrow.up.doc',
          group: 'drafts',
          onPress: onPublish,
        })
      }
      if (currentStatus === 'published' && onUnpublish) {
        actions.push({
          key: 'unpublish',
          label: 'Unpublish',
          icon: 'eye.slash',
          destructive: true,
          group: 'drafts',
          onPress: onUnpublish,
        })
      }
    }

    // Append custom extra actions from Payload config
    if (extraActions) {
      for (const extra of extraActions) {
        actions.push({
          key: `extra-${extra.label}`,
          label: extra.label,
          icon: extra.icon,
          destructive: extra.destructive,
          group: 'extra',
          onPress: extra.onPress,
        })
      }
    }

    return actions
  }, [hasVersions, hasDrafts, currentStatus, onViewVersions, onSaveDraft, onPublish, onUnpublish, extraActions])
}

const GROUP_ORDER: ActionGroup[] = ['versions', 'drafts', 'extra']

/** Split actions into non-empty groups (dividers go between them). */
const groupActions = (actions: ActionItem[]): ActionItem[][] =>
  GROUP_ORDER.map((group) => actions.filter((a) => a.group === group)).filter(
    (group) => group.length > 0,
  )

// ---------------------------------------------------------------------------
// Native iOS: SwiftUI Menu with real menu items
// ---------------------------------------------------------------------------

const NativeMenu: React.FC<Props> = (props) => {
  const actions = useActions(props)
  const Menu = nativeComponents.Menu!
  const MenuButton = nativeComponents.Button!
  const MenuDivider = nativeComponents.Divider

  if (actions.length === 0) return null

  const items: React.ReactNode[] = []
  groupActions(actions).forEach((group, groupIndex) => {
    if (groupIndex > 0 && MenuDivider) {
      items.push(<MenuDivider key={`divider-${groupIndex}`} />)
    }
    for (const action of group) {
      items.push(
        <MenuButton
          key={action.key}
          label={action.label}
          systemImage={action.icon}
          role={action.destructive ? 'destructive' : undefined}
          onPress={action.onPress}
        />,
      )
    }
  })

  return (
    <NativeHost matchContents>
      <Menu label="" systemImage="ellipsis.circle">
        {items}
      </Menu>
    </NativeHost>
  )
}

// ---------------------------------------------------------------------------
// Native Android: Jetpack Compose ContextMenu (press-to-open dropdown)
// ---------------------------------------------------------------------------

/**
 * Material icon names for the built-in actions. The canary jetpack-compose
 * MaterialIcon set is small ('variant.Name'); SF Symbol names from
 * extraActions can't be mapped, so extras only get an icon when they already
 * look like a valid MaterialIcon ('outlined.Delete', ...).
 */
const ANDROID_ICONS: Record<string, string> = {
  versions: 'outlined.List',
  'save-draft': 'outlined.Done',
  publish: 'filled.Send',
  unpublish: 'outlined.Clear',
}

const MATERIAL_ICON_RE = /^(rounded|twotone|outlined|filled|sharp)\.[A-Za-z]+$/

const androidIconFor = (action: ActionItem): string | undefined => {
  const builtin = ANDROID_ICONS[action.key]
  if (builtin) return builtin
  if (action.icon && MATERIAL_ICON_RE.test(action.icon)) return action.icon
  return undefined
}

const AndroidNativeMenu: React.FC<Props> = (props) => {
  const actions = useActions(props)
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  // The canary JC ContextMenu accepts an RN `style` prop (it's an RN-layouted
  // native view) — not part of the shared registry type, hence the cast.
  const ContextMenu = nativeComponents.ContextMenu! as React.ComponentType<any>
  const Trigger = nativeComponents.ContextMenuTrigger!
  const Items = nativeComponents.ContextMenuItems!
  const JCButton = nativeComponents.JCButton!

  if (actions.length === 0) return null

  return (
    <ContextMenu style={styles.androidMenuAnchor}>
      <Items>
        {actions.map((action) => (
          <JCButton
            key={action.key}
            variant="borderless"
            leadingIcon={androidIconFor(action)}
            elementColors={
              action.destructive ? { contentColor: DESTRUCTIVE_RED } : undefined
            }
            onPress={action.onPress}
          >
            {action.label}
          </JCButton>
        ))}
      </Items>
      <Trigger>
        <View style={styles.androidTrigger}>
          <Text style={[styles.ellipsis, isDark && styles.ellipsisDark]}>{'⋯'}</Text>
        </View>
      </Trigger>
    </ContextMenu>
  )
}

// ---------------------------------------------------------------------------
// Fallback: BottomSheet for Expo Go / unsupported platforms
// ---------------------------------------------------------------------------

const FallbackMenu: React.FC<Props> = (props) => {
  const actions = useActions(props)
  const [visible, setVisible] = useState(false)
  const colorScheme = useColorScheme()
  const isDark = colorScheme === 'dark'

  if (actions.length === 0) return null

  const sheetHeight = Math.min(0.4, (actions.length * 56 + 70) / 800)

  return (
    <>
      <Pressable onPress={() => setVisible(true)} hitSlop={8}>
        <Text style={[styles.ellipsis, isDark && styles.ellipsisDark]}>{'...'}</Text>
      </Pressable>

      <BottomSheet visible={visible} onClose={() => setVisible(false)} height={sheetHeight}>
        <Text style={[styles.title, isDark && styles.textDark]}>Actions</Text>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            style={({ pressed }) => [
              styles.row,
              pressed && (isDark ? styles.rowPressedDark : styles.rowPressed),
            ]}
            onPress={() => {
              action.onPress()
              setVisible(false)
            }}
          >
            <Text
              style={[
                styles.rowLabel,
                isDark && styles.textDark,
                action.destructive && styles.rowLabelDestructive,
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

// ---------------------------------------------------------------------------
// Exported component — picks the right implementation
// ---------------------------------------------------------------------------

export const DocumentActionsMenu: React.FC<Props> = (props) => {
  const actions = useActions(props)
  if (actions.length === 0) return null

  if (Platform.OS === 'ios' && nativeComponents.Menu && nativeComponents.Button) {
    return <NativeMenu {...props} />
  }
  if (
    Platform.OS === 'android' &&
    nativeComponents.ContextMenu &&
    nativeComponents.ContextMenuTrigger &&
    nativeComponents.ContextMenuItems &&
    nativeComponents.JCButton
  ) {
    return <AndroidNativeMenu {...props} />
  }
  return <FallbackMenu {...props} />
}

// ---------------------------------------------------------------------------
// Styles (Android trigger + fallback)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  androidMenuAnchor: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  androidTrigger: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ellipsis: {
    fontSize: 22,
    fontWeight: '700',
    color: t.colors.text,
    letterSpacing: 2,
  },
  ellipsisDark: {
    color: 'rgba(255,255,255,0.92)',
  },
  title: {
    fontSize: t.fontSize.lg,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: t.spacing.md,
  },
  textDark: {
    color: 'rgba(255,255,255,0.92)',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
  },
  rowPressed: {
    backgroundColor: '#f5f5f5',
  },
  rowPressedDark: {
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  rowLabel: {
    fontSize: t.fontSize.md,
    color: t.colors.text,
    fontWeight: '500',
  },
  rowLabelDestructive: {
    color: DESTRUCTIVE_RED,
  },
})
