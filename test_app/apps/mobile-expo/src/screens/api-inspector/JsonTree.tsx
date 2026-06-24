// ---------------------------------------------------------------------------
// JSON tree — pure JS, chevron-expandable, monospace, type-colored values
// ---------------------------------------------------------------------------
import React, { useState } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'

const MONO = Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' })

export type JsonPalette = {
  key: string
  string: string
  number: string
  boolean: string
  null: string
  punct: string
  chevron: string
}

export const lightJson: JsonPalette = {
  key: '#0550ae',
  string: '#a3262c',
  number: '#6f42c1',
  boolean: '#bc4c00',
  null: '#8E8E93',
  punct: '#6e7781',
  chevron: '#8E8E93',
}

export const darkJson: JsonPalette = {
  key: '#79c0ff',
  string: '#ffa198',
  number: '#d2a8ff',
  boolean: '#ffab70',
  null: '#8E8E93',
  punct: '#8b949e',
  chevron: '#8E8E93',
}

const leafColor = (value: unknown, p: JsonPalette): string => {
  if (value === null) return p.null
  switch (typeof value) {
    case 'string':
      return p.string
    case 'number':
      return p.number
    case 'boolean':
      return p.boolean
    default:
      return p.punct
  }
}

const leafText = (value: unknown): string => {
  if (value === null) return 'null'
  if (typeof value === 'string') return JSON.stringify(value)
  return String(value)
}

export const JsonNode: React.FC<{
  name: string | null
  value: unknown
  depth: number
  palette: JsonPalette
}> = ({ name, value, depth, palette }) => {
  // Root + first level start expanded; deeper nodes start collapsed.
  const [expanded, setExpanded] = useState(depth < 2)

  const isArray = Array.isArray(value)
  const isObject = value !== null && typeof value === 'object'

  const keyLabel = name !== null ? (
    <Text style={[jsonStyles.mono, { color: palette.key }]}>
      {JSON.stringify(name)}
      <Text style={{ color: palette.punct }}>: </Text>
    </Text>
  ) : null

  if (!isObject) {
    return (
      <View style={[jsonStyles.row, { paddingLeft: depth * 14 }]}>
        <Text style={jsonStyles.mono} numberOfLines={3}>
          {keyLabel}
          <Text style={[jsonStyles.mono, { color: leafColor(value, palette) }]}>
            {leafText(value)}
          </Text>
        </Text>
      </View>
    )
  }

  const entries: Array<[string | null, unknown]> = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as [string, unknown])
    : Object.entries(value as Record<string, unknown>)
  const summary = isArray
    ? `[${entries.length}]`
    : `{${entries.length} ${entries.length === 1 ? 'key' : 'keys'}}`

  return (
    <View>
      <Pressable
        style={[jsonStyles.row, { paddingLeft: depth * 14 }]}
        onPress={() => setExpanded((e) => !e)}
        hitSlop={4}
      >
        <Text style={[jsonStyles.chevron, { color: palette.chevron }]}>
          {expanded ? '▾' : '▸'}
        </Text>
        <Text style={jsonStyles.mono} numberOfLines={1}>
          {keyLabel}
          <Text style={[jsonStyles.mono, { color: palette.punct }]}>
            {expanded ? (isArray ? '[' : '{') : summary}
          </Text>
        </Text>
      </Pressable>
      {expanded && (
        <>
          {entries.map(([k, v], i) => (
            <JsonNode key={`${k}-${i}`} name={k} value={v} depth={depth + 1} palette={palette} />
          ))}
          <View style={[jsonStyles.row, { paddingLeft: depth * 14 }]}>
            <Text style={[jsonStyles.mono, { color: palette.punct }]}>
              {isArray ? ']' : '}'}
            </Text>
          </View>
        </>
      )}
    </View>
  )
}

const jsonStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 1,
  },
  mono: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 18,
  },
  chevron: {
    fontFamily: MONO,
    fontSize: 12,
    lineHeight: 18,
    width: 14,
  },
})
