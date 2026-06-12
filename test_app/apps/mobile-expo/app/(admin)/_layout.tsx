/**
 * Admin tab layout – bottom tabs (phone) or sidebar (tablet).
 *
 * Phone / narrow window (no persistent sidebar):
 *   - Bottom tabs with a custom frosted-glass tab bar
 *   - Press-state capsule highlight on tab items (Telegram-style)
 *   - Long-press menu on Collections tab (iOS) with grouped collections
 *   - Swipe from the LEFT EDGE on a tab root reveals an overlay sidebar
 *     (Apple Notes/Mail slide-over) — see src/components/OverlaySidebar.tsx
 *
 * Tablet (>= 1024px window width):
 *   - Left sidebar replaces bottom tabs
 *   - Shows all collections and globals inline with icons and group headers
 *   - Account pinned at bottom
 *   - Frosted-glass background (same as phone tab bar)
 *
 * The sidebar nav tree itself (SidebarContent) is shared between the
 * persistent sidebar here and the overlay panel — one source of truth.
 */
import React from 'react'
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Tabs, useRouter } from 'expo-router'
import { Home, LayoutList, Globe, User } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  getCollectionLabel,
  getSFSymbol,
  useListColors,
  useMenuModel,
} from '@payload-universal/admin-native'
import { useResponsive, SIDEBAR_WIDTH } from '@/hooks/useResponsive'
import { OverlaySidebar, SidebarContent } from '@/src/components/OverlaySidebar'

// ---------------------------------------------------------------------------
// Optional native modules (graceful fallback when unavailable)
// ---------------------------------------------------------------------------

let BlurView: React.ComponentType<any> | null = null
try {
  // expo-blur uses a native view (ViewManagerAdapter_ExpoBlur_ExpoBlurView).
  // The JS module always loads, but the native view crashes at RENDER time if
  // the binary doesn't include it. The view config getter is registered lazily
  // via NativeComponentRegistry — it doesn't throw at require time.
  // Check globalThis.expo.getViewConfig() which is the native registry probe.
  const hasNativeView = globalThis.expo?.getViewConfig?.('ExpoBlur', 'ExpoBlurView') != null
  if (hasNativeView) {
    BlurView = require('expo-blur').BlurView
  }
} catch {
  /* expo-blur not installed or native view unavailable */
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

// ===========================================================================
//  PHONE: Bottom tab bar
// ===========================================================================

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

function CustomTabBar({ state, navigation }: any) {
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

// ===========================================================================
//  TABLET: Sidebar navigation
// ===========================================================================

/**
 * Persistent sidebar chrome (width, hairline, blur background, safe area).
 * The nav tree itself is the shared SidebarContent — the same component the
 * swipe-in OverlaySidebar panel renders on narrow windows.
 */
function Sidebar() {
  const insets = useSafeAreaInsets()
  const { dark, colors: c } = useListColors()

  return (
    <View
      style={[
        sidebarStyles.container,
        { borderRightColor: c.hairline },
        { paddingTop: insets.top, paddingBottom: insets.bottom },
      ]}
    >
      {/* Background – frosted glass or fallback */}
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
            { backgroundColor: dark ? 'rgba(30,30,30,0.88)' : 'rgba(249,249,249,0.85)' },
          ]}
        />
      )}

      <SidebarContent />
    </View>
  )
}

// ===========================================================================
//  Main layout
// ===========================================================================

export default function AdminLayout() {
  const { showSidebar, width: windowWidth, height: windowHeight } = useResponsive()
  const menuModel = useMenuModel()
  const globalsCount =
    menuModel?.globals.filter((g) => !g.hidden).length ?? 0

  return (
    <View style={[
      layoutStyles.root,
      showSidebar && layoutStyles.rootTablet,
      // Explicit dimensions force native re-layout on iPad window resize
      { width: windowWidth, height: windowHeight },
    ]}>
      {showSidebar && <Sidebar />}
      <View style={layoutStyles.content}>
        {/* Edge-swipe overlay sidebar — armed only when the persistent
            sidebar is hidden, and only on tab-root routes (deeper paths
            leave the left edge to the iOS back-swipe). Always mounted so
            the Tabs tree never remounts on rotation/resize. */}
        <OverlaySidebar enabled={!showSidebar}>
          <Tabs
            tabBar={(props) =>
              showSidebar ? null : <CustomTabBar {...props} />
            }
            screenOptions={{ headerShown: false }}
          >
            <Tabs.Screen name="index" options={{ title: 'Home' }} />
            <Tabs.Screen
              name="collections"
              options={{ title: 'Collections' }}
            />
            <Tabs.Screen
              name="globals"
              options={{
                title: 'Globals',
                href: globalsCount === 0 ? null : undefined,
              }}
            />
            <Tabs.Screen name="account" options={{ title: 'Account' }} />
          </Tabs>
        </OverlaySidebar>
      </View>
    </View>
  )
}

// ===========================================================================
//  Styles
// ===========================================================================

// Layout wrapper
const layoutStyles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rootTablet: {
    flexDirection: 'row',
  },
  content: {
    flex: 1,
    // Explicit stretch prevents Tabs from constraining to content width
    alignSelf: 'stretch',
  },
})

// Phone: bottom tab bar
const styles = StyleSheet.create({
  // Tab bar container — borderTopColor comes from the palette (c.hairline)
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  barRow: {
    flexDirection: 'row',
    paddingTop: 6,
  },

  // Outer touch target — fills equal tab width
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },

  // Inner content wrapper — receives the capsule highlight
  tabItemContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderRadius: 18,
  },

  // Pressed capsule — subtle gray pill (Telegram-style)
  tabItemPressed: {
    backgroundColor: 'rgba(0,0,0,0.06)',
  },

  // Same shape for the SwiftUI Menu label (no press state — handled natively)
  tabItemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 4,
  },

  tabLabel: {
    fontSize: 10,
    fontWeight: '500',
    marginTop: 2,
  },
})

// Tablet: sidebar chrome — border color comes from the palette (useListColors).
// Nav-item styles live with SidebarContent in src/components/OverlaySidebar.tsx.
const sidebarStyles = StyleSheet.create({
  container: {
    width: SIDEBAR_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
})
