/**
 * DocumentForm — StyleSheet factories.
 *
 * Extracted from the original DocumentForm.tsx (purely structural; no behavior
 * change). `styles` is the iOS 26 Mail compose aesthetic shared by both form
 * variants; `edgeTabStyles` belongs to SidebarEdgeTab; `inspectorStyles`
 * belongs to InspectorPanel.
 */
import { StyleSheet } from 'react-native'
import { defaultTheme as t, ROW_MIN_HEIGHT } from '../theme'

// ===========================================================================
// Styles — iOS 26 Mail compose aesthetic
// ===========================================================================

export const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.sm, paddingBottom: 60 },
  widthRow: { flexDirection: 'row' as const, gap: t.spacing.md },
  carveoutContainer: { paddingHorizontal: t.spacing.lg, paddingVertical: t.spacing.sm },

  // Native SwiftUI Form path — full-screen Host; the Form scrolls natively.
  nativeFormContainer: { flex: 1 },
  nativeFormHost: { flex: 1 },
  nativeFormHeader: { paddingHorizontal: t.spacing.lg },


  // Validation banner — subtle, no heavy border
  validationBanner: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fef2f2',
    borderRadius: t.borderRadius.sm, padding: t.spacing.md, marginBottom: t.spacing.md,
    gap: t.spacing.sm,
  },
  validationIcon: {
    width: 20, height: 20, borderRadius: 10, backgroundColor: t.colors.error,
    color: '#fff', fontSize: 12, fontWeight: '800', textAlign: 'center',
    lineHeight: 20, overflow: 'hidden',
  },
  validationText: { fontSize: t.fontSize.sm, color: t.colors.error, flex: 1, fontWeight: '500' },

  // Sidebar → "Details" section
  sidebarSection: {
    marginTop: t.spacing.lg, borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: t.colors.separator, paddingTop: t.spacing.sm,
  },
  glassSidebarSection: {
    marginTop: t.spacing.lg, borderRadius: t.borderRadius.md, overflow: 'hidden',
  },
  sidebarHeader: {
    paddingVertical: t.spacing.sm,
  },
  sidebarTitle: {
    fontSize: t.fontSize.sm, fontWeight: '600', color: t.colors.textMuted,
  },
  sidebarBody: { },

  errorBanner: {
    backgroundColor: t.colors.errorBackground, borderRadius: t.borderRadius.sm,
    padding: t.spacing.md, marginBottom: t.spacing.md,
  },
  errorText: { color: t.colors.error, fontSize: t.fontSize.sm },

  // Status pill (compact)
  statusRow: { flexDirection: 'row', marginBottom: t.spacing.sm },
  statusPill: { paddingHorizontal: t.spacing.sm, paddingVertical: 3, borderRadius: 6 },
  statusDraft: { backgroundColor: '#fefce8' },
  statusPublished: { backgroundColor: '#f0fdf4' },
  statusPillText: { fontSize: 11, fontWeight: '600', letterSpacing: 0.3 },
  statusDraftText: { color: t.colors.warning },
  statusPublishedText: { color: t.colors.success },

  // "Details ›" row — taps to open sidebar sheet. Canonical inline row:
  // 44pt min height, no vertical padding (FormSection row owns the inset).
  detailsRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    minHeight: ROW_MIN_HEIGHT,
  },
  detailsRowLabel: { fontSize: t.fontSize.md, color: t.colors.primary, fontWeight: '500' },
  detailsRowChevron: { fontSize: 20, color: t.colors.textMuted },

  // Sidebar formSheet
  sheetContainer: { flex: 1, backgroundColor: t.colors.background },
  sheetHeader: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingHorizontal: t.spacing.lg, paddingTop: t.spacing.md, paddingBottom: t.spacing.xs,
  },
  sheetDone: { fontSize: t.fontSize.md, fontWeight: '600', color: t.colors.primary },
})

// Sidebar edge tab — Apple Notes/Freeform-style affordance on the content's
// right edge that opens the Details (sidebar fields) sheet.
export const edgeTabStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 0,
    top: '42%',
    zIndex: 30,
  },
  glass: {
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    overflow: 'hidden',
  },
  press: {
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
})

// Floating inspector panel — hovers over form content (wide layouts).
export const inspectorStyles = StyleSheet.create({
  panel: {
    position: 'absolute',
    // top and bottom set dynamically from safe area insets
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 32,
  },
  dragHandle: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  dragPill: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1f1f1f',
  },
  closeButton: {
    fontSize: 17,
    fontWeight: '500',
    color: t.colors.primary,
  },
  content: {
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 40,
  },
})
