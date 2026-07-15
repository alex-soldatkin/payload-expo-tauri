// Desktop ActionRegistry — the app-code side of the SSOT custom-actions split.
//
// Action METADATA (key/label/destructive) lives in the admin schema
// (menuModel.collections[].listActions / editActions). The HANDLER BODIES live
// here, keyed `{slug}.{list|edit}.{key}`, mirroring the mobile registry
// (apps/mobile-expo/src/actions/index.ts). List handlers receive the selected
// docs; edit handlers receive the single current doc.
//
// Mobile writes directly through RxDB (incrementalPatch); the desktop mutations
// (useLocalMutations) already stamp `updatedAt` + `_locallyModified`, so the
// ported handlers only carry the field writes. Mobile's Share.share becomes
// clipboard + toast, and native Alert confirmations move to the caller
// (SelectionBar / DocMenu use window.confirm before destructive actions).

/** Context handed to every action handler. */
export type ActionContext = {
  slug: string
  /** List handlers: the selected docs. Edit handlers: `[currentDoc]`. */
  docs: Record<string, unknown>[]
  /** Patch a local doc (stamps updatedAt + _locallyModified). */
  update: (id: string, data: Record<string, unknown>) => Promise<void>
  /** Soft-delete a local doc. */
  remove: (id: string) => Promise<void>
  /** Payload server base URL (for shareable links). */
  serverURL: string
  token?: string
  /** Promise-based modal steps for multi-step flows (confirm/form). */
  steps?: import('../components/preview/ActionSteps').ActionSteps
  /** Read docs from ANY locally-synced collection (cross-collection lookups). */
  getDocs?: (slug: string, limit?: number) => Promise<Record<string, unknown>[]>
  /** Corner-toast notifier. */
  toast: (message: string, opts?: { type?: 'info' | 'success' | 'error' }) => void
  /**
   * Optional progress reporter (`(done, total) => void`). Bulk handlers call it
   * after each doc so the toolbar can render "3/14…".
   */
  onProgress?: (done: number, total: number) => void
}

export type ActionHandler = (ctx: ActionContext) => void | Promise<void>

/** Registry keyed by collection slug → 'list' | 'edit' → action key → handler. */
export type ActionRegistry = {
  [slug: string]: {
    list?: Record<string, ActionHandler>
    edit?: Record<string, ActionHandler>
  }
}

const docId = (d: Record<string, unknown>): string => String(d.id ?? '')

/** Patch every doc in `ctx.docs`, reporting progress + returning the count. */
async function patchEach(
  ctx: ActionContext,
  data: Record<string, unknown>,
): Promise<number> {
  let done = 0
  for (const doc of ctx.docs) {
    const id = docId(doc)
    if (!id) continue
    try {
      await ctx.update(id, data)
      done++
    } catch {
      // skip failed docs (mirrors mobile's per-doc try/catch)
    }
    ctx.onProgress?.(done, ctx.docs.length)
  }
  return done
}

function download(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Port of the mobile `duplicatePost` handler for a single doc: clone the
 * editable subset, suffix the title, force draft status, insert as new. Desktop
 * routes this to the generic Duplicate implementation (DocumentForm owns the
 * validated create), so the registered handler here is a thin passthrough that
 * DocumentForm supplies via `duplicate`. Registered so the schema-driven menu
 * item resolves; the actual body is injected at call time (see DocumentForm).
 */

export const actionRegistry: ActionRegistry = {
  posts: {
    list: {
      // Mobile: incrementalPatch({ _status: 'published', ... }).
      bulkPublish: async (ctx) => {
        if (ctx.docs.length === 0) {
          ctx.toast('Select one or more posts to publish.', { type: 'info' })
          return
        }
        const n = await patchEach(ctx, { _status: 'published' })
        ctx.toast(`${n} post${n !== 1 ? 's' : ''} published. Syncing…`, { type: 'success' })
      },
      // Mobile: incrementalPatch({ status: 'archived', ... }) — note it writes
      // the `status` field, NOT `_status`. Copied verbatim.
      bulkArchive: async (ctx) => {
      // Multi-step example: show exactly what will be archived, then confirm
      // through the modal steps (falls back to window.confirm without them).
      if (ctx.steps) {
        const titles = ctx.docs
          .map((d) => String((d as { title?: unknown }).title ?? (d as { id?: unknown }).id ?? '?'))
          .slice(0, 12)
        const more = ctx.docs.length - titles.length
        const ok = await ctx.steps.confirmStep({
          title: `Archive ${ctx.docs.length} post${ctx.docs.length === 1 ? '' : 's'}?`,
          body: titles.join('\n') + (more > 0 ? `\n…and ${more} more` : ''),
          confirmLabel: 'Archive',
        })
        if (!ok) return
      }
        if (ctx.docs.length === 0) {
          ctx.toast('Select one or more posts to archive.', { type: 'info' })
          return
        }
        const n = await patchEach(ctx, { status: 'archived' })
        ctx.toast(`${n} post${n !== 1 ? 's' : ''} archived.`, { type: 'success' })
      },
    },
    edit: {
      // Mobile shares title/excerpt + https://yoursite.com/posts/{slug}.
      // Desktop copies {serverURL}/posts/{slug-or-id} to the clipboard.
      sharePost: async (ctx) => {
        const doc = ctx.docs[0]
        if (!doc) return
        const slugOrId = doc.slug ? String(doc.slug) : docId(doc)
        const base = ctx.serverURL.replace(/\/$/, '')
        const url = `${base}/posts/${slugOrId}`
        try {
          await navigator.clipboard.writeText(url)
          ctx.toast('Link copied to clipboard.', { type: 'success' })
        } catch {
          ctx.toast('Could not copy link.', { type: 'error' })
        }
      },
      // Reuses the generic Duplicate (DocumentForm injects the body). Present so
      // the schema-driven menu item is treated as a registered action.
      duplicatePost: async (ctx) => {
        ctx.toast('Duplicating…', { type: 'info' })
      },
    },
  },

  products: {
    list: {
      // Mobile shares a CSV via the native sheet; desktop serializes the
      // selected docs to JSON and downloads them (Blob + a[download]).
      exportProducts: async (ctx) => {
        if (ctx.docs.length === 0) {
          ctx.toast('Select one or more products to export.', { type: 'info' })
          return
        }
        download(
          `products-export-${ctx.docs.length}.json`,
          JSON.stringify(ctx.docs, null, 2),
        )
        ctx.toast(`Exported ${ctx.docs.length} product${ctx.docs.length !== 1 ? 's' : ''}.`, {
          type: 'success',
        })
      },
    },
    edit: {
      // Mobile: incrementalPatch({ availability: 'discontinued', ... }).
      archiveProduct: async (ctx) => {
        const doc = ctx.docs[0]
        if (!doc) return
        try {
          await ctx.update(docId(doc), { availability: 'discontinued' })
          const name = String(doc.name ?? 'Product')
          ctx.toast(`"${name}" marked as discontinued. Syncing…`, { type: 'success' })
        } catch (err) {
          ctx.toast(err instanceof Error ? err.message : 'Failed to archive.', { type: 'error' })
        }
      },
    },
  },
}

/** Look up a handler by slug/kind/key, or `undefined` when unregistered. */
export function resolveHandler(
  slug: string,
  kind: 'list' | 'edit',
  key: string,
): ActionHandler | undefined {
  return actionRegistry[slug]?.[kind]?.[key]
}
