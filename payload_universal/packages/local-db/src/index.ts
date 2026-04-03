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
export { LocalDBProvider, useLocalDB, useLocalDBStatus } from './contexts/LocalDBProvider'
export type { SyncProgress } from './contexts/LocalDBProvider'

// React hooks for data access
export {
  useLocalCollection,
  useLocalDocument,
  useLocalQuery,
  useLocalMutations,
} from './hooks/hooks'
export type {
  UseLocalCollectionResult,
  UseLocalDocumentResult,
  UseLocalMutationsResult,
} from './hooks/hooks'

// Upload queue hook
export { usePendingUploads } from './hooks/useUploadQueue'
export type { UsePendingUploadsResult } from './hooks/useUploadQueue'

// Database factory (for advanced usage)
export { createLocalDB, resetLocalDB } from './database'
export type { PayloadLocalDB, CreateLocalDBArgs } from './database'

// Schema utilities
export { buildRxSchema, extractFieldDefs } from './utils/schemaFromPayload'
export type { PayloadDoc, PayloadFieldDef, PayloadCollectionMeta } from './utils/schemaFromPayload'

// Replication
export { startReplication } from './sync/replication'
export type { ReplicationConfig } from './sync/replication'

// WebSocket sync replication
export { startSyncReplication } from './sync/syncReplication'
export type { SyncReplicationConfig, SyncReplicationState } from './sync/syncReplication'

// Upload queue
export { UploadQueueManager, UPLOAD_QUEUE_COLLECTION } from './queue/uploadQueue'
export type { PendingUploadItem, UploadStatus, EnqueueArgs } from './queue/uploadQueue'

// Client-side validation & hooks
export { ClientValidatorProvider, useClientValidatorConfig } from './contexts/ClientValidatorContext'
export type { ClientValidatorProviderProps } from './contexts/ClientValidatorContext'
export { useValidatedMutations } from './hooks/validatedHooks'
export type {
  UseValidatedMutationsResult,
  ValidatedMutationResult,
  ValidatedMutationSuccess,
  ValidatedMutationFailure,
} from './hooks/validatedHooks'

// SQLite storage (drop-in replacement for rxdb trial)
export { getRxStorageSQLite, getSQLiteBasicsExpoSQLiteAsync } from './storage'
export type { SQLiteStorageSettings } from './storage'
