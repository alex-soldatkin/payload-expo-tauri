/**
 * FormCrashBoundary — catches native Form rendering crashes (JS render errors)
 * and auto-falls back via the onCrash callback.
 *
 * Extracted from the original DocumentForm.tsx (purely structural; no behavior
 * change).
 */
import React from 'react'

export class FormCrashBoundary extends React.Component<
  { children: React.ReactNode; onCrash: (error: Error) => void },
  { crashed: boolean }
> {
  state = { crashed: false }
  static getDerivedStateFromError() { return { crashed: true } }
  componentDidCatch(error: Error) { this.props.onCrash(error) }
  render() { return this.state.crashed ? null : this.props.children }
}
