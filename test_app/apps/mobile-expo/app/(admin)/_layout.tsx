/**
 * Admin tab layout – bottom tabs with a custom tab bar.
 *
 * Uses Expo Router's Tabs with a custom tab bar that supports:
 *   - Native blur effect on the tab bar background
 *   - Long-press menu on the Collections tab (iOS) showing
 *     collections grouped by admin.group from the Payload schema
 *   - Single tap navigates to the collections overview
 *
 * The long-press behaviour is powered by @expo/ui's SwiftUI Menu component:
 *   - `onPrimaryAction` handles single tap  → switch to collections tab
 *   - Default long-press                    → native iOS dropdown with
 *     grouped collections (collapsible submenus)
 */
import React from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { Tabs, useRouter } from 'expo-router'
import { Home, LayoutList, Globe, User } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  getCollectionLabel,
  useMenuModel,
} from '@payload-universal/admin-native'

// ---------------------------------------------------------------------------
// Optional native modules (graceful fallback when unavailable)
// ---------------------------------------------------------------------------

let BlurView: React.ComponentType<any> | null = null
try {
  BlurView = require('expo-blur').BlurView
} catch {
  /* expo-blur not installed or native module unavailable */
}

// SwiftUI components for the native long-press menu (iOS only)
let SMenu: any = null
let SButton: any = null
let SDivider: any = null
let SHost: any = null

if (Platform.OS === 'ios') {
  try {
    const s = require('@expo/ui/swift-ui')
    SMenu = s.Menu
    SButton = s.Button
    SDivider = s.Divider
    SHost = s.Host
  } catch {
    /* @expo/ui not available */
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVE_COLOR = '#007AFF'
const INACTIVE_COLOR = '#8E8E93'

/** Map well-known collection slugs to SF Symbol names. */
function sfIcon(slug: string): string {
  switch (slug) {
    case 'users':
      return 'person.2'
    case 'media':
      return 'photo.on.rectangle'
    default:
      return 'doc.text'
  }
}

// ---------------------------------------------------------------------------
// Generic tab bar item
// ---------------------------------------------------------------------------

type TabItemProps = {
  icon: React.ComponentType<{ size: number; color: string }>
  label: string
  isFocused: boolean
  onPress: () => void
}

function TabItem({ icon: Icon, label, isFocused, onPress }: TabItemProps) {
  const color = isFocused ? ACTIVE_COLOR : INACTIVE_COLOR
  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <Icon size={22} color={color} />
      <Text style={[styles.tabLabel, { color }]}>{label}</Text>
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
        <SHost matchContents colorScheme="light">
          <SMenu label={inner} onPrimaryAction={onPress}>
            {/* Ungrouped collections */}
            {ungrouped.map((col) => (
              <SButton
                key={col.slug}
                label={getCollectionLabel(menuModel!, col.slug)}
                systemImage={sfIcon(col.slug)}
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
                    systemImage={sfIcon(col.slug)}
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

  // ── Fallback: simple pressable ─────────────────────────────────────
  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      {inner}
    </Pressable>
  )
}

// ---------------------------------------------------------------------------
// Custom tab bar
// ---------------------------------------------------------------------------

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets()
  const menuModel = useMenuModel()
  const globalsCount =
    menuModel?.globals.filter((g) => !g.hidden).length ?? 0

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}
    >
      {/* Background – blur or opaque fallback */}
      {BlurView ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={80}
          tint="systemChromeMaterial"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.barFallback]} />
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

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

export default function AdminLayout() {
  const menuModel = useMenuModel()
  const globalsCount =
    menuModel?.globals.filter((g) => !g.hidden).length ?? 0

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="collections" options={{ title: 'Collections' }} />
      <Tabs.Screen
        name="globals"
        options={{
          title: 'Globals',
          href: globalsCount === 0 ? null : undefined,
        }}
      />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  // Tab bar container
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.2)',
  },
  barFallback: {
    backgroundColor: 'rgba(249,249,249,0.94)',
  },
  barRow: {
    flexDirection: 'row',
    paddingTop: 6,
  },

  // Individual tab item
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
})
