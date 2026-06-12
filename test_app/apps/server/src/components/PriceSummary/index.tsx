'use client'
/**
 * PriceSummary — ui field component for the products collection.
 *
 * Renders a computed pricing breakdown from sibling fields. Exercises:
 * useField (read-only across a named group), div→View, span→Text,
 * simple inline styles. RN-translatable (no document/window/canvas).
 */
import React from 'react'
import { useField } from '@payloadcms/ui'

const formatMoney = (value: number | undefined | null): string => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '—'
  return `$${value.toFixed(2)}`
}

export const PriceSummary: React.FC = () => {
  const { value: price } = useField<number>({ path: 'pricing.price' })
  const { value: salePrice } = useField<number>({ path: 'pricing.salePrice' })
  const { value: taxRate } = useField<number>({ path: 'pricing.taxRate' })
  const { value: onSale } = useField<boolean>({ path: 'pricing.onSale' })

  const effectivePrice = onSale && typeof salePrice === 'number' ? salePrice : price
  const tax =
    typeof effectivePrice === 'number' && typeof taxRate === 'number'
      ? effectivePrice * (taxRate / 100)
      : undefined
  const total =
    typeof effectivePrice === 'number' && typeof tax === 'number'
      ? effectivePrice + tax
      : effectivePrice

  const discount =
    onSale && typeof price === 'number' && typeof salePrice === 'number' && price > 0
      ? Math.round(((price - salePrice) / price) * 100)
      : null

  return (
    <div
      style={{
        padding: 12,
        marginBottom: 16,
        border: '1px solid #ddd',
        borderRadius: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontWeight: 600, fontSize: 14 }}>Price Summary</span>
        {discount !== null && (
          <span style={{ color: '#1a7f37', fontSize: 12, fontWeight: 600 }}>
            {discount}% off
          </span>
        )}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 2 }}>
        <span style={{ color: '#666', fontSize: 13 }}>Base price</span>
        <span style={{ fontSize: 13 }}>{formatMoney(price)}</span>
      </div>
      {onSale && (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: 2 }}>
          <span style={{ color: '#666', fontSize: 13 }}>Sale price</span>
          <span style={{ fontSize: 13 }}>{formatMoney(salePrice)}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 2 }}>
        <span style={{ color: '#666', fontSize: 13 }}>
          Tax ({typeof taxRate === 'number' ? taxRate : 0}%)
        </span>
        <span style={{ fontSize: 13 }}>{formatMoney(tax)}</span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 6,
          paddingTop: 6,
          borderTop: '1px solid #eee',
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 13 }}>Total</span>
        <span style={{ fontWeight: 600, fontSize: 13 }}>{formatMoney(total)}</span>
      </div>
    </div>
  )
}

export default PriceSummary
