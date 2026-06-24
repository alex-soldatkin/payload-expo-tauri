import { resolveAssetURL } from '../shared'
import type { MediaDoc } from './types'

// Optional document picker (installed in the app; not a package peer dep)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export let DocumentPicker: any = null
try { DocumentPicker = require('expo-document-picker') } catch { /* not available */ }

// ---------------------------------------------------------------------------
// Media doc helpers
// ---------------------------------------------------------------------------

export const isImageDoc = (doc: MediaDoc): boolean => String(doc.mimeType ?? '').startsWith('image/')

/** Sizes-aware thumbnail URL: thumbnailURL → sizes.thumbnail → any size → url. */
export const thumbnailURLFor = (baseURL: string, doc: MediaDoc): string | null => {
  const direct = resolveAssetURL(baseURL, doc.thumbnailURL)
  if (direct) return direct
  const sizes = doc.sizes as Record<string, { url?: unknown } | undefined> | undefined
  if (sizes && typeof sizes === 'object') {
    const thumb = sizes.thumbnail?.url
    const resolvedThumb = resolveAssetURL(baseURL, thumb)
    if (resolvedThumb) return resolvedThumb
    for (const size of Object.values(sizes)) {
      const resolved = resolveAssetURL(baseURL, size?.url)
      if (resolved) return resolved
    }
  }
  return resolveAssetURL(baseURL, doc.url)
}

export const fullURLFor = (baseURL: string, doc: MediaDoc): string | null =>
  resolveAssetURL(baseURL, doc.url) ?? thumbnailURLFor(baseURL, doc)

export const clampPct = (v: number) => Math.max(0, Math.min(100, v))
