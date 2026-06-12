/**
 * Creates and manages the RxDB database instance and its collections.
 *
 * The database is initialized from the Payload admin schema:
 *   1. For each Payload collection, an RxDB collection is created
 *   2. A local _pending_uploads collection is created (not replicated)
 *   3. Replication is started for each Payload collection
 *   4. The upload queue manager is started
 */
import { type RxCollection, type RxDatabase } from 'rxdb';
import type { RxReplicationState } from 'rxdb/plugins/replication';
import type { AdminSchema } from '@payload-universal/admin-schema';
import { type PayloadDoc } from './utils/schemaFromPayload';
import { type SyncReplicationState } from './sync/syncReplication';
import { UploadQueueManager, type PendingUploadItem } from './queue/uploadQueue';
export type PayloadLocalDB = {
    db: RxDatabase;
    collections: Record<string, RxCollection<PayloadDoc>>;
    replications: Record<string, RxReplicationState<PayloadDoc, any>>;
    /** WebSocket sync state (when using sync replication) */
    syncState: SyncReplicationState | null;
    uploadCollection: RxCollection<PendingUploadItem>;
    uploadQueue: UploadQueueManager;
    /** Trigger an immediate pull for a collection */
    pullNow: (slug: string) => Promise<void>;
    /** Push all locally-modified documents now */
    pushNow: () => Promise<void>;
    /** Stop all replications and close the database */
    destroy: () => Promise<void>;
};
export type CreateLocalDBArgs = {
    /** The admin schema fetched from the server */
    schema: AdminSchema;
    /** Server base URL */
    baseURL: string;
    /** Auth token or getter function for the latest token (supports re-auth). */
    token: string | null | (() => string | null);
    /** Pull interval in ms. Defaults to 30000. Only used with polling replication. */
    pullInterval?: number;
    /** RxDB storage factory. Defaults to in-memory. Pass getRxStorageSQLite() for persistence. */
    storage?: any;
    /**
     * WebSocket URL for real-time sync (e.g. ws://localhost:3001).
     * When provided, uses WS-driven sync instead of polling.
     */
    wsURL?: string;
};
export declare const createLocalDB: ({ schema, baseURL, token, pullInterval, storage, wsURL, }: CreateLocalDBArgs) => Promise<PayloadLocalDB>;
/**
 * Completely wipe the local database and reset the singleton.
 *
 * After this call the LocalDBProvider can re-init a fresh database
 * that re-syncs everything from the server.
 *
 * @param storage - The same RxDB storage that was used to create the DB.
 *                  Required so `removeRxDatabase` can locate persisted data.
 */
export declare const resetLocalDB: (storage?: any) => Promise<void>;
