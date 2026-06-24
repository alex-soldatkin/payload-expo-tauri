import { StyleSheet } from 'react-native'

export const overlayStyles = StyleSheet.create({
  wrapper: {
    flex: 1,
    alignSelf: 'stretch',
  },
  backdrop: {
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  panel: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    borderRightWidth: StyleSheet.hairlineWidth,
    // No overflow:'hidden' — it would clip the iOS shadow; the absolute-fill
    // background layers fit the panel bounds exactly.
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 16,
  },
})

// Nav content — mirrors the original sidebar styles from app/(admin)/_layout.tsx
export const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#8E8E93',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderRadius: 10,
    overflow: 'hidden',
  },
  itemActive: {
    backgroundColor: 'rgba(0,122,255,0.1)',
  },
  itemIndented: {
    paddingLeft: 16,
  },
  itemLabel: {
    fontSize: 15,
    fontWeight: '500',
    flex: 1,
    flexShrink: 1,
  },
  bottomSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    paddingBottom: 4,
  },
})
