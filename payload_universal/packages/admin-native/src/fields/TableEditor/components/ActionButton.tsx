import React from 'react'
import { Pressable, Text } from 'react-native'

import { GlassView, liquidGlassAvailable } from '../glass'
import { styles } from '../styles'

/** Small action button (+ or -). */
export const ActionButton: React.FC<{
  label: string
  onPress: () => void
  variant?: 'add' | 'remove'
}> = ({ label, onPress, variant = 'add' }) => {
  const isRemove = variant === 'remove'

  if (liquidGlassAvailable && GlassView) {
    return (
      <Pressable onPress={onPress}>
        <GlassView style={styles.actionBtnGlass} isInteractive glassEffectStyle="regular">
          <Text style={[styles.actionBtnText, isRemove && styles.actionBtnTextRemove]}>
            {label}
          </Text>
        </GlassView>
      </Pressable>
    )
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionBtn,
        isRemove && styles.actionBtnRemove,
        pressed && styles.actionBtnPressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.actionBtnText, isRemove && styles.actionBtnTextRemove]}>
        {label}
      </Text>
    </Pressable>
  )
}
