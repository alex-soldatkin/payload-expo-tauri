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
 * IMPLEMENTATION NOTES (hard-won, 2026-06-12):
 * - `usePreventRemove` (not a manual beforeRemove listener) is REQUIRED for
 *   sheet presentations: it registers dismiss prevention with
 *   react-native-screens NATIVELY, so a swipe-down on a dirty sheet bounces
 *   the sheet back when the user picks "Keep Editing". A plain
 *   beforeRemove + preventDefault only keeps the JS route alive — the
 *   native sheet has already animated away and never returns.
 * - This import is only safe because metro.config.js pins
 *   '@react-navigation/native'/'@react-navigation/core' (incl. deep imports)
 *   to the copies expo-router resolves. Without the pin, pnpm provides a
 *   second module instance whose context differs from expo-router's
 *   NavigationContainer → "Couldn't find a navigation object" render crash.
 *   Restart Metro with -c after touching the resolver.
 */
import { useCallback, useRef } from 'react'
import { Alert } from 'react-native'
import { useNavigation, usePreventRemove } from '@react-navigation/native'

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
