/**
 * useAutosave — debounced draft autosave for edit screens.
 *
 * Payload collections can enable `versions.drafts.autosave` (e.g. Pages,
 * interval 1500ms). DocumentForm exposes its live data via the imperative
 * handle (`getFormData()` / `isDirty`) rather than an onChange prop, so this
 * hook polls the handle on the configured interval and saves ONLY when the
 * serialized form data actually changed since the last snapshot — an
 * interval-based debounce identical in effect to the web admin's autosave.
 *
 * The first tick seeds the snapshot without saving (no save-on-mount).
 */
import { useCallback, useEffect, useRef, useState } from 'react'

import type { DocumentFormHandle } from '@payload-universal/admin-native'

export type AutosaveStatus = 'idle' | 'saving' | 'saved' | 'error'

type UseAutosaveArgs = {
  /** Master switch (autosave configured + editing the default locale, etc.). */
  enabled: boolean
  /** Autosave interval in ms (from versions.drafts.autosave.interval). */
  intervalMs: number
  /** Ref to the mounted DocumentForm. */
  formRef: React.RefObject<DocumentFormHandle | null>
  /** Persist the draft. Must throw on failure. */
  onSave: (data: Record<string, unknown>) => Promise<void>
}

export type UseAutosaveResult = {
  status: AutosaveStatus
  /** Wall-clock time of the last successful autosave (null before first). */
  lastSavedAt: Date | null
}

export function useAutosave({ enabled, intervalMs, formRef, onSave }: UseAutosaveArgs): UseAutosaveResult {
  const [status, setStatus] = useState<AutosaveStatus>('idle')
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null)

  // Keep the latest save callback without re-arming the interval.
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave

  const snapshotRef = useRef<string | null>(null)
  const savingRef = useRef(false)

  const tick = useCallback(async () => {
    if (savingRef.current) return
    const handle = formRef.current
    if (!handle) return

    let data: Record<string, unknown> | null = null
    try {
      data = handle.getFormData()
    } catch {
      return
    }
    if (!data) return

    let serialized: string
    try {
      serialized = JSON.stringify(data)
    } catch {
      return
    }

    // First tick: seed the snapshot, never save on mount.
    if (snapshotRef.current === null) {
      snapshotRef.current = serialized
      return
    }
    if (serialized === snapshotRef.current) return

    savingRef.current = true
    setStatus('saving')
    try {
      await onSaveRef.current(data)
      snapshotRef.current = serialized
      setLastSavedAt(new Date())
      setStatus('saved')
    } catch {
      // Leave the stale snapshot so the next tick retries.
      setStatus('error')
    } finally {
      savingRef.current = false
    }
  }, [formRef])

  useEffect(() => {
    if (!enabled) {
      snapshotRef.current = null
      setStatus('idle')
      return
    }
    const interval = setInterval(tick, Math.max(500, intervalMs))
    return () => clearInterval(interval)
  }, [enabled, intervalMs, tick])

  return { status, lastSavedAt }
}
