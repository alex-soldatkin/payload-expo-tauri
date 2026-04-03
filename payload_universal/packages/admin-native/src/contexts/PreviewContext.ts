/**
 * PreviewContext — signals to nested field components that they are rendered
 * inside a preview overlay (e.g. ScrollablePreview, modal) where Expo Router's
 * Link/Preview components are unavailable (no LinkPreviewContextProvider).
 *
 * Fields check `useIsInsidePreview()` and fall back to plain Pressable/Text
 * instead of `<Link.Preview />` / `<Link.Trigger>`.
 */
import { createContext, useContext } from 'react'

const PreviewContext = createContext(false)

export const PreviewContextProvider = PreviewContext.Provider

/**
 * Returns `true` when the component is rendered inside a preview overlay
 * (ScrollablePreview.Content, modal, etc.) where Expo Router context is absent.
 */
export const useIsInsidePreview = (): boolean => useContext(PreviewContext)
