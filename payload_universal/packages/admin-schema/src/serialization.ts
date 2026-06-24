import type { SerializedSchemaMap } from './types'

export const serializeSchemaMap = <T>(map: Map<string, T>): SerializedSchemaMap<T> => {
  return Array.from(map.entries())
}

export const deserializeSchemaMap = <T>(entries: SerializedSchemaMap<T>): Map<string, T> => {
  return new Map(entries)
}
