/**
 * MentionPicker — BottomSheet picker for document mentions in the rich text editor.
 *
 * Activated when the user types `@` in a rich text field. Queries all user-facing
 * collections from the local RxDB database (with REST API fallback) and displays
 * results grouped by collection. Selecting a result inserts a document mention.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { defaultTheme as t } from '../theme'
import { BottomSheet } from '../BottomSheet'
import { usePayloadNative } from '../PayloadNativeProvider'
import { CollectionIcon } from '../CollectionIcon'
import { payloadApi } from '../utils/api'

// Optional: GlassView for liquid glass effect on result cards (iOS 26+)
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

// Optional: local-db for offline-first querying
let _useLocalDB: (() => any) | null = null
try {
  _useLocalDB = require('@payload-universal/local-db').useLocalDB
} catch { /* local-db not available */ }

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MentionItem = {
  collection: string
  id: string
  title: string
}

type MentionResult = MentionItem & {
  /** Collection display label for the badge. */
  collectionLabel: string
  /** Collection icon string from menuModel. */
  collectionIcon?: string
}

type SectionData = {
  slug: string
  label: string
  icon?: string
  data: MentionResult[]
}

type Props = {
  visible: boolean
  /** Current search text from the onChangeMention event (text after `@`). */
  searchText: string
  /** Called when the user selects a document to mention. */
  onSelect: (item: MentionItem) => void
  /** Called when the picker should be dismissed without selection. */
  onDismiss: () => void
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PER_COLLECTION_LIMIT = 20
const TOTAL_LIMIT = 50
const DEBOUNCE_MS = 200

/** Derive a display title from a document using the collection's useAsTitle field. */
const docTitle = (doc: Record<string, unknown>, useAsTitle?: string): string => {
  if (useAsTitle && doc[useAsTitle] != null) return String(doc[useAsTitle])
  return String(doc.title ?? doc.name ?? doc.email ?? doc.id ?? '')
}

/** Derive the singular label for a collection from its menuModel entry. */
const collectionLabel = (entry: {
  slug: string
  labels?: { singular?: string; plural?: string }
}): string => {
  if (entry.labels?.singular) return entry.labels.singular
  // Capitalise slug as fallback
  return entry.slug.charAt(0).toUpperCase() + entry.slug.slice(1)
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const MentionPicker: React.FC<Props> = ({
  visible,
  searchText: externalSearchText,
  onSelect,
  onDismiss,
}) => {
  const { baseURL, auth, schema } = usePayloadNative()
  const localDB = _useLocalDB ? _useLocalDB() : null

  // Local search state — initialised from the external searchText prop
  const [search, setSearch] = useState(externalSearchText)
  const [results, setResults] = useState<MentionResult[]>([])
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync external searchText into local state when it changes
  useEffect(() => {
    setSearch(externalSearchText)
  }, [externalSearchText])

  // Visible (non-hidden) collections derived from menuModel
  const visibleCollections = useMemo(() => {
    if (!schema?.menuModel?.collections) return []
    return schema.menuModel.collections.filter((c: any) => !c.hidden)
  }, [schema])

  // ---- Search logic (debounced) ----

  const performSearch = useCallback(async (query: string) => {
    if (!visibleCollections.length) {
      setResults([])
      return
    }

    setLoading(true)

    try {
      const allResults: MentionResult[] = []
      const q = query.trim().toLowerCase()

      // Search each collection in parallel
      const promises = visibleCollections.map(async (col: any) => {
        const useAsTitle: string | undefined = col.useAsTitle
        const label = collectionLabel(col)
        const slug: string = col.slug

        let docs: Array<Record<string, unknown>> = []

        try {
          const localCollection = localDB?.collections?.[slug]

          if (localCollection) {
            // Local-first: query RxDB
            if (q.length > 0 && useAsTitle) {
              // Use $regex for the useAsTitle field
              const rxDocs = await localCollection.find({
                selector: {
                  _deleted: { $eq: false },
                  [useAsTitle]: { $regex: new RegExp(q, 'i') },
                },
                limit: PER_COLLECTION_LIMIT,
              }).exec()
              docs = rxDocs.map((r: any) => r.toJSON())
            } else {
              // No search text or no useAsTitle — fetch all and filter in JS
              const rxDocs = await localCollection.find({
                selector: { _deleted: { $eq: false } },
                sort: [{ updatedAt: 'desc' }],
                limit: PER_COLLECTION_LIMIT,
              }).exec()
              const allDocs = rxDocs.map((r: any) => r.toJSON())
              if (q.length > 0) {
                docs = allDocs.filter((doc: Record<string, unknown>) =>
                  docTitle(doc, useAsTitle).toLowerCase().includes(q),
                )
              } else {
                docs = allDocs
              }
            }
          } else {
            // Fallback: REST API search
            const titleField = useAsTitle || 'title'
            const where = q.length > 0
              ? { [titleField]: { like: q } }
              : undefined
            const result = await payloadApi.find(
              { baseURL, token: auth.token },
              slug,
              { limit: PER_COLLECTION_LIMIT, depth: 0, sort: '-updatedAt', where },
            )
            docs = result.docs
          }
        } catch {
          // Silently skip collections that fail to query
          docs = []
        }

        return docs.map((doc) => ({
          collection: slug,
          id: String(doc.id),
          title: docTitle(doc, useAsTitle),
          collectionLabel: label,
          collectionIcon: col.icon,
        }))
      })

      const perCollectionResults = await Promise.all(promises)

      for (const batch of perCollectionResults) {
        for (const item of batch) {
          if (allResults.length >= TOTAL_LIMIT) break
          allResults.push(item)
        }
        if (allResults.length >= TOTAL_LIMIT) break
      }

      setResults(allResults)
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [visibleCollections, localDB, baseURL, auth.token])

  // Debounced search trigger
  useEffect(() => {
    if (!visible) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      performSearch(search)
    }, DEBOUNCE_MS)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search, visible, performSearch])

  // Reset state when sheet closes
  useEffect(() => {
    if (!visible) {
      setResults([])
      setLoading(false)
    }
  }, [visible])

  // ---- Group results by collection for section rendering ----

  const sections = useMemo<SectionData[]>(() => {
    const map = new Map<string, SectionData>()
    for (const item of results) {
      let section = map.get(item.collection)
      if (!section) {
        section = {
          slug: item.collection,
          label: item.collectionLabel,
          icon: item.collectionIcon,
          data: [],
        }
        map.set(item.collection, section)
      }
      section.data.push(item)
    }
    return Array.from(map.values())
  }, [results])

  // Flatten sections into a single list with section headers for FlatList
  const flatData = useMemo(() => {
    const items: Array<{ type: 'header'; section: SectionData } | { type: 'item'; item: MentionResult }> = []
    for (const section of sections) {
      items.push({ type: 'header', section })
      for (const item of section.data) {
        items.push({ type: 'item', item })
      }
    }
    return items
  }, [sections])

  // ---- Handlers ----

  const handleSelect = useCallback((item: MentionResult) => {
    onSelect({
      collection: item.collection,
      id: item.id,
      title: item.title,
    })
  }, [onSelect])

  // ---- Render ----

  const renderRow = useCallback(({ item: row }: { item: typeof flatData[number] }) => {
    if (row.type === 'header') {
      return (
        <View style={styles.sectionHeader}>
          <CollectionIcon icon={row.section.icon} size={16} color={t.colors.textMuted} />
          <Text style={styles.sectionLabel}>{row.section.label}</Text>
        </View>
      )
    }

    const { item } = row

    const content = (
      <>
        <Text style={styles.itemTitle} numberOfLines={1}>{item.title}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{item.collectionLabel}</Text>
        </View>
      </>
    )

    if (liquidGlassAvailable && GlassView) {
      return (
        <Pressable onPress={() => handleSelect(item)}>
          <GlassView style={styles.glassItemRow} glassEffectStyle="regular" isInteractive>
            {content}
          </GlassView>
        </Pressable>
      )
    }

    return (
      <Pressable style={styles.itemRow} onPress={() => handleSelect(item)}>
        {content}
      </Pressable>
    )
  }, [handleSelect])

  const keyExtractor = useCallback(
    (row: typeof flatData[number], index: number) =>
      row.type === 'header' ? `header-${row.section.slug}` : `${row.item.collection}-${row.item.id}`,
    [],
  )

  return (
    <BottomSheet visible={visible} onClose={onDismiss} height={0.6}>
      <Text style={styles.sheetTitle}>Mention a document</Text>
      <TextInput
        style={styles.searchInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search across collections..."
        placeholderTextColor={t.colors.textPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
      />
      {loading && <ActivityIndicator style={styles.loader} />}
      <FlatList
        data={flatData}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          !loading ? (
            <Text style={styles.emptyText}>
              {search.trim().length > 0 ? 'No matching documents' : 'Type to search...'}
            </Text>
          ) : null
        }
      />
    </BottomSheet>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  sheetTitle: {
    fontSize: t.fontSize.lg,
    fontWeight: '700',
    color: t.colors.text,
    marginBottom: t.spacing.md,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    fontSize: t.fontSize.md,
    color: t.colors.text,
    marginBottom: t.spacing.md,
  },
  loader: {
    marginVertical: t.spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: t.spacing.sm,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.xs,
    marginTop: t.spacing.sm,
  },
  sectionLabel: {
    fontSize: t.fontSize.sm,
    fontWeight: '600',
    color: t.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: t.colors.separator,
  },
  glassItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: t.spacing.md,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.borderRadius.sm,
    marginVertical: 2,
  },
  itemTitle: {
    flex: 1,
    fontSize: t.fontSize.md,
    color: t.colors.text,
  },
  badge: {
    backgroundColor: t.colors.background,
    borderRadius: 10,
    paddingHorizontal: t.spacing.sm,
    paddingVertical: 2,
    marginLeft: t.spacing.sm,
  },
  badgeText: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
    fontWeight: '500',
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: t.spacing.xl,
    color: t.colors.textMuted,
    fontSize: t.fontSize.sm,
  },
})
