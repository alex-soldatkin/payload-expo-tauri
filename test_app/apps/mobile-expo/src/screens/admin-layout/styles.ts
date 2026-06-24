/**
 * StyleSheet factories for the admin tab layout.
 *
 * `styles`        — phone bottom tab bar (borderTopColor comes from the
 *                   palette via useListColors at render time).
 * `sidebarStyles` — tablet sidebar chrome (border color from the palette).
 *                   Nav-item styles live with SidebarContent in
 *                   src/components/OverlaySidebar.tsx.
 */
import { StyleSheet } from 'react-native'
import { SIDEBAR_WIDTH } from '@/hooks/useResponsive'

// Phone: bottom tab bar
export const styles = StyleSheet.create({
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
export const sidebarStyles = StyleSheet.create({
  container: {
    width: SIDEBAR_WIDTH,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
})
