/**
 * useAutosave — debounced draft autosave for the Electron document form.
 *
 * Mirrors the mobile hook's gating semantics: autosave only runs when the
 * collection has drafts (`enabled`), the doc is NOT published (autosave must
 * never publish or touch a published doc), and the form is dirty. It polls the
 * form's current values on an interval and saves ONLY when the serialized
 * snapshot has been stable since the previous tick and differs from the last
 * saved snapshot — an interval-based debounce identical in effect to the web
 * admin's autosave. Autosave keeps the current `_status` (the doc is already a
 * draft by gating), so it never writes 'draft'/'published' itself.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

export type AutosaveState = 'idle' | 'saving' | 'saved' | 'error'

type UseAutosaveArgs = {
  /** Master switch — the collection has drafts enabled. */
  enabled: boolean
  /** Whether the form currently has unsaved edits. */
  isDirty: boolean
  /** Read the current form values. */
  getValues: () => Record<string, unknown>
  /** Current `_status` of the doc — autosave is skipped when 'published'. */
  currentStatus: unknown
  /** Persist the draft. Resolves `true` on success, `false` on failure. */
  save: (values: Record<string, unknown>) => Promise<boolean>
  /** Debounce/poll interval in ms (default 2000). */
  intervalMs?: number
}

export type UseAutosaveResult = {
  state: AutosaveState
  /** Wall-clock time of the last successful autosave (null before first). */
  lastSavedAt: Date | null
}

export function useAutosave({
  enabled,
  isDirty,
  getValues,
  currentStatus,
  save,
  intervalMs = 2000,
}: UseAutosaveArgs): UseAutosaveResult {
  const [state, setState] = useState<AutosaveState>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  // Keep the latest inputs without re-arming the interval on every render.
  const getValuesRef = useRef(getValues)
  getValuesRef.current = getValues
  const saveRef = useRef(save)
  saveRef.current = save

  const savingRef = useRef(false)
  // Snapshot from the previous tick (for stability detection).
  const pendingRef = useRef<string | null>(null)
  // Last snapshot we successfully saved (or seeded on activation).
  const savedRef = useRef<string | null>(null)
  // Last snapshot that FAILED — don't retry the same one until it changes.
  const failedRef = useRef<string | null>(null)

  const active = enabled && currentStatus !== 'published' && isDirty

  const tick = useCallback(async () => {
    if (savingRef.current) return

    let serialized: string
    try {
      serialized = JSON.stringify(getValuesRef.current() ?? {})
    } catch {
      return
    }

    // Debounce: require two consecutive equal snapshots before saving.
    const stable = serialized === pendingRef.current
    pendingRef.current = serialized
    if (!stable) return

    // Nothing new since the last save, or this exact snapshot already failed.
    if (serialized === savedRef.current) return
    if (serialized === failedRef.current) return

    savingRef.current = true
    setState('saving')
    try {
      const ok = await saveRef.current(getValuesRef.current())
      if (ok) {
        savedRef.current = serialized
        failedRef.current = null
        setLastSavedAt(new Date())
        setState('saved')
      } else {
        failedRef.current = serialized
        setState('error')
      }
    } catch {
      failedRef.current = serialized
      setState('error')
    } finally {
      savingRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!active) {
      // While inactive the form matches the saved doc — keep refreshing the
      // clean baseline. Seeding here (NOT on activation) is load-bearing:
      // activation is CAUSED by the first edit, so seeding at that moment
      // records the edited snapshot as "already saved" and autosave never
      // fires.
      pendingRef.current = null
      failedRef.current = null
      try {
        savedRef.current = JSON.stringify(getValuesRef.current() ?? {})
      } catch {
        savedRef.current = null
      }
      return
    }
    const interval = setInterval(() => {
      void tick()
    }, Math.max(500, intervalMs))
    return () => clearInterval(interval)
  }, [active, intervalMs, tick])

  return { state, lastSavedAt }
}
