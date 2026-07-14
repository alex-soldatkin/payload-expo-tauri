// DOM port of server PriceSummary — a display-only `ui` Field for products.
// Reads the pricing group siblings (pricing.price/salePrice/taxRate/onSale) and
// reproduces the original's formulas verbatim:
//   effectivePrice = onSale && salePrice ? salePrice : price
//   tax            = effectivePrice * (taxRate / 100)
//   total          = effectivePrice + tax
//   discount       = onSale ? round((price - salePrice) / price * 100) : null
import { useWatch } from 'react-hook-form'
import type { FieldComponentProps } from '../types'

function num(v: unknown): number | undefined {
  return typeof v === 'number' && !Number.isNaN(v) ? v : undefined
}

function formatMoney(value: number | undefined): string {
  return value === undefined ? '—' : `$${value.toFixed(2)}`
}

export function PriceSummary(props: FieldComponentProps) {
  const form = useWatch({ control: props.control }) as Record<string, unknown>
  const pricing = (form.pricing ?? {}) as Record<string, unknown>
  const price = num(pricing.price)
  const salePrice = num(pricing.salePrice)
  const taxRate = num(pricing.taxRate)
  const onSale = Boolean(pricing.onSale)

  const effectivePrice = onSale && salePrice !== undefined ? salePrice : price
  const tax =
    effectivePrice !== undefined && taxRate !== undefined
      ? effectivePrice * (taxRate / 100)
      : undefined
  const total =
    effectivePrice !== undefined && tax !== undefined ? effectivePrice + tax : effectivePrice

  const discount =
    onSale && price !== undefined && salePrice !== undefined && price > 0
      ? Math.round(((price - salePrice) / price) * 100)
      : null

  return (
    <div className="field">
      <div
        style={{
          padding: 12,
          borderRadius: 8,
          background: 'rgba(255, 255, 255, 0.04)',
          border: '1px solid var(--line)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>Price Summary</span>
          {discount !== null && (
            <span style={{ color: '#2ea043', fontSize: 12, fontWeight: 600 }}>{discount}% off</span>
          )}
        </div>
        <Row label="Base price" value={formatMoney(price)} />
        {onSale && <Row label="Sale price" value={formatMoney(salePrice)} />}
        <Row label={`Tax (${taxRate ?? 0}%)`} value={formatMoney(tax)} />
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 6,
            paddingTop: 6,
            borderTop: '1px solid var(--line)',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <span>Total</span>
          <span>{formatMoney(total)}</span>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
      <span style={{ color: 'var(--ink-muted)', fontSize: 13 }}>{label}</span>
      <span style={{ fontSize: 13 }}>{value}</span>
    </div>
  )
}

export default PriceSummary
