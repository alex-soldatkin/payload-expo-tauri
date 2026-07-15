// Corner toast system (desktop translation of admin-native's ToastProvider).
// Stacked bottom-right, auto-dismiss, click to dismiss early.
import { createContext, useCallback, useContext, useRef, useState } from 'react'

export type ToastType = 'info' | 'success' | 'error'
type ToastItem = { id: number; message: string; type: ToastType }

type ToastApi = {
  showToast: (message: string, opts?: { type?: ToastType; duration?: number }) => void
}

const ToastContext = createContext<ToastApi>({ showToast: () => {} })
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showToast = useCallback(
    (message: string, opts?: { type?: ToastType; duration?: number }) => {
      const id = nextId.current++
      setToasts((prev) => [...prev.slice(-3), { id, message, type: opts?.type ?? 'info' }])
      window.setTimeout(() => dismiss(id), opts?.duration ?? 3000)
    },
    [dismiss],
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-stack">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`} onClick={() => dismiss(t.id)}>
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
