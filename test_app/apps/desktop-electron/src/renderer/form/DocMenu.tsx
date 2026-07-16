// Overflow (⋯) menu for document-level actions (duplicate/delete). Reuses the
// shared .picker-menu popover styling; closes on outside-click or Escape.
import { useEffect, useRef, useState } from 'react'

export type DocMenuItem = {
  label: string
  danger?: boolean
  onSelect: () => void
}

type Props = {
  items: DocMenuItem[]
  disabled?: boolean
  /** Codegen passthrough edit actions — original admin components, rendered
   *  as menu entries below the built-ins (they self-handle clicks). */
  passthrough?: React.ReactNode
}

export function DocMenu({ items, disabled, passthrough }: Props) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="doc-menu" ref={wrapRef}>
      <button
        className="no-drag doc-menu-trigger"
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        ⋯
      </button>
      {open && (
        <div className="picker-menu doc-menu-popover" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              className={`option${item.danger ? ' danger' : ''}`}
              role="menuitem"
              onClick={() => {
                setOpen(false)
                item.onSelect()
              }}
            >
              {item.label}
            </button>
          ))}
          {passthrough && <div className="doc-menu-passthrough">{passthrough}</div>}
        </div>
      )}
    </div>
  )
}
