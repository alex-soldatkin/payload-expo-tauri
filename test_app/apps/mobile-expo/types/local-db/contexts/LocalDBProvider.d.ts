/**
 * React context provider for the local RxDB database + upload queue.
 *
 * LOCAL-FIRST: The database is made available to consumers as soon as it's
 * created (before replication completes). Persisted SQLite data is available
 * instantly. Replication syncs in the background without blocking the UI.
 */
import React from 'react';
import type { AdminSchema } from '@payload-universal/admin-schema';
import { type PayloadLocalDB } from '../database';
export type SyncProgress = {
    /** Total collections being synced */
    total: number;
    /** Number of collections finished syncing */
    completed: number;
    /** Currently syncing collection slug (or null if idle) */
    current: string | null;
    /** Overall percentage 0-100 */
    percent: number;
};
export declare const useLocalDB: () => PayloadLocalDB | null;
export declare const useLocalDBStatus: () => {
    isReady: boolean;
    error: string | null;
    syncStatus: "error" | "idle" | "syncing" | "offline";
    syncProgress: SyncProgress;
    resetAndResync: () => Promise<void>;
    isResetting: boolean;
};
type Props = {
    children: React.ReactNode;
    schema: AdminSchema | null;
    baseURL: string;
    token: string | null;
    /** Pull interval in ms. Defaults to 30000. Only used without wsURL. */
    pullInterval?: number;
    /** Custom RxDB storage. Defaults to in-memory. */
    storage?: any;
    /** WebSocket URL for real-time sync. When provided, uses WS instead of polling. */
    wsURL?: string;
    /** Called when sync progress changes (for toast / splash UI). */
    onSyncProgress?: (progress: SyncProgress) => void;
    /** Called when sync completes. */
    onSyncComplete?: () => void;
    /** Called when a background sync receives new documents. */
    onSyncUpdate?: (collection: string, count: number) => void;
};
export declare const LocalDBProvider: React.FC<Props>;
export {};
