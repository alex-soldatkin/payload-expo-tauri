/**
 * useScanLookup — resolve a scanned barcode / QR / DataMatrix payload to a
 * document in a collection.
 *
 * Resolution order (first field with hits wins, per pass):
 *   1. Local RxDB, exact string equality (with a numeric retry for number
 *      fields — scanned payloads are always strings).
 *   2. Local RxDB, case-insensitive equality (single materialization of the
 *      collection, compared in JS so dot-path overrides work too).
 *   3. REST `equals` fallback (device online / collection not synced).
 *   4. REST `like` + JS case-insensitive equality filter ('id' is skipped —
 *      ids are canonical and `like` on id columns can error per adapter).
 *
 * Candidate fields per collection:
 *   (a) explicit override persisted under `scan_lookup_field:{slug}`;
 *   (b) heuristic names present in the schema as scannable types
 *       ('sku', 'code', 'barcode', 'serial', 'readableId', 'slug');
 *   (c) the collection's `useAsTitle` field;
 *   (d) 'id' always terminates the chain.
 * The candidate logic is exported (`getScanLookupCandidates` + the override
 * storage helpers) so a future settings UI can offer the override picker.
 */
import { useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  extractRootFields,
  getByPath,
  payloadApi,
  useAdminSchema,
  useAuth,
  useBaseURL,
  type ClientField,
  type PayloadAPIConfig,
} from '@payload-universal/admin-native'
import { useLocalDB } from '@payload-universal/local-db'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScanLookupResult =
  | { status: 'found'; doc: Record<string, unknown>; field: string }
  | { status: 'multiple'; docs: Array<Record<string, unknown>>; field: string }
  | { status: 'none' }

/** Cap for the 'multiple' picker — more than this is a mis-configured field. */
const MULTIPLE_LIMIT = 25

// ---------------------------------------------------------------------------
// Candidate-field logic (exported for the future settings/override picker UI)
// ---------------------------------------------------------------------------

/** Heuristic field names tried in priority order when no override is set. */
export const SCAN_LOOKUP_HEURISTIC_NAMES = [
  'sku',
  'code',
  'barcode',
  'serial',
  'readableId',
  'slug',
] as const

/** Field types whose values can plausibly be encoded on a label. */
export const SCANNABLE_FIELD_TYPES = new Set(['text', 'email', 'number', 'code'])

type StructuralField = ClientField & {
  fields?: ClientField[]
  tabs?: Array<{ name?: string; fields?: ClientField[] }>
}

/**
 * Flatten structural containers whose children keep the ROOT data path
 * (row / collapsible / unnamed tabs). Named groups and named tabs nest the
 * data path, so their children are only reachable via a dot-path override.
 */
const flattenRootPathFields = (fields: ClientField[]): ClientField[] => {
  const out: ClientField[] = []
  const walk = (list: ClientField[]) => {
    for (const field of list) {
      const f = field as StructuralField
      if (f.type === 'row' || f.type === 'collapsible') {
        walk(f.fields ?? [])
      } else if (f.type === 'tabs') {
        for (const tab of f.tabs ?? []) {
          if (!tab.name) walk(tab.fields ?? [])
        }
      } else {
        out.push(field)
      }
    }
  }
  walk(fields)
  return out
}

export type ScanLookupCandidateArgs = {
  /** Root client fields for the collection (`extractRootFields` output). */
  fields: ClientField[]
  /** The collection's `useAsTitle` from the menu model. */
  useAsTitle?: string
  /** Persisted per-collection override (see `getScanLookupOverride`). */
  override?: string | null
}

/**
 * Ordered, deduped lookup-field candidates for a collection.
 * Pure — usable by the settings UI to render the override picker.
 */
export const getScanLookupCandidates = (args: ScanLookupCandidateArgs): string[] => {
  const { fields, useAsTitle, override } = args
  const present = new Map<string, ClientField>()
  for (const f of flattenRootPathFields(fields)) {
    if (f.name) present.set(f.name, f)
  }

  const ordered: string[] = []
  const push = (name?: string | null) => {
    if (name && !ordered.includes(name)) ordered.push(name)
  }

  // (a) explicit override always leads — kept even when absent from the
  // schema so dot-paths into named groups/tabs work.
  push(override)

  // (b) heuristic names present in the schema as scannable types
  for (const name of SCAN_LOOKUP_HEURISTIC_NAMES) {
    const f = present.get(name)
    if (f && SCANNABLE_FIELD_TYPES.has(f.type)) push(name)
  }

  // (c) useAsTitle when it is a scannable schema field
  if (useAsTitle) {
    const f = present.get(useAsTitle)
    if (f && SCANNABLE_FIELD_TYPES.has(f.type)) push(useAsTitle)
  }

  // (d) the primary key always terminates the chain
  push('id')
  return ordered
}

// ---------------------------------------------------------------------------
// Per-collection override persistence (AsyncStorage)
// ---------------------------------------------------------------------------

export const scanLookupOverrideKey = (slug: string): string => `scan_lookup_field:${slug}`

export const getScanLookupOverride = async (slug: string): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(scanLookupOverrideKey(slug))
  } catch {
    return null
  }
}

