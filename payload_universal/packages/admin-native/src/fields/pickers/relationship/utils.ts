import React from 'react'

import { docDisplayTitle } from '../shared'
import type { RelDoc, RelItem } from './types'

// Lazy-loaded DocumentForm to avoid circular dep (pickers → DocumentForm → fields → pickers)
let _DocumentForm: React.ComponentType<any> | null = null
export const getDocumentForm = () => {
  if (!_DocumentForm) {
    try { _DocumentForm = require('../../../DocumentForm').DocumentForm } catch { /* not available */ }
  }
  return _DocumentForm
}

export const noopSubmit = async () => {}

// ---------------------------------------------------------------------------
// Value normalization
// ---------------------------------------------------------------------------

export const toRelItem = (
  raw: unknown,
  fallbackCollection: string,
  titleFieldFor: (slug: string) => string | undefined,
): RelItem | null => {
  if (raw == null || raw === '') return null
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    // Polymorphic shape: { relationTo, value }
    if ('relationTo' in obj && 'value' in obj) {
      const relationTo = String(obj.relationTo)
      const inner = obj.value
      if (inner != null && typeof inner === 'object') {
        const doc = inner as RelDoc
        const id = String(doc.id ?? '')
        return id ? { relationTo, id, title: docDisplayTitle(doc, titleFieldFor(relationTo)) } : null
      }
      const id = String(inner ?? '')
      return id ? { relationTo, id } : null
    }
    // Populated doc
    const id = String(obj.id ?? '')
    return id
      ? { relationTo: fallbackCollection, id, title: docDisplayTitle(obj, titleFieldFor(fallbackCollection)) }
      : null
  }
  const id = String(raw)
  return id ? { relationTo: fallbackCollection, id } : null
}
