/**
 * Phone bottom tab bar — custom frosted-glass tab bar with press-state
 * capsule highlight (Telegram-style) and a native long-press menu on the
 * Collections tab (iOS).
 *
 *   - TabItem            — generic tab item with press-state capsule
 *   - CollectionsTabItem — Collections tab with native long-press menu (iOS)
 *   - CustomTabBar       — the frosted-glass bar that hosts the items
 */
import React from 'react'
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Home, LayoutList, Globe, User } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  getCollectionLabel,
  getSFSymbol,
  useListColors,
  useMenuModel,
} from '@payload-universal/admin-native'
import {
  ACTIVE_COLOR,
  BlurView,
  INACTIVE_COLOR,
  SButton,
  SDivider,
  SHost,
  SMenu,
} from './nativeModules'
import { styles } from './styles'

// ---------------------------------------------------------------------------
// Generic tab bar item – with press-state capsule highlight
// ---------------------------------------------------------------------------

type TabItemProps = {
  icon: React.ComponentType<{ size: number; color: string }>
  label: string
  isFocused: boolean
  onPress: () => void
}

function TabItem({ icon: Icon, label, isFocused, onPress }: TabItemProps) {
  const color = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR
  const { colors: c } = useListColors()
  return (
    <Pressable
      onPress={onPress}
      style={styles.tabItem}
    >
      {({ pressed }) => (
        <View style={[styles.tabItemContent, pressed && { backgroundColor: c.pressed }]}>
          <Icon size={22} color={color} />
          <Text style={[styles.tabLabel, { color }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Collections tab item – with native long-press menu on iOS
// ---------------------------------------------------------------------------

function CollectionsTabItem({
  isFocused,
  onPress,
}: {
  isFocused: boolean
  onPress: () => void
}) {
  const color = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR
  const router = useRouter()
  const menuModel = useMenuModel()
  const { colors: c } = useListColors()

  const visible = menuModel?.collections.filter((c) => !c.hidden) ?? []
  const groups = menuModel?.groups ?? []
  const ungrouped = visible.filter((c) => !c.group)
  const grouped = groups
    .map((g) => ({ name: g, items: visible.filter((c) => c.group === g) }))
    .filter((g) => g.items.length > 0)

  // Visual content of the tab item (shared between native & fallback)
  const inner = (
    <View style={styles.tabItemInner}>
      <LayoutList size={22} color={color} />
      <Text style={[styles.tabLabel, { color }]}>Collections</Text>
    </View>
  )

  // ── iOS with @expo/ui: SwiftUI Menu ────────────────────────────────
  //
  // Single tap  → onPrimaryAction → switch to collections tab
  // Long press  → native dropdown with collections picker
  //
  // Grouped collections render as nested Menu (collapsible submenus).
  // Ungrouped collections render as top-level buttons.
  if (SMenu && SButton && SHost && visible.length > 0) {
    return (
      <View style={styles.tabItem}>
        {/* Follow the system colour scheme — never force light */}
        <SHost matchContents>
          <SMenu label={inner} onPrimaryAction={onPress}>
            {/* Ungrouped collections */}
            {ungrouped.map((col) => (
              <SButton
                key={col.slug}
                label={getCollectionLabel(menuModel!, col.slug)}
                systemImage={getSFSymbol(col.icon)}
                onPress={() =>
                  router.navigate(`/(admin)/collections/${col.slug}`)
                }
              />
            ))}

            {/* Divider between ungrouped & grouped */}
            {ungrouped.length > 0 && grouped.length > 0 && SDivider && (
              <SDivider />
            )}

            {/* Grouped collections – each group is a collapsible submenu */}
            {grouped.map((group) => (
              <SMenu
                key={group.name}
                label={group.name}
                systemImage="folder"
              >
                {group.items.map((col) => (
                  <SButton
                    key={col.slug}
                    label={getCollectionLabel(menuModel!, col.slug)}
                    systemImage={getSFSymbol(col.icon)}
                    onPress={() =>
                      router.navigate(`/(admin)/collections/${col.slug}`)
                    }
                  />
                ))}
              </SMenu>
            ))}
          </SMenu>
        </SHost>
      </View>
    )
  }

  // ── Fallback: simple pressable with press-state capsule ────────────
  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      {({ pressed }) => (
        <View style={[styles.tabItemContent, pressed && { backgroundColor: c.pressed }]}>
          <LayoutList size={22} color={color} />
          <Text style={[styles.tabLabel, { color }]}>Collections</Text>
        </View>
      )}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Custom tab bar (phone only)
// ---------------------------------------------------------------------------

export function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets()
  const { width: barWidth } = useWindowDimensions()
  const menuModel = useMenuModel()
  const { dark, colors: c } = useListColors()
  const globalsCount =
    menuModel?.globals.filter((g) => !g.hidden).length ?? 0

  return (
    <View
      style={[styles.bar, { borderTopColor: c.hairline }, { paddingBottom: Math.max(insets.bottom, 8), width: barWidth }]}
    >
      {/* Background – translucent blur or frosted fallback */}
      {BlurView ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={35}
          tint="systemUltraThinMaterial"
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: dark ? 'rgba(30,30,30,0.78)' : 'rgba(249,249,249,0.65)' },
          ]}
        />
      )}

      <View style={styles.barRow}>
        {state.routes.map((route: any, i: number) => {
          // Conditionally hide the globals tab
          if (route.name === 'globals' && globalsCount === 0) return null

          const focused = state.index === i
          const go = () => {
            const e = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            })
            if (!focused && !e.defaultPrevented) {
              navigation.navigate(route.name)
            }
          }

          switch (route.name) {
            case 'index':
              return (
                <TabItem
                  key={route.key}
                  icon={Home}
                  label="Home"
                  isFocused={focused}
                  onPress={go}
                />
              )
            case 'collections':
              return (
                <CollectionsTabItem
                  key={route.key}
                  isFocused={focused}
                  onPress={go}
                />
              )
            case 'globals':
              return (
                <TabItem
                  key={route.key}
                  icon={Globe}
                  label="Globals"
                  isFocused={focused}
                  onPress={go}
                />
              )
            case 'account':
              return (
                <TabItem
                  key={route.key}
                  icon={User}
                  label="Account"
                  isFocused={focused}
                  onPress={go}
                />
              )
            default:
              return null
          }
        })}
      </View>
    </View>
  )
}
