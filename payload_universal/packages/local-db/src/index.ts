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

// Provider & status hooks
export { LocalDBProvider, useLocalDB, useLocalDBStatus } from './LocalDBProvider'
export type { SyncProgress } from './LocalDBProvider'

// React hooks for data access
export {
  useLocalCollection,
  useLocalDocument,
  useLocalQuery,
  useLocalMutations,
} from './hooks'
export type {
  UseLocalCollectionResult,
  UseLocalDocumentResult,
  UseLocalMutationsResult,
} from './hooks'

// Upload queue hook
export { usePendingUploads } from './useUploadQueue'
export type { UsePendingUploadsResult } from './useUploadQueue'

// Database factory (for advanced usage)
export { createLocalDB } from './database'
export type { PayloadLocalDB, CreateLocalDBArgs } from './database'

// Schema utilities
export { buildRxSchema, extractFieldDefs } from './schemaFromPayload'
export type { PayloadDoc, PayloadFieldDef, PayloadCollectionMeta } from './schemaFromPayload'

// Replication
export { startReplication } from './replication'
export type { ReplicationConfig } from './replication'

// WebSocket sync replication
export { startSyncReplication } from './syncReplication'
export type { SyncReplicationConfig, SyncReplicationState } from './syncReplication'

// Upload queue
export { UploadQueueManager, UPLOAD_QUEUE_COLLECTION } from './uploadQueue'
export type { PendingUploadItem, UploadStatus, EnqueueArgs } from './uploadQueue'

// Client-side validation & hooks
export { ClientValidatorProvider, useClientValidatorConfig } from './ClientValidatorContext'
export type { ClientValidatorProviderProps } from './ClientValidatorContext'
export { useValidatedMutations } from './validatedHooks'
export type {
  UseValidatedMutationsResult,
  ValidatedMutationResult,
  ValidatedMutationSuccess,
  ValidatedMutationFailure,
} from './validatedHooks'

// SQLite storage (drop-in replacement for rxdb trial)
export { getRxStorageSQLite, getSQLiteBasicsExpoSQLiteAsync } from './storage'
export type { SQLiteStorageSettings } from './storage'
