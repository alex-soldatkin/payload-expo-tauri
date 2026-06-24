/**
 * Scan-to-lookup state for the collection-list screen — the toolbar scanner
 * popup resolving barcode/QR payloads to documents (local-first with REST
 * fallback, see useScanLookup).
 *
 *   'found'    → navigate through the SAME double-nav guard rows use
 *   'multiple' → close the scanner and open the picker sheet
 *   'none'     → toast and KEEP the scanner open for an immediate retry
 *
 * Extracted verbatim from the route file.
 */
import { useCallback, useState } from 'react'
import { useToast } from '@payload-universal/admin-native'
import { useScanLookup } from '@/src/hooks/useScanLookup'

export function useScanner(slug: string, navigateToDoc: (id: string) => void) {
  const toast = useToast()
  const { resolveScannedCode } = useScanLookup()
  const [scanOpen, setScanOpen] = useState(false)
  const [scanMatches, setScanMatches] = useState<Record<string, unknown>[] | null>(null)

  const handleScanned = useCallback(
    async (value: string) => {
      const res = await resolveScannedCode(slug, value)
      if (res.status === 'found') {
        setScanOpen(false)
        navigateToDoc(String(res.doc.id))
      } else if (res.status === 'multiple') {
        setScanOpen(false)
        setScanMatches(res.docs)
      } else {
        toast.showToast(`No match for "${value}"`, { type: 'error' })
      }
    },
    [resolveScannedCode, slug, navigateToDoc, toast],
  )

  return { scanOpen, setScanOpen, scanMatches, setScanMatches, handleScanned }
}
