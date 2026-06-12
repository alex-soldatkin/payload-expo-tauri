/**
 * Uncontrolled native text bridge.
 *
 * SwiftUI TextField/SecureField and JC TextInput are UNCONTROLLED: mount
 * with `defaultValue`, listen via `onChangeText`, and set programmatically
 * via `ref.setText`. This hook bridges that to react-hook-form's controlled
 * values: text is pushed INTO the native field ONLY when the form value
 * changes from the outside (RHF reset / programmatic setValue) — keystrokes
 * are never echoed back as defaultValue.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

/** Imperative surface shared by SwiftUI TextField/SecureField and JC TextInput refs. */
export type NativeTextRef = {
  setText: (newText: string) => Promise<void>
  focus?: () => Promise<void>
  blur?: () => Promise<void>
}

export type TextBridge = {
  /** Attach to the native field (callback ref or ref object). */
  ref: { current: NativeTextRef | null }
  /** Value at mount — feed as `defaultValue` (uncontrolled). */
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

  // External change (reset / setValue / server refresh): push into the native
  // field only when it didn't originate from this field's own keystrokes.
  useEffect(() => {
    if (externalText !== lastFormValueRef.current) {
      lastFormValueRef.current = externalText
      setIsEmpty(externalText.length === 0)
      void ref.current?.setText(externalText)
    }
  }, [externalText])

  return { ref, initialValue: initialRef.current, handleChangeText, setText, isEmpty }
}
