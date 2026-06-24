/**
 * useCalendarDraft — buffered draft + source-editor state machine for the
 * CalendarCustomizeSheet. All changes buffer locally; handleSave flushes the
 * draft via onSave (saving always writes an EXPLICIT source list). Pure
 * state/logic — no JSX.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { type CalendarSource } from '@payload-universal/admin-native'

import type { CalendarConfig } from '@/src/hooks/useCalendarConfig'
import type { CalendarDateFieldOption, Draft, SourceEditorState } from '../types'
import { ensureUniqueIds, nextPaletteColor } from '../utils'

export type UseCalendarDraftArgs = {
  visible: boolean
  dateFieldOptions: CalendarDateFieldOption[]
  config: CalendarConfig
  resolvedSources: CalendarSource[]
  onSave: (next: CalendarConfig) => void
  onClose: () => void
}

export function useCalendarDraft({
  visible,
  dateFieldOptions,
  config,
  resolvedSources,
  onSave,
  onClose,
}: UseCalendarDraftArgs) {
  // ── Buffered draft (flushed on ✓) ────────────────────────────────────
  const [draft, setDraft] = useState<Draft>({ sources: [], defaultMode: 'month' })
  const [editor, setEditor] = useState<SourceEditorState | null>(null)

  useEffect(() => {
    if (visible) {
      setDraft({
        sources: ensureUniqueIds(resolvedSources),
        defaultMode: config.defaultMode,
      })
      setEditor(null)
    }
  }, [visible]) // eslint-disable-line react-hooks/exhaustive-deps

  const labelByFieldName = useMemo(
    () => new Map(dateFieldOptions.map((f) => [f.name, f.label])),
    [dateFieldOptions],
  )
  const fieldLabel = useCallback(
    (name: string | null | undefined): string =>
      (name ? labelByFieldName.get(name) : undefined) ?? name ?? '',
    [labelByFieldName],
  )

  // ── Sources list ──────────────────────────────────────────────────────
  const removeSource = useCallback((id: string) => {
    setDraft((prev) => ({ ...prev, sources: prev.sources.filter((s) => s.id !== id) }))
  }, [])

  // Visibility section — `hidden: true` only when off (visible omits the key
  // so configs stay minimal and pre-`hidden` entries mean visible).
  const setSourceVisible = useCallback((id: string, visible: boolean) => {
    setDraft((prev) => ({
      ...prev,
      sources: prev.sources.map((s) => {
        if (s.id !== id) return s
        if (visible) {
          const { hidden: _hidden, ...rest } = s
          return rest
        }
        return { ...s, hidden: true }
      }),
    }))
  }, [])

  // onMove must stay a no-op (state updates mid-drag remount the Sortable);
  // the final order is read once from onDrop's allPositions.
  const noopMove = useCallback(() => {}, [])

  const handleSourceDrop = useCallback(
    (_id: string, _position: number, allPositions?: Record<string, number>) => {
      if (!allPositions) return
      setDraft((prev) => {
        const byId = new Map(prev.sources.map((s) => [s.id, s]))
        const orderedIds = Object.keys(allPositions).sort(
          (a, b) => allPositions[a] - allPositions[b],
        )
        const ordered = orderedIds
          .map((id) => byId.get(id))
          .filter((s): s is CalendarSource => s != null)
        // Defensive: keep any sources the positions map missed (shouldn't happen)
        const rest = prev.sources.filter((s) => allPositions[s.id] == null)
        return { ...prev, sources: [...ordered, ...rest] }
      })
    },
    [],
  )

  // ── Source editor ─────────────────────────────────────────────────────
  const openAddSource = useCallback(() => {
    setEditor({
      index: null,
      startField: null,
      endField: null,
      label: '',
      labelTouched: false,
      color: nextPaletteColor(draft.sources),
    })
  }, [draft.sources])

  const openEditSource = useCallback((source: CalendarSource, index: number) => {
    setEditor({
      index,
      startField: source.startField,
      endField: source.endField ?? null,
      label: source.label,
      labelTouched: true,
      color: source.color,
    })
  }, [])

  const handlePickStartField = useCallback(
    (name: string) => {
      setEditor((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          startField: name,
          // The end field must differ from the start field
          endField: prev.endField === name ? null : prev.endField,
          // Auto-label from the field's label until the user types one
          label: prev.labelTouched ? prev.label : fieldLabel(name),
        }
      })
    },
    [fieldLabel],
  )

  const handlePickEndField = useCallback((name: string | null) => {
    setEditor((prev) => (prev ? { ...prev, endField: name } : prev))
  }, [])

  const handleEditorSave = useCallback(() => {
    if (!editor || !editor.startField) return
    const startField = editor.startField
    setDraft((prev) => {
      const label = editor.label.trim() || fieldLabel(startField)
      if (editor.index != null && prev.sources[editor.index]) {
        const next = [...prev.sources]
        next[editor.index] = {
          ...next[editor.index],
          label,
          startField,
          ...(editor.endField ? { endField: editor.endField } : {}),
          color: editor.color,
        }
        if (!editor.endField) delete next[editor.index].endField
        return { ...prev, sources: next }
      }
      // New source — id from the start field name, deduped against existing ids
      const existing = new Set(prev.sources.map((s) => s.id))
      let id = startField
      let n = 2
      while (existing.has(id)) id = `${startField}-${n++}`
      const source: CalendarSource = {
        id,
        label,
        startField,
        ...(editor.endField ? { endField: editor.endField } : {}),
        color: editor.color,
      }
      return { ...prev, sources: [...prev.sources, source] }
    })
    setEditor(null)
  }, [editor, fieldLabel])

  // ── Save (flush draft) ────────────────────────────────────────────────
  const handleSave = useCallback(() => {
    onSave({ sources: draft.sources, defaultMode: draft.defaultMode })
    onClose()
  }, [draft, onSave, onClose])

  return {
    draft,
    setDraft,
    editor,
    setEditor,
    fieldLabel,
    removeSource,
    setSourceVisible,
    noopMove,
    handleSourceDrop,
    openAddSource,
    openEditSource,
    handlePickStartField,
    handlePickEndField,
    handleEditorSave,
    handleSave,
  }
}
