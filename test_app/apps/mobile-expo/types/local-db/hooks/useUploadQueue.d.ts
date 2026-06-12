import type { PendingUploadItem } from '../queue/uploadQueue';
import type { PayloadLocalDB } from '../database';
export type UsePendingUploadsResult = {
    items: PendingUploadItem[];
    pendingCount: number;
    uploadingCount: number;
    completedCount: number;
    errorCount: number;
    isProcessing: boolean;
    retry: (id: string) => Promise<void>;
    retryAll: () => Promise<void>;
    remove: (id: string) => Promise<void>;
    clearCompleted: () => Promise<void>;
};
export declare const usePendingUploads: (localDB: PayloadLocalDB | null) => UsePendingUploadsResult;
