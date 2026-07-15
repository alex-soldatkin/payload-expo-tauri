// Toolbar cluster for the filter engine: the funnel Filter button (with an
// active-count badge) opening the FilterBuilder popover, and the presets button
// opening the FilterPresets popover. Owns the open/close state for both so
// DocumentList only passes data + callbacks.
import { useState } from 'react'
import { FilterBuilder } from './FilterBuilder'
import { FilterPresets } from './FilterPresets'
import { countRules } from './toSelector'
import type { FilterField } from './filterFields'
import type { FilterGroups, FilterPreset } from './types'

type Props = {
  fields: FilterField[]
  groups: FilterGroups
  onChange: (groups: FilterGroups) => void
  presets: FilterPreset[]
  onApplyPreset: (groups: FilterGroups) => void
  onSavePreset: (name: string) => void
  onDeletePreset: (name: string) => void
}

export function FilterControls({
  fields,
  groups,
  onChange,
  presets,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
}: Props) {
  const [builderOpen, setBuilderOpen] = useState(false)
  const [presetsOpen, setPresetsOpen] = useState(false)
  const count = countRules(groups)

  return (
    <>
      <div className="list-config-wrap">
        <button
          className={`icon-btn filter-btn${count > 0 ? ' on' : ''}`}
          onClick={() => {
            setBuilderOpen((o) => !o)
            setPresetsOpen(false)
          }}
          title="Filter"
          aria-label="Filter"
        >
          ⧩
          {count > 0 && <span className="filter-badge">{count}</span>}
        </button>
        {builderOpen && (
          <FilterBuilder
            fields={fields}
            groups={groups}
            onChange={onChange}
            onClose={() => setBuilderOpen(false)}
          />
        )}
      </div>
      <div className="list-config-wrap">
        <button
          className="icon-btn"
          onClick={() => {
            setPresetsOpen((o) => !o)
            setBuilderOpen(false)
          }}
          title="Saved presets"
          aria-label="Saved presets"
        >
          ▤
        </button>
        {presetsOpen && (
          <FilterPresets
            presets={presets}
            currentGroups={groups}
            onApply={(g) => {
              onApplyPreset(g)
              setPresetsOpen(false)
            }}
            onSave={onSavePreset}
            onDelete={onDeletePreset}
            onClose={() => setPresetsOpen(false)}
          />
        )}
      </div>
    </>
  )
}
