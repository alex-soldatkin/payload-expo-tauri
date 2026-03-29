'use client'

import { useEffect, useRef } from 'react'

import { isTauri } from '@tauri-apps/api/core'
import { fetchAdminSchema } from '@payload-universal/admin-schema/client'
import type { MenuModel } from '@payload-universal/admin-schema'

type MenuNode =
  | { type: 'separator' }
  | {
      type: 'submenu'
      label: string
      items: MenuNode[]
    }
  | {
      type: 'item'
      label: string
      accelerator?: string
      enabled?: boolean
      action?: () => void
    }

const navigate = (path: string) => {
  if (typeof window === 'undefined') return
  window.location.assign(path)
}

const buildCollectionItems = (menuModel: MenuModel): MenuNode[] => {
  const ungroupedLabel = 'Other'
  const groups = new Map<string, MenuModel['collections']>()

  for (const collection of menuModel.collections) {
    if (collection.hidden) continue

    const group = collection.group || ungroupedLabel
    if (!groups.has(group)) {
      groups.set(group, [])
    }
    groups.get(group)?.push(collection)
  }

  const sortedGroups = [...groups.keys()].sort((a, b) => {
    if (a === ungroupedLabel) return 1
    if (b === ungroupedLabel) return -1
    return a.localeCompare(b)
  })

  return sortedGroups.map((group) => {
    const items = (groups.get(group) || []).map((collection) => {
      const label = collection.labels?.plural || collection.labels?.singular || collection.slug

      return {
        type: 'submenu',
        label,
        items: [
          {
            type: 'item',
            label: `Open ${label}`,
            action: () => navigate(`/admin/collections/${collection.slug}`),
          },
          {
            type: 'item',
            label: `New ${label}`,
            action: () => navigate(`/admin/collections/${collection.slug}/create`),
          },
          {
            type: 'item',
            label: `Search ${label}…`,
            action: () => navigate(`/admin/collections/${collection.slug}?search=`),
          },
        ],
      } as MenuNode
    })

    return {
      type: 'submenu',
      label: group,
      items,
    } as MenuNode
  })
}

const buildGlobalsItems = (menuModel: MenuModel): MenuNode[] => {
  const ungroupedLabel = 'Other'
  const groups = new Map<string, MenuModel['globals']>()

  for (const global of menuModel.globals) {
    if (global.hidden) continue

    const group = global.group || ungroupedLabel
    if (!groups.has(group)) {
      groups.set(group, [])
    }
    groups.get(group)?.push(global)
  }

  const sortedGroups = [...groups.keys()].sort((a, b) => {
    if (a === ungroupedLabel) return 1
    if (b === ungroupedLabel) return -1
    return a.localeCompare(b)
  })

  return sortedGroups.map((group) => {
    const items = (groups.get(group) || []).map((global) => {
      const label = global.label || global.slug

      return {
        type: 'item',
        label,
        action: () => navigate(`/admin/globals/${global.slug}`),
      } as MenuNode
    })

    return {
      type: 'submenu',
      label: group,
      items,
    } as MenuNode
  })
}

const buildWorkflowItems = (menuModel: MenuModel): MenuNode[] => {
  const draftCollections = menuModel.collections.filter((collection) => collection.drafts)
  if (draftCollections.length === 0) {
    return []
  }

  return [
    {
      type: 'submenu',
      label: 'Drafts',
      items: draftCollections.map((collection) => {
        const label = collection.labels?.plural || collection.labels?.singular || collection.slug
        return {
          type: 'item',
          label,
          action: () =>
            navigate(
              `/admin/collections/${collection.slug}?where[_status][equals]=draft`,
            ),
        } as MenuNode
      }),
    } as MenuNode,
  ]
}

const buildToolsItems = (menuModel: MenuModel): MenuNode[] => {
  if (!menuModel.capabilities.adminSchemaJson) return []

  return [
    {
      type: 'item',
      label: 'Open Admin Schema JSON',
      action: () => window.open('/api/admin-schema', '_blank'),
    } as MenuNode,
  ]
}

