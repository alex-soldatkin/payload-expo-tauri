// Grouped collection navigation (mirrors the native menu grouping), plus a
// Settings entry pinned to the bottom.
import type { AdminSchema } from '@payload-universal/admin-schema'
import { collectionLabel, groupCollections } from '../lib/collections'

type Props = {
  schema: AdminSchema
  activeSlug: string | null
  onSelect: (slug: string) => void
  onOpenSettings: () => void
  settingsActive: boolean
}

export function Sidebar({ schema, activeSlug, onSelect, onOpenSettings, settingsActive }: Props) {
  const groups = groupCollections(schema)

  return (
    <nav className="sidebar">
      <div className="sidebar-scroll">
        {groups.length === 0 && <div className="empty">No collections</div>}
        {groups.map((g) => (
          <div key={g.group}>
            <div className="sidebar-group-label">{g.group}</div>
            {g.collections.map((c) => (
              <button
                key={c.slug}
                className={`nav-item${activeSlug === c.slug ? ' active' : ''}`}
                onClick={() => onSelect(c.slug)}
                title={c.slug}
              >
                <span className="title">{collectionLabel(c)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="sidebar-footer">
        <button
          className={`nav-item${settingsActive ? ' active' : ''}`}
          onClick={onOpenSettings}
        >
          <span className="title">Settings</span>
        </button>
      </div>
    </nav>
  )
}
