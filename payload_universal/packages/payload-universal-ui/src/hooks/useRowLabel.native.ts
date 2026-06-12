/**
 * useRowLabel — Native implementation.
 *
 * Reads admin-native's RowLabelContext (provided by ArrayField around each
 * custom RowLabel component) and adapts it to the @payloadcms/ui contract:
 *
 *   const { data, path, rowNumber } = useRowLabel<T>()
 *
 * Web parity notes (payload-main/packages/ui/src/forms/RowLabel):
 *   - `rowNumber` is the 0-BASED row index — ArrayRow/BlockRow pass
 *     `rowNumber={rowIndex}`. Consumers render `rowNumber + 1` for display.
 *     admin-native's RowLabelContextValue carries a 1-based `rowNumber` and a
 *     0-based `index`; we expose `index` here to match the web hook.
 *   - Outside a row, the web context defaults to
 *     `{ data: {}, path: '', rowNumber: undefined }` — mirrored here so the
 *     hook is safe to call unconditionally.
 */
import { useRowLabelContext } from '@payload-universal/admin-native'

export type UseRowLabelReturn<T = unknown> = {
  data: T
  path: string
  rowNumber: number | undefined
}

export function useRowLabel<T = unknown>(): UseRowLabelReturn<T> {
  const ctx = useRowLabelContext()
  if (!ctx) {
    return { data: {} as T, path: '', rowNumber: undefined }
  }
  return {
    data: ctx.data as T,
    path: ctx.path,
    rowNumber: ctx.index,
  }
}
