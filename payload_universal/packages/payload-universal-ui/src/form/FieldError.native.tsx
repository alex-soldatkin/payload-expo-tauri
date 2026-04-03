/**
 * FieldError — Native implementation.
 */
import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { defaultTheme as t } from '@payload-universal/admin-native'

type Props = {
  message?: string
  showError?: boolean
  className?: string
  style?: any
  path?: string
}

export const FieldError: React.FC<Props> = ({ message, showError = true }) => {
  if (!message || !showError) return null
  return <Text style={styles.error}>{message}</Text>
}

const styles = StyleSheet.create({
  error: {
    fontSize: 12,
    color: t.colors.error,
    marginTop: 3,
    marginBottom: 2,
  },
})
