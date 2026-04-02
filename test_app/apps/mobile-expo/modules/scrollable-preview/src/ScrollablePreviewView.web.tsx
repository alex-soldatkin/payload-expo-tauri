// Web fallback — no preview functionality
import React from 'react'

export function Trigger({ children }: { children?: React.ReactNode }) {
  return <>{children}</>
}
export function Content() { return null }
export function Action() { return null }
