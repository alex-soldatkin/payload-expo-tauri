import React from 'react'
import { Pressable, ScrollView, Text, View } from 'react-native'

import { PreviewContextProvider } from '../../../../contexts/PreviewContext'
import { type PickerPalette, docDisplayTitle, sharedStyles } from '../../shared'
import { styles } from '../styles'
import type { RelDoc } from '../types'
import { noopSubmit } from '../utils'

/**
 * Long-press preview sheet — read-only DocumentForm of the tapped doc with
 * select / back actions. Pure presentation (purely structural extraction).
 */
export const PreviewSheet: React.FC<{
  palette: PickerPalette
  previewItem: { doc: RelDoc; relationTo: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DocumentForm: React.ComponentType<any> | null
  previewSchemaMap: unknown
  titleFieldFor: (slug: string) => string | undefined
  onSelect: () => void
  onBack: () => void
}> = ({ palette, previewItem, DocumentForm, previewSchemaMap, titleFieldFor, onSelect, onBack }) => (
  <View style={{ flex: 1 }}>
    <View style={styles.previewHeader}>
      <Text style={[sharedStyles.sheetTitle, { color: palette.text }]} numberOfLines={1}>
        {docDisplayTitle(previewItem.doc, titleFieldFor(previewItem.relationTo))}
      </Text>
    </View>
    <View style={{ flex: 1, overflow: 'hidden' }}>
      <ScrollView bounces showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: 16 }}>
        {DocumentForm && previewSchemaMap ? (
          <PreviewContextProvider value={true}>
            <DocumentForm
              schemaMap={previewSchemaMap}
              slug={previewItem.relationTo}
              initialData={previewItem.doc}
              onSubmit={noopSubmit}
              disabled
            />
          </PreviewContextProvider>
        ) : null}
      </ScrollView>
    </View>
    <View style={[styles.previewActions, { borderTopColor: palette.separator }]}>
      <Pressable
        style={[styles.previewSelectBtn, { borderRightColor: palette.separator }]}
        onPress={onSelect}
      >
        <Text style={[styles.previewSelectText, { color: palette.primary }]}>Select</Text>
      </Pressable>
      <Pressable style={styles.previewCloseBtn} onPress={onBack}>
        <Text style={[styles.previewCloseText, { color: palette.textMuted }]}>Back</Text>
      </Pressable>
    </View>
  </View>
)
