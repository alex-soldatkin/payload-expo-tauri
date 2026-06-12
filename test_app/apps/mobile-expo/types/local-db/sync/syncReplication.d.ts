/**
 * WebSocket-driven sync — PULL ONLY.
 *
 * Receives real-time change notifications from the server via WebSocket.
 * When a change is received, fetches the full doc via /sync/pull and
 * upserts it into the local RxDB.
 *
 * Push is handled by the polling replication (replication.ts) which
 * uses RxDB's built-in push handler with proper conflict detection.
 * This avoids the infinite loop caused by having two independent push paths.
 */
import type { RxCollection } from 'rxdb';
import type { PayloadDoc } from '../utils/schemaFromPayload';
export type SyncReplicationConfig = {
    baseURL: string;
    wsURL: string;
    token: string | null | (() => string | null);
    collections: Record<string, RxCollection<PayloadDoc>>;
};
export type SyncReplicationState = {
    destroy: () => void;
    readonly connected: boolean;
    /**
     * Push all locally-modified documents now. The WS sync is pull-only
     * (push is handled by the polling replication), so this is not provided
     * by startSyncReplication — callers must guard before invoking.
     */
    pushNow?: () => Promise<void>;
};
export declare function startSyncReplication(config: SyncReplicationConfig): SyncReplicationState;
