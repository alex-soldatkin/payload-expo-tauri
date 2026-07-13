// Tabs container — a tab bar over field groups. Named tabs nest their data
// under the tab name (base = `${path}.${tab.name}`); unnamed tabs are
// transparent and keep props.path. This nesting is load-bearing for docs like
// pages.meta / pages.settings.
import { useState } from 'react'
import type { FieldComponentProps } from '../types'
import { resolveLabel } from '../labels'
import { subPath } from '../paths'

export function TabsField(props: FieldComponentProps) {
  const { field, path, renderField } = props
  const tabs = field.tabs ?? []
  const [activeTab, setActiveTab] = useState(0)

  const active = tabs[activeTab]
  const activeBase = active?.name ? subPath(path, active.name) : path

  return (
    <div className="field-tabs">
      <div className="field-tabs-bar">
        {tabs.map((tab, i) => (
          <button
            key={tab.name ?? `tab-${i}`}
            type="button"
            className={i === activeTab ? 'active' : undefined}
            onClick={() => setActiveTab(i)}
          >
            {resolveLabel(tab.label, tab.name ?? `Tab ${i + 1}`)}
          </button>
        ))}
      </div>
      {active && (
        <div className="field-tab-body">
          {active.fields.map((child) => renderField(child, activeBase))}
        </div>
      )}
    </div>
  )
}
