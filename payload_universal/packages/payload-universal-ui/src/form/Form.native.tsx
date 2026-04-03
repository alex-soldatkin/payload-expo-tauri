/**
 * Form / RenderFields / FormSubmit — Native implementations.
 *
 * On native, form state is managed by RHF FormProvider (in DocumentForm).
 * These are thin wrappers for structural compatibility with codegen output.
 */
import React from 'react'
import { View, Pressable, Text, StyleSheet } from 'react-native'
import { defaultTheme as t } from '@payload-universal/admin-native'

type FormProps = {
  children?: React.ReactNode
  onSubmit?: (data: Record<string, unknown>) => void
  className?: string
  style?: any
}

/**
 * Form — on native, just a View wrapper (RHF FormProvider handles form logic).
 */
export const Form: React.FC<FormProps> = ({ children }) => (
  <View>{children}</View>
)

type RenderFieldsProps = {
  fields?: any[]
  fieldTypes?: any
  className?: string
  style?: any
  path?: string
}

/**
 * RenderFields — iterates fields through FieldRenderer.
 * On native, the DocumentForm handles this directly. This is a pass-through
 * for codegen compatibility.
 */
export const RenderFields: React.FC<RenderFieldsProps> = ({ children }) => (
  <View>{children}</View>
)

type FormSubmitProps = {
  children?: React.ReactNode
  className?: string
  style?: any
  type?: string
  disabled?: boolean
}

/**
 * FormSubmit — submit button. On native, mapped to a Pressable.
 */
export const FormSubmit: React.FC<FormSubmitProps> = ({ children, disabled }) => (
  <Pressable disabled={disabled} style={[styles.submit, disabled && styles.disabled]}>
    {typeof children === 'string' ? (
      <Text style={styles.submitText}>{children}</Text>
    ) : (
      children
    )}
  </Pressable>
)

const styles = StyleSheet.create({
  submit: {
    backgroundColor: t.colors.primary,
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.lg,
    paddingVertical: t.spacing.md,
    alignItems: 'center',
  },
  submitText: { color: t.colors.primaryText, fontSize: t.fontSize.md, fontWeight: '600' },
  disabled: { opacity: 0.5 },
})
