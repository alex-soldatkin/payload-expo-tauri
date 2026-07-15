// GENERATED PASSTHROUGH — do not edit. Regenerate with codegen:dom.
// Verbatim copy of components/FooterLinkRowLabel/index.tsx ('use client' stripped);
// '@payloadcms/ui' resolves to the desktop ui-dom shim.
/**
 * FooterLinkRowLabel — custom RowLabel for the footer.links array.
 *
 * Exercises: useRowLabel inside a global, div→View, span→Text.
 * RN-translatable (no document/window/canvas).
 */
import React from 'react'
import { useRowLabel } from '@payloadcms/ui'

type FooterLinkRow = {
  label?: string
  url?: string
  newTab?: boolean
}

export const FooterLinkRowLabel: React.FC = () => {
  // Guarded call: the native shim may not export useRowLabel yet. The
  // condition is constant per platform, so hook order stays stable.
  const { data, rowNumber } =
    typeof useRowLabel === 'function'
      ? useRowLabel<FooterLinkRow>()
      : {
          data: undefined as FooterLinkRow | undefined,
          rowNumber: undefined as number | undefined,
        }

  const label = data?.label || `Link ${(rowNumber ?? 0) + 1}`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
      {data?.url ? <span style={{ color: '#888', fontSize: 12 }}>{data.url}</span> : null}
      {data?.newTab ? (
        <span style={{ color: '#1a7f37', fontSize: 11, fontWeight: 600 }}>NEW TAB</span>
      ) : null}
    </div>
  )
}

export default FooterLinkRowLabel
