/**
 * Gutter — Native implementation.
 * Horizontal padding wrapper.
 */
import React from 'react'
import { View, StyleSheet } from 'react-native'
import { defaultTheme as t } from '@payload-universal/admin-native'

type Props = {
  children?: React.ReactNode
  left?: boolean
  right?: boolean
  className?: string
  style?: any
}

export const Gutter: React.FC<Props> = ({ children, left = true, right = true }) => (
  <View style={[styles.gutter, !left && styles.noLeft, !right && styles.noRight]}>
    {children}
  </View>
)

const styles = StyleSheet.create({
  gutter: { paddingHorizontal: t.spacing.lg },
  noLeft: { paddingLeft: 0 },
  noRight: { paddingRight: 0 },
})
