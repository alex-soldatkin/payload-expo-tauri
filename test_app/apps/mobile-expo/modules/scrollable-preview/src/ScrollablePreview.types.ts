import type { ViewProps } from 'react-native'

/**
 * Trigger view — wraps the visible row content.
 *
 * Long press opens the Telegram-style peek (blur + dim backdrop in a dedicated native
 * overlay, scrollable preview content, action rows below); tap fires `onPrimaryAction`.
 *
 * Safe to use inside React Native Modal / BottomSheet hierarchies: the iOS overlay is
 * hosted in its own UIWindow (no UIContextMenuInteraction), and Android uses a Dialog.
 */
export type ScrollablePreviewTriggerProps = ViewProps & {
  /** Preferred width of the preview popup in dp. Defaults to 92% of screen width. */
  previewWidth?: number
  /** Preferred height of the preview popup in dp. Defaults to `previewHeightFraction` of screen height. */
  previewHeight?: number
  /**
   * Height of the preview as a fraction of the screen height (0.2–0.95).
   * Only used when `previewHeight` is not set. Defaults to 0.65.
   */
  previewHeightFraction?: number
  /** Fired on single tap of the row, and on tap of the open preview (commit). */
  onPrimaryAction?: () => void
  /** Fired when the peek opens. */
  onPreviewOpen?: () => void
  /** Fired after the peek closes (any dismissal path). */
  onPreviewClose?: () => void
}

/**
 * Content container — its children are shown inside the scrollable peek popup.
 * Any ScrollView/FlatList inside scrolls natively while the peek is open.
 * Hidden (and excluded from row layout) until the peek opens.
 */
export type ScrollablePreviewContentProps = ViewProps & {}

/**
 * Action button shown below the preview popup.
 * Rendered natively as a rounded glass capsule row.
 */
export type ScrollablePreviewActionProps = ViewProps & {
  title: string
  /** SF Symbol name (e.g. 'doc.text', 'trash'). iOS only — ignored on Android. */
  icon?: string
  /** Red destructive style. */
  destructive?: boolean
  /** Fired when the action is tapped (or when the held finger is released over the row). */
  onActionPress?: () => void
}
