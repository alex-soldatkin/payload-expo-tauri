import React from 'react'
import { ActivityIndicator, Pressable, Text, View } from 'react-native'

import { CollectionIcon } from '../../../../CollectionIcon'
import { PreviewContextProvider } from '../../../../contexts/PreviewContext'
import { LucideIcon, type PickerPalette } from '../../shared'
import { styles } from '../styles'
import type { RelDoc, RelItem } from '../types'
import { noopSubmit } from '../utils'

/** Single-value trigger row — label (or placeholder) + chevron. */
export const SingleTrigger: React.FC<{
  palette: PickerPalette
  item: RelItem | undefined
  isDisabled: boolean | undefined
  labelFor: (it: RelItem) => string
  placeholderLabel: string
  onOpen: () => void
}> = ({ palette, item, isDisabled, labelFor, placeholderLabel, onOpen }) => (
  <Pressable
    style={styles.triggerRow}
    onPress={() => !isDisabled && onOpen()}
    disabled={isDisabled}
  >
    {item ? (
      <Text style={[styles.triggerText, { color: palette.text }]} numberOfLines={1}>{labelFor(item)}</Text>
    ) : (
      <Text style={[styles.triggerText, { color: palette.placeholder }]}>
        {`Select ${placeholderLabel}...`}
      </Text>
    )}
    <Text style={[styles.chevron, { color: palette.textMuted }]}>›</Text>
  </Pressable>
)

/**
 * hasMany trigger — selected rows with native long-press peek (read-only
 * DocumentForm), JS up/down reorder + remove actions, add row, minRows hint.
 * All state stays in RelationshipField; this is presentation only.
 */
export const ManyTrigger: React.FC<{
  palette: PickerPalette
  selectedItems: RelItem[]
  isPoly: boolean
  isDisabled: boolean | undefined
  sortable: boolean
  maxReached: boolean | undefined
  belowMin: boolean | undefined
  field: { maxRows?: number | null; minRows?: number | null }
  addLabel: string
  // peek wiring
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nativePeek: any
  insidePreview: boolean
  peekRow: { key: string; item: RelItem } | null
  peekDoc: RelDoc | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DocumentForm: React.ComponentType<any> | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  schemaFor: (slug: string) => any
  cacheKey: (it: RelItem) => string
  labelFor: (it: RelItem) => string
  collectionLabel: (slug: string, plural?: boolean) => string
  collectionMeta: (slug: string) => { icon?: string } | undefined
  canPreviewFor: (slug: string) => boolean
  setPeekRow: (v: { key: string; item: RelItem } | null) => void
  setPeekRowIfMatch: (key: string) => void
  onMove: (index: number, delta: number) => void
  onRemove: (index: number) => void
  onAdd: () => void
}> = ({
  palette, selectedItems, isPoly, isDisabled, sortable, maxReached, belowMin,
  field, addLabel, nativePeek, insidePreview, peekRow, peekDoc, DocumentForm,
  schemaFor, cacheKey, labelFor, collectionLabel, collectionMeta, canPreviewFor,
  setPeekRow, setPeekRowIfMatch, onMove, onRemove, onAdd,
}) => (
  <View>
    {selectedItems.map((it, i) => {
      const rowKey = `${cacheKey(it)}-${i}`
      // Leading row content (icon + title + badge). The action buttons stay
      // OUTSIDE the peek trigger so their Pressables never fight the native
      // long-press/tap recognizers.
      const rowMain = (
        <View style={styles.valueMain}>
          <CollectionIcon icon={collectionMeta(it.relationTo)?.icon} size={16} color={palette.textMuted} />
          <Text style={[styles.valueTitle, { color: palette.text }]} numberOfLines={1}>{labelFor(it)}</Text>
          {isPoly && (
            <Text style={[styles.valueBadge, { color: palette.placeholder }]}>{collectionLabel(it.relationTo)}</Text>
          )}
        </View>
      )
      // Native long-press peek: read-only DocumentForm of the related doc.
      // Fallback-safe — plain row when no module/schema or inside a preview.
      const canPeek = nativePeek != null && !insidePreview && canPreviewFor(it.relationTo)
      const isPeekOpen = peekRow?.key === rowKey
      const peekSchemaMap = schemaFor(it.relationTo)
      return (
        // Borderless value row (row contract: NO field-owned hairlines —
        // FormSection is the only separator owner). 44pt min tap target.
        <View key={rowKey} style={styles.valueRow}>
          <View style={styles.valueMainWrap}>
            {canPeek ? (
              <nativePeek.Trigger
                onPreviewOpen={() => setPeekRow({ key: rowKey, item: it })}
                onPreviewClose={() => setPeekRowIfMatch(rowKey)}
              >
                {rowMain}
                <nativePeek.Content>
                  <PreviewContextProvider value={true}>
                    {isPeekOpen && peekDoc && DocumentForm && peekSchemaMap ? (
                      <DocumentForm
                        schemaMap={peekSchemaMap}
                        slug={it.relationTo}
                        initialData={peekDoc}
                        onSubmit={noopSubmit}
                        disabled
                        // Peek content mounts in an unsized native container —
                        // a zero-height SwiftUI Form swallows touches.
                        nativeForm={false}
                      />
                    ) : (
                      <View style={styles.peekLoading}>
                        <ActivityIndicator />
                      </View>
                    )}
                  </PreviewContextProvider>
                </nativePeek.Content>
                {!isDisabled && (
                  <nativePeek.Action
                    title="Remove"
                    icon="minus.circle"
                    destructive
                    onActionPress={() => onRemove(i)}
                  />
                )}
              </nativePeek.Trigger>
            ) : (
              rowMain
            )}
          </View>
          {!isDisabled && (
            <View style={styles.valueActions}>
              {sortable && selectedItems.length > 1 && (
                <>
                  <Pressable onPress={() => onMove(i, -1)} disabled={i === 0} hitSlop={6} style={i === 0 && styles.actionDisabled}>
                    <LucideIcon name="ChevronUp" size={18} color={palette.textMuted} />
                  </Pressable>
                  <Pressable onPress={() => onMove(i, 1)} disabled={i === selectedItems.length - 1} hitSlop={6} style={i === selectedItems.length - 1 && styles.actionDisabled}>
                    <LucideIcon name="ChevronDown" size={18} color={palette.textMuted} />
                  </Pressable>
                </>
              )}
              <Pressable onPress={() => onRemove(i)} hitSlop={6}>
                <LucideIcon name="X" size={16} color={palette.textMuted} />
              </Pressable>
            </View>
          )}
        </View>
      )
    })}
    <Pressable
      style={[styles.addRow, (isDisabled || maxReached) && styles.actionDisabled]}
      onPress={() => { if (!isDisabled && !maxReached) onAdd() }}
      disabled={isDisabled || maxReached}
    >
      <LucideIcon name="Plus" size={16} color={palette.textMuted} />
      <Text style={[styles.addText, { color: palette.textMuted }]}>
        {maxReached ? `Maximum of ${field.maxRows} selected` : `Add ${addLabel}...`}
      </Text>
    </Pressable>
    {belowMin && (
      <Text style={[styles.minHint, { color: palette.placeholder }]}>
        {`Select at least ${field.minRows}`}
      </Text>
    )}
  </View>
)
