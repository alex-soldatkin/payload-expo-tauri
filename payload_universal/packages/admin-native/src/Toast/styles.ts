import { StyleSheet } from 'react-native'

// ---------------------------------------------------------------------------
// Accent colours per toast type
// ---------------------------------------------------------------------------

export const ACCENT = {
  success: '#34C759', // iOS green
  error: '#FF3B30', // iOS red
  info: '#007AFF', // iOS blue
} as const

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

export const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    gap: 8,
  },

  // Pill shape — sizes to its content (maxWidth applied inline from window
  // width), centred, very rounded. RN clamps oversized radii on tall pills.
  pill: {
    borderRadius: 50,
    overflow: 'hidden',
    minWidth: 200,
    borderWidth: StyleSheet.hairlineWidth,
    // Shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },

  pillContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },

  iconContainer: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },

  messageText: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    letterSpacing: -0.2,
  },

  accentDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  fallbackIcon: {
    fontSize: 18,
    fontWeight: '700',
  },
})
