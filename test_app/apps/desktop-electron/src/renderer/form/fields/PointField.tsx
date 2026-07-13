// Geo point editor. Value is a [longitude, latitude] number tuple.
import type { FieldComponentProps } from '../types'
import { FieldShell, useFieldValue, isReadOnly } from './shared'

function coords(value: unknown): [number | undefined, number | undefined] {
  if (Array.isArray(value)) {
    const lng = typeof value[0] === 'number' ? value[0] : undefined
    const lat = typeof value[1] === 'number' ? value[1] : undefined
    return [lng, lat]
  }
  return [undefined, undefined]
}

export function PointField(props: FieldComponentProps) {
  const { value, setValue, onBlur } = useFieldValue<unknown>(props)
  const [lng, lat] = coords(value)
  const readOnly = isReadOnly(props)

  const update = (nextLng: number | undefined, nextLat: number | undefined) => {
    if (nextLng === undefined && nextLat === undefined) {
      setValue(undefined)
      return
    }
    setValue([nextLng ?? 0, nextLat ?? 0])
  }

  const parse = (raw: string): number | undefined => (raw === '' ? undefined : Number(raw))

  return (
    <FieldShell props={props}>
      <div className="point-pair">
        <label className="field-label">
          Lng
          <input
            className="input"
            type="number"
            value={lng ?? ''}
            readOnly={readOnly}
            step="any"
            onBlur={onBlur}
            onChange={(e) => update(parse(e.target.value), lat)}
          />
        </label>
        <label className="field-label">
          Lat
          <input
            className="input"
            type="number"
            value={lat ?? ''}
            readOnly={readOnly}
            step="any"
            onBlur={onBlur}
            onChange={(e) => update(lng, parse(e.target.value))}
          />
        </label>
      </div>
    </FieldShell>
  )
}
