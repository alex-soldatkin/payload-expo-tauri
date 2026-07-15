// Registry glue for shim-hosted components (the codegen passthrough target).
// Payload admin components expect Payload-shaped props (path/label/required at
// the top level, RowLabels propless via useRowLabel); our registry passes
// FieldComponentProps / {data,index}. These adapters translate at the boundary
// so ORIGINAL component sources register unmodified.
import type { ComponentType } from 'react'
import type { FieldComponentProps } from '../types'
import type { RowLabelProps } from '../registry'
import { resolveLabel } from '../labels'
import { RowLabelScopeProvider } from './hooks'

/** Wrap a Payload Field/beforeInput/afterInput component for our registry. */
export function asPayloadField(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- original
  // components declare arbitrary Payload prop subsets; the adapter supplies
  // a superset, so any narrower prop contract is satisfied at runtime.
  Component: ComponentType<any>,
): ComponentType<FieldComponentProps> {
  return function PayloadFieldAdapter(props: FieldComponentProps) {
    return (
      <Component
        path={props.path}
        field={props.field}
        label={resolveLabel(props.field.label, props.field.name)}
        description={resolveLabel(props.field.admin?.description) || undefined}
        required={props.field.required}
        readOnly={Boolean(props.field.admin?.readOnly)}
      />
    )
  }
}

/** Wrap a Payload RowLabel (propless, reads useRowLabel) for our registry. */
export function asPayloadRowLabel(Component: ComponentType): ComponentType<RowLabelProps> {
  return function PayloadRowLabelAdapter({ data, index }: RowLabelProps) {
    return (
      <RowLabelScopeProvider value={{ data, rowNumber: index, path: '' }}>
        <Component />
      </RowLabelScopeProvider>
    )
  }
}
