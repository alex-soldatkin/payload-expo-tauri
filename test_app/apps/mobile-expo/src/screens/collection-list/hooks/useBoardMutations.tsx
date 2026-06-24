/**
 * Local-first mutations for the collection-list screen — kanban card moves,
 * gantt date edits, swipe-to-delete and shake-to-undo. All optimistic, all
 * routed through the same validated mutation pipeline. Extracted verbatim from
 * the route file.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { DeviceMotion } from 'expo-sensors'
import {
  setByPath,
  useToast,
  type CalendarSource,
  type ClientField,
  type KanbanStatusField,
} from '@payload-universal/admin-native'
import { useLocalDB, useValidatedMutations } from '@payload-universal/local-db'
import { SHAKE_THRESHOLD } from '../utils'

type LocalDB = ReturnType<typeof useLocalDB>

export type UseBoardMutationsArgs = {
  localDB: LocalDB
  slug: string
  rootFields: ClientField[]
  kanbanStatusField: KanbanStatusField | null
  remove: (id: string) => Promise<unknown>
  isPreview: boolean
}

export function useBoardMutations({
  localDB,
  slug,
  rootFields,
  kanbanStatusField,
  remove,
  isPreview,
}: UseBoardMutationsArgs) {
  const toast = useToast()

  // ── Card moves — optimistic local-first patch via validated mutations ──
  const { update: validatedUpdate } = useValidatedMutations(localDB, slug, rootFields)
  const [movingDocIds, setMovingDocIds] = useState<string[]>([])

  const handleMoveCard = useCallback(
    async (doc: Record<string, unknown>, toValue: string | null) => {
      if (!kanbanStatusField) return
      const id = String(doc.id)
      setMovingDocIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      try {
        const result = await validatedUpdate(id, { [kanbanStatusField.name]: toValue }, doc)
        if (result.success === false) {
          const firstError = result.errors._form ?? Object.values(result.errors)[0]
          toast.showToast(
            typeof firstError === 'string' ? firstError : 'Move failed',
            { type: 'error', icon: 'error' },
          )
        }
      } catch {
        toast.showToast('Move failed', { type: 'error', icon: 'error' })
      } finally {
        setMovingDocIds((prev) => prev.filter((x) => x !== id))
      }
    },
    [kanbanStatusField, validatedUpdate, toast],
  )

  // ── Gantt date edits — optimistic local-first patch via the same validated
  // mutation pipeline. Fired ONCE per completed drag with day-snapped ISO
  // datetimes; bars derive purely from docs, so a validation failure simply
  // re-renders the old dates (spring-back) after the toast. ──
  const handleGanttUpdateDates = useCallback(
    async (
      doc: Record<string, unknown>,
      source: CalendarSource,
      next: { start: string; end: string },
    ) => {
      const id = String(doc.id)
      setMovingDocIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
      try {
        // Dot-path WRITES mirror the calendar's dot-path reads (getByPath):
        // nested paths patch their whole root key via setByPath — RxDB's
        // incrementalPatch merges top-level keys only, so the rebuilt root
        // object keeps sibling fields intact while a plain 'a.b' key would
        // land as a literal dotted property.
        const patch: Record<string, unknown> = {}
        const writeField = (path: string, value: string) => {
          if (!path.includes('.')) {
            patch[path] = value
            return
          }
          const root = path.split('.')[0]
          // Seed from the patch-so-far so start+end under the same root
          // (e.g. scheduling.start / scheduling.end) compose, else the doc.
          const base = { [root]: root in patch ? patch[root] : doc[root] }
          patch[root] = setByPath(base, path, value)[root]
        }
        writeField(source.startField, next.start)
        // Point sources (no endField) write only the start — GanttBar already
        // disables resize for them (bar.point), so next.end mirrors next.start.
        if (source.endField) writeField(source.endField, next.end)
        const result = await validatedUpdate(id, patch, doc)
        if (result.success === false) {
          const firstError = result.errors._form ?? Object.values(result.errors)[0]
          toast.showToast(
            typeof firstError === 'string' ? firstError : 'Date update failed',
            { type: 'error', icon: 'error' },
          )
        }
      } catch {
        toast.showToast('Date update failed', { type: 'error', icon: 'error' })
      } finally {
        setMovingDocIds((prev) => prev.filter((x) => x !== id))
      }
    },
    [validatedUpdate, toast],
  )

  // --- Swipe to delete + shake to undo ---
  const lastDeletedRef = useRef<{ id: string; data: Record<string, unknown> } | null>(null)

  const handleDelete = useCallback(
    async (doc: Record<string, unknown>) => {
      const id = String(doc.id)
      // Stash the doc data for undo
      lastDeletedRef.current = { id, data: { ...doc } }
      await remove(id)
      toast.showToast('Deleted — shake to undo', { type: 'info', icon: 'delete', duration: 4000 })
    },
    [remove, toast],
  )

  // Shake to undo: listen for device motion and detect shake gesture
  useEffect(() => {
    if (isPreview) return

    let lastShake = 0
    const sub = DeviceMotion.addListener(({ acceleration }) => {
      if (!acceleration) return
      const mag = Math.sqrt(
        (acceleration.x ?? 0) ** 2 +
        (acceleration.y ?? 0) ** 2 +
        (acceleration.z ?? 0) ** 2,
      )
      const now = Date.now()
      if (mag > SHAKE_THRESHOLD && now - lastShake > 2000) {
        lastShake = now
        const deleted = lastDeletedRef.current
        if (deleted) {
          lastDeletedRef.current = null
          // Re-insert the deleted document
          const col = localDB?.collections[slug]
          if (col) {
            const { _deleted, _rev, _meta, _attachments, _locallyModified, ...cleanData } = deleted.data as any
            col.upsert({
              ...cleanData,
              id: deleted.id,
              _deleted: false,
              _locallyModified: true,
              updatedAt: new Date().toISOString(),
            } as any).then(() => {
              toast.showToast('Undo successful', { type: 'success', icon: 'undo', duration: 2000 })
            }).catch(() => {
              toast.showToast('Undo failed', { type: 'error', icon: 'undo' })
            })
          }
        }
      }
    })

    DeviceMotion.setUpdateInterval(100)

    return () => sub.remove()
  }, [isPreview, localDB, slug, toast])

  return {
    movingDocIds,
    handleMoveCard,
    handleGanttUpdateDates,
    handleDelete,
  }
}
