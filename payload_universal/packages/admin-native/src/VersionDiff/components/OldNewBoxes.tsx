import React from 'react'
import { Text, View } from 'react-native'

import { useDiffTheme } from '../theme'

// ---------------------------------------------------------------------------
// Old / new value boxes (scalars, relationships, fallback)
// ---------------------------------------------------------------------------

export const OldNewBoxes: React.FC<{
  fromStr: string
  toStr: string
  mono?: boolean
  vertical?: boolean
}> = ({ fromStr, toStr, mono, vertical }) => {
  const { styles } = useDiffTheme()
  return (
    <View style={vertical ? styles.diffValuesVertical : styles.diffValues}>
      <View style={[styles.diffOldBox, vertical && styles.diffBoxFullWidth]}>
        <Text style={[styles.diffValueText, styles.delPlainText, mono && styles.diffValueMono]}>
          {fromStr}
        </Text>
      </View>
      <View style={[styles.diffNewBox, vertical && styles.diffBoxFullWidth]}>
        <Text style={[styles.diffValueText, mono && styles.diffValueMono]}>
          {toStr}
        </Text>
      </View>
    </View>
  )
}