const buildMenuTree = (menuModel: MenuModel): MenuNode[] => {
  const collectionsItems = buildCollectionItems(menuModel)
  const globalsItems = buildGlobalsItems(menuModel)
  const workflowItems = buildWorkflowItems(menuModel)
  const toolsItems = buildToolsItems(menuModel)

  return [
    {
      type: 'submenu',
      label: 'Collections',
      items: collectionsItems,
    },
    {
      type: 'submenu',
      label: 'Globals',
      items: globalsItems,
    },
    ...(workflowItems.length
      ? [
          {
            type: 'submenu',
            label: 'Workflow',
            items: workflowItems,
          } as MenuNode,
        ]
      : []),
    ...(toolsItems.length
      ? [
          {
            type: 'submenu',
            label: 'Tools',
            items: toolsItems,
          } as MenuNode,
        ]
      : []),
    {
      type: 'submenu',
      label: 'View',
      items: [
        {
          type: 'item',
          label: 'Reload',
          accelerator: 'CmdOrCtrl+R',
          action: () => window.location.reload(),
        },
      ],
    },
  ]
}

const buildTauriMenuItems = async (nodes: MenuNode[]) => {
  const menuApi = await import('@tauri-apps/api/menu')
  const { MenuItem, Submenu, PredefinedMenuItem } = menuApi

  const items = [] as Array<Awaited<ReturnType<typeof MenuItem.new>>>

  for (const node of nodes) {
    if (node.type === 'separator') {
      items.push(await PredefinedMenuItem.new({ item: 'Separator' }))
      continue
    }

    if (node.type === 'submenu') {
      const subItems = await buildTauriMenuItems(node.items)
      items.push(await Submenu.new({ text: node.label, items: subItems }))
      continue
    }

    items.push(
      await MenuItem.new({
        text: node.label,
        enabled: node.enabled !== false,
        accelerator: node.accelerator,
        action: node.action,
      }),
    )
  }

  return items
}

const buildAppMenu = async () => {
  const menuApi = await import('@tauri-apps/api/menu')
  const { Submenu, PredefinedMenuItem } = menuApi

  return Submenu.new({
    text: 'Payload',
    items: [
      await PredefinedMenuItem.new({ item: { About: null } }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ item: 'Hide' }),
      await PredefinedMenuItem.new({ item: 'HideOthers' }),
      await PredefinedMenuItem.new({ item: 'ShowAll' }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ item: 'Quit' }),
    ],
  })
}

const buildEditMenu = async () => {
  const menuApi = await import('@tauri-apps/api/menu')
  const { Submenu, PredefinedMenuItem } = menuApi

  return Submenu.new({
    text: 'Edit',
    items: [
      await PredefinedMenuItem.new({ item: 'Undo' }),
      await PredefinedMenuItem.new({ item: 'Redo' }),
      await PredefinedMenuItem.new({ item: 'Separator' }),
      await PredefinedMenuItem.new({ item: 'Cut' }),
      await PredefinedMenuItem.new({ item: 'Copy' }),
      await PredefinedMenuItem.new({ item: 'Paste' }),
      await PredefinedMenuItem.new({ item: 'SelectAll' }),
    ],
  })
}

