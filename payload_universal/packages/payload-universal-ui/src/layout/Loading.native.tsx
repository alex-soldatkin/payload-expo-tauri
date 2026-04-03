/**
 * Loading — Native implementation.
 * Maps to React Native ActivityIndicator.
 */
import React from 'react'
import { ActivityIndicator, View, StyleSheet } from 'react-native'
import { defaultTheme as t } from '@payload-universal/admin-native'

type Props = {
  className?: string
  style?: any
}

export const Loading: React.FC<Props> = () => (
  <View style={styles.container}>
    <ActivityIndicator size="small" color={t.colors.primary} />
  </View>
)

const styles = StyleSheet.create({
  container: { padding: t.spacing.lg, alignItems: 'center', justifyContent: 'center' },
})
