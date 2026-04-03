/**
 * Collapsible — Native implementation.
 * Animated collapsible section using LayoutAnimation.
 */
import React, { useState } from 'react'
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native'
import { defaultTheme as t } from '@payload-universal/admin-native'

type Props = {
  children?: React.ReactNode
  initCollapsed?: boolean
  header?: React.ReactNode
  label?: string | React.ReactNode
  className?: string
  style?: any
  onToggle?: (open: boolean) => void
}

export const Collapsible: React.FC<Props> = ({
  children,
  initCollapsed = false,
  header,
  label,
  onToggle,
}) => {
  const [collapsed, setCollapsed] = useState(initCollapsed)

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setCollapsed((prev) => {
      const next = !prev
      onToggle?.(next)
      return next
    })
  }

  return (
    <View style={styles.container}>
      <Pressable onPress={toggle} style={styles.header}>
        {header ?? (
          <Text style={styles.label}>
            {typeof label === 'string' ? label : 'Section'}
          </Text>
        )}
        <Text style={styles.chevron}>{collapsed ? '+' : '-'}</Text>
      </Pressable>
      {!collapsed && <View style={styles.body}>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { marginVertical: t.spacing.xs },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: t.spacing.md,
  },
  label: { fontSize: t.fontSize.md, fontWeight: '600', color: t.colors.text },
  chevron: { fontSize: 18, color: t.colors.textMuted, fontWeight: '500' },
  body: { paddingTop: t.spacing.xs },
})
