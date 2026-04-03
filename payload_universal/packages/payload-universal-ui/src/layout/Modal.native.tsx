/**
 * Modal / Drawer — Native implementation.
 * Uses BottomSheet from admin-native.
 */
import React from 'react'
import { Modal as RNModal, Pressable, StyleSheet, View } from 'react-native'
import { defaultTheme as t } from '@payload-universal/admin-native'

type ModalProps = {
  children?: React.ReactNode
  slug?: string
  className?: string
  style?: any
}

export const Modal: React.FC<ModalProps> = ({ children }) => {
  return (
    <RNModal transparent animationType="slide">
      <View style={styles.backdrop}>
        <View style={styles.sheet}>{children}</View>
      </View>
    </RNModal>
  )
}

type DrawerProps = {
  children?: React.ReactNode
  slug?: string
  Header?: React.ComponentType
  className?: string
  style?: any
  gutter?: boolean
  title?: string
}

export const Drawer: React.FC<DrawerProps> = ({ children }) => (
  <RNModal transparent animationType="slide">
    <View style={styles.backdrop}>
      <View style={styles.sheet}>{children}</View>
    </View>
  </RNModal>
)

type DrawerTogglerProps = {
  children?: React.ReactNode
  slug?: string
  disabled?: boolean
  className?: string
  style?: any
  onClick?: () => void
}

export const DrawerToggler: React.FC<DrawerTogglerProps> = ({ children, onClick }) => (
  <Pressable onPress={onClick}>{children}</Pressable>
)

export const AnimateHeight: React.FC<{ children?: React.ReactNode; height?: number | 'auto' }> = ({ children }) => (
  <View>{children}</View>
)

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: t.colors.surface,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: t.spacing.lg,
    maxHeight: '80%',
  },
})
