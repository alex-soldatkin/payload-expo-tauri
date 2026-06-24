/**
 * SidebarContent — the shared sidebar nav content (persistent sidebar + overlay
 * panel). `SidebarContent` is the grouped collections / globals / account nav
 * tree — ONE source rendered by both the persistent tablet sidebar
 * (app/(admin)/_layout.tsx) and the overlay panel here.
 */
import React, { useCallback } from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'
import { useRouter, usePathname } from 'expo-router'
import { Home, Globe, User } from 'lucide-react-native'
import {
  CollectionIcon,
  getCollectionLabel,
  getGlobalLabel,
  useListColors,
  useMenuModel,
} from '@payload-universal/admin-native'

import { ACTIVE_COLOR, INACTIVE_COLOR } from './constants'
import { GlassView, liquidGlassAvailable } from './native'
import { styles } from './styles'

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
  const { colors: c } = useListColors()
  const color = isActive ? ACTIVE_COLOR : c.text

  const innerContent = (
    <>
      {customIcon ?? (Icon ? <Icon size={20} color={color} /> : null)}
      <Text style={[styles.itemLabel, { color }]} numberOfLines={1}>
        {label}
      </Text>
    </>
  )

  // On iOS 26+ with liquid glass: use GlassView for native hover/press states
  if (liquidGlassAvailable && GlassView) {
    return (
      <Pressable onPress={onPress}>
        <GlassView
          style={[styles.item, indent && styles.itemIndented]}
          isInteractive
          glassEffectStyle={isActive ? 'regular' : 'regular'}
          tintColor={isActive ? 'rgba(0,122,255,0.15)' : undefined}
        >
          {innerContent}
        </GlassView>
      </Pressable>
    )
  }

  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <View
          style={[
            styles.item,
            isActive && styles.itemActive,
            indent && styles.itemIndented,
            pressed && !isActive && { backgroundColor: c.pressed },
          ]}
        >
          {innerContent}
        </View>
      )}
    </Pressable>
  )
}

function SidebarSectionLabel({ label }: { label: string }) {
  return <Text style={styles.sectionLabel}>{label}</Text>
}

/**
 * The sidebar nav tree: title, Home, grouped/ungrouped collections, globals,
 * and Account pinned at the bottom. The parent supplies the chrome (width,
 * background, safe-area padding); `onNavigate` fires after any nav press so
 * the overlay can close itself.
 */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const router = useRouter()
  const pathname = usePathname()
  const menuModel = useMenuModel()
  const { colors: c } = useListColors()

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

  const go = useCallback(
    (path: string) => {
      router.navigate(path as Parameters<typeof router.navigate>[0])
      onNavigate?.()
    },
    [router, onNavigate],
  )

  return (
    <>
      {/* Scrollable nav content */}
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 8 }}
      >
        <Text style={[styles.title, { color: c.text }]}>Payload Admin</Text>

        {/* Home */}
        <SidebarNavItem
          icon={Home}
          label="Home"
          isActive={currentSection === 'index'}
          onPress={() => go('/(admin)/')}
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
                onPress={() => go(`/(admin)/collections/${col.slug}`)}
                indent
                customIcon={
                  <CollectionIcon
                    icon={col.icon}
                    size={18}
                    color={
                      currentSection === 'collections' &&
                      currentSlug === col.slug
                        ? ACTIVE_COLOR
                        : INACTIVE_COLOR
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
                onPress={() => go(`/(admin)/collections/${col.slug}`)}
                indent
                customIcon={
                  <CollectionIcon
                    icon={col.icon}
                    size={18}
                    color={
                      currentSection === 'collections' &&
                      currentSlug === col.slug
                        ? ACTIVE_COLOR
                        : INACTIVE_COLOR
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
                onPress={() => go(`/(admin)/globals/${g.slug}`)}
                indent
              />
            ))}
          </>
        )}
      </ScrollView>

      {/* Account – pinned at bottom */}
      <View style={[styles.bottomSection, { borderTopColor: c.hairline }]}>
        <SidebarNavItem
          icon={User}
          label="Account"
          isActive={currentSection === 'account'}
          onPress={() => go('/(admin)/account')}
        />
      </View>
    </>
  )
}
