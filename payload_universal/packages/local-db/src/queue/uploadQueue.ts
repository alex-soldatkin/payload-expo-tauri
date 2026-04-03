/**
 * Pending upload queue — stores files locally via expo-file-system
 * and uploads them to the Payload REST API when online.
 *
 * Each queue entry tracks: local file path, target collection, upload status,
 * the referencing document (so the upload field can be patched on success),
 * and retry metadata.
 */
import type { RxCollection, RxJsonSchema } from 'rxdb'

export type UploadStatus = 'pending' | 'uploading' | 'completed' | 'error'

export type PendingUploadItem = {
  id: string
  localUri: string
  fileName: string
  mimeType: string
  targetCollection: string
  /** JSON: { collection, docId, fieldPath } — which doc+field to patch on success */
  referencingDoc: string
  status: UploadStatus
  remoteDocId: string
  error: string
  retryCount: number
  createdAt: string
  updatedAt: string
}

export const UPLOAD_QUEUE_COLLECTION = '_pending_uploads'
const MAX_RETRIES = 5

export const uploadQueueSchema: RxJsonSchema<PendingUploadItem> = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    localUri: { type: 'string', maxLength: 1000 },
    fileName: { type: 'string', maxLength: 500 },
    mimeType: { type: 'string', maxLength: 200 },
    targetCollection: { type: 'string', maxLength: 100 },
    referencingDoc: { type: 'string', maxLength: 1000 },
    status: { type: 'string', maxLength: 20 },
    remoteDocId: { type: 'string', maxLength: 100 },
    error: { type: 'string', maxLength: 2000 },
    retryCount: { type: 'number' },
    createdAt: { type: 'string', maxLength: 50 },
    updatedAt: { type: 'string', maxLength: 50 },
  },
  required: ['id', 'localUri', 'fileName', 'mimeType', 'targetCollection', 'status', 'createdAt', 'updatedAt'],
  indexes: ['status', 'createdAt'],
}

export type EnqueueArgs = {
  localUri: string
  fileName: string
  mimeType: string
  targetCollection: string
  /** Which document field to patch when upload completes */
  referencingDoc?: { collection: string; docId: string; fieldPath: string }
}

export class UploadQueueManager {
  private collection: RxCollection<PendingUploadItem>
  private baseURL: string
  private token: string | null
  private interval: ReturnType<typeof setInterval> | null = null
  private processing = false
  /** Callback to patch a local RxDB doc when upload succeeds */
  private patchLocalDoc?: (collection: string, docId: string, fieldPath: string, value: string) => Promise<void>

  constructor(
    collection: RxCollection<PendingUploadItem>,
    baseURL: string,
    token: string | null,
    patchLocalDoc?: (collection: string, docId: string, fieldPath: string, value: string) => Promise<void>,
  ) {
    this.collection = collection
    this.baseURL = baseURL
    this.token = token
    this.patchLocalDoc = patchLocalDoc
  }

