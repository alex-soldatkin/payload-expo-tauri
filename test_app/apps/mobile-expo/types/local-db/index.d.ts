/**
 * @payload-universal/local-db
 *
 * Local-first database layer for the Payload mobile admin.
 * Built on RxDB with HTTP replication to the Payload REST API.
 *
 * Architecture:
 *   Payload Server (MongoDB)
 *       ↕ HTTP replication (pull/push)
 *   RxDB (local SQLite via expo-sqlite)
 *       ↕ Reactive queries (RxJS Observables)
 *   React Native UI (instant reads, optimistic writes)
 */
export { LocalDBProvider, useLocalDB, useLocalDBStatus } from './contexts/LocalDBProvider';
export type { SyncProgress } from './contexts/LocalDBProvider';
export { useLocalCollection, useLocalDocument, useLocalQuery, useLocalMutations, } from './hooks/hooks';
export type { UseLocalCollectionResult, UseLocalDocumentResult, UseLocalMutationsResult, } from './hooks/hooks';
export { usePendingUploads } from './hooks/useUploadQueue';
export type { UsePendingUploadsResult } from './hooks/useUploadQueue';
export { createLocalDB, resetLocalDB } from './database';
export type { PayloadLocalDB, CreateLocalDBArgs } from './database';
export { buildRxSchema, extractFieldDefs } from './utils/schemaFromPayload';
export type { PayloadDoc, PayloadFieldDef, PayloadCollectionMeta } from './utils/schemaFromPayload';
export { startReplication } from './sync/replication';
export type { ReplicationConfig } from './sync/replication';
export { startSyncReplication } from './sync/syncReplication';
export type { SyncReplicationConfig, SyncReplicationState } from './sync/syncReplication';
export { UploadQueueManager, UPLOAD_QUEUE_COLLECTION } from './queue/uploadQueue';
export type { PendingUploadItem, UploadStatus, EnqueueArgs } from './queue/uploadQueue';
export { ClientValidatorProvider, useClientValidatorConfig } from './contexts/ClientValidatorContext';
export type { ClientValidatorProviderProps } from './contexts/ClientValidatorContext';
export { useValidatedMutations } from './hooks/validatedHooks';
export type { UseValidatedMutationsResult, ValidatedMutationResult, ValidatedMutationSuccess, ValidatedMutationFailure, } from './hooks/validatedHooks';
export { getRxStorageSQLite, getSQLiteBasicsExpoSQLiteAsync } from './storage';
export type { SQLiteStorageSettings } from './storage';