/** Pass `null` to clear the override (heuristics take over again). */
export const setScanLookupOverride = async (
  slug: string,
  field: string | null,
): Promise<void> => {
  try {
    if (field) await AsyncStorage.setItem(scanLookupOverrideKey(slug), field)
    else await AsyncStorage.removeItem(scanLookupOverrideKey(slug))
  } catch {
    /* persistence is best-effort */
  }
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

type AnyDoc = Record<string, unknown>

const toJSONDoc = (d: unknown): AnyDoc => {
  const doc = d as { toJSON?: () => AnyDoc }
  return typeof doc?.toJSON === 'function' ? doc.toJSON() : (d as AnyDoc)
}

const toResult = (docs: AnyDoc[], field: string): ScanLookupResult | null => {
  if (docs.length === 1) return { status: 'found', doc: docs[0], field }
  if (docs.length > 1)
    return { status: 'multiple', docs: docs.slice(0, MULTIPLE_LIMIT), field }
  return null
}

/** Case-insensitive scalar equality (numbers compare via String()). */
const matchesCI = (value: unknown, lowerCode: string): boolean =>
  value != null && typeof value !== 'object' && String(value).toLowerCase() === lowerCode

type RxCollectionLike = {
  find: (query: {
    selector: Record<string, unknown>
    limit?: number
  }) => { exec: () => Promise<unknown[]> }
}

const queryLocalExact = async (
  col: RxCollectionLike,
  field: string,
  code: string,
): Promise<AnyDoc[]> => {
  const run = async (value: string | number): Promise<AnyDoc[]> => {
    const docs = await col
      .find({
        selector: { _deleted: { $eq: false }, [field]: { $eq: value } },
        limit: MULTIPLE_LIMIT + 1,
      })
      .exec()
    return docs.map(toJSONDoc)
  }
  try {
    const exact = await run(code)
    if (exact.length > 0) return exact
    // Scanned payloads are strings — retry number fields with a numeric value.
    const numeric = Number(code)
    if (code !== '' && Number.isFinite(numeric) && String(numeric) === code) {
      return await run(numeric)
    }
    return []
  } catch {
    return []
  }
}

const queryLocalAll = async (col: RxCollectionLike): Promise<AnyDoc[]> => {
  try {
    const docs = await col.find({ selector: { _deleted: { $eq: false } } }).exec()
    return docs.map(toJSONDoc)
  } catch {
    return []
  }
}

const queryRestEquals = async (
  config: PayloadAPIConfig,
  slug: string,
  field: string,
  code: string,
): Promise<AnyDoc[]> => {
  try {
    const res = await payloadApi.find(config, slug, {
      where: { [field]: { equals: code } },
      limit: MULTIPLE_LIMIT + 1,
      depth: 0,
    })
    return res.docs as AnyDoc[]
  } catch {
    return []
  }
}

const queryRestLikeCI = async (
  config: PayloadAPIConfig,
  slug: string,
  field: string,
  code: string,
): Promise<AnyDoc[]> => {
  try {
    const res = await payloadApi.find(config, slug, {
      where: { [field]: { like: code } },
      limit: 100,
      depth: 0,
    })
    const lower = code.toLowerCase()
    return (res.docs as AnyDoc[]).filter((d) => matchesCI(getByPath(d, field), lower))
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export type UseScanLookupResult = {
  /** Resolve a scanned code against a collection (local-first, REST fallback). */
  resolveScannedCode: (slug: string, code: string) => Promise<ScanLookupResult>
  /**
   * Ordered candidate lookup fields for a collection (override included) —
   * what `resolveScannedCode` will try, for settings / debugging UI.
   */
  candidatesFor: (slug: string) => Promise<string[]>
}

export function useScanLookup(): UseScanLookupResult {
  const localDB = useLocalDB()
  const schema = useAdminSchema()
  const baseURL = useBaseURL()
  const { token } = useAuth()

  const candidatesFor = useCallback(
    async (slug: string): Promise<string[]> => {
      const serialized = schema?.collections?.[slug]
      const fields = serialized ? extractRootFields(serialized, slug) : []
      const useAsTitle = schema?.menuModel?.collections.find(
        (c) => c.slug === slug,
      )?.useAsTitle
      const override = await getScanLookupOverride(slug)
      return getScanLookupCandidates({ fields, useAsTitle, override })
    },
    [schema],
  )

  const resolveScannedCode = useCallback(
    async (slug: string, rawCode: string): Promise<ScanLookupResult> => {
      const code = String(rawCode ?? '').trim()
      if (!code) return { status: 'none' }

      const candidates = await candidatesFor(slug)

      // ── Local-first: RxDB exact pass, then case-insensitive pass ──
      const col = (localDB?.collections as Record<string, RxCollectionLike> | undefined)?.[
        slug
      ]
      if (col) {
        for (const field of candidates) {
          const hit = toResult(await queryLocalExact(col, field, code), field)
          if (hit) return hit
        }

        const all = await queryLocalAll(col)
        if (all.length > 0) {
          const lower = code.toLowerCase()
          for (const field of candidates) {
            const docs = all.filter((d) => matchesCI(getByPath(d, field), lower))
            const hit = toResult(docs, field)
            if (hit) return hit
          }
        }
      }

      // ── REST fallback: equals pass, then like + case-insensitive filter ──
      if (token) {
        const config: PayloadAPIConfig = { baseURL, token }
        for (const field of candidates) {
          const hit = toResult(await queryRestEquals(config, slug, field, code), field)
          if (hit) return hit
        }
        for (const field of candidates) {
          if (field === 'id') continue
          const hit = toResult(await queryRestLikeCI(config, slug, field, code), field)
          if (hit) return hit
        }
      }

      return { status: 'none' }
    },
    [localDB, candidatesFor, baseURL, token],
  )

  return { resolveScannedCode, candidatesFor }
}
