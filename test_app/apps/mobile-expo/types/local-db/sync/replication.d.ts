/**
 * RxDB ↔ Payload REST API replication engine.
 *
 * For each collection:
 *   Pull: GET /api/{slug}?where[updatedAt][greater_than]=checkpoint&sort=updatedAt&limit=batchSize
 *   Push: POST /api/{slug} (create) or PATCH /api/{slug}/{id} (update)
 *
 * Uses Payload's `updatedAt` as the replication checkpoint.
 * Conflict strategy: server wins (last-write-wins based on updatedAt).
 */
import { type RxReplicationState } from 'rxdb/plugins/replication';
import type { RxCollection } from 'rxdb';
import type { PayloadDoc } from '../utils/schemaFromPayload';
export type ReplicationConfig = {
    baseURL: string;
    /** Token or getter function for the latest token (supports re-auth). */
    token: string | null | (() => string | null);
    collection: RxCollection<PayloadDoc>;
    slug: string;
    /** Pull batch size. Defaults to 50. */
    batchSize?: number;
    /** Pull interval in ms. Defaults to 30000 (30s). 0 = manual only. */
    pullInterval?: number;
    /** Enable live push (react to local writes). Defaults to true. */
    livePush?: boolean;
    /** Whether this collection has drafts enabled. When true, pulls include draft documents. */
    hasDrafts?: boolean;
};
type Checkpoint = {
    updatedAt: string;
    id: string;
} | null;
export declare const startReplication: (config: ReplicationConfig) => RxReplicationState<PayloadDoc, Checkpoint>;
export {};
