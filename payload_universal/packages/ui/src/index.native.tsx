import React from 'react'
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput as RNTextInput,
  View,
} from 'react-native'
import { Link as ExpoLink } from 'expo-router'
// Note: We'll import FieldShell from admin-native if needed, or fallback.
// Since admin-native depends on this, actually ui peers admin-native.
import { FieldShell } from '@payload-universal/admin-native'
import { useField } from './hooks.native'

export * from './hooks.native'

export const getTranslation = (label: any, i18n: any) => {
  if (typeof label === 'string') return label;
  if (label && typeof label === 'object' && 'en' in label) return label.en || label.text || String(label);
  return String(label)
}

// Layout
export const Card = ({ children, style, className }: any) => (
  <View style={[{ padding: 16, borderRadius: 8, backgroundColor: '#fff', shadowOpacity: 0.1 }, style]} className={className}>
    {children}
  </View>
)

export const Button = ({ children, onClick, onPress, style, className }: any) => (
  <Pressable onPress={onPress || onClick} style={[{ padding: 12, backgroundColor: '#000', borderRadius: 4 }, style]} className={className}>
    <Text style={{ color: 'white', textAlign: 'center' }}>{children}</Text>
  </Pressable>
)

export const Link = ExpoLink

export const Collapsible = ({ children, header, initCollapsed }: any) => {
  // Simplistic fallback for DisclosureGroup
  const [open, setOpen] = React.useState(!initCollapsed)
  return (
    <View style={{ marginBottom: 16 }}>
      <Pressable onPress={() => setOpen(!open)} style={{ padding: 12, backgroundColor: '#f0f0f0' }}>
        <Text>{header}</Text>
      </Pressable>
      {open && <View style={{ padding: 12 }}>{children}</View>}
    </View>
  )
}

export const Modal = ({ children }: any) => <View>{children}</View>
export const Drawer = Modal

export const Banner = ({ children, type }: any) => (
  <View style={{ padding: 12, backgroundColor: type === 'error' ? '#fdd' : '#ffd' }}>
    <Text>{children}</Text>
  </View>
)

export const Pill = ({ children }: any) => (
  <View style={{ paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, backgroundColor: '#eee' }}>
    <Text style={{ fontSize: 12 }}>{children}</Text>
  </View>
)

export const Gutter = ({ children }: any) => <View style={{ paddingHorizontal: 16 }}>{children}</View>

export const Loading = () => <ActivityIndicator />

export const NavGroup = Collapsible

// Form Components
export const FieldLabel = ({ label }: any) => (
  <Text style={{ fontSize: 12, color: '#666', textTransform: 'uppercase', marginBottom: 4 }}>{label}</Text>
)

export const FieldDescription = ({ description }: any) => (
  <Text style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{description}</Text>
)

export const FieldError = ({ error }: any) => (
  <Text style={{ fontSize: 12, color: 'red', marginTop: 4 }}>{error}</Text>
)

export const RenderFields = () => null // Handled implicitly usually, or stub

export const Form = ({ children }: any) => <View>{children}</View>

// Inputs
export const TextInput = ({ path, label, description, required, onChange, value: propValue }: any) => {
  const { value: hookValue, setValue, errorMessage } = useField({ path })
  
  // Support both controlled props from RenderFields and useField auto-binding
  const val = propValue !== undefined ? propValue : hookValue
  const handleChange = onChange || setValue

  return (
    <FieldShell field={{ type: 'text', name: path, required, label, admin: { description } } as any} error={errorMessage}>
       <RNTextInput
         value={String(val || '')}
         onChangeText={handleChange}
         style={{ borderWidth: 1, borderColor: '#eee', padding: 8, borderRadius: 4 }}
       />
    </FieldShell>
  )
}

export const TextareaInput = (props: any) => (
  <TextInput {...props} multiline numberOfLines={4} />
)

export const NumberInput = (props: any) => (
  <TextInput {...props} keyboardType="numeric" />
)

export const SelectInput = (props: any) => (
  <TextInput {...props} /> // Fallback stub
)

export const CheckboxInput = (props: any) => (
  <TextInput {...props} /> // Fallback stub
)
