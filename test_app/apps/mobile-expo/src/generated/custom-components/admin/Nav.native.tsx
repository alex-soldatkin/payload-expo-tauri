import type { EntityToGroup } from '@payload-universal/ui/shared'
import type { NavPreferences } from 'payload'

import { getTranslation } from '@payload-universal/ui'
import {
    BrowseByFolderButton,
    Link,
    NavGroup,
    useAuth,
    useConfig,
    useEntityVisibility,
    usePreferences,
    useTranslation,
} from '@payload-universal/ui'
import { EntityType, groupNavItems } from '@payload-universal/ui/shared'
import { usePathname, Link as ExpoLink } from 'expo-router'
import { formatAdminURL, PREFERENCE_KEYS } from '@payload-universal/ui/shared'
import React, { useEffect, useMemo, useState } from 'react'
import { View, Text } from "react-native";

const baseClass = 'nav'

export const NativeNav: React.FC = () => {
    const pathname = usePathname()
    const { config } = useConfig()
    const { permissions } = useAuth()
    const { visibleEntities } = useEntityVisibility()
    const { i18n } = useTranslation()
    const { getPreference } = usePreferences()
    const [navPreferences, setNavPreferences] = useState<NavPreferences | null>(null)

    useEffect(() => {
        let mounted = true
        void (async () => {
            const prefs = await getPreference<NavPreferences>(PREFERENCE_KEYS.NAV)
            if (mounted) {
                setNavPreferences(prefs)
            }
        })()

        return () => {
            mounted = false
        }
    }, [getPreference])

    const groups = useMemo(() => {
        const collections = (config.collections || [])
            .filter((collection: any) => visibleEntities.collections.includes(collection.slug as never))
            .map(
                (collection: any) =>
                    ({
                        type: EntityType.collection,
                        entity: collection,
                    }) as any,
            )

        const globals = (config.globals || [])
            .filter((global: any) => visibleEntities.globals.includes(global.slug as never))
            .map(
                (global: any) =>
                    ({
                        type: EntityType.global,
                        entity: global,
                    }) as any,
            )

        return groupNavItems([...collections, ...globals], permissions as any, i18n as any)
    }, [config.collections, config.globals, visibleEntities, permissions, i18n])

    const folderURL = formatAdminURL({
        adminRoute: config.routes.admin,
        path: config.admin.routes.browseByFolder,
    })

    const viewingRootFolderView = pathname.startsWith(folderURL)

    return (
        <View baseClass={baseClass}>
            <View className={`${baseClass}__wrap`}>
                {config.folders && config.folders.browseByFolder && (
                    <BrowseByFolderButton active={viewingRootFolderView} />
                )}
                {groups.map(({ entities, label }, groupIndex) => (
                    <NavGroup
                        isOpen={navPreferences?.groups?.[label]?.open}
                        key={groupIndex}
                        label={label}
                    >
                        {entities.map(({ slug, type, label: entityLabel }, index) => {
                            let href = ''
                            let id = ''

                            if (type === EntityType.collection) {
                                href = formatAdminURL({ adminRoute: config.routes.admin, path: `/collections/${slug}` })
                                id = `nav-${slug}`
                            }

                            if (type === EntityType.global) {
                                href = formatAdminURL({ adminRoute: config.routes.admin, path: `/globals/${slug}` })
                                id = `nav-global-${slug}`
                            }

                            const isActive = pathname.startsWith(href) && ['/', undefined].includes(pathname[href.length])

                            const Label = (
                                <>
                                    {isActive && <View className={`${baseClass}__link-indicator`} />}
                                    <Text className={`${baseClass}__link-label`}>
                                        {getTranslation(entityLabel, i18n)}
                                    </Text>
                                </>
                            )

                            if (pathname === href) {
                                return (
                                    <View className={`${baseClass}__link`} testID={id} key={index}>
                                        {Label}
                                    </View>
                                )
                            }

                            return (
                                <Link className={`${baseClass}__link`} href={href} testID={id} key={index}>
                                    {Label}
                                </Link>
                            )
                        })}
                    </NavGroup>
                ))}
                <View className={`${baseClass}__controls`}>
                    <ExpoLink className={`${baseClass}__log-out`} href={formatAdminURL({ adminRoute: config.routes.admin, path: '/logout' })}>
                        Log out
                    </ExpoLink>
                </View>
            </View>
            <View className={`${baseClass}__header`}>
                <View className={`${baseClass}__header-content`}>
                    <View baseClass={baseClass} />
                </View>
            </View>
        </View>
    )
}

export default NativeNav
