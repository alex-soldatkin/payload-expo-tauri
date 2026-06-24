// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

import { StyleSheet } from 'react-native'

import { defaultTheme as t } from '../../theme'
import { ACTION_BTN_SIZE, CELL_PADDING, MIN_CELL_WIDTH } from './constants'

export const styles = StyleSheet.create({
  container: {
    marginBottom: t.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.md,
    backgroundColor: t.colors.surface,
    overflow: 'hidden',
    padding: t.spacing.xs,
  },
  containerGlass: {
    marginBottom: t.spacing.sm,
    borderRadius: t.borderRadius.md,
    overflow: 'hidden',
    padding: t.spacing.xs,
  },

  // Header toggle
  headerToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: t.spacing.xs,
    gap: t.spacing.xs,
  },
  headerToggle: {
    width: ACTION_BTN_SIZE,
    height: ACTION_BTN_SIZE,
    borderRadius: t.borderRadius.sm / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.background,
  },
  headerToggleActive: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  headerToggleText: {
    fontSize: t.fontSize.xs,
    fontWeight: '700',
    color: t.colors.textMuted,
  },
  headerToggleTextActive: {
    color: t.colors.primaryText,
  },
  headerToggleLabel: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
  },

  // Table grid
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  // Column action strip (remove buttons above columns)
  colActionsRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  colActionCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },

  // Cell
  cell: {
    minWidth: MIN_CELL_WIDTH,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.separator,
    justifyContent: 'center',
    // Collapse double borders between adjacent cells
    marginRight: -StyleSheet.hairlineWidth,
    marginBottom: -StyleSheet.hairlineWidth,
  },
  cellHeader: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  cellFocused: {
    borderColor: t.colors.primary,
    borderWidth: 1.5,
    zIndex: 1,
  },
  cellInput: {
    paddingHorizontal: CELL_PADDING,
    paddingVertical: CELL_PADDING,
    fontSize: t.fontSize.sm,
    color: t.colors.text,
    minHeight: 36,
  },
  cellInputHeader: {
    fontWeight: '600',
  },

  // Row action (remove button beside each row)
  rowAction: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: t.spacing.xs,
  },

  // Add row/column containers
  addRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: t.spacing.xs,
    gap: t.spacing.xs,
  },
  addColContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: t.spacing.xs,
    gap: 2,
  },
  addLabel: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
  },

  // Action buttons (+ / -)
  actionBtn: {
    width: ACTION_BTN_SIZE,
    height: ACTION_BTN_SIZE,
    borderRadius: ACTION_BTN_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnGlass: {
    width: ACTION_BTN_SIZE,
    height: ACTION_BTN_SIZE,
    borderRadius: ACTION_BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnRemove: {
    borderColor: t.colors.destructive + '40',
    backgroundColor: t.colors.errorBackground,
  },
  actionBtnPressed: {
    opacity: 0.6,
  },
  actionBtnText: {
    fontSize: t.fontSize.md,
    fontWeight: '500',
    color: t.colors.textMuted,
    lineHeight: t.fontSize.md + 2,
  },
  actionBtnTextRemove: {
    color: t.colors.destructive,
  },
})
