// ---------------------------------------------------------------------------
// Query presets (payload-query-presets, REST-only) — fetch, parse & save.
// Presets live in 'payload-query-presets'; local-first sync deliberately
// skips payload-* slugs, so these are fetched/saved over REST only.
// ---------------------------------------------------------------------------
import { useEffect, useMemo, useState } from 'react'

import type { ClientField } from '../../types'
import type { ActiveFilter } from '../../hooks/useDocumentListFilters'
import { filtersToWhere, whereToFilterGroups } from '../../hooks/useDocumentListFilters'
import { usePayloadNative } from '../../PayloadNativeProvider'
import { payloadApi } from '../../utils/api'
import type { QueryPresetDoc } from '../types'
import { presetWhereOf } from '../utils'

type UseQueryPresetsArgs = {
  visible: boolean
  presetsEnabled: boolean
  presetsCollection?: string
  presetsColumns?: string[]
  activeFilters?: ActiveFilter[]
  fields: ClientField[]
}

export const useQueryPresets = ({
  visible,
  presetsEnabled,
  presetsCollection,
  presetsColumns,
  activeFilters,
  fields,
}: UseQueryPresetsArgs) => {
  const { baseURL, auth } = usePayloadNative()

  const [presets, setPresets] = useState<QueryPresetDoc[]>([])
  const [presetsLoading, setPresetsLoading] = useState(false)
  const [presetSaveOpen, setPresetSaveOpen] = useState(false)
  const [presetTitle, setPresetTitle] = useState('')
  const [presetSaving, setPresetSaving] = useState(false)
  const [presetError, setPresetError] = useState<string | null>(null)
  /** Bumped after a save so the list refetches. */
  const [presetsEpoch, setPresetsEpoch] = useState(0)

  useEffect(() => {
    if (!visible || !presetsEnabled || !presetsCollection) return
    let cancelled = false
    setPresetsLoading(true)
    payloadApi
      .find({ baseURL, token: auth.token }, 'payload-query-presets', {
        where: { relatedCollection: { equals: presetsCollection } },
        limit: 50,
        depth: 0,
        sort: '-updatedAt',
      })
      .then((result) => {
        if (!cancelled) setPresets(result.docs as QueryPresetDoc[])
      })
      .catch(() => {
        if (!cancelled) setPresets([])
      })
      .finally(() => {
        if (!cancelled) setPresetsLoading(false)
      })
    return () => { cancelled = true }
  }, [visible, presetsEnabled, presetsCollection, baseURL, auth.token, presetsEpoch])

  // Parse each preset's where once — flags conditions the local evaluator
  // can't run so the limitation can be noted inline on the row.
  const parsedPresets = useMemo(
    () =>
      presets.map((preset) => ({
        preset,
        ...whereToFilterGroups(presetWhereOf(preset), fields),
      })),
    [presets, fields],
  )

  const handleSavePreset = async () => {
    const title = presetTitle.trim()
    if (!title || !presetsCollection || presetSaving) return
    setPresetSaving(true)
    setPresetError(null)
    try {
      await payloadApi.create({ baseURL, token: auth.token }, 'payload-query-presets', {
        title,
        relatedCollection: presetsCollection,
        where: filtersToWhere(activeFilters ?? []) ?? {},
        ...(presetsColumns && presetsColumns.length > 0
          ? { columns: presetsColumns.map((accessor) => ({ accessor, active: true })) }
          : {}),
      })
      setPresetTitle('')
      setPresetSaveOpen(false)
      setPresetsEpoch((e) => e + 1)
    } catch (err) {
      setPresetError(err instanceof Error ? err.message : 'Failed to save preset')
    } finally {
      setPresetSaving(false)
    }
  }

  return {
    presets,
    presetsLoading,
    parsedPresets,
    presetSaveOpen,
    setPresetSaveOpen,
    presetTitle,
    setPresetTitle,
    presetSaving,
    presetError,
    setPresetError,
    handleSavePreset,
  }
}
