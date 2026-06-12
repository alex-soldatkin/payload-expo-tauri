/**
 * Uncontrolled native text bridge.
 *
 * SwiftUI TextField/SecureField and the JCTextInput adapter are UNCONTROLLED.
 * Stable @expo/ui removed the canary `defaultValue` prop on BOTH platforms:
 * the field keeps internal state, so the initial value is pushed via
 * `ref.setText` when the native view attaches (`attachRef`), and external
 * form changes (RHF reset / programmatic setValue) are pushed the same way —
 * keystrokes are never echoed back.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

/** Imperative surface shared by SwiftUI TextField/SecureField and JC TextInput refs. */
export type NativeTextRef = {
  setText: (newText: string) => Promise<void>
  focus?: () => Promise<void>
  blur?: () => Promise<void>
}

export type TextBridge = {
  /** Live handle to the native field (read-only; attach via `attachRef`). */
  ref: { current: NativeTextRef | null }
  /**
   * Callback ref for the native field. Stores the handle AND pushes the
   * current form value into the freshly attached native view via `setText`
   * (stable @expo/ui text fields have no `defaultValue` prop).
   */
  attachRef: (r: NativeTextRef | null) => void
  /** Value at mount (kept for fallback tiers that still take a defaultValue). */
  initialValue: string
  /** Forward native keystrokes to the form. */
  handleChangeText: (raw: string) => void
  /**
   * Imperatively set the native text AND record it as the expected form
   * value (so the external-sync effect won't push it again).
   */
  setText: (next: string) => void
  /** Whether the field currently has no text (drives JS placeholder overlays). */
  isEmpty: boolean
}

/**
 * @param externalText  String form of the current form value.
 * @param onText        Receives each raw keystroke value. Must return the
 *                      string representation of what was pushed to the form,
 *                      or `undefined` when the form was left unchanged
 *                      (e.g. unparseable in-progress numeric input).
 */
export const useUncontrolledTextBridge = (
  externalText: string,
  onText: (raw: string) => string | undefined,
): TextBridge => {
  const ref = useRef<NativeTextRef | null>(null)
  const initialRef = useRef(externalText)
  /** String form of the form value as last produced BY this field. */
  const lastFormValueRef = useRef(externalText)
  const [isEmpty, setIsEmpty] = useState(externalText.length === 0)

  const onTextRef = useRef(onText)
  onTextRef.current = onText

  const handleChangeText = useCallback((raw: string) => {
    const sent = onTextRef.current(raw)
    if (sent !== undefined) lastFormValueRef.current = sent
    setIsEmpty(raw.length === 0)
  }, [])

  const setText = useCallback((next: string) => {
    lastFormValueRef.current = next
    setIsEmpty(next.length === 0)
    void ref.current?.setText(next)
  }, [])

  // Native view attached (mount or remount): seed it with the current form
  // value. Stable @expo/ui text fields keep internal state and have no
  // `defaultValue` prop, so this is the only way to set the initial text.
  const attachRef = useCallback((r: NativeTextRef | null) => {
    ref.current = r
    if (r && lastFormValueRef.current.length > 0) {
      void r.setText(lastFormValueRef.current)
    }
  }, [])

  // External change (reset / setValue / server refresh): push into the native
  // field only when it didn't originate from this field's own keystrokes.
  useEffect(() => {
    if (externalText !== lastFormValueRef.current) {
      lastFormValueRef.current = externalText
      setIsEmpty(externalText.length === 0)
      void ref.current?.setText(externalText)
    }
  }, [externalText])

  return { ref, attachRef, initialValue: initialRef.current, handleChangeText, setText, isEmpty }
}