export const TauriMenuBridge = () => {
  const initializedRef = useRef(false)
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptsRef = useRef(0)

  useEffect(() => {
    if (initializedRef.current) return
    if (!isTauri()) return

    initializedRef.current = true
    document.documentElement.classList.add('payload-tauri')

    let dragRegionAttempts = 0
    let dragCleanup: (() => void) | null = null

    const applyDragRegion = async () => {
      const header = document.querySelector<HTMLElement>('.app-header')
      if (!header) {
        dragRegionAttempts += 1
        if (dragRegionAttempts < 20) {
          window.setTimeout(() => {
            void applyDragRegion()
          }, 250)
        }
        return
      }

      const { getCurrentWindow, Effect, EffectState } = await import('@tauri-apps/api/window')
      const appWindow = getCurrentWindow()

      try {
        await appWindow.setBackgroundColor([0, 0, 0, 0])
        await appWindow.setEffects({
          effects: [Effect.Sidebar],
          state: EffectState.Active,
        })
      } catch (error) {
        console.warn('[payload-universal] Unable to set window effects', error)
      }

      const isInteractive = (target: EventTarget | null) => {
        if (!(target instanceof Element)) return false
        return Boolean(
          target.closest(
            [
              'a',
              'button',
              'input',
              'select',
              'textarea',
              'option',
              '[role="button"]',
              '[data-tauri-drag-region="false"]',
              '.nav-toggler',
              '.hamburger',
              '.app-header__step-nav-wrapper',
              '.app-header__actions-wrapper',
              '.app-header__account',
            ].join(','),
          ),
        )
      }

      const handleMouseDown = (event: MouseEvent) => {
        if (event.button !== 0) return
        if (isInteractive(event.target)) return

        void appWindow.startDragging()
      }

      const handleDoubleClick = (event: MouseEvent) => {
        if (event.button !== 0) return
        if (isInteractive(event.target)) return

        void appWindow.toggleMaximize()
      }

      header.addEventListener('mousedown', handleMouseDown, true)
      header.addEventListener('dblclick', handleDoubleClick, true)
      dragCleanup = () => {
        header.removeEventListener('mousedown', handleMouseDown, true)
        header.removeEventListener('dblclick', handleDoubleClick, true)
      }
    }

    void applyDragRegion()

    let titleObserver: MutationObserver | null = null
    const formatTitle = (raw: string) => {
      const trimmed = raw.trim()
      const separators = [' - ', ' | ', ' — ', ' – ']
      for (const sep of separators) {
        if (trimmed.includes(sep)) {
          return trimmed.split(sep)[0].trim()
        }
      }
      return trimmed || 'Payload Admin'
    }

    const applyTitle = () => {
      const title = formatTitle(document.title || 'Payload Admin')
      const homeEl = document.querySelector<HTMLElement>('.step-nav__home')
      if (homeEl) {
        homeEl.setAttribute('data-title', title)
      }
    }

    const applyNavWidth = () => {
      const navScroll = document.querySelector<HTMLElement>('.nav__scroll')
      if (!navScroll) return
      const navWrap = navScroll.querySelector<HTMLElement>('.nav__wrap')
      const computedWidth = Math.ceil(navWrap?.scrollWidth || navScroll.scrollWidth || 0)
      const styles = getComputedStyle(navScroll)
      const paddingLeft = Number.parseFloat(styles.paddingLeft) || 0
      const paddingRight = Number.parseFloat(styles.paddingRight) || 0
      const width = Math.ceil(computedWidth + paddingLeft + paddingRight)
      document.documentElement.style.setProperty('--nav-open-width', `${width}px`)
      if (!navScroll.dataset.navWidthDebug) {
        navScroll.dataset.navWidthDebug = '1'
        console.info('[payload-universal] nav width', {
          computedWidth,
          paddingLeft,
          paddingRight,
          width,
        })
      }
    }

    let navResizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      const navScroll = document.querySelector<HTMLElement>('.nav__scroll')
      if (navScroll) {
        navResizeObserver = new ResizeObserver(() => {
          applyNavWidth()
        })
        navResizeObserver.observe(navScroll)
      }
    }

    window.addEventListener('resize', applyNavWidth)
    applyNavWidth()

    const titleEl = document.querySelector('title')
    if (titleEl) {
      titleObserver = new MutationObserver(applyTitle)
      titleObserver.observe(titleEl, { childList: true })
    }
    window.addEventListener('focus', applyTitle)
    applyTitle()

    const setupMenu = async () => {
      try {
        if (retryTimeoutRef.current) {
          clearTimeout(retryTimeoutRef.current)
          retryTimeoutRef.current = null
        }

        const schema = await fetchAdminSchema({
          requestInit: {
            credentials: 'include',
          },
        })

        const menuApi = await import('@tauri-apps/api/menu')
        const { Menu } = menuApi

        const appMenu = await buildAppMenu()
        const editMenu = await buildEditMenu()
        const menuTree = buildMenuTree(schema.menuModel)
        const generatedMenus = await buildTauriMenuItems(menuTree)

        const menu = await Menu.new({
          items: [appMenu, editMenu, ...generatedMenus],
        })

        await menu.setAsAppMenu()
        console.info('[payload-universal] Tauri menu updated')
      } catch (error) {
        attemptsRef.current += 1
        console.error('[payload-universal] Failed to build Tauri menu', error)

        const delay = Math.min(30000, 1000 * Math.pow(2, attemptsRef.current))
        retryTimeoutRef.current = setTimeout(() => {
          void setupMenu()
        }, delay)
      }
    }

    void setupMenu()

    return () => {
      document.documentElement.classList.remove('payload-tauri')
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current)
      }
      if (dragCleanup) {
        dragCleanup()
      }
      if (titleObserver) {
        titleObserver.disconnect()
      }
      if (navResizeObserver) {
        navResizeObserver.disconnect()
      }
      window.removeEventListener('focus', applyTitle)
      window.removeEventListener('resize', applyNavWidth)
    }
  }, [])

  return null
}
