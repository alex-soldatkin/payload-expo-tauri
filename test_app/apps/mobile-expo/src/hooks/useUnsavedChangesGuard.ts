/**
 * Unsaved-changes guard for document screens/sheets (web admin
 * "LeaveWithoutSaving" parity, iOS-style).
 *
 * While `dirty` is true, any removal of the screen — formSheet swipe-down,
 * tap outside the sheet, back gesture/button, or the Cancel header button —
 * is intercepted with a native confirm alert instead of silently discarding
 * edits. Default dismiss behavior is untouched when the form is clean.
 *
 * Programmatic navigation that SHOULD proceed (after a successful save /
 * delete / duplicate) must call `allowLeave()` first — the next removal
 * passes through without prompting.
 *
 * IMPLEMENTATION NOTES (hard-won, 2026-06-12; migrated to SDK 56 2026-06-12):
 * - `usePreventRemove` (not a manual beforeRemove listener) is REQUIRED for
 *   sheet presentations: it registers dismiss prevention with
 *   react-native-screens NATIVELY (NativeStackView sets
 *   `preventNativeDismiss` from the prevent-remove context), so a swipe-down
 *   on a dirty sheet bounces the sheet back when the user picks "Keep
 *   Editing". A plain beforeRemove + preventDefault only keeps the JS route
 *   alive — the native sheet has already animated away and never returns.
 * - SDK 56: expo-router no longer depends on @react-navigation/*; it VENDORS
 *   react-navigation under 'expo-router/react-navigation' (same
 *   usePreventRemove signature and native wiring). Because the vendored copy
 *   lives inside expo-router itself, there is exactly one module instance —
 *   the old metro.config.js @react-navigation singleton pins are gone.
 */
import { useCallback, useRef } from 'react'
import { Alert } from 'react-native'
import { useNavigation, usePreventRemove } from 'expo-router/react-navigation'

export function useUnsavedChangesGuard(dirty: boolean) {
  const navigation = useNavigation()
  const allowLeaveRef = useRef(false)

  usePreventRemove(dirty, ({ data }) => {
    if (allowLeaveRef.current) {
      allowLeaveRef.current = false
      navigation.dispatch(data.action)
      return
    }
    Alert.alert(
      'Unsaved Changes',
      'You have unsaved changes. Are you sure you want to discard them?',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard Changes',
          style: 'destructive',
          onPress: () => navigation.dispatch(data.action),
        },
      ],
    )
  })

  /** Arm a one-shot bypass before intentional navigation (post-save etc.). */
  const allowLeave = useCallback(() => {
    allowLeaveRef.current = true
  }, [])

  return { allowLeave }
}
