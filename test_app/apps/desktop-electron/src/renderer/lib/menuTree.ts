// Builds the native application menu (MenuItemTree[]) from the admin schema,
// replicating TauriMenuBridge's buildMenuTree structure:
//   Collections (grouped → Open/New) · Globals · Workflow → Drafts ·
//   Tools (Web Admin, Settings) · View (Reload).
//
// Actions are string codes consumed by Workspace's onMenuAction handler:
//   open:<slug> · new:<slug> · global:<slug> · drafts · open-web-admin ·
//   settings · reload
import type { AdminSchema } from '@payload-universal/admin-schema'
import type { MenuItemTree } from '../global'
import {
  collectionLabel,
  draftCollections,
  groupCollections,
  groupGlobals,
  globalLabel,
} from './collections'

export function buildMenuTree(schema: AdminSchema | null): MenuItemTree[] {
  const tree: MenuItemTree[] = []

  // ---- Collections (grouped) ----------------------------------------------
  const collectionGroups = groupCollections(schema)
  const collectionsSubmenu: MenuItemTree[] = collectionGroups.map((g) => ({
    label: g.group,
    submenu: g.collections.map((c) => {
      const label = collectionLabel(c)
      return {
        label,
        submenu: [
          { label: `Open ${label}`, action: `open:${c.slug}` },
          { label: `New ${label}`, action: `new:${c.slug}` },
        ],
      }
    }),
  }))
  tree.push({ label: 'Collections', submenu: collectionsSubmenu })

  // ---- Globals (only when present) ----------------------------------------
  const globalGroups = groupGlobals(schema)
  const hasGlobals = globalGroups.some((g) => g.globals.length > 0)
  if (hasGlobals) {
    const globalsSubmenu: MenuItemTree[] = globalGroups.map((g) => ({
      label: g.group,
      submenu: g.globals.map((gl) => ({
        label: globalLabel(gl),
        action: `global:${gl.slug}`,
      })),
    }))
    tree.push({ label: 'Globals', submenu: globalsSubmenu })
  }

  // ---- Workflow → Drafts (only when drafts exist) -------------------------
  const drafts = draftCollections(schema)
  if (drafts.length > 0) {
    tree.push({
      label: 'Workflow',
      submenu: [
        {
          label: 'Drafts',
          submenu: drafts.map((c) => ({
            label: collectionLabel(c),
            action: `open:${c.slug}`,
          })),
        },
      ],
    })
  }

  // ---- Tools ---------------------------------------------------------------
  tree.push({
    label: 'Tools',
    submenu: [
      { label: 'Open Web Admin', action: 'open-web-admin' },
      { label: 'Server Settings', action: 'settings' },
    ],
  })

  // ---- View ----------------------------------------------------------------
  tree.push({
    label: 'View',
    submenu: [{ label: 'Reload', action: 'reload', accelerator: 'CmdOrCtrl+R' }],
  })

  return tree
}
