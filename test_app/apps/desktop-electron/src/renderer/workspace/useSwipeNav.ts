// Trackpad back/forward gestures (browser-native feel): a two-finger
// horizontal swipe — wheel events with dominant deltaX on mac/windows
// precision touchpads — drives back (swipe left→right, negative deltaX) or
// forward (positive deltaX) navigation, on par with Cmd/Ctrl+[ ].
//
// The animation TRACKS the gesture: the focused pane's content translates
// proportionally with the accumulated delta (clipped inside the pane — the
// sidebar never moves), snaps home when the gesture ends short of the
// threshold, and settles home after a triggered navigation.
//
// The gesture must NOT steal horizontal scrolling: if any ancestor of the
// event target can still scroll in the wheel's direction (kanban boards,
// gantt timelines, wide tables), the wheel belongs to it.
import { useEffect, useRef } from 'react'

/** Accumulated |deltaX| that triggers a navigation. */
const THRESHOLD = 220
/** Gap (ms) after which a new wheel burst counts as a new gesture. */
const GESTURE_GAP = 250
/** Ignore wheels after a trigger until the finger clearly lifts. */
const COOLDOWN = 650
/** Max content translation at full gesture progress. */
const MAX_SHIFT = 64

function scrollableAncestorConsumes(target: EventTarget | null, deltaX: number): boolean {
  let el = target instanceof Element ? target : null
  while (el && el !== document.body) {
    if (el.scrollWidth > el.clientWidth + 1) {
      const style = getComputedStyle(el)
      if (style.overflowX === 'auto' || style.overflowX === 'scroll') {
        const max = el.scrollWidth - el.clientWidth
        // The element can still move in this direction — the wheel is a scroll.
        if (deltaX < 0 && el.scrollLeft > 0) return true
        if (deltaX > 0 && el.scrollLeft < max - 1) return true
      }
    }
    el = el.parentElement
  }
  return false
}

/** The focused pane's content — the element the gesture translates. */
function paneContent(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>('.group-view.focused .group-content') ??
    document.querySelector<HTMLElement>('.group-content')
  )
}

export function useSwipeNav(goBack: () => void, goForward: () => void): void {
  const cb = useRef({ goBack, goForward })
  cb.current = { goBack, goForward }

  useEffect(() => {
    let accum = 0
    let lastWheel = 0
    let cooldownUntil = 0
    let el: HTMLElement | null = null
    let idleTimer: number | null = null

    const track = () => {
      if (!el) return
      const progress = Math.max(-1, Math.min(1, accum / THRESHOLD))
      el.style.transition = 'none'
      // Negative accum (swipe toward "back") slides the content right.
      el.style.transform = `translateX(${-progress * MAX_SHIFT}px)`
      el.style.opacity = String(1 - Math.abs(progress) * 0.2)
    }

    const settle = () => {
      if (!el) return
      const target = el
      target.style.transition = 'transform 0.18s ease-out, opacity 0.18s ease-out'
      target.style.transform = ''
      target.style.opacity = ''
      window.setTimeout(() => {
        target.style.transition = ''
      }, 220)
      el = null
      accum = 0
    }

    const onWheel = (e: WheelEvent) => {
      const now = performance.now()
      if (now < cooldownUntil) return
      // Horizontal-dominant wheels only (vertical scrolling stays untouched).
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.5) return
      if (scrollableAncestorConsumes(e.target, e.deltaX)) {
        settle()
        return
      }
      if (now - lastWheel > GESTURE_GAP) {
        settle()
        el = paneContent()
      }
      lastWheel = now
      accum += e.deltaX
      track()
      if (idleTimer !== null) window.clearTimeout(idleTimer)
      idleTimer = window.setTimeout(settle, GESTURE_GAP)
      if (Math.abs(accum) >= THRESHOLD) {
        const dir = accum < 0 ? 'goBack' : 'goForward'
        cooldownUntil = now + COOLDOWN
        settle()
        cb.current[dir]()
      }
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      window.removeEventListener('wheel', onWheel)
      if (idleTimer !== null) window.clearTimeout(idleTimer)
    }
  }, [])
}
