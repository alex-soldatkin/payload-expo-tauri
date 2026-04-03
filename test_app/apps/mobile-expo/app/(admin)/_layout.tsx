/**
 * Admin tab layout – bottom tabs (phone) or sidebar (tablet).
 *
 * Phone:
 *   - Bottom tabs with a custom frosted-glass tab bar
 *   - Press-state capsule highlight on tab items (Telegram-style)
 *   - Long-press menu on Collections tab (iOS) with grouped collections
 *
 * Tablet (>= 768px shortest side):
 *   - Left sidebar replaces bottom tabs
 *   - Shows all collections and globals inline with icons and group headers
 *   - Account pinned at bottom
 *   - Frosted-glass background (same as phone tab bar)
 */
import React from 'react'
import { Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Tabs, useRouter, usePathname } from 'expo-router'
import { Home, LayoutList, Globe, User } from 'lucide-react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import {
  CollectionIcon,
  getCollectionLabel,
  getGlobalLabel,
  getSFSymbol,
  useMenuModel,
} from '@payload-universal/admin-native'
import { useResponsive, SIDEBAR_WIDTH } from '@/hooks/useResponsive'

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
  return (
    <Pressable
      onPress={onPress}
      style={styles.tabItem}
    >
      {({ pressed }) => (
        <View style={[styles.tabItemContent, pressed && styles.tabItemPressed]}>
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
        <View style={[styles.tabItemContent, pressed && styles.tabItemPressed]}>
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
  const globalsCount =
    menuModel?.globals.filter((g) => !g.hidden).length ?? 0

  return (
    <View
      style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 8), width: barWidth }]}
    >
      {/* Background – translucent blur or frosted fallback */}
      {BlurView ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={35}
          tint="systemUltraThinMaterial"
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

// ===========================================================================
//  TABLET: Sidebar navigation
// ===========================================================================

function SidebarNavItem({
  icon: Icon,
  label,
  isActive,
  onPress,
  indent,
  customIcon,
}: {
  icon?: React.ComponentType<{ size: number; color: string }>
  label: string
  isActive: boolean
  onPress: () => void
  indent?: boolean
  customIcon?: React.ReactNode
}) {
  const color = isActive ? ACTIVE_COLOR : '#1f1f1f'
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={[
            sidebarStyles.item,
            isActive && sidebarStyles.itemActive,
            indent && sidebarStyles.itemIndented,
            pressed && !isActive && sidebarStyles.itemPressed,
          ]}
        >
          {customIcon ?? (Icon ? <Icon size={20} color={color} /> : null)}
          <Text style={[sidebarStyles.itemLabel, { color }]} numberOfLines={1}>
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  )
}

function SidebarSectionLabel({ label }: { label: string }) {
  return <Text style={sidebarStyles.sectionLabel}>{label}</Text>
}

function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const menuModel = useMenuModel()

  const visibleCollections =
    menuModel?.collections.filter((c) => !c.hidden) ?? []
  const visibleGlobals =
    menuModel?.globals.filter((g) => !g.hidden) ?? []
  const groups = menuModel?.groups ?? []

  const ungrouped = visibleCollections.filter((c) => !c.group)
  const grouped = groups
    .map((g) => ({
      name: g,
      items: visibleCollections.filter((c) => c.group === g),
    }))
    .filter((g) => g.items.length > 0)

  // Parse current route from pathname for active-state highlighting
  let currentSection = 'index'
  let currentSlug: string | undefined

  if (pathname.includes('/account')) {
    currentSection = 'account'
  } else if (pathname.includes('/collections')) {
    currentSection = 'collections'
    const match = pathname.match(/collections\/([^/]+)/)
    currentSlug = match?.[1]
  } else if (pathname.includes('/globals')) {
    currentSection = 'globals'
    const match = pathname.match(/globals\/([^/]+)/)
    currentSlug = match?.[1]
  }

  return (
    <View
      style={[
        sidebarStyles.container,
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
        <View style={[StyleSheet.absoluteFill, sidebarStyles.fallbackBg]} />
      )}

      {/* Scrollable nav content */}
      <ScrollView
        style={sidebarStyles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        <Text style={sidebarStyles.title}>Payload Admin</Text>

        {/* Home */}
        <SidebarNavItem
          icon={Home}
          label="Home"
          isActive={currentSection === 'index'}
          onPress={() => router.navigate('/(admin)/')}
        />

        {/* Ungrouped collections */}
        {ungrouped.length > 0 && (
          <>
            <SidebarSectionLabel label="Collections" />
            {ungrouped.map((col) => (
              <SidebarNavItem
                key={col.slug}
                label={getCollectionLabel(menuModel!, col.slug)}
                isActive={
                  currentSection === 'collections' &&
                  currentSlug === col.slug
                }
                onPress={() =>
                  router.navigate(`/(admin)/collections/${col.slug}`)
                }
                indent
                customIcon={
                  <CollectionIcon
                    icon={col.icon}
                    size={18}
                    color={
                      currentSection === 'collections' &&
                      currentSlug === col.slug
                        ? ACTIVE_COLOR
                        : '#666'
                    }
                  />
                }
              />
            ))}
          </>
        )}

        {/* Grouped collections */}
        {grouped.map((group) => (
          <React.Fragment key={group.name}>
            <SidebarSectionLabel label={group.name} />
            {group.items.map((col) => (
              <SidebarNavItem
                key={col.slug}
                label={getCollectionLabel(menuModel!, col.slug)}
                isActive={
                  currentSection === 'collections' &&
                  currentSlug === col.slug
                }
                onPress={() =>
                  router.navigate(`/(admin)/collections/${col.slug}`)
                }
                indent
                customIcon={
                  <CollectionIcon
                    icon={col.icon}
                    size={18}
                    color={
                      currentSection === 'collections' &&
                      currentSlug === col.slug
                        ? ACTIVE_COLOR
                        : '#666'
                    }
                  />
                }
              />
            ))}
          </React.Fragment>
        ))}

        {/* Globals */}
        {visibleGlobals.length > 0 && (
          <>
            <SidebarSectionLabel label="Globals" />
            {visibleGlobals.map((g) => (
              <SidebarNavItem
                key={g.slug}
                icon={Globe}
                label={getGlobalLabel(menuModel!, g.slug)}
                isActive={
                  currentSection === 'globals' && currentSlug === g.slug
                }
                onPress={() =>
                  router.navigate(`/(admin)/globals/${g.slug}`)
                }
                indent
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Account – pinned at bottom */}
      <View style={sidebarStyles.bottomSection}>
        <SidebarNavItem
          icon={User}
          label="Account"
          isActive={currentSection === 'account'}
          onPress={() => router.navigate('/(admin)/account')}
        />
      </View>
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
  // Tab bar container
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.12)',
  },
  barFallback: {
    backgroundColor: 'rgba(249,249,249,0.65)',
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

// Tablet: sidebar
const sidebarStyles = StyleSheet.create({
  container: {
    width: SIDEBAR_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: 'rgba(0,0,0,0.12)',
  },
  fallbackBg: {
    backgroundColor: 'rgba(249,249,249,0.85)',
  },
  scroll: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1f1f1f',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  itemActive: {
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  itemPressed: {
    backgroundColor: 'rgba(0,0,0,0.04)',
  },
  itemIndented: {
    paddingLeft: 16,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    flexShrink: 1,
  },
  bottomSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.08)',
    paddingTop: 8,
    paddingBottom: 4,
  },
})
