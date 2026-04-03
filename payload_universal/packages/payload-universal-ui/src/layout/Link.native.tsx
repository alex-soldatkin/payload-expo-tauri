/**
 * Link — Native implementation.
 * Maps to expo-router Link or Pressable.
 */
import React from 'react'
import { Pressable, Text, StyleSheet } from 'react-native'
import { defaultTheme as t } from '@payload-universal/admin-native'

// Try to import expo-router Link
let ExpoLink: React.ComponentType<any> | null = null
try {
  ExpoLink = require('expo-router').Link
} catch { /* not available */ }

type Props = {
  children?: React.ReactNode
  href?: string
  to?: string
  onClick?: () => void
  onPress?: () => void
  className?: string
  style?: any
  id?: string
  prefetch?: boolean
  el?: string
  newTab?: boolean
}

export const Link: React.FC<Props> = ({
  children,
  href,
  to,
  onClick,
  onPress,
  id,
  style,
}) => {
  const target = href ?? to

  // If we have expo-router and a href, use Link
  if (ExpoLink && target) {
    return (
      <ExpoLink href={target} asChild={false} style={style}>
        {typeof children === 'string' ? (
          <Text style={styles.linkText}>{children}</Text>
        ) : (
          children
        )}
      </ExpoLink>
    )
  }

  // Fallback to Pressable
  return (
    <Pressable onPress={onPress ?? onClick} style={style} testID={id}>
      {typeof children === 'string' ? (
        <Text style={styles.linkText}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  linkText: {
    fontSize: t.fontSize.md,
    color: t.colors.primary,
  },
})
