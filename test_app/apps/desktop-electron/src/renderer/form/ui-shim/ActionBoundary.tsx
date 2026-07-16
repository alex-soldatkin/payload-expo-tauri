// Per-action error boundary: passthrough components are third-party code —
// one that throws (missing context, unexpected data) must not take down the
// menu or selection bar hosting it. Failed actions vanish with a warning.
import { Component, type ReactNode } from 'react'

export class ActionBoundary extends Component<
  { children: ReactNode; label?: string },
  { failed: boolean }
> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.warn(`[ui-shim] passthrough action failed to render (${this.props.label ?? '?'}):`, err)
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}
