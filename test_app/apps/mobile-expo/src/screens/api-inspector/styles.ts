import { Platform, StyleSheet } from 'react-native'

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

export const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 48, gap: 12 },

  section: {
    borderRadius: 16,
    padding: 16,
    overflow: 'hidden',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  urlText: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 17,
  },

  controlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
    minHeight: 36,
  },
  controlLabel: { fontSize: 15 },
  hostFill: { flex: 1 },

  stepperFallback: { flexDirection: 'row', gap: 8 },
  stepBtn: {
    width: 36,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(120,120,128,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnText: { fontSize: 18, fontWeight: '600' },

  localeChips: { flex: 1 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 6, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(120,120,128,0.16)',
  },
  chipActive: { backgroundColor: '#007AFF' },
  chipText: { fontSize: 13, fontWeight: '600' },

  jsonSection: { paddingVertical: 12 },
  jsonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  errorText: { color: '#FF3B30', fontSize: 13, marginBottom: 6 },
})
