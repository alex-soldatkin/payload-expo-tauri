import React from 'react'

// ---------------------------------------------------------------------------
// Error boundary — catches native view registration failures at render time
// and falls back to plain-text gracefully (e.g. Expo Go without native code).
// ---------------------------------------------------------------------------

export class RichTextErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch() { /* logged by React */ }
  render() { return this.state.hasError ? this.props.fallback : this.props.children }
}
