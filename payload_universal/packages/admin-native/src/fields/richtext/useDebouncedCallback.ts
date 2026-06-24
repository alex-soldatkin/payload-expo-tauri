// ---------------------------------------------------------------------------
// Debounce helper
// ---------------------------------------------------------------------------
import { useCallback, useRef } from 'react'

export function useDebouncedCallback<T extends (...args: any[]) => void>(cb: T, delay: number): T {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(cb)
  latest.current = cb
  return useCallback(
    ((...args: any[]) => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => latest.current(...args), delay)
    }) as unknown as T,
    [delay],
  )
}
