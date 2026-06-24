// ---------------------------------------------------------------------------
// Styles — dark-mode aware palette only (zero hardcoded light colours)
// ---------------------------------------------------------------------------
import { StyleSheet } from 'react-native'

import type { ListColorPalette } from '../../hooks/useListColors'
import { GANTT_BAR_HEIGHT, GANTT_POINT_SIZE } from '../types'
import { TOOLTIP_WIDTH } from './utils'

export const createStyles = (c: ListColorPalette) =>
  StyleSheet.create({
    barRoot: {
      position: 'absolute',
      height: GANTT_BAR_HEIGHT,
    },
    // RN 0.85 removed StyleSheet.absoluteFillObject — inline the equivalent.
    pressable: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },

    rect: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      borderRadius: 7,
      borderWidth: StyleSheet.hairlineWidth,
      marginHorizontal: 1,
      overflow: 'hidden',
    },
    rectAccent: { width: 3, alignSelf: 'stretch' },
    rectTitle: {
      flexShrink: 1,
      paddingHorizontal: 6,
      fontSize: 11,
      fontWeight: '600',
      color: c.text,
    },
    rectLifted: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.25,
      shadowRadius: 8,
      elevation: 8,
    },

    pointWrap: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      alignItems: 'center',
      justifyContent: 'center',
    },
    point: {
      width: GANTT_POINT_SIZE,
      height: GANTT_POINT_SIZE,
      borderRadius: 3,
      transform: [{ rotate: '45deg' }],
    },

    handle: {
      position: 'absolute',
      top: -4,
      bottom: -4,
      alignItems: 'center',
      justifyContent: 'center',
    },
    grip: { width: 3, height: 12, borderRadius: 1.5 },

    ghost: {
      position: 'absolute',
      top: 0,
      height: GANTT_BAR_HEIGHT,
      borderRadius: 7,
      borderWidth: 1.5,
      borderStyle: 'dashed',
    },

    tooltip: {
      position: 'absolute',
      top: -(26 + 8),
      width: TOOLTIP_WIDTH,
      height: 26,
      borderRadius: 13,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: c.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 6,
      elevation: 6,
    },
    tooltipText: { fontSize: 11, fontWeight: '600', color: c.text },

    trailingLabelWrap: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    trailingLabel: { fontSize: 12, fontWeight: '500', color: c.textMuted },

    dimmed: { opacity: 0.45 },
  })
