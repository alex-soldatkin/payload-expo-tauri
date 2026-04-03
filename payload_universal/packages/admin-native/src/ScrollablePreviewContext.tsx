/**
 * ScrollablePreviewContext — lets the host app inject its native
 * ScrollablePreview module into shared field components (relationship
 * picker, join field rows, etc.) so they can offer long-press previews.
 *
 * Usage in the app:
 * ```tsx
 * import * as ScrollablePreview from '@/modules/scrollable-preview'
 * import { ScrollablePreviewProvider } from '@payload-universal/admin-native'
 *
 * <ScrollablePreviewProvider value={ScrollablePreview}>
 *   <App />
 * </ScrollablePreviewProvider>
 * ```
 *
 * Usage in shared field components:
 * ```tsx
 * const preview = useScrollablePreview()
 * if (preview) {
 *   return (
 *     <preview.Trigger onPrimaryAction={onTap}>
 *       {rowContent}
 *       <preview.Content>...</preview.Content>
 *       <preview.Action title="Open" icon="doc.text" onActionPress={onTap} />
 *     </preview.Trigger>
 *   )
 * }
 * ```
 */
import { createContext, useContext } from 'react'
import type React from 'react'

export type ScrollablePreviewModule = {
  Trigger: React.ComponentType<{
    previewWidth?: number
    previewHeight?: number
    onPrimaryAction?: () => void
    onPreviewOpen?: () => void
    onPreviewClose?: () => void
    children?: React.ReactNode
  }>
  Content: React.ComponentType<{
    children?: React.ReactNode
  }>
  Action: React.ComponentType<{
    title: string
    icon?: string
    destructive?: boolean
    onActionPress?: () => void
  }>
}

const ScrollablePreviewContext = createContext<ScrollablePreviewModule | null>(null)

export const ScrollablePreviewProvider = ScrollablePreviewContext.Provider

/** Returns the ScrollablePreview module if the host app provided it. */
export const useScrollablePreview = (): ScrollablePreviewModule | null =>
  useContext(ScrollablePreviewContext)
