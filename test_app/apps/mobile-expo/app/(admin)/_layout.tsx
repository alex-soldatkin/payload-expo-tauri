/**
 * Admin tab layout – bottom tabs driven by the admin schema's menuModel.
 *
 * Uses Expo Router's NativeTabs for a truly native tab bar with:
 *   - SF Symbol icons on iOS, lucide bundled icons as source
 *   - System blur/glass effect on the tab bar
 *   - Native badge support
 *   - Sidebar-adaptable on iPad
 */
import React from 'react'
import { NativeTabs } from 'expo-router/unstable-native-tabs'
import { Home, LayoutList, Globe, User } from 'lucide-react-native'
import { useMenuModel } from '@payload-universal/admin-native'

export default function AdminLayout() {
  const menuModel = useMenuModel()

  const collectionsCount = menuModel?.collections.filter((c) => !c.hidden).length ?? 0
  const globalsCount = menuModel?.globals.filter((g) => !g.hidden).length ?? 0

  return (
    <NativeTabs
      blurEffect="systemMaterial"
      sidebarAdaptable
      minimizeBehavior="automatic"
    >
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }}>
          <Home size={24} color="#999" />
        </NativeTabs.Trigger.Icon>
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="collections">
        <NativeTabs.Trigger.Icon sf={{ default: 'list.bullet.rectangle', selected: 'list.bullet.rectangle.fill' }}>
          <LayoutList size={24} color="#999" />
        </NativeTabs.Trigger.Icon>
        <NativeTabs.Trigger.Label>Collections</NativeTabs.Trigger.Label>
        {collectionsCount > 0 && (
          <NativeTabs.Trigger.Badge>{collectionsCount}</NativeTabs.Trigger.Badge>
        )}
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="globals" hidden={globalsCount === 0}>
        <NativeTabs.Trigger.Icon sf={{ default: 'globe', selected: 'globe' }}>
          <Globe size={24} color="#999" />
        </NativeTabs.Trigger.Icon>
        <NativeTabs.Trigger.Label>Globals</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Icon sf={{ default: 'person.circle', selected: 'person.circle.fill' }}>
          <User size={24} color="#999" />
        </NativeTabs.Trigger.Icon>
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  )
}
