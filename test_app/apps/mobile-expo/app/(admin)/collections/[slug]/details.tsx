/**
 * Details sheet — renders sidebar fields (admin.position: 'sidebar') in a
 * native iOS formSheet with grab handle and multiple detents.
 *
 * Presented as a sheet over the document edit/create screen.
 * Uses DocumentForm in read-only mode to get the full context stack
 * (FieldRendererContext, ErrorMapContext, FormDataContext).
 */
import React, { useMemo } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

import {
  extractRootFields,
  splitFieldsBySidebar,
  FormSection,
  useAdminSchema,
  getFieldLabel,
} from '@payload-universal/admin-native'
import { useLocalDB, useLocalDocument } from '@payload-universal/local-db'

export default function DetailsSheet() {
  const { slug, id } = useLocalSearchParams<{ slug: string; id?: string }>()
  const schema = useAdminSchema()
  const localDB = useLocalDB()

  const schemaMap = schema?.collections?.[slug]
  const rootFields = useMemo(
    () => (schemaMap ? extractRootFields(schemaMap, slug) : []),
    [schemaMap, slug],
  )
  const { sidebarFields } = useMemo(
    () => splitFieldsBySidebar(rootFields),
    [rootFields],
  )

  // Load document data for display
  const { data: doc } = useLocalDocument(localDB, slug, id ?? '')

  if (!sidebarFields.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No details available</Text>
      </View>
    )
  }

  // Simple read-only display of sidebar field values
  // (doesn't need the full FieldRendererContext/DocumentForm stack)
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <FormSection>
        {sidebarFields.map((field) => {
          const name = (field as any).name ?? ''
          const value = doc?.[name]
          const label = getFieldLabel(field)

          return (
            <View key={name} style={styles.row}>
              <Text style={styles.label}>{label}</Text>
              <Text style={styles.value} numberOfLines={2}>
                {formatValue(value)}
              </Text>
            </View>
          )
        })}
      </FormSection>
    </ScrollView>
  )
}

function formatValue(val: unknown): string {
  if (val === null || val === undefined) return '—'
  if (typeof val === 'boolean') return val ? 'Yes' : 'No'
  if (typeof val === 'number') return String(val)
  if (typeof val === 'string') {
    // Format dates
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
      try { return new Date(val).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) } catch { /* fall through */ }
    }
    return val
  }
  if (typeof val === 'object') {
    const obj = val as Record<string, unknown>
    return String(obj.title ?? obj.name ?? obj.email ?? obj.id ?? JSON.stringify(val))
  }
  return String(val)
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyText: { fontSize: 15, color: '#888' },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 44,
  },
  label: {
    fontSize: 15,
    color: '#1f1f1f',
    flex: 1,
  },
  value: {
    fontSize: 15,
    color: '#666',
    textAlign: 'right',
    flex: 1,
    marginLeft: 8,
  },
})
