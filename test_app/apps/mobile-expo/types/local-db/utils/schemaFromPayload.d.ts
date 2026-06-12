/**
 * Converts a Payload admin schema into RxDB collection schemas.
 *
 * Each Payload collection becomes an RxDB collection with:
 *   - `id` as the primary key (Payload uses string IDs)
 *   - `updatedAt` and `createdAt` as indexed date fields
 *   - All root-level data fields as properties (loosely typed as the
 *     Payload REST API returns full JSON documents)
 *   - `_deleted` soft-delete flag for replication
 */
import type { RxJsonSchema } from 'rxdb';
export type PayloadFieldDef = {
    name?: string;
    type: string;
    required?: boolean;
    fields?: PayloadFieldDef[];
};
export type PayloadCollectionMeta = {
    slug: string;
    fields: PayloadFieldDef[];
};
/** The RxDB document shape for any Payload collection. */
export type PayloadDoc = {
    id: string;
    createdAt: string;
    updatedAt: string;
    _deleted: boolean;
    /** True when the doc has been modified locally but not yet pushed to the server. */
    _locallyModified?: boolean;
    [key: string]: unknown;
};
/**
 * Build an RxDB JSON schema for a Payload collection.
 * Uses a permissive approach: all fields except the core ones
 * are typed as generic JSON (`{}`) so we don't need to recursively
 * map every Payload field type. The Payload REST API always returns
 * full JSON documents, and RxDB stores them as-is.
 */
export declare const buildRxSchema: (slug: string, fields: PayloadFieldDef[]) => RxJsonSchema<PayloadDoc>;
/**
 * Extract root-level field definitions from a serialized schema map entry.
 * The schema map stores the root as `map.get(slug) → { fields: [...] }`.
 */
export declare const extractFieldDefs: (serializedMap: Array<[string, unknown]>, slug: string) => PayloadFieldDef[];
