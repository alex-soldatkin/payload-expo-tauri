// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
import { StyleSheet } from 'react-native'
import type { ListColorPalette } from '@payload-universal/admin-native'

import { RETICLE } from './constants'

const CORNER = 26
const CORNER_W = 3

export const createDynamicStyles = (colors: ListColorPalette, dark: boolean) =>
  StyleSheet.create({
    solidBg: {
      backgroundColor: dark ? 'rgba(28,28,30,0.96)' : 'rgba(255,255,255,0.94)',
    },
    cameraWrapBg: {
      backgroundColor: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
      borderColor: colors.hairline,
    },
  })

export const styles = StyleSheet.create({
  centerWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  popup: {
    borderRadius: 20,
    borderCurve: 'continuous',
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  popupShadowPhone: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 24,
    elevation: 16,
  },
  popupShadowTablet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.28,
    shadowRadius: 30,
    elevation: 20,
  },
  content: {
    padding: 14,
  },
  contentFill: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    flexShrink: 1,
    marginRight: 12,
  },
  cameraWrap: {
    borderRadius: 16,
    borderCurve: 'continuous',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  cameraWrapSquare: {
    aspectRatio: 1,
  },
  cameraWrapFill: {
    flex: 1,
  },
  // Viewfinder mask strips (darken everything outside the reticle)
  maskRow: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  maskCenterRow: {
    flexDirection: 'row',
    height: RETICLE,
  },
  maskSide: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.32)',
  },
  reticleBox: {
    width: RETICLE,
    height: RETICLE,
  },
  viewfinderBorder: {
    // RN 0.85 removed StyleSheet.absoluteFillObject — inline the equivalent.
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    borderRadius: 18,
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  corner: {
    position: 'absolute',
    width: CORNER,
    height: CORNER,
    borderColor: '#fff',
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderTopLeftRadius: 18,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderTopRightRadius: 18,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_W,
    borderLeftWidth: CORNER_W,
    borderBottomLeftRadius: 18,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_W,
    borderRightWidth: CORNER_W,
    borderBottomRightRadius: 18,
  },
  scanLine: {
    position: 'absolute',
    left: 14,
    right: 14,
    height: 2,
    borderRadius: 1,
    opacity: 0.9,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    minHeight: 32,
  },
  caption: {
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
    marginRight: 12,
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
  },
  circle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  circleInner: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Permission / module-absent empty states
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  allowButton: {
    marginTop: 6,
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 18,
    borderCurve: 'continuous',
  },
  allowButtonLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
})
