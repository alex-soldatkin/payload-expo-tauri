/**
 * NativeFormBody — single full-screen SwiftUI Form (iOS only).
 *
 * Extracted from the original DocumentForm.tsx (purely structural; no behavior
 * change).
 *
 * Renders ALL field segments inside ONE NativeHost > Form. Only mounted when
 * `canUseNativeFormForFields` passed (every segment is 'compatible') — never
 * standalone Sections, never multiple Forms in one ScrollView.
 *
 * Wrapped in FormCrashBoundary: a JS render crash flips the parent back to
 * the stable JS FormSection path. Native-side crashes cannot be caught here
 * — on-device verification is required before shipping this path enabled.
 */
import React from 'react'
import { View } from 'react-native'

import type { ClientField } from '../../types'
import { defaultTheme as t } from '../../theme'
import { NativeFormContext, nativeComponents } from '../../fields/shared'
import { NativeHost } from '../../fields/NativeHost'
import { FormCrashBoundary } from './FormCrashBoundary'
import { styles } from '../styles'
import type { FieldSegment } from '../types'

export const NativeFormBody: React.FC<{
  segments: FieldSegment[]
  renderField: (field: ClientField, basePath: string) => React.ReactNode
  onOpenDetails?: () => void
  showDetailsRow: boolean
  onCrash: (error: Error) => void
  contentInsetTop: number
  header: React.ReactNode
}> = ({ segments, renderField, onOpenDetails, showDetailsRow, onCrash, contentInsetTop, header }) => {
  const NativeForm = nativeComponents.Form
  const NativeSection = nativeComponents.Section
  const NativeButton = nativeComponents.Button

  if (!NativeForm || !NativeSection) return null

  // Modifiers are factory calls from the registry — null-checked, never
  // object literals.
  const formModifiers = nativeComponents.scrollDismissesKeyboard
    ? [nativeComponents.scrollDismissesKeyboard('interactively')]
    : undefined

  return (
    <NativeFormContext.Provider value={true}>
      <FormCrashBoundary onCrash={onCrash}>
        <View
          style={[
            styles.nativeFormContainer,
            contentInsetTop > 0 && { paddingTop: contentInsetTop + t.spacing.sm },
          ]}
        >
          {header ? <View style={styles.nativeFormHeader}>{header}</View> : null}
          {/* matchContents intentionally omitted (false): the Form is a
              full-screen scrolling container sized by the flex:1 parent. */}
          <NativeHost matchContents={false} style={styles.nativeFormHost}>
            <NativeForm modifiers={formModifiers}>
              {segments.map((seg, i) => {
                // Guarded upstream by canUseNativeFormForFields — skip
                // defensively if a carve-out ever slips through.
                if (seg.type !== 'compatible') return null
                return (
                  <NativeSection key={`section-${i}`}>
                    {seg.fields.map((f, fi) => {
                      const path = f.name ?? `field-${fi}`
                      return <React.Fragment key={path}>{renderField(f, path)}</React.Fragment>
                    })}
                  </NativeSection>
                )
              })}
              {showDetailsRow && onOpenDetails && NativeButton ? (
                <NativeSection>
                  <NativeButton label="Details" onPress={onOpenDetails} />
                </NativeSection>
              ) : null}
            </NativeForm>
          </NativeHost>
        </View>
      </FormCrashBoundary>
    </NativeFormContext.Provider>
  )
}
