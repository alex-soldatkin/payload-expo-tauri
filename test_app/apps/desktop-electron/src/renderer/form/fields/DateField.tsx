// Date/time editor. Doc value is an ISO datetime string; the DOM input works
// in LOCAL time, so we convert on both directions per pickerAppearance.
import type { FieldComponentProps } from '../types'
import { FieldShell, useFieldValue, isReadOnly } from './shared'

type Appearance = 'dayAndTime' | 'dayOnly' | 'timeOnly' | 'monthOnly'

function appearanceOf(props: FieldComponentProps): Appearance {
  const raw = props.field.admin?.date?.pickerAppearance ?? props.field.admin?.pickerAppearance
  if (raw === 'dayOnly' || raw === 'timeOnly' || raw === 'monthOnly') return raw
  return 'dayAndTime'
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Parse an ISO string into a valid Date, or null. */
function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string' || value === '') return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** ISO → the LOCAL-time string the given input type expects. */
function isoToInput(value: unknown, kind: Appearance): string {
  const d = parseDate(value)
  if (!d) return ''
  const y = d.getFullYear()
  const mo = pad(d.getMonth() + 1)
  const day = pad(d.getDate())
  const hh = pad(d.getHours())
  const mm = pad(d.getMinutes())
  switch (kind) {
    case 'dayOnly':
      return `${y}-${mo}-${day}`
    case 'timeOnly':
      return `${hh}:${mm}`
    case 'monthOnly':
      return `${y}-${mo}`
    default:
      return `${y}-${mo}-${day}T${hh}:${mm}`
  }
}

/** LOCAL input string → ISO string (or undefined when cleared/invalid). */
function inputToIso(raw: string, kind: Appearance): string | undefined {
  if (raw === '') return undefined
  let d: Date
  switch (kind) {
    case 'dayOnly': {
      const [y, mo, day] = raw.split('-').map(Number)
      d = new Date(y, mo - 1, day)
      break
    }
    case 'timeOnly': {
      const [hh, mm] = raw.split(':').map(Number)
      d = new Date(1970, 0, 1, hh, mm)
      break
    }
    case 'monthOnly': {
      const [y, mo] = raw.split('-').map(Number)
      d = new Date(y, mo - 1, 1)
      break
    }
    default: {
      const [datePart, timePart] = raw.split('T')
      const [y, mo, day] = datePart.split('-').map(Number)
      const [hh, mm] = timePart.split(':').map(Number)
      d = new Date(y, mo - 1, day, hh, mm)
    }
  }
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

const INPUT_TYPE: Record<Appearance, string> = {
  dayAndTime: 'datetime-local',
  dayOnly: 'date',
  timeOnly: 'time',
  monthOnly: 'month',
}

export function DateField(props: FieldComponentProps) {
  const { field } = props
  const kind = appearanceOf(props)
  const { value, setValue, onBlur } = useFieldValue<string | undefined>(props)
  const readOnly = isReadOnly(props)

  return (
    <FieldShell props={props}>
      <div className="point-pair">
        <input
          className="input"
          type={INPUT_TYPE[kind]}
          value={isoToInput(value, kind)}
          readOnly={readOnly}
          onBlur={onBlur}
          onChange={(e) => setValue(inputToIso(e.target.value, kind))}
        />
        {!field.required && !readOnly && (
          <button type="button" onClick={() => setValue(undefined)}>
            Clear
          </button>
        )}
      </div>
    </FieldShell>
  )
}
