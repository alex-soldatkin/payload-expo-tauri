// Web export: pass-through to @payloadcms/ui
import * as React from 'react'
import { Button as PayloadButton } from '@payloadcms/ui'

export * from '@payloadcms/ui'
export { getTranslation } from '@payloadcms/translations'

/**
 * NativeActionButton — web counterpart of the native shim (see
 * NativeActionButton.native.tsx). On the web it simply renders the Payload
 * admin Button with the variant mapped onto buttonStyle.
 */
export const NativeActionButton: React.FC<{
  onPress?: () => void
  disabled?: boolean
  children?: React.ReactNode
  variant?: 'default' | 'primary' | 'destructive'
  style?: unknown
  testID?: string
}> = ({ onPress, disabled, children, variant }) =>
  React.createElement(
    PayloadButton as unknown as React.ComponentType<Record<string, unknown>>,
    {
      onClick: onPress,
      disabled,
      buttonStyle:
        variant === 'primary' ? 'primary' : variant === 'destructive' ? 'error' : 'secondary',
    },
    children,
  )
