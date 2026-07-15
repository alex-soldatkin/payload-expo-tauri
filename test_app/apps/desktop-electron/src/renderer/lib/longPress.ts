// Long-press detection as a plain handler factory (no hooks — usable inside
// row .map()s). Fires after `ms` of holding within `slopPx`; a click that
// releases earlier proceeds normally. Suppresses the synthetic click that
// follows a fired long-press so the row doesn't also open.
export function longPressHandlers(cb: () => void, ms = 450, slopPx = 8) {
  let timer: number | null = null
  let startX = 0
  let startY = 0
  let fired = false

  const cancel = () => {
    if (timer !== null) {
      window.clearTimeout(timer)
      timer = null
    }
  }

  return {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.button !== 0) return
      fired = false
      startX = e.clientX
      startY = e.clientY
      cancel()
      timer = window.setTimeout(() => {
        timer = null
        fired = true
        cb()
      }, ms)
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (timer === null) return
      if (Math.abs(e.clientX - startX) > slopPx || Math.abs(e.clientY - startY) > slopPx) cancel()
    },
    onPointerUp: cancel,
    onPointerLeave: cancel,
    onClickCapture: (e: React.MouseEvent) => {
      if (fired) {
        e.preventDefault()
        e.stopPropagation()
        fired = false
      }
    },
  }
}
