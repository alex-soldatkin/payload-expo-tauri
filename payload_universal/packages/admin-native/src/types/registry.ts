import type React from 'react'

import type { FieldComponentProps } from './fields'

// ---------------------------------------------------------------------------
// Custom component override types
// ---------------------------------------------------------------------------

/** Slots where a custom component can override the default rendering. */
export type ComponentSlot = 'Field' | 'Cell' | 'Label' | 'Description' | 'Error' | 'RowLabel'

/**
 * A custom field entry in the registry.
 * Can provide overrides for individual slots (Field, Cell, Label, etc.)
 * and injection points (beforeInput, afterInput).
 */
export type CustomFieldEntry = {
  Field?: React.ComponentType<FieldComponentProps>
  Cell?: React.ComponentType<any>
  Label?: React.ComponentType<any>
  Description?: React.ComponentType<any>
  Error?: React.ComponentType<any>
  /**
   * Custom array-row label (codegen registry slot). Rendered inside
   * RowLabelContext; also receives { data, index, rowNumber, path } props.
   */
  RowLabel?: React.ComponentType<any>
  beforeInput?: React.ComponentType<any>[]
  afterInput?: React.ComponentType<any>[]
}

/**
 * Registry of custom component overrides.
 *
 * - `fields`: Keyed by "collectionSlug.fieldPath" (e.g. "posts.title")
 *   or just "fieldPath" for global overrides. Values are either a bare
 *   component (treated as a Field slot override) or a CustomFieldEntry.
 *
 * - `views`: Custom collection/global views keyed by
 *   "collectionSlug.viewKey" (e.g. "posts.Edit.CustomTab").
 *
 * - `admin`: Admin-level overrides keyed by slot name
 *   (e.g. "Nav", "beforeDashboard", "afterDashboard").
 */
export type CustomComponentRegistry = {
  fields: Record<string, CustomFieldEntry | React.ComponentType<any>>
  views: Record<string, { Component: React.ComponentType<any>; tab?: { label: string } }>
  admin: Record<string, React.ComponentType<any>>
  /**
   * Custom action components for collection list views, keyed by collection slug.
   * Each entry has a `component` (transpiled from Payload's `admin.components.listMenuItems`)
   * and a `label` extracted from the web component's button text during codegen.
   */
  listActions?: Record<string, Array<{ component: React.ComponentType<any>; label?: string }>>
  /**
   * Custom action components for document edit views, keyed by collection slug.
   * Transpiled from `admin.components.edit.editMenuItems`.
   */
  editActions?: Record<string, Array<{ component: React.ComponentType<any>; label?: string }>>
}

// ---------------------------------------------------------------------------
// Native action items (collection-level custom action buttons)
// ---------------------------------------------------------------------------

/**
 * Context provided to list action handlers.
 */
export type ListActionContext = {
  collectionSlug: string
  /** IDs of currently selected documents. Empty if nothing selected. */
  selectedIds: string[]
  /** All currently visible documents. */
  allDocs: Record<string, unknown>[]
  /** Local RxDB instance (may be null if DB not ready). */
  localDB: any
  /** Payload REST API base URL. */
  baseURL: string
  /** Current auth token. */
  token: string | null
}

/**
 * Context provided to edit action handlers.
 */
export type EditActionContext = {
  collectionSlug: string
  documentId: string
  /** The current document data. */
  doc: Record<string, unknown>
  /** Local RxDB instance (may be null if DB not ready). */
  localDB: any
  /** Payload REST API base URL. */
  baseURL: string
  /** Current auth token. */
  token: string | null
}

/** A handler function for a native action. */
export type ActionHandler<Ctx = ListActionContext | EditActionContext> =
  (context: Ctx) => void | Promise<void>

/**
 * Registry of action handlers defined in the mobile app (Metro-bundled).
 *
 * Keyed by collection slug → action key → handler function.
 * Defined per-app (like client validators), not serialized in JSON.
 */
export type ActionHandlerRegistry = {
  [collectionSlug: string]: {
    list?: Record<string, ActionHandler<ListActionContext>>
    edit?: Record<string, ActionHandler<EditActionContext>>
  }
}
