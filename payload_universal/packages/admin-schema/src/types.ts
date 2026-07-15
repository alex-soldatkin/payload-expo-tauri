import type { ClientConfig, Config, ImportMap, SanitizedConfig } from 'payload'

export type SerializedSchemaMap<T> = Array<[string, T]>

/** A single configured locale (serializable subset of Payload's Locale). */
export type AdminLocale = {
  code: string
  label?: string | Record<string, string>
  rtl?: boolean
  fallbackLocale?: string
}

/** Top-level localization config, or `false` when localization is disabled. */
export type AdminLocalization =
  | {
      locales: AdminLocale[]
      defaultLocale: string
      fallback?: boolean
    }
  | false

export type AdminSchema = {
  clientConfig: ClientConfig
  collections: Record<string, SerializedSchemaMap<unknown>>
  /**
   * Field schema paths (keyed by collection/global slug) whose server config
   * declares an `admin.condition` function. Condition functions cannot
   * serialize — the affected client fields also carry an
   * `admin.hasCondition: true` marker so a client-side condition registry
   * can match by path and evaluate locally. Unnamed fields (row/collapsible)
   * use `_index-{n}` segments; block subfields use `{path}.{blockSlug}.{name}`.
   */
  conditions?: Record<string, string[]>
  generatedAt: string
  globals: Record<string, SerializedSchemaMap<unknown>>
  /** Localization config ({ locales, defaultLocale, fallback }) or false. */
  localization?: AdminLocalization
  menuModel: MenuModel
}

/**
 * Metadata for a native action menu item.
 * Mobile clients render these as toolbar/menu buttons.
 */
export type NativeActionMeta = {
  /** Unique key for this action within the collection. */
  key: string
  /** Human-readable label shown in the menu. */
  label: string
  /** SF Symbol name (iOS) / lucide icon name. */
  icon?: string
  /** Whether this action is destructive (renders in red). */
  destructive?: boolean
}

export type MenuModel = {
  groups: string[]
  collections: Array<{
    slug: string
    labels?: {
      singular?: string
      plural?: string
    }
    group?: string | null
    hidden?: boolean
    drafts?: boolean
    versions?: boolean
    useAsTitle?: string
    /** admin.defaultColumns from the config — default list columns. */
    defaultColumns?: string[]
    /** Lucide icon name (e.g. 'users', 'image', 'file-text') or raw SVG string. */
    icon?: string
    /** Custom action items for the collection list view (rendered in toolbar menu). */
    listActions?: NativeActionMeta[]
    /** Custom action items for the document edit view (rendered in toolbar menu). */
    editActions?: NativeActionMeta[]
  }>
  globals: Array<{
    slug: string
    label?: string
    group?: string | null
    hidden?: boolean
    drafts?: boolean
    /** Lucide icon name or raw SVG string. */
    icon?: string
  }>
  capabilities: {
    adminSchemaJson: boolean
  }
}

export type BuildAdminSchemaArgs = {
  /** Raw or already-sanitized Payload config (e.g. `req.payload.config`). */
  config: Config | SanitizedConfig
  importMap?: ImportMap
  language?: string
}
