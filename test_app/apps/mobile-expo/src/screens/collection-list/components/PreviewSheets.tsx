/**
 * Two pure-JS BottomSheets for the collection-list screen:
 *   - BoardPreviewSheet  → kanban-card / gantt-bar preview (read-only
 *                          DocumentForm), opened by a static long-press or the
 *                          kanban card's ellipsis menu. Long-press belongs to
 *                          the drag gesture on both surfaces, so the native
 *                          ScrollablePreview peek is never mounted on cards/bars.
 *   - ScanMatchesSheet   → "multiple matches" picker for the scanner (same
 *                          inline list pattern); tapping a row navigates
 *                          through the shared double-nav guard.
 *
 * Extracted verbatim from the route file.
 */
import React from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import {
  BottomSheet,
  DocumentForm,
  getDocumentTitle,
  PreviewContextProvider,
  useListColors,
} from '@payload-universal/admin-native'

// The screen's schemaMap may be undefined; BoardPreviewSheet guards on it.
type SchemaMap = React.ComponentProps<typeof DocumentForm>['schemaMap'] | undefined

export type BoardPreviewSheetProps = {
  doc: Record<string, unknown> | null
  schemaMap: SchemaMap
  slug: string
  useAsTitle?: string
  noopSubmit: () => Promise<void>
  onClose: () => void
  onOpenDoc: (id: string) => void
}

export function BoardPreviewSheet({
  doc,
  schemaMap,
  slug,
  useAsTitle,
  noopSubmit,
  onClose,
  onOpenDoc,
}: BoardPreviewSheetProps) {
  const { colors: tc } = useListColors()
  return (
    <BottomSheet visible={doc != null} onClose={onClose} height={0.75}>
      {doc && schemaMap ? (
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              marginBottom: 8,
            }}
          >
            <Text
              style={{ flex: 1, fontSize: 17, fontWeight: '700', color: tc.text }}
              numberOfLines={1}
            >
              {getDocumentTitle(doc, useAsTitle)}
            </Text>
            <Pressable
              onPress={() => {
                const id = String(doc.id)
                onClose()
                onOpenDoc(id)
              }}
              hitSlop={8}
            >
              <Text style={{ fontSize: 15, fontWeight: '600', color: '#007AFF' }}>Open</Text>
            </Pressable>
          </View>
          <View style={{ flex: 1, overflow: 'hidden' }}>
            <ScrollView bounces showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: 16 }}>
              <PreviewContextProvider value={true}>
                <DocumentForm
                  schemaMap={schemaMap}
                  slug={slug}
                  initialData={doc}
                  onSubmit={noopSubmit}
                  disabled
                  nativeForm={false}
                />
              </PreviewContextProvider>
            </ScrollView>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  )
}

export type ScanMatchesSheetProps = {
  matches: Record<string, unknown>[] | null
  useAsTitle?: string
  onClose: () => void
  onPick: (id: string) => void
}

export function ScanMatchesSheet({ matches, useAsTitle, onClose, onPick }: ScanMatchesSheetProps) {
  const { colors: tc } = useListColors()
  return (
    <BottomSheet visible={matches != null} onClose={onClose} height={0.5}>
      <Text style={{ fontSize: 17, fontWeight: '700', color: tc.text, marginBottom: 4 }}>
        Multiple matches
      </Text>
      <Text style={{ fontSize: 13, color: tc.textMuted, marginBottom: 8 }}>
        Several documents match the scanned code — pick one to open.
      </Text>
      <ScrollView bounces showsVerticalScrollIndicator contentContainerStyle={{ paddingBottom: 16 }}>
        {(matches ?? []).map((doc) => {
          const id = String(doc.id)
          return (
            <Pressable
              key={id}
              onPress={() => {
                onClose()
                onPick(id)
              }}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                paddingVertical: 14,
                paddingHorizontal: 4,
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: tc.separator,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{ flex: 1, fontSize: 15, fontWeight: '600', color: tc.text }}
                numberOfLines={1}
              >
                {getDocumentTitle(doc, useAsTitle)}
              </Text>
              <Text style={{ fontSize: 18, color: tc.tertiary, fontWeight: '300' }}>›</Text>
            </Pressable>
          )
        })}
      </ScrollView>
    </BottomSheet>
  )
}
