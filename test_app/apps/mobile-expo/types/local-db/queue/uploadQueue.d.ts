/**
 * Pending upload queue — stores files locally via expo-file-system
 * and uploads them to the Payload REST API when online.
 *
 * Each queue entry tracks: local file path, target collection, upload status,
 * the referencing document (so the upload field can be patched on success),
 * and retry metadata.
 */
import type { RxCollection, RxJsonSchema } from 'rxdb';
export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'error';
export type PendingUploadItem = {
    id: string;
    localUri: string;
    fileName: string;
    mimeType: string;
    targetCollection: string;
    /** JSON: { collection, docId, fieldPath } — which doc+field to patch on success */
    referencingDoc: string;
    status: UploadStatus;
    remoteDocId: string;
    error: string;
    retryCount: number;
    createdAt: string;
    updatedAt: string;
};
export declare const UPLOAD_QUEUE_COLLECTION = "_pending_uploads";
export declare const uploadQueueSchema: RxJsonSchema<PendingUploadItem>;
export type EnqueueArgs = {
    localUri: string;
    fileName: string;
    mimeType: string;
    targetCollection: string;
    /** Which document field to patch when upload completes */
    referencingDoc?: {
        collection: string;
        docId: string;
        fieldPath: string;
    };
};
export declare class UploadQueueManager {
    private collection;
    private baseURL;
    /** Token or getter function for the latest token (supports re-auth). */
    private token;
    private interval;
    private processing;
    /** Callback to patch a local RxDB doc when upload succeeds */
    private patchLocalDoc?;
    constructor(collection: RxCollection<PendingUploadItem>, baseURL: string, token: string | null | (() => string | null), patchLocalDoc?: (collection: string, docId: string, fieldPath: string, value: string) => Promise<void>);
    /** Always resolve the latest token (supports re-auth after logout/login). */
    private getToken;
    /** Add a file to the upload queue. Returns the queue item ID. */
    enqueue(args: EnqueueArgs): Promise<string>;
    /** Process all pending/retryable items in the queue. */
    processQueue(): Promise<void>;
    /** Start auto-processing on an interval. */
    startAutoProcess(intervalMs?: number): void;
    stopAutoProcess(): void;
    /** Retry a specific failed item. */
    retry(id: string): Promise<void>;
    /** Retry all failed items. */
    retryAll(): Promise<void>;
    /** Remove a queue item and its local file. */
    remove(id: string): Promise<void>;
    /** Remove all completed items. */
    clearCompleted(): Promise<void>;
    destroy(): void;
}
