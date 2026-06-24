/**
 * Point field (lng/lat — labeled pair with range validation).
 *
 * Two borderless axis columns under a stacked label. Invalid input is NOT
 * coerced to 0 — the last valid form value is kept and the problem surfaced
 * via the field error instead.
 */
import React, { useEffect, useRef, useState } from 'react'
import { Platform, Text, TextInput, View } from 'react-native'

import type { ClientPointField, FieldComponentProps } from '../../types'
import { getFieldDescription, getFieldLabel } from '../../utils/schemaHelpers'
import { FieldShell } from '../shared'
import { useInputColors } from './colors'
import { styles } from './styles'

/** In-progress numeric input that shouldn't trigger a validation message yet. */
const isPartialNumber = (raw: string) => raw === '' || raw === '-' || raw === '.' || raw === '-.'

type AxisCheck = { ok: boolean; n?: number; message?: string }

const checkAxis = (raw: string, axis: 'lng' | 'lat'): AxisCheck => {
  const [lo, hi] = axis === 'lng' ? [-180, 180] : [-90, 90]
  const label = axis === 'lng' ? 'Longitude' : 'Latitude'
  if (isPartialNumber(raw)) return { ok: false }
  const n = Number(raw)
  if (Number.isNaN(n)) return { ok: false, message: `${label} must be a number` }
  if (n < lo || n > hi) return { ok: false, message: `${label} must be between ${lo} and ${hi}` }
  return { ok: true, n }
}

export const PointField: React.FC<FieldComponentProps<ClientPointField>> = ({
  field, value, onChange, disabled, error,
}) => {
  const c = useInputColors()
  const initial = Array.isArray(value) ? value : [null, null]
  const [lngText, setLngText] = useState(initial[0] != null ? String(initial[0]) : '')
  const [latText, setLatText] = useState(initial[1] != null ? String(initial[1]) : '')
  const [localError, setLocalError] = useState<string | undefined>(undefined)
  const lastEmittedRef = useRef<unknown>(value)

  // External value change (reset / load) — re-derive the input texts.
  useEffect(() => {
    if (value !== lastEmittedRef.current) {
      lastEmittedRef.current = value
      const coords = Array.isArray(value) ? value : [null, null]
      setLngText(coords[0] != null ? String(coords[0]) : '')
      setLatText(coords[1] != null ? String(coords[1]) : '')
      setLocalError(undefined)
    }
  }, [value])

  const handleAxis = (axis: 'lng' | 'lat', raw: string) => {
    const nextLng = axis === 'lng' ? raw : lngText
    const nextLat = axis === 'lat' ? raw : latText
    if (axis === 'lng') setLngText(raw)
    else setLatText(raw)

    if (nextLng.trim() === '' && nextLat.trim() === '') {
      setLocalError(undefined)
      lastEmittedRef.current = null
      onChange(null)
      return
    }

    const lng = checkAxis(nextLng, 'lng')
    const lat = checkAxis(nextLat, 'lat')
    if (lng.ok && lat.ok) {
      setLocalError(undefined)
      const next: [number, number] = [lng.n!, lat.n!]
      lastEmittedRef.current = next
      onChange(next)
    } else {
      // Do NOT coerce invalid input to 0 — keep the last valid form value
      // and surface the problem instead.
      setLocalError(lng.message ?? lat.message)
    }
  }

  const editable = !disabled && !field.admin?.readOnly
  const keyboardType = Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'

  return (
    <FieldShell
      label={getFieldLabel(field)}
      description={getFieldDescription(field)}
      required={field.required}
      error={error ?? localError}
      layout="stacked"
    >
      <View style={styles.pointRow}>
        <View style={styles.pointCol}>
          <Text style={[styles.pointAxisLabel, { color: c.textPlaceholder }]}>LNG</Text>
          <TextInput
            style={[styles.stackedInput, { color: c.text }, disabled && styles.disabled]}
            value={lngText}
            onChangeText={(v) => handleAxis('lng', v)}
            placeholder="-180 to 180"
            placeholderTextColor={c.textPlaceholder}
            keyboardType={keyboardType}
            editable={editable}
          />
        </View>
        <View style={styles.pointCol}>
          <Text style={[styles.pointAxisLabel, { color: c.textPlaceholder }]}>LAT</Text>
          <TextInput
            style={[styles.stackedInput, { color: c.text }, disabled && styles.disabled]}
            value={latText}
            onChangeText={(v) => handleAxis('lat', v)}
            placeholder="-90 to 90"
            placeholderTextColor={c.textPlaceholder}
            keyboardType={keyboardType}
            editable={editable}
          />
        </View>
      </View>
    </FieldShell>
  )
}
