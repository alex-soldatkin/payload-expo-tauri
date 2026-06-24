// ---------------------------------------------------------------------------
// User multi-picker — relationship-style searchable list over 'users'
// (local-first RxDB; REST fallback when the local collection is missing)
// ---------------------------------------------------------------------------
import React, { useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native'
import { Circle, CircleCheck } from 'lucide-react-native'
import {
  payloadApi,
  usePayloadNative,
  type ListColorPalette,
} from '@payload-universal/admin-native'
import { useLocalDB } from '@payload-universal/local-db'

import type { createStyles } from '../styles'

const userDisplayName = (doc: Record<string, unknown>): string =>
  String(doc.name ?? doc.email ?? doc.id ?? '')

export function UserMultiPicker({
  selected,
  onToggle,
  excludeId,
  colors,
  styles,
}: {
  selected: string[]
  onToggle: (id: string) => void
  /** The current user — owner is always included server-side, so hide them. */
  excludeId: string | null
  colors: ListColorPalette
  styles: ReturnType<typeof createStyles>
}) {
  const { baseURL, auth } = usePayloadNative()
  const localDB = useLocalDB()
  const usersCollection = localDB?.collections?.users
  const [search, setSearch] = useState('')
  const [docs, setDocs] = useState<Array<Record<string, unknown>>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      try {
        if (usersCollection) {
          const results = await usersCollection
            .find({ selector: { _deleted: { $eq: false } }, sort: [{ updatedAt: 'desc' }], limit: 100 })
            .exec()
          if (!cancelled) setDocs(results.map((r: any) => r.toJSON()))
        } else {
          const result = await payloadApi.find({ baseURL, token: auth.token }, 'users', {
            limit: 100,
            depth: 0,
            sort: 'email',
          })
          if (!cancelled) setDocs(result.docs)
        }
      } catch {
        if (!cancelled) setDocs([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [usersCollection, baseURL, auth.token])

  const filtered = useMemo(() => {
    const visible = docs.filter((d) => String(d.id) !== excludeId)
    if (!search.trim()) return visible
    const q = search.toLowerCase()
    return visible.filter((d) =>
      ['name', 'email', 'id'].some((f) => d[f] != null && String(d[f]).toLowerCase().includes(q)),
    )
  }, [docs, search, excludeId])

  return (
    <View>
      <TextInput
        style={styles.textInput}
        value={search}
        onChangeText={setSearch}
        placeholder="Search users…"
        placeholderTextColor={colors.textPlaceholder}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading ? (
        <ActivityIndicator style={styles.userLoading} />
      ) : filtered.length === 0 ? (
        <Text style={styles.emptyText}>No users found</Text>
      ) : (
        filtered.map((doc) => {
          const id = String(doc.id)
          const isSelected = selected.includes(id)
          return (
            <Pressable key={id} style={styles.userRow} onPress={() => onToggle(id)}>
              {isSelected ? (
                <CircleCheck size={22} color={colors.primary} />
              ) : (
                <Circle size={22} color={colors.border} />
              )}
              <Text style={[styles.rowLabel, isSelected && styles.rowLabelSelected]} numberOfLines={1}>
                {userDisplayName(doc)}
              </Text>
            </Pressable>
          )
        })
      )}
    </View>
  )
}
