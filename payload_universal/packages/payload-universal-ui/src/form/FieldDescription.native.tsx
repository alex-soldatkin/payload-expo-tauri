/**
 * FieldDescription — Native implementation.
 */
import React from 'react'
import { StyleSheet, Text } from 'react-native'
import { defaultTheme as t } from '@payload-universal/admin-native'

type Props = {
  description?: string | Record<string, string>
  className?: string
  style?: any
  value?: unknown
  path?: string
}

function resolveDesc(desc: string | Record<string, string> | undefined): string {
  if (!desc) return ''
  if (typeof desc === 'string') return desc
  return desc.en ?? Object.values(desc)[0] ?? ''
}

export const FieldDescription: React.FC<Props> = ({ description }) => {
  const text = resolveDesc(description)
  if (!text) return null

  return <Text style={styles.description}>{text}</Text>
}

const styles = StyleSheet.create({
  description: {
    fontSize: 12,
    color: t.colors.textPlaceholder,
    marginTop: 2,
    marginBottom: 2,
  },
})
