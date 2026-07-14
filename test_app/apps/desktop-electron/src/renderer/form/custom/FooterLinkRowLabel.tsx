// DOM port of server FooterLinkRowLabel — labels rows of footer.links.
// The original showed `data.label || 'Link N'`, the url, and a NEW TAB marker.
// Here we render '{label} → {url}' with a NEW TAB chip, guarding missing values.
import type { RowLabelProps } from '../registry'

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() !== '' ? v : undefined
}

export function FooterLinkRowLabel({ data, index }: RowLabelProps) {
  const label = str(data.label) ?? `Link ${index + 1}`
  const url = str(data.url)
  const newTab = Boolean(data.newTab)

  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
      {url && <span style={{ color: 'var(--ink-faint)', fontSize: 12 }}>→ {url}</span>}
      {newTab && (
        <span style={{ color: '#2ea043', fontSize: 11, fontWeight: 600 }}>NEW TAB</span>
      )}
    </span>
  )
}

export default FooterLinkRowLabel
