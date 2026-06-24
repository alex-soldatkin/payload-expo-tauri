/**
 * useColumnFrames — board-owned column drop-frame registry + hit-testing.
 *
 * Each KanbanColumn registers its container node here; frames re-measure
 * (measureInWindow) on drag start, board layout, board scroll settle and
 * column scroll end. Release hit-tests the overlay card's CENTER against the
 * frames. This hook owns the node/frame maps, the stable per-value ref
 * callbacks, the refresh, and the center hit-test — the drag hook supplies
 * the live overlay-position refs it tests against.
 */
import { useCallback, useRef, type MutableRefObject } from 'react'
import { View } from 'react-native'

import type { ColumnFrame } from '../constants'

type DragGeometryRefs = {
  /** Board root window origin. */
  boardOrigin: MutableRefObject<{ x: number; y: number }>
  /** Latest overlay position in board coordinates. */
  overlayPosRef: MutableRefObject<{ x: number; y: number }>
  /** Measured drag-card size. */
  cardSizeRef: MutableRefObject<{ width: number; height: number }>
}

export function useColumnFrames({
  boardOrigin,
  overlayPosRef,
  cardSizeRef,
}: DragGeometryRefs) {
  // ── Column drop frames (board-owned hit-testing) ─────────────────────
  const columnNodesRef = useRef(new Map<string | null, View>())
  const columnFramesRef = useRef(new Map<string | null, ColumnFrame>())

  // Stable callback ref per column value: React detaches/reattaches a
  // callback ref whenever its IDENTITY changes, so an inline arrow would
  // fire ref(null) on every board re-render — including mid-drag — and wipe
  // the measured frames right before the release hit-test. One memoized
  // callback per value means refs only fire on real mount/unmount.
  const columnRefCallbacksRef = useRef(new Map<string | null, (node: View | null) => void>())
  const getColumnRefCallback = useCallback((value: string | null) => {
    let cb = columnRefCallbacksRef.current.get(value)
    if (!cb) {
      cb = (node: View | null) => {
        if (node) {
          columnNodesRef.current.set(value, node)
        } else {
          columnNodesRef.current.delete(value)
          columnFramesRef.current.delete(value)
        }
      }
      columnRefCallbacksRef.current.set(value, cb)
    }
    return cb
  }, [])

  const refreshColumnFrames = useCallback(() => {
    columnNodesRef.current.forEach((node, value) => {
      node.measureInWindow((x, y, width, height) => {
        columnFramesRef.current.set(value, { x, y, width, height })
      })
    })
  }, [])

  /** Hit-test the overlay card's CENTER (window coords) against the
   * registered column frames. */
  const hitTestCardCenter = useCallback((): { found: boolean; value: string | null } => {
    const pos = overlayPosRef.current
    const cx = boardOrigin.current.x + pos.x + cardSizeRef.current.width / 2
    const cy = boardOrigin.current.y + pos.y + cardSizeRef.current.height / 2
    let found = false
    let value: string | null = null
    columnFramesRef.current.forEach((frame, colValue) => {
      if (found) return
      if (
        cx >= frame.x &&
        cx <= frame.x + frame.width &&
        cy >= frame.y &&
        cy <= frame.y + frame.height
      ) {
        found = true
        value = colValue
      }
    })
    return { found, value }
  }, [boardOrigin, overlayPosRef, cardSizeRef])

  return { getColumnRefCallback, refreshColumnFrames, hitTestCardCenter }
}
