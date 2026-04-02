import type { ViewProps } from 'react-native'

/**
 * Trigger view — wraps the visible row content.
 * Long press opens the preview popup; tap fires onPrimaryAction.
 */
export type ScrollablePreviewTriggerProps = ViewProps & {
  /** Preferred width of the preview popup. Defaults to 92% of screen width. */
  previewWidth?: number
  /** Preferred height of the preview popup. Defaults to 65% of screen height. */
  previewHeight?: number
  /** Fired on single tap (navigate to the screen). */
  onPrimaryAction?: () => void
  /** Fired when preview opens. */
  onPreviewOpen?: () => void
  /** Fired when preview closes. */
  onPreviewClose?: () => void
}

/**
 * Content container — its children are shown inside the scrollable popup.
 * Any ScrollView/FlatList inside will be interactive.
 */
export type ScrollablePreviewContentProps = ViewProps & {}

/**
 * Action button shown below the preview popup.
 */
export type ScrollablePreviewActionProps = ViewProps & {
  title: string
  /** SF Symbol name (e.g. 'doc.text', 'trash'). */
  icon?: string
  /** Red destructive style. */
  destructive?: boolean
  /** Fired when the action is tapped. */
  onActionPress?: () => void
}
