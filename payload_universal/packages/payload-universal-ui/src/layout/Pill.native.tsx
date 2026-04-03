/**
 * Pill — Native implementation.
 * Small capsule badge component.
 */
import React from 'react'
import { StyleSheet, Text, View, Pressable } from 'react-native'
import { defaultTheme as t } from '@payload-universal/admin-native'

type Props = {
  children?: React.ReactNode
  pillStyle?: 'white' | 'dark' | 'light' | 'warning' | 'error' | 'success' | 'light-gray'
  onClick?: () => void
  onRemove?: () => void
  className?: string
  style?: any
  icon?: React.ReactNode
  rounded?: boolean
  draggable?: boolean
}

export const Pill: React.FC<Props> = ({
  children,
  pillStyle = 'light',
  onClick,
  icon,
}) => {
  const bg = pillStyle === 'dark' ? t.colors.primary
    : pillStyle === 'error' ? t.colors.errorBackground
    : pillStyle === 'success' ? t.colors.successBackground
    : pillStyle === 'warning' ? t.colors.warningBackground
    : '#f0f0f0'

  const textColor = pillStyle === 'dark' ? '#fff'
    : pillStyle === 'error' ? t.colors.error
    : pillStyle === 'success' ? t.colors.success
    : pillStyle === 'warning' ? t.colors.warning
    : t.colors.text

  const content = (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      {icon}
      {typeof children === 'string' ? (
        <Text style={[styles.text, { color: textColor }]}>{children}</Text>
      ) : (
        children
      )}
    </View>
  )

  if (onClick) {
    return <Pressable onPress={onClick}>{content}</Pressable>
  }

  return content
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 3,
    borderRadius: 100,
    gap: 4,
  },
  text: { fontSize: t.fontSize.xs, fontWeight: '600' },
})
