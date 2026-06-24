// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
import { StyleSheet } from 'react-native'

import { defaultTheme as t } from '../../theme'

export const styles = StyleSheet.create({
  editorContainer: {
    borderRadius: t.borderRadius.sm,
    backgroundColor: t.colors.surface,
    minHeight: 160,
    overflow: 'hidden',
  },
  editorContainerGlass: {
    borderRadius: 14,
    minHeight: 160,
    overflow: 'hidden',
  },
  tableWrapper: {
    marginTop: t.spacing.sm,
  },
  editor: {
    flex: 1,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
    fontSize: t.fontSize.md,
    color: t.colors.text,
    minHeight: 160,
  },
  editorDisabled: { opacity: 0.5, backgroundColor: '#f9f9f9' },
  editorError: { borderColor: t.colors.error },
  badge: {
    backgroundColor: '#f0f0f0',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    alignSelf: 'flex-start',
    marginBottom: t.spacing.sm,
  },
  badgeText: { fontSize: t.fontSize.xs, color: t.colors.textMuted },
  fallbackInput: {
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm + 2,
    fontSize: t.fontSize.md,
    color: t.colors.text,
    backgroundColor: t.colors.surface,
    minHeight: 140,
  },
})
