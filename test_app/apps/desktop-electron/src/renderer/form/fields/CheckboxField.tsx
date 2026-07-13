// Boolean checkbox editor — inline shell with the control before the label.
import type { FieldComponentProps } from '../types'
import { FieldShell, useFieldValue, isReadOnly } from './shared'

export function CheckboxField(props: FieldComponentProps) {
  const { value, setValue } = useFieldValue<unknown>(props)
  return (
    <FieldShell props={props} inline>
      <input
        type="checkbox"
        checked={Boolean(value)}
        disabled={isReadOnly(props)}
        onChange={(e) => setValue(e.target.checked)}
      />
    </FieldShell>
  )
}
