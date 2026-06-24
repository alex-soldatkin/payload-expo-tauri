// ---------------------------------------------------------------------------
// Relationship value picker — minimal searchable doc list
// (local-first RxDB when available, REST fallback)
// ---------------------------------------------------------------------------
import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native'

import { usePayloadNative } from '../../PayloadNativeProvider'
import { payloadApi } from '../../utils/api'
import type { ListColorPalette } from '../../hooks/useListColors'
import type { FilterStyles } from '../types'
import { docDisplayTitle } from '../utils'

// Optional: local-first reads for the relationship doc picker
let _useLocalDB: (() => any) | null = null
try {
  _useLocalDB = require('@payload-universal/local-db').useLocalDB
} catch {
  /* local-db not available */
}

export const RelationValuePicker: React.FC<{
  relationTo: string
  multi: boolean
  value: unknown
  onChange: (v: unknown, label?: string) => void
  colors: ListColorPalette
  styles: FilterStyles
}> = ({ relationTo, multi, value, onChange, colors, styles }) => {
  const { baseURL, auth, schema } = usePayloadNative()
  const [search, setSearch] = useState('')
  const [docs, setDocs] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  const useAsTitle = schema?.menuModel?.collections.find(
    (c) => c.slug === relationTo,
  )?.useAsTitle

  const localDB = _useLocalDB ? _useLocalDB() : null
  const localCollection = localDB?.collections?.[relationTo]

  useEffect(() => {
    let cancelled = false
    const loadDocs = async () => {
      setLoading(true)
      try {
        if (localCollection) {
          const results = await localCollection
            .find({ selector: { _deleted: { $eq: false } }, sort: [{ updatedAt: 'desc' }], limit: 50 })
            .exec()
          if (!cancelled) setDocs(results.map((r: any) => r.toJSON()))
        } else {
          const result = await payloadApi.find({ baseURL, token: auth.token }, relationTo, {
            limit: 50,
            depth: 0,
            sort: '-updatedAt',
          })
          if (!cancelled) setDocs(result.docs)
        }
      } catch {
        if (!cancelled) setDocs([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadDocs()
    return () => { cancelled = true }
  }, [localCollection, baseURL, auth.token, relationTo])

  const filtered = useMemo(() => {
    if (!search.trim()) return docs
    const q = search.toLowerCase()
    return docs.filter((doc) => {
      const candidates = new Set(['title', 'name', 'email', 'filename', 'id'])
      if (useAsTitle) candidates.add(useAsTitle)
      return Array.from(candidates).some((f) => {
        const val = doc[f]
        return val != null && String(val).toLowerCase().includes(q)
      })
    })
  }, [docs, search, useAsTitle])

  const selectedIds = useMemo(
    () =>
      Array.isArray(value)
        ? value.map(String)
        : value !== '' && value != null
          ? [String(value)]
          : [],
    [value],
  )

  const handleSelect = (doc: Record<string, unknown>) => {
    const id = String(doc.id)
    const title = docDisplayTitle(doc, useAsTitle)
    if (!multi) {
      onChange(id, title)
      return
    }
    const next = selectedIds.includes(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id]
    const labels = next.map((nid) => {
      const d = docs.find((dd) => String(dd.id) === nid)
      return d ? docDisplayTitle(d, useAsTitle) : nid
    })
    onChange(next, labels.join(', ') || undefined)
  }

  return (
    <View style={styles.relationContainer}>
      <TextInput
        style={styles.textInput}
        value={search}
        onChangeText={setSearch}
        placeholder={`Search ${relationTo}...`}
        placeholderTextColor={colors.textPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading ? (
        <ActivityIndicator style={styles.relationLoading} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          style={styles.relationList}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const selected = selectedIds.includes(String(item.id))
            return (
              <Pressable
                style={[styles.row, selected && styles.rowSelected]}
                onPress={() => handleSelect(item)}
              >
                <Text
                  style={[styles.rowLabel, selected && styles.rowLabelSelected]}
                  numberOfLines={1}
                >
                  {docDisplayTitle(item, useAsTitle)}
                </Text>
                {selected && <Text style={styles.checkMark}>✓</Text>}
              </Pressable>
            )
          }}
          ListEmptyComponent={
            <Text style={styles.emptyText}>No documents found</Text>
          }
        />
      )}
    </View>
  )
}
