/**
 * @payload-universal/ui — Web entry point.
 *
 * On web, simply re-export everything from @payloadcms/ui so that
 * custom components work identically to the standard Payload admin.
 *
 * On React Native, Metro resolves index.native.ts instead, which
 * provides native equivalents.
 */

// Hooks
export {
  useField,
  useForm,
  useAuth,
  useConfig,
  useDocumentInfo,
  useTranslation,
  useLocale,
  usePreferences,
  useEntityVisibility,
  useOperation,
  useNav,
  useEditDepth,
  useFormFields,
  useFormSubmitted,
  useFormProcessing,
  useFormModified,
} from '@payloadcms/ui'

// Input components
export {
  TextInput,
  TextareaInput,
  SelectInput,
  CheckboxInput,
} from '@payloadcms/ui'

// Layout components
export {
  Card,
  Button,
  Link,
  Collapsible,
  Modal,
  Banner,
  Pill,
  Loading,
  NavGroup,
  Gutter,
  Drawer,
  DrawerToggler,
  AnimateHeight,
} from '@payloadcms/ui'

// Form components
export {
  FieldLabel,
  FieldDescription,
  FieldError,
  RenderFields,
  Form,
  FormSubmit,
} from '@payloadcms/ui'

// Translation helper
export { getTranslation } from '@payloadcms/translations'
