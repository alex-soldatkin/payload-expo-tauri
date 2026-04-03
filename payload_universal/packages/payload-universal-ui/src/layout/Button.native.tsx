/**
 * Button — Native implementation.
 * Pressable with themed styling.
 */
import React from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'
import { defaultTheme as t } from '@payload-universal/admin-native'

type Props = {
  children?: React.ReactNode
  onClick?: () => void
  onPress?: () => void
  disabled?: boolean
  buttonStyle?: 'primary' | 'secondary' | 'pill' | 'icon-label' | 'none'
  size?: 'small' | 'medium' | 'large'
  type?: string
  className?: string
  style?: any
  el?: string
  id?: string
  icon?: React.ReactNode
  round?: boolean
}

export const Button: React.FC<Props> = ({
  children,
  onClick,
  onPress,
  disabled,
  buttonStyle = 'primary',
  size = 'medium',
  icon,
}) => {
  const handlePress = onPress ?? onClick

  const isPrimary = buttonStyle === 'primary'
  const isSmall = size === 'small'

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        isPrimary ? styles.primary : styles.secondary,
        isSmall && styles.small,
        disabled && styles.disabled,
        pressed && styles.pressed,
      ]}
    >
      {icon}
      {typeof children === 'string' ? (
        <Text style={[styles.text, isPrimary ? styles.primaryText : styles.secondaryText, isSmall && styles.smallText]}>
          {children}
        </Text>
      ) : (
        children
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    gap: t.spacing.sm,
  },
  primary: {
    backgroundColor: t.colors.primary,
  },
  secondary: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: t.colors.border,
  },
  small: {
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.xs,
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.8 },
  text: { fontSize: t.fontSize.md, fontWeight: '600' },
  primaryText: { color: t.colors.primaryText },
  secondaryText: { color: t.colors.text },
  smallText: { fontSize: t.fontSize.sm },
})
