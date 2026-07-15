// Global back/forward (Cmd/Ctrl+[ and Cmd/Ctrl+]) over workspace navigation.
// History tracks the active tab's TARGET (kind/slug/docId), not its tab id —
// sidebar navigation reuses one preview tab whose content is retargeted, so
// ids alone record nothing. Traversal re-opens the target in preview mode:
// existing tabs (preview or permanent) are reused/activated by the reducer's
// same-target matching, and targets whose tab has been closed simply reopen —
// browser-like. Traversal-induced changes are suppressed from re-recording.
import { useEffect, useRef } from 'react'
import type { Action, Tab, WorkspaceState } from './state'

type Target = Pick<Tab, 'kind' | 'slug' | 'docId' | 'title'>

const keyOf = (t: Target) => `${t.kind}|${t.slug ?? ''}|${t.docId ?? ''}`

export function useNavHistory(state: WorkspaceState, dispatch: (a: Action) => void): void {
  const back = useRef<Target[]>([])
  const forward = useRef<Target[]>([])
  const current = useRef<Target | null>(null)
  const suppress = useRef(false)

  const group = state.groups[state.activeGroupId]
  const activeTab = group?.activeTabId ? state.tabs[group.activeTabId] : undefined
  const activeKey = activeTab ? keyOf(activeTab) : null

  useEffect(() => {
    if (!activeTab || !activeKey) return
    if (current.current && keyOf(current.current) === activeKey) {
      // Same target — keep the freshest title (tabs retitle async).
      current.current = { kind: activeTab.kind, slug: activeTab.slug, docId: activeTab.docId, title: activeTab.title }
      return
    }
    const next: Target = { kind: activeTab.kind, slug: activeTab.slug, docId: activeTab.docId, title: activeTab.title }
    if (suppress.current) {
      suppress.current = false
      current.current = next
      return
    }
    if (current.current) {
      back.current.push(current.current)
      if (back.current.length > 100) back.current.shift()
    }
    forward.current = []
    current.current = next
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey])

  useEffect(() => {
    const go = (dir: 'back' | 'forward') => {
      const [from, to] = dir === 'back' ? [back.current, forward.current] : [forward.current, back.current]
      const target = from.pop()
      if (!target) return
      if (current.current) to.push(current.current)
      suppress.current = true
      dispatch({ type: 'open', target, mode: 'preview' })
    }
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey) return
      if (e.key === '[') {
        e.preventDefault()
        go('back')
      } else if (e.key === ']') {
        e.preventDefault()
        go('forward')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [dispatch])
}