  /** Add a file to the upload queue. Returns the queue item ID. */
  async enqueue(args: EnqueueArgs): Promise<string> {
    const id = `upload-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()

    await this.collection.insert({
      id,
      localUri: args.localUri,
      fileName: args.fileName,
      mimeType: args.mimeType,
      targetCollection: args.targetCollection,
      referencingDoc: args.referencingDoc ? JSON.stringify(args.referencingDoc) : '',
      status: 'pending',
      remoteDocId: '',
      error: '',
      retryCount: 0,
      createdAt: now,
      updatedAt: now,
    })

    // Trigger immediate processing
    this.processQueue().catch(() => {})

    return id
  }

  /** Process all pending/retryable items in the queue. */
  async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    try {
      const items = await this.collection.find({
        selector: {
          $or: [
            { status: 'pending' },
            { status: 'error', retryCount: { $lt: MAX_RETRIES } },
          ],
        },
        sort: [{ createdAt: 'asc' }],
      }).exec()

      for (const rxDoc of items) {
        const item = rxDoc.toJSON() as PendingUploadItem

        // Set uploading
        await rxDoc.incrementalPatch({
          status: 'uploading',
          updatedAt: new Date().toISOString(),
        })

        try {
          // Build FormData for upload
          const formData = new FormData()
          formData.append('file', {
            uri: item.localUri,
            name: item.fileName,
            type: item.mimeType,
          } as unknown as Blob)
          formData.append('alt', item.fileName.replace(/\.[^.]+$/, ''))

          const res = await fetch(`${this.baseURL}/api/${item.targetCollection}`, {
            method: 'POST',
            headers: {
              ...(this.token ? { Authorization: `JWT ${this.token}` } : {}),
            },
            body: formData,
          })

          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            throw new Error(body.errors?.[0]?.message || `Upload failed (${res.status})`)
          }

          const data = await res.json()
          const remoteDocId = String(data.doc?.id ?? data.doc ?? '')

          // Mark completed
          await rxDoc.incrementalPatch({
            status: 'completed',
            remoteDocId,
            error: '',
            updatedAt: new Date().toISOString(),
          })

          // Patch the referencing document's field with the new remote ID
          if (item.referencingDoc && remoteDocId && this.patchLocalDoc) {
            try {
              const ref = JSON.parse(item.referencingDoc) as { collection: string; docId: string; fieldPath: string }
              await this.patchLocalDoc(ref.collection, ref.docId, ref.fieldPath, remoteDocId)
            } catch {
              // Non-fatal — the upload succeeded, just the back-reference failed
            }
          }

          // Clean up local file
          try {
            const FileSystem = await import('expo-file-system')
            await FileSystem.deleteAsync(item.localUri, { idempotent: true })
          } catch {
            // Non-fatal
          }

        } catch (err) {
          await rxDoc.incrementalPatch({
            status: 'error',
            error: err instanceof Error ? err.message : 'Upload failed',
            retryCount: item.retryCount + 1,
            updatedAt: new Date().toISOString(),
          })
        }
      }
    } finally {
      this.processing = false
    }
  }

  /** Start auto-processing on an interval. */
  startAutoProcess(intervalMs = 15_000): void {
    this.stopAutoProcess()
    this.interval = setInterval(() => this.processQueue().catch(() => {}), intervalMs)
    // Also process immediately
    this.processQueue().catch(() => {})
  }

  stopAutoProcess(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  /** Retry a specific failed item. */
  async retry(id: string): Promise<void> {
    const rxDoc = await this.collection.findOne(id).exec()
    if (rxDoc) {
      await rxDoc.incrementalPatch({
        status: 'pending',
        retryCount: 0,
        error: '',
        updatedAt: new Date().toISOString(),
      })
      this.processQueue().catch(() => {})
    }
  }

  /** Retry all failed items. */
  async retryAll(): Promise<void> {
    const failed = await this.collection.find({ selector: { status: 'error' } }).exec()
    for (const rxDoc of failed) {
      await rxDoc.incrementalPatch({
        status: 'pending',
        retryCount: 0,
        error: '',
        updatedAt: new Date().toISOString(),
      })
    }
    this.processQueue().catch(() => {})
  }

  /** Remove a queue item and its local file. */
  async remove(id: string): Promise<void> {
    const rxDoc = await this.collection.findOne(id).exec()
    if (rxDoc) {
      const item = rxDoc.toJSON() as PendingUploadItem
      try {
        const FileSystem = await import('expo-file-system')
        await FileSystem.deleteAsync(item.localUri, { idempotent: true })
      } catch { /* ignore */ }
      await rxDoc.remove()
    }
  }

  /** Remove all completed items. */
  async clearCompleted(): Promise<void> {
    const completed = await this.collection.find({ selector: { status: 'completed' } }).exec()
    for (const rxDoc of completed) {
      await rxDoc.remove()
    }
  }

  destroy(): void {
    this.stopAutoProcess()
  }
}
