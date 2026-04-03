'use client'

import type { EntityToGroup } from '@payloadcms/ui/shared'
import type { NavPreferences } from 'payload'

import { getTranslation } from '@payloadcms/translations'
import {
  BrowseByFolderButton,
  Link,
  NavGroup,
  useAuth,
  useConfig,
  useEntityVisibility,
  usePreferences,
  useTranslation,
} from '@payloadcms/ui'
import { EntityType, groupNavItems } from '@payloadcms/ui/shared'
import { usePathname } from 'next/navigation'
import { formatAdminURL, PREFERENCE_KEYS } from 'payload/shared'
import React, { useEffect, useMemo, useState } from 'react'

import { NavHamburger, NavWrapper } from '@payloadcms/next/client'

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
    <NavWrapper baseClass={baseClass}>
      <nav className={`${baseClass}__wrap`}>
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
                  {isActive && <div className={`${baseClass}__link-indicator`} />}
                  <span className={`${baseClass}__link-label`}>
                    {getTranslation(entityLabel, i18n)}
                  </span>
                </>
              )

              if (pathname === href) {
                return (
                  <div className={`${baseClass}__link`} id={id} key={index}>
                    {Label}
                  </div>
                )
              }

              return (
                <Link className={`${baseClass}__link`} href={href} id={id} key={index} prefetch={false}>
                  {Label}
                </Link>
              )
            })}
          </NavGroup>
        ))}
        <div className={`${baseClass}__controls`}>
          <a className={`${baseClass}__log-out`} href={formatAdminURL({ adminRoute: config.routes.admin, path: '/logout' })}>
            Log out
          </a>
        </div>
      </nav>
      <div className={`${baseClass}__header`}>
        <div className={`${baseClass}__header-content`}>
          <NavHamburger baseClass={baseClass} />
        </div>
      </div>
    </NavWrapper>
  )
}

export default NativeNav
