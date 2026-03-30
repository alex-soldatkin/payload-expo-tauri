/**
 * DocumentActionsMenu — native menu for the document edit header.
 *
 * Uses @expo/ui SwiftUI Picker with `pickerStyle('menu')` to render a native
 * iOS dropdown menu triggered by an SF Symbol button (ellipsis).
 * Falls back to a BottomSheet on Android / when @expo/ui is unavailable.
 *
 * Shows contextual actions based on collection capabilities:
 *  - "Versions" (when the collection has versions enabled)
 *  - "Save as Draft" / "Publish" / "Unpublish" (when drafts are enabled)
 */
import React, { useCallback, useMemo, useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

import { BottomSheet } from './BottomSheet'
import { isNativeUIAvailable, NativeHost } from './fields/NativeHost'
import { defaultTheme as t } from './theme'

// ---------------------------------------------------------------------------
// Dynamic imports for @expo/ui Picker (same pattern as pickers.tsx)
// ---------------------------------------------------------------------------

let NativePicker: React.ComponentType<{
  selection?: string | null
  onSelectionChange?: (selection: string | null) => void
  label?: string
  systemImage?: string
  children?: React.ReactNode
  modifiers?: any[]
}> | null = null

let NativeText: React.ComponentType<{
  children?: React.ReactNode
  modifiers?: any[]
}> | null = null

if (Platform.OS === 'ios') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const swiftUI = require('@expo/ui/swift-ui')
    NativePicker = swiftUI.Picker
    NativeText = swiftUI.Text
  } catch {
    // @expo/ui SwiftUI not available
  }
}

// ---------------------------------------------------------------------------
// Action item type
// ---------------------------------------------------------------------------

type ActionItem = {
  key: string
  label: string
  onPress: () => void
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type Props = {
  /** Whether the collection has versions enabled. */
  hasVersions?: boolean
  /** Whether the collection has drafts enabled. */
  hasDrafts?: boolean
  /** Current document _status. */
  currentStatus?: 'draft' | 'published' | string
  /** Callbacks for each action. */
  onViewVersions?: () => void
  onSaveDraft?: () => void
  onPublish?: () => void
  onUnpublish?: () => void
}

// ---------------------------------------------------------------------------
// Build action list from props
// ---------------------------------------------------------------------------

const useActions = (props: Props): ActionItem[] => {
  const { hasVersions, hasDrafts, currentStatus, onViewVersions, onSaveDraft, onPublish, onUnpublish } = props

  return useMemo(() => {
    const actions: ActionItem[] = []

    if (hasVersions && onViewVersions) {
      actions.push({ key: 'versions', label: 'Versions', onPress: onViewVersions })
    }
    if (hasDrafts) {
      if (currentStatus === 'published' && onSaveDraft) {
        actions.push({ key: 'save-draft', label: 'Save as Draft', onPress: onSaveDraft })
      }
      if (currentStatus === 'draft' && onPublish) {
        actions.push({ key: 'publish', label: 'Publish', onPress: onPublish })
      }
      if (currentStatus === 'published' && onUnpublish) {
        actions.push({ key: 'unpublish', label: 'Unpublish', onPress: onUnpublish })
      }
    }

    return actions
  }, [hasVersions, hasDrafts, currentStatus, onViewVersions, onSaveDraft, onPublish, onUnpublish])
}

// ---------------------------------------------------------------------------
// Native iOS: SwiftUI Picker with menu style
// ---------------------------------------------------------------------------

const NativeMenuPicker: React.FC<Props> = (props) => {
  const actions = useActions(props)
  // Use an empty/sentinel value so no item appears "selected"
  const [selection, setSelection] = useState<string | null>('__none__')

  const handleSelectionChange = useCallback((value: string | null) => {
    if (!value || value === '__none__') return
    const action = actions.find((a) => a.key === value)
    if (action) {
      action.onPress()
    }
    // Reset selection so the picker acts like an action menu, not a selector
    setSelection('__none__')
  }, [actions])

  if (actions.length === 0) return null

  return (
    <NativeHost matchContents>
      <NativePicker
        selection={selection}
        onSelectionChange={handleSelectionChange}
        systemImage="ellipsis"
        label=""
        modifiers={[{ pickerStyle: 'menu' }]}
      >
        {/* Hidden sentinel so no visible item is pre-selected */}
        <NativeText modifiers={[{ tag: '__none__' }]}>{' '}</NativeText>
        {actions.map((action) => (
          <NativeText key={action.key} modifiers={[{ tag: action.key }]}>
            {action.label}
          </NativeText>
        ))}
      </NativePicker>
    </NativeHost>
  )
}

// ---------------------------------------------------------------------------
// Fallback: BottomSheet for Android / unsupported platforms
// ---------------------------------------------------------------------------

const FallbackMenu: React.FC<Props> = (props) => {
  const actions = useActions(props)
  const [visible, setVisible] = useState(false)

  if (actions.length === 0) return null

  const sheetHeight = Math.min(0.4, (actions.length * 56 + 70) / 800)

  return (
    <>
      <Pressable onPress={() => setVisible(true)} hitSlop={8}>
        <Text style={styles.ellipsis}>{'...'}</Text>
      </Pressable>

      <BottomSheet visible={visible} onClose={() => setVisible(false)} height={sheetHeight}>
        <Text style={styles.title}>Actions</Text>
        {actions.map((action) => (
          <Pressable
            key={action.key}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
            onPress={() => {
              action.onPress()
              setVisible(false)
            }}
          >
            <Text style={styles.rowLabel}>{action.label}</Text>
          </Pressable>
        ))}
      </BottomSheet>
    </>
  )
}

// ---------------------------------------------------------------------------
// Exported component — picks the right implementation
// ---------------------------------------------------------------------------

export const DocumentActionsMenu: React.FC<Props> = (props) => {
  const actions = useActions(props)
  if (actions.length === 0) return null

  if (isNativeUIAvailable && NativePicker && NativeText) {
    return <NativeMenuPicker {...props} />
  }
  return <FallbackMenu {...props} />
}

// ---------------------------------------------------------------------------
// Styles (fallback only)
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  ellipsis: {
    fontSize: 22,
    fontWeight: '700',
    color: t.colors.text,
    letterSpacing: 2,
  },
  title: {
    fontSize: t.fontSize.lg,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: t.spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.md,
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
  },
  rowPressed: {
    backgroundColor: '#f5f5f5',
  },
  rowLabel: {
    fontSize: t.fontSize.md,
    color: t.colors.text,
    fontWeight: '500',
  },
})
