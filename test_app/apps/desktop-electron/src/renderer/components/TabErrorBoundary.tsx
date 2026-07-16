// Per-tab error boundary: a crashing field/component in ONE tab must never
// white-screen the whole workspace (a StatusBadge crash used to). The failed
// tab shows an inline error with a retry; every other tab keeps working.
import { Component, type ReactNode } from 'react'

export class TabErrorBoundary extends Component<
  { children: ReactNode; tabKey: string },
  { error: string | null }
> {
  state: { error: string | null } = { error: null }
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) }
  }
  componentDidCatch(err: unknown) {
    console.error('[workspace] tab content crashed:', err)
  }
  componentDidUpdate(prev: { tabKey: string }) {
    // Navigating the tab elsewhere clears the failure.
    if (prev.tabKey !== this.props.tabKey && this.state.error) this.setState({ error: null })
  }
  render() {
    if (this.state.error) {
      return (
        <div className="empty" style={{ padding: 24 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>This tab hit an error.</div>
          <div style={{ marginBottom: 12, fontSize: 12, opacity: 0.75 }}>{this.state.error}</div>
          <button className="chip" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
