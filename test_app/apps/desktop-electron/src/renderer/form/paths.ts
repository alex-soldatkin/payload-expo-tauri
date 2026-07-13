// Dot-path rules for form values, mirroring admin-native/common/utils and the
// admin-core schema map conventions:
//   - named field under a base path → `${base}.${name}`
//   - unnamed containers (row/collapsible/unnamed group/unnamed tab) are
//     transparent — children keep the container's base path
//   - array/blocks children live at `${base}.${index}.${name}`

export function subPath(basePath: string, name?: string): string {
  if (!name) return basePath
  return basePath ? `${basePath}.${name}` : name
}

/** `items.0.title` → `items.title` (condition + registry lookups ignore indexes). */
export function normalizeIndexes(path: string): string {
  return path.replace(/\.\d+(\.|$)/g, '$1')
}

/** Read a nested value by dot-path (indexes allowed). */
export function getAtPath(obj: unknown, path: string): unknown {
  if (!path) return obj
  let cur: unknown = obj
  for (const seg of path.split('.')) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

/** The sibling scope of a path — everything up to the last segment. */
export function parentPath(path: string): string {
  const i = path.lastIndexOf('.')
  return i === -1 ? '' : path.slice(0, i)
}
