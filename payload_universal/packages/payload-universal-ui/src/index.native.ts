/**
 * @payload-universal/ui — Native entry point.
 *
 * Metro resolves this file instead of index.ts on React Native.
 * Provides RN equivalents of @payloadcms/ui hooks and components,
 * all wired to the local-first data layer (RxDB/SQLite via admin-native).
 */

// ── Hooks ──
export {
  useField,
  useForm,
  useAuth,
  useConfig,
  useDocumentInfo,
  useTranslation,
  getTranslation,
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
} from './hooks/index.native'

export type {
  UseFieldOptions,
  UseFieldReturn,
  UseFormReturn,
  UseAuthReturn,
  UseConfigReturn,
  UseDocumentInfoReturn,
  UseTranslationReturn,
  UseLocaleReturn,
  UsePreferencesReturn,
  UseEntityVisibilityReturn,
} from './hooks/index.native'

// ── Input Components ──
export {
  TextInput,
  TextareaInput,
  SelectInput,
  CheckboxInput,
} from './inputs/index.native'

// ── Layout Components ──
export {
  Card,
  Button,
  Banner,
  Pill,
  Loading,
  Gutter,
  Collapsible,
  Modal,
  Drawer,
  DrawerToggler,
  AnimateHeight,
  NavGroup,
  Link,
} from './layout/index.native'

// ── Form Components ──
export {
  FieldLabel,
  FieldDescription,
  FieldError,
  Form,
  RenderFields,
  FormSubmit,
} from './form/index.native'

// ── Stubs for web-only components used in custom components ──
// These render nothing on native but prevent import errors.

import React from 'react'
import { View, Text } from 'react-native'

/** BrowseByFolderButton — web-only, renders nothing on native. */
export const BrowseByFolderButton: React.FC<any> = () => null

/** CopyToClipboard — renders nothing on native. */
export const CopyToClipboard: React.FC<any> = () => null

/** Tooltip — renders children directly (no tooltip on native). */
export const Tooltip: React.FC<any> = ({ children }) =>
  React.createElement(View, null, children)

/** Popup — renders children directly. */
export const Popup: React.FC<any> = ({ children }) =>
  React.createElement(View, null, children)

/** StickyToolbar — renders children in a View. */
export const StickyToolbar: React.FC<any> = ({ children }) =>
  React.createElement(View, null, children)

/** FullscreenModal — falls back to Modal. */
export { Modal as FullscreenModal } from './layout/index.native'
