// Pure operations on the binary split tree (Layout). Mirrors vscode's grid
// semantics: splitting a leaf replaces it with a branch of [existing, new]
// (or [new, existing] for left/up); removing a leaf collapses single-child
// branches back to their remaining child.
import type { GroupId, Layout } from './state'

export type SplitDirection = 'left' | 'right' | 'up' | 'down'

const orientationOf = (dir: SplitDirection): 'horizontal' | 'vertical' =>
  dir === 'left' || dir === 'right' ? 'horizontal' : 'vertical'

/** All leaf group ids in visual order (left-to-right, top-to-bottom). */
export function leafOrder(layout: Layout): GroupId[] {
  if (layout.type === 'leaf') return [layout.groupId]
  return layout.children.flatMap(leafOrder)
}

/** Split the leaf holding `targetGroup`, placing `newGroup` in `dir`. */
export function splitLeaf(
  layout: Layout,
  targetGroup: GroupId,
  newGroup: GroupId,
  dir: SplitDirection,
): Layout {
  if (layout.type === 'leaf') {
    if (layout.groupId !== targetGroup) return layout
    const newLeaf: Layout = { type: 'leaf', groupId: newGroup }
    const existing: Layout = layout
    const children = dir === 'left' || dir === 'up' ? [newLeaf, existing] : [existing, newLeaf]
    return { type: 'branch', orientation: orientationOf(dir), sizes: [50, 50], children }
  }
  return { ...layout, children: layout.children.map((c) => splitLeaf(c, targetGroup, newGroup, dir)) }
}

/** Remove the leaf for `groupId`; collapse now-single-child branches. */
export function removeLeaf(layout: Layout, groupId: GroupId): Layout | null {
  if (layout.type === 'leaf') {
    return layout.groupId === groupId ? null : layout
  }
  const children = layout.children
    .map((c) => removeLeaf(c, groupId))
    .filter((c): c is Layout => c !== null)
  if (children.length === 0) return null
  if (children.length === 1) return children[0]
  // Redistribute sizes evenly when a child disappears (simple + predictable).
  const sizes =
    children.length === layout.children.length
      ? layout.sizes
      : children.map(() => 100 / children.length)
  return { ...layout, children, sizes }
}

/** Update stored sizes for the branch containing exactly these children counts. */
export function resizeBranch(layout: Layout, branchPath: number[], sizes: number[]): Layout {
  if (branchPath.length === 0) {
    return layout.type === 'branch' ? { ...layout, sizes } : layout
  }
  if (layout.type !== 'branch') return layout
  const [head, ...rest] = branchPath
  return {
    ...layout,
    children: layout.children.map((c, i) => (i === head ? resizeBranch(c, rest, sizes) : c)),
  }
}
