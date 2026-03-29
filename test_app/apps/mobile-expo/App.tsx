/**
 * @deprecated This file is no longer the app entry point.
 * The app now uses Expo Router with file-based routing in the app/ directory.
 * Entry point is expo-router/entry (see package.json "main" field).
 *
 * This file is kept only for backwards compatibility with the legacy test suite.
 * See __tests__/App.test.tsx.
 */
import { useState } from 'react'
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native'
import { fetchAdminSchema } from '@payload-universal/admin-schema/client'

const buildSchemaPaths = (entries: Array<[string, any]>, limit = 8) =>
  entries
    .map(([path, field]) => ({
      path,
      type: field?.type || (field?.fields ? 'group' : 'unknown'),
    }))
    .slice(0, limit)

const buildRootFields = (entries: Array<[string, any]>, slug: string) => {
  const map = new Map(entries)
  const root = map.get(slug)

  if (!root || !Array.isArray(root.fields)) {
    return []
  }

  return root.fields.map((field: any) => ({
    name: field.name || '(unnamed)',
    type: field.type || 'unknown',
  }))
}

export default function App() {
  const [baseURL, setBaseURL] = useState('http://localhost:3000')
  const [language, setLanguage] = useState('')
  const [token, setToken] = useState('')
  const [schema, setSchema] = useState<any>(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const loadSchema = async () => {
    setError('')
    setStatus('Loading admin schema...')
    setLoading(true)

    try {
      const result = await fetchAdminSchema({
        baseURL,
        language: language || undefined,
        requestInit: {
          headers: token ? { Authorization: `JWT ${token}` } : undefined,
        },
      })

      setSchema(result)
      setStatus('Schema loaded successfully.')
    } catch (err) {
      setSchema(null)
      setStatus('')
      setError(err instanceof Error ? err.message : 'Failed to load schema.')
    } finally {
      setLoading(false)
    }
  }

  const collections = schema
    ? Object.entries(schema.collections).map(([slug, entries]) => ({
        slug,
        count: (entries as Array<[string, any]>).length,
        fields: buildRootFields(entries as Array<[string, any]>, slug),
        paths: buildSchemaPaths(entries as Array<[string, any]>),
      }))
    : []

  return (
    <ScrollView className="flex-1 bg-paper" contentContainerClassName="px-5 py-8">
      <Text className="text-2xl font-semibold text-ink">Admin Schema Preview</Text>
      <Text className="mt-2 text-sm text-ink-muted">Fetches /api/admin-schema and renders a basic summary.</Text>

      <View className="mt-6 rounded-2xl bg-white p-4">
        <Text className="text-xs text-ink-muted">Base URL</Text>
        <TextInput
          className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          value={baseURL}
          onChangeText={setBaseURL}
        />

        <Text className="mt-3 text-xs text-ink-muted">Language</Text>
        <TextInput
          className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          value={language}
          onChangeText={setLanguage}
          placeholder="en"
        />

        <Text className="mt-3 text-xs text-ink-muted">Auth token (optional)</Text>
        <TextInput
          className="mt-1 rounded-xl border border-neutral-200 px-3 py-2 text-sm"
          value={token}
          onChangeText={setToken}
          placeholder="JWT token"
          secureTextEntry
        />

        <TouchableOpacity className="mt-4 rounded-xl bg-black px-4 py-3" onPress={loadSchema}>
          <Text className="text-center text-sm text-white">Load schema</Text>
        </TouchableOpacity>
      </View>

      {(status || error) && (
        <View className={`mt-4 rounded-xl px-4 py-3 ${error ? 'bg-red-100' : 'bg-yellow-100'}`}>
          <Text className={`text-sm ${error ? 'text-red-800' : 'text-yellow-900'}`}>
            {error || status}
          </Text>
        </View>
      )}

      {loading && <ActivityIndicator className="mt-4" />}

      {schema && (
        <View className="mt-6">
          <View className="rounded-2xl bg-white p-4">
            <Text className="text-base font-semibold text-ink">Summary</Text>
            <Text className="mt-2 text-sm text-ink-muted">Generated at: {schema.generatedAt}</Text>
            <Text className="text-sm text-ink-muted">Collections: {Object.keys(schema.collections).length}</Text>
            <Text className="text-sm text-ink-muted">Globals: {Object.keys(schema.globals).length}</Text>
          </View>

          <Text className="mt-6 text-lg font-semibold text-ink">Collections</Text>
          {collections.length === 0 && <Text className="text-sm text-ink-muted">No entries found.</Text>}
          {collections.map((collection) => (
            <View key={collection.slug} className="mt-3 rounded-2xl bg-white p-4">
              <Text className="text-base font-semibold text-ink">{collection.slug}</Text>
              <Text className="text-xs text-ink-muted">{collection.count} schema entries</Text>
              {collection.fields.map((field) => (
                <Text key={`${collection.slug}-${field.name}`} className="mt-2 text-sm text-ink">
                  {field.name} — {field.type}
                </Text>
              ))}
              <Text className="mt-3 text-xs font-semibold text-ink">Schema paths</Text>
              {collection.paths.map((entry) => (
                <Text key={`${collection.slug}-${entry.path}`} className="mt-1 text-xs text-ink-muted">
                  {entry.path} — {entry.type}
                </Text>
              ))}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  )
}
