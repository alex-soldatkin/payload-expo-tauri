// The `@payloadcms/ui` alias target (issue #28 phase 2): vite + tsconfig map
// that specifier here, so ORIGINAL Payload admin component sources — copied
// verbatim by the codegen passthrough — resolve their hooks and UI kit against
// this DOM shim instead of the real (Next-only) package.
import '../../styles/ui-shim.css'
import { installShimFetch } from './scopes'

// Rewrites passthrough components' relative '/api/…' fetches onto the session
// server with JWT auth (see scopes.tsx).
installShimFetch()

export {
  useField,
  useForm,
  useDocumentInfo,
  useAuth,
  useConfig,
  useTranslation,
  useLocale,
  useRowLabel,
  RowLabelScopeProvider,
  useSelection,
  useModal,
  useDocumentDrawer,
  useFormFields,
  useAllFormFields,
  useListQuery,
  useTableColumns,
  usePreferences,
  useCollapsible,
} from './hooks'
export { toast } from './scopes'
export { Button, Pill, Banner, Card, Collapsible, Gutter, Link } from './elements'
export { FieldLabel, FieldDescription, FieldError, TextInput, CheckboxInput, SelectInput, ReactSelect, TextareaInput } from './fields'
export { TextField, NumberField, RelationshipField, RelationshipInput } from './form-fields'
// RenderFields delegates back to the desktop FieldRenderer so custom GROUP
// passthroughs (StructureFilesCollapsibleGroup) can mount their nested field
// children — including the Ketcher editor. Lives in its own file to keep the
// FieldRenderer import out of the elements/fields presentational modules.
export { RenderFields } from './render-fields'
export type { RowLabelProps } from '../registry'
