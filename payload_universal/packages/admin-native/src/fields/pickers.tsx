/**
 * Picker-based fields: select, radio, relationship, upload.
 *
 * Implementations live in ./pickers/ — this barrel is the ONLY module other
 * files may import picker components from.
 *
 * - Select/Radio use the platform-resolved nativeComponents registry:
 *   SwiftUI Picker on iOS, JC Picker (segmented/radio) on Android, with
 *   @react-native-picker/picker → pure-JS fallbacks (Expo Go safe).
 * - Relationship supports hasMany, polymorphic relationTo, object-form
 *   filterOptions, debounced server search with RxDB local prefilter, and an
 *   injected onRequestCreate callback (no expo-router in packages).
 * - Upload supports thumbnails, browse-existing, camera/library/document
 *   picker sources, hasMany strips, and focal point editing.
 */
export { RadioField } from './pickers/radio'
export { SelectField } from './pickers/select'
export { RelationshipField } from './pickers/relationship'
export type { RelationshipFieldProps } from './pickers/relationship'
export { UploadField } from './pickers/upload'
