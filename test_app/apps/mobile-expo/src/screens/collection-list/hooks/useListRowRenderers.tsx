/**
 * Row + peek renderers for the collection-list screen.
 *
 * Owns the single-preview tracking (`previewItemId` — only ONE DocumentForm is
 * mounted at a time, not one per row), the double-nav guard (`navigateToDoc`),
 * and the two render callbacks:
 *   - renderRow         → table/phone-card rows: selection checkbox wrapper,
 *                         swipe-to-delete, long-press peek (ScrollablePreview).
 *   - renderDocWithPeek → calendar day-list rows: same long-press peek.
 *
 * Extracted verbatim from the route file; behaviour is unchanged.
 */
import React, { useCallback, useRef, useState } from 'react'
import { Alert, Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import {
  closeOpenSwipeRow,
  DocumentForm,
  PreviewContextProvider,
  SwipeToDeleteRow,
  useListColors,
} from '@payload-universal/admin-native'
import * as ScrollablePreview from '@/modules/scrollable-preview'
import { PHONE_SWIPE_ACTION_STYLE } from '../utils'

// The screen's schemaMap is `schema?.collections[slug]` — possibly undefined;
// the renderers guard on it (`schemaMap && …`), so allow undefined here.
type SchemaMap = React.ComponentProps<typeof DocumentForm>['schemaMap'] | undefined

export type UseListRowRenderersArgs = {
  slug: string
  schemaMap: SchemaMap
  isPreview: boolean
  showSidebar: boolean
  selectionMode: boolean
  selectedIds: string[]
  toggleSelection: (id: string) => void
  handleDelete: (doc: Record<string, unknown>) => void | Promise<void>
  previewWidth: number
  previewHeight: number
  noopSubmit: () => Promise<void>
}

export function useListRowRenderers({
  slug,
  schemaMap,
  isPreview,
  showSidebar,
  selectionMode,
  selectedIds,
  toggleSelection,
  handleDelete,
  previewWidth,
  previewHeight,
  noopSubmit,
}: UseListRowRenderersArgs) {
  const router = useRouter()
  // Dark-mode aware palette for the selection checkbox border
  const { colors: tc } = useListColors()

  // Track which item's preview is open so only ONE DocumentForm
  // is mounted at a time (not one per row — that was killing perf).
  const [previewItemId, setPreviewItemId] = useState<string | null>(null)

  const renderRow = useCallback(
    ({ item, rowContent }: { item: Record<string, unknown>; rowContent: React.ReactElement; onPress: () => void }) => {
      const itemId = String(item.id)
      const isThisPreviewOpen = previewItemId === itemId
      const isSelected = selectedIds.includes(itemId)

      // Wrap row content with a selection checkbox when in selection mode
      const wrapWithSelection = (content: React.ReactElement) => {
        if (!selectionMode) return content
        return (
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center' }}
            onPress={() => toggleSelection(itemId)}
          >
            <View style={{
              width: 24, height: 24, borderRadius: 12,
              borderWidth: 2, borderColor: isSelected ? '#007AFF' : tc.tertiary,
              backgroundColor: isSelected ? '#007AFF' : 'transparent',
              alignItems: 'center', justifyContent: 'center',
              marginRight: 10, marginLeft: 4,
            }}>
              {isSelected && <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{'✓'}</Text>}
            </View>
            <View style={{ flex: 1 }}>{content}</View>
          </Pressable>
        )
      }

      // rowContent comes fully formed from DocumentList — phone card or
      // (tableMode) frozen-title table row; no screen-side row markup.

      // In selection mode: tap toggles selection instead of navigating
      // (swipe-to-delete is disabled — rows render without the wrapper)
      if (selectionMode) {
        return wrapWithSelection(rowContent)
      }

      // Swipe-to-delete wraps OUTSIDE the peek trigger: the revealed Delete
      // button must never sit inside the trigger's native tap/long-press
      // recognizer subtree, and the trigger (with its long-press peek)
      // translates as part of the swiped content. The confirm dialog lives
      // in SwipeToDeleteRow; delete flows through the same local-first
      // handleDelete (shake-to-undo toast preserved).
      return (
        <SwipeToDeleteRow
          onDelete={() => handleDelete(item)}
          confirmTitle="Delete"
          confirmMessage="Are you sure?"
          actionStyle={showSidebar ? undefined : PHONE_SWIPE_ACTION_STYLE}
        >
          <ScrollablePreview.Trigger
            previewWidth={previewWidth}
            previewHeight={previewHeight}
            onPrimaryAction={() => {
              // A tap while a swipe row is open just closes it
              if (closeOpenSwipeRow()) return
              if (!isPreview) router.push(`/(admin)/collections/${slug}/${itemId}`)
            }}
            onPreviewOpen={() => setPreviewItemId(itemId)}
            onPreviewClose={() => setPreviewItemId(null)}
          >
            {rowContent}
            <ScrollablePreview.Content>
              <PreviewContextProvider value={true}>
                {schemaMap && isThisPreviewOpen ? (
                  <DocumentForm
                    schemaMap={schemaMap}
                    slug={slug}
                    initialData={item}
                    onSubmit={noopSubmit}
                    disabled
                    // Preview content mounts in an unsized native container —
                    // a zero-height SwiftUI Form swallows touches.
                    nativeForm={false}
                  />
                ) : null}
              </PreviewContextProvider>
            </ScrollablePreview.Content>
            <ScrollablePreview.Action
              title="Open"
              icon="doc.text"
              onActionPress={() => {
                if (!isPreview) router.push(`/(admin)/collections/${slug}/${itemId}`)
              }}
            />
            <ScrollablePreview.Action
              title="Delete"
              icon="trash"
              destructive
              onActionPress={() => {
                Alert.alert('Delete', 'Are you sure?', [
                  { text: 'Cancel', style: 'cancel' },
                  { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
                ])
              }}
            />
          </ScrollablePreview.Trigger>
        </SwipeToDeleteRow>
      )
    },
    [slug, handleDelete, schemaMap, noopSubmit, isPreview, router, previewWidth, previewHeight, previewItemId, showSidebar, selectionMode, selectedIds, toggleSelection, tc],
  )

  // ── Calendar row wrapper — long-press peek via ScrollablePreview.Trigger
  // (same pattern as list rows). NOT used for kanban cards: the trigger's
  // native UILongPressGestureRecognizer would steal the long-press that
  // drives the board's PanResponder drag-or-peek (cards preview via a
  // static long-press or the ellipsis menu instead — see boardPreviewDoc
  // above). Tap can fire from both the trigger's primary action and the
  // inner row's Pressable — the timestamp guard collapses doubles. ──
  const lastNavRef = useRef(0)
  const navigateToDoc = useCallback(
    (id: string) => {
      if (isPreview) return
      const now = Date.now()
      if (now - lastNavRef.current < 600) return
      lastNavRef.current = now
      router.push(`/(admin)/collections/${slug}/${id}`)
    },
    [isPreview, router, slug],
  )

  const renderDocWithPeek = useCallback(
    (doc: Record<string, unknown>, defaultCard: React.ReactElement) => {
      const itemId = String(doc.id)
      const isThisPreviewOpen = previewItemId === itemId
      return (
        <ScrollablePreview.Trigger
          previewWidth={previewWidth}
          previewHeight={previewHeight}
          onPrimaryAction={() => navigateToDoc(itemId)}
          onPreviewOpen={() => setPreviewItemId(itemId)}
          onPreviewClose={() => setPreviewItemId(null)}
        >
          {defaultCard}
          <ScrollablePreview.Content>
            <PreviewContextProvider value={true}>
              {schemaMap && isThisPreviewOpen ? (
                <DocumentForm
                  schemaMap={schemaMap}
                  slug={slug}
                  initialData={doc}
                  onSubmit={noopSubmit}
                  disabled
                  // Preview content mounts in an unsized native container —
                  // a zero-height SwiftUI Form swallows touches.
                  nativeForm={false}
                />
              ) : null}
            </PreviewContextProvider>
          </ScrollablePreview.Content>
          <ScrollablePreview.Action
            title="Open"
            icon="doc.text"
            onActionPress={() => navigateToDoc(itemId)}
          />
          <ScrollablePreview.Action
            title="Delete"
            icon="trash"
            destructive
            onActionPress={() => {
              Alert.alert('Delete', 'Are you sure?', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Delete', style: 'destructive', onPress: () => handleDelete(doc) },
              ])
            }}
          />
        </ScrollablePreview.Trigger>
      )
    },
    [previewItemId, previewWidth, previewHeight, navigateToDoc, schemaMap, slug, noopSubmit, handleDelete],
  )

  return { previewItemId, setPreviewItemId, navigateToDoc, renderRow, renderDocWithPeek }
}
