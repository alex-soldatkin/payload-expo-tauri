// 'next/navigation' alias target — passthrough admin components (written for
// the Next-based web admin) call useRouter/usePathname; on desktop, admin
// URLs map onto workspace tabs and everything else is a soft no-op.
import { navigateAdminURL } from './scopes'

export function useRouter(): {
  push: (url: string) => void
  replace: (url: string) => void
  refresh: () => void
  back: () => void
} {
  return {
    push: (url: string) => {
      if (!navigateAdminURL(url)) console.warn('[ui-shim] unhandled router.push:', url)
    },
    replace: (url: string) => {
      if (!navigateAdminURL(url)) console.warn('[ui-shim] unhandled router.replace:', url)
    },
    // Local-first views are live queries — the data is already fresh.
    refresh: () => {},
    back: () => window.history.back(),
  }
}

export function usePathname(): string {
  return '/'
}

export function useParams(): Record<string, string> {
  return {}
}

export function useSearchParams(): URLSearchParams {
  return new URLSearchParams()
}
