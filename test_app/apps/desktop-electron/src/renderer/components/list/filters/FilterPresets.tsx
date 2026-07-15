// Saved-preset dropdown next to the Filter button. v1 persists named presets
// LOCALLY per slug in listConfig (presets: FilterPreset[]); each preset stores
// its OR-group filter model. Apply replaces the active filters; 'Save current
// as…' captures the current groups under an inline name; delete removes.
//
// TODO(#20): integrate server-side payload-query-presets (REST-only, excluded
// from local-first sync — mirror the mobile useQueryPresets fetch/save flow).
import { useEffect, useRef, useState } from 'react'
import type { FilterGroups, FilterPreset } from './types'
import { countRules } from './toSelector'

type Props = {
  presets: FilterPreset[]
  currentGroups: FilterGroups
  onApply: (groups: FilterGroups) => void
  onSave: (name: string) => void
  onDelete: (name: string) => void
  onClose: () => void
}

export function FilterPresets({
  presets,
  currentGroups,
  onApply,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const commitSave = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    onSave(trimmed)
    setName('')
    setSaving(false)
  }

  const canSave = countRules(currentGroups) > 0

  return (
    <div className="picker-menu filter-presets" ref={ref}>
      <div className="column-config-head">
        <span>Presets</span>
      </div>

      {presets.length === 0 && <div className="filter-empty">No saved presets.</div>}

      {presets.map((preset) => (
        <div key={preset.name} className="option filter-preset-row">
          <button className="filter-preset-name" onClick={() => onApply(preset.groups)}>
            {preset.name}
          </button>
          <span className="type-badge">{countRules(preset.groups)}</span>
          <button
            className="mini filter-remove"
            onClick={() => onDelete(preset.name)}
            title="Delete preset"
            aria-label="Delete preset"
          >
            ×
          </button>
        </div>
      ))}

      <div className="column-config-sep" />

      {saving ? (
        <div className="filter-preset-save">
          <input
            className="filter-value"
            type="text"
            autoFocus
            placeholder="Preset name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitSave()
            }}
          />
          <button className="mini" onClick={commitSave} disabled={!name.trim()}>
            Save
          </button>
        </div>
      ) : (
        <button
          className="link filter-add"
          onClick={() => setSaving(true)}
          disabled={!canSave}
          title={canSave ? undefined : 'Add a filter first'}
        >
          Save current as…
        </button>
      )}
    </div>
  )
}
