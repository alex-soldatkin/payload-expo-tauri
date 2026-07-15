// @payloadcms/ui presentational shims — DOM stand-ins for the admin UI kit,
// styled with the desktop tokens via .pui-* classes (styles/ui-shim.css).
// Prop contracts follow Payload's components but only the surface our SSOT
// components exercise is honored; unknown props are ignored, never fatal.
import { useState } from 'react'
import type { ReactNode } from 'react'

type WithChildren = { children?: ReactNode; className?: string }

export function Button({
  children,
  onClick,
  buttonStyle = 'primary',
  size = 'medium',
  disabled,
  className,
  type,
}: WithChildren & {
  onClick?: () => void
  buttonStyle?: 'primary' | 'secondary' | 'pill' | 'transparent' | 'none'
  size?: 'xsmall' | 'small' | 'medium' | 'large'
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type ?? 'button'}
      className={`pui-btn pui-btn-${buttonStyle} pui-btn-${size}${className ? ` ${className}` : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  )
}

export function Pill({
  children,
  pillStyle = 'light',
  className,
}: WithChildren & {
  pillStyle?: 'white' | 'light' | 'dark' | 'success' | 'warning' | 'error' | 'light-gray'
}) {
  return (
    <span className={`pui-pill pui-pill-${pillStyle}${className ? ` ${className}` : ''}`}>
      {children}
    </span>
  )
}

export function Banner({
  children,
  type = 'default',
  className,
}: WithChildren & { type?: 'default' | 'info' | 'success' | 'error' }) {
  return (
    <div className={`pui-banner pui-banner-${type}${className ? ` ${className}` : ''}`}>
      {children}
    </div>
  )
}

export function Card({
  title,
  actions,
  children,
  className,
}: WithChildren & { title?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={`pui-card${className ? ` ${className}` : ''}`}>
      {(title || actions) && (
        <div className="pui-card-head">
          {title && <span className="pui-card-title">{title}</span>}
          {actions}
        </div>
      )}
      {children}
    </div>
  )
}

export function Collapsible({
  header,
  children,
  initCollapsed = false,
  className,
  onToggle,
}: WithChildren & {
  header?: ReactNode
  initCollapsed?: boolean
  onToggle?: (collapsed: boolean) => void
}) {
  const [collapsed, setCollapsed] = useState(initCollapsed)
  return (
    <div className={`pui-collapsible${className ? ` ${className}` : ''}`}>
      <button
        type="button"
        className="pui-collapsible-toggle"
        onClick={() => {
          setCollapsed((c) => {
            onToggle?.(!c)
            return !c
          })
        }}
      >
        <span className={`pui-caret${collapsed ? '' : ' open'}`}>▸</span>
        {header}
      </button>
      {!collapsed && <div className="pui-collapsible-body">{children}</div>}
    </div>
  )
}

/** Payload's page-padding wrapper — on desktop just a light horizontal inset. */
export function Gutter({ children, className }: WithChildren) {
  return <div className={`pui-gutter${className ? ` ${className}` : ''}`}>{children}</div>
}

/** External links open in the OS browser (window.open is intercepted by main). */
export function Link({
  href,
  children,
  className,
}: WithChildren & { href?: string }) {
  return (
    <a
      className={`pui-link${className ? ` ${className}` : ''}`}
      href={href}
      target="_blank"
      rel="noreferrer"
    >
      {children}
    </a>
  )
}
