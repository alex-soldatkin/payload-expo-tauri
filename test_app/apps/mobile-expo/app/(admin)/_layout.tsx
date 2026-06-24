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
 *
 * Chrome lives in src/screens/admin-layout/:
 *   - TabBar.tsx  — phone bottom tab bar (CustomTabBar + items)
 *   - Sidebar.tsx — persistent tablet sidebar chrome
 */
import React from 'react'
import { StyleSheet, View } from 'react-native'
import { Tabs } from 'expo-router'
import { useMenuModel } from '@payload-universal/admin-native'
import { useResponsive } from '@/hooks/useResponsive'
import { OverlaySidebar } from '@/src/components/OverlaySidebar'
import { CustomTabBar } from '@/src/screens/admin-layout/TabBar'
import { Sidebar } from '@/src/screens/admin-layout/Sidebar'

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
