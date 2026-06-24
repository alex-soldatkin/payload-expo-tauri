/**
 * Static styles shared by the collection-list screen pieces.
 * Currently the selection action bar's light-palette base (dark-mode overrides
 * are applied inline in SelectionActionBar via useListColors).
 */
import { StyleSheet } from 'react-native'

// ---------------------------------------------------------------------------
// Selection action bar styles
// ---------------------------------------------------------------------------

export const selectionStyles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f0f0f0',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  count: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  actionBtnDestructive: {
    backgroundColor: '#FF3B30',
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  actionLabelDestructive: {
    color: '#fff',
  },
  cancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  cancelLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1f1f1f',
  },
})
