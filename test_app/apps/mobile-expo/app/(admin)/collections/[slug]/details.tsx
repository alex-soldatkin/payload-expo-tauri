/**
 * Details sheet — renders sidebar fields (admin.position: 'sidebar') in a
 * native iOS formSheet with grab handle and multiple detents.
 *
 * Presented as a sheet over the document edit/create screen.
 * Uses the same FormSection styling as the rest of the app.
 */
import React, { useMemo } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'

import {
  extractRootFields,
  splitFieldsBySidebar,
  FieldRenderer,
  FormSection,
  useAdminSchema,
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
        {/* No sidebar fields — sheet shouldn't have been opened */}
      </View>
    )
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <FormSection>
        {sidebarFields.map((field) => {
          const path = (field as any).name ?? ''
          const value = doc?.[path]
          return (
            <FieldRenderer
              key={path}
              field={field}
              value={value}
              path={path}
              onChange={() => {}}
              disabled
            />
          )
        })}
      </FormSection>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  empty: {
    flex: 1,
  },
})
