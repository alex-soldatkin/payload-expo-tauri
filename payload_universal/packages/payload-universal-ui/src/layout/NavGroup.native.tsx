/**
 * NavGroup — Native implementation.
 * Collapsible navigation section used by custom Nav components.
 */
import React, { useState } from 'react'
import { LayoutAnimation, Pressable, StyleSheet, Text, View } from 'react-native'
import { defaultTheme as t } from '@payload-universal/admin-native'

type Props = {
  children?: React.ReactNode
  label: string
  isOpen?: boolean
  className?: string
  style?: any
}

export const NavGroup: React.FC<Props> = ({
  children,
  label,
  isOpen: initialOpen = true,
}) => {
  const [open, setOpen] = useState(initialOpen)

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)
    setOpen((prev) => !prev)
  }

  return (
    <View style={styles.group}>
      <Pressable onPress={toggle} style={styles.header}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.chevron}>{open ? '-' : '+'}</Text>
      </Pressable>
      {open && <View style={styles.items}>{children}</View>}
    </View>
  )
}

const styles = StyleSheet.create({
  group: { marginBottom: t.spacing.sm },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.md,
  },
  label: {
    fontSize: t.fontSize.xs,
    fontWeight: '700',
    color: t.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  chevron: { fontSize: 14, color: t.colors.textMuted },
  items: { paddingLeft: t.spacing.md },
})
