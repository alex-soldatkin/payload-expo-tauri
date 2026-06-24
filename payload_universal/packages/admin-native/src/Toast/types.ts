// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastType = 'success' | 'error' | 'info'

/** Semantic hint for picking the right icon. */
export type ToastIcon = 'sync' | 'syncError' | 'save' | 'publish' | 'delete' | 'undo' | 'error' | 'info' | 'success'

export type Toast = {
  id: number
  message: string
  type: ToastType
  icon?: ToastIcon
  duration: number
}

export type ToastContextValue = {
  showToast: (
    message: string,
    options?: { type?: ToastType; icon?: ToastIcon; duration?: number },
  ) => void
}
