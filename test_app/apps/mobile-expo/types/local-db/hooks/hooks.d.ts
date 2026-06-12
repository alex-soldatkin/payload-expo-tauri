import type { MangoQuery } from 'rxdb';
import type { PayloadDoc } from '../utils/schemaFromPayload';
import type { PayloadLocalDB } from '../database';
export type UseLocalCollectionResult = {
    docs: PayloadDoc[];
    totalDocs: number;
    loading: boolean;
    error: string | null;
    refetch: () => void;
    page: number;
    setPage: (p: number) => void;
    hasNextPage: boolean;
};
export declare const useLocalCollection: (localDB: PayloadLocalDB | null, slug: string, options?: {
    limit?: number;
    sort?: string;
    where?: Record<string, unknown>;
}) => UseLocalCollectionResult;
export type UseLocalDocumentResult = {
    doc: PayloadDoc | null;
    loading: boolean;
    error: string | null;
    /** Update the document locally (optimistic — will sync to server). */
    update: (data: Partial<PayloadDoc>) => Promise<void>;
    /** Delete the document locally (will sync to server). */
    remove: () => Promise<void>;
};
export declare const useLocalDocument: (localDB: PayloadLocalDB | null, slug: string, id: string | null) => UseLocalDocumentResult;
export declare const useLocalQuery: (localDB: PayloadLocalDB | null, slug: string, mangoQuery: MangoQuery<PayloadDoc>) => {
    docs: PayloadDoc[];
    loading: boolean;
};
export type UseLocalMutationsResult = {
    /**
     * Insert a new document into the local DB.
     * Generates a client-side ID and returns it immediately.
     * The replication engine will push the document to the server in the background.
     */
    create: (data: Record<string, unknown>) => Promise<string>;
    /**
     * Patch an existing document locally.
     * Replication will push the changes to the server.
     */
    update: (id: string, data: Record<string, unknown>) => Promise<void>;
    /**
     * Soft-delete a document locally.
     * Replication will send a DELETE request to the server.
     */
    remove: (id: string) => Promise<void>;
};
export declare const useLocalMutations: (localDB: PayloadLocalDB | null, slug: string) => UseLocalMutationsResult;
