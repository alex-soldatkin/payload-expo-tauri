/**
 * Selection action bar — native SwiftUI buttons with Pressable fallback.
 * Rendered above the table when selection mode is active (table-only surface,
 * like swipe-delete). Extracted verbatim from the collection-list route.
 */
import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { useListColors } from '@payload-universal/admin-native'
// Native @expo/ui SwiftUI components for the selection action bar
import { nativeComponents, NativeHost } from '@payload-universal/admin-native/fields'
import { selectionStyles } from '../styles'
import type { SelectionActionBarProps } from '../types'

const NativeButton = nativeComponents.Button
const btnStyle = nativeComponents.buttonStyle
const ctrlSize = nativeComponents.controlSize
const tintMod = nativeComponents.tint

export function SelectionActionBar({ selectedCount, actions, onAction, onDone }: SelectionActionBarProps) {
  // Use native SwiftUI Button when available (iOS), Pressable fallback otherwise
  const useNative = NativeButton != null && btnStyle != null && ctrlSize != null && tintMod != null
  // Dark-mode aware bar colours (never hardcode the light palette)
  const { dark, colors: c } = useListColors()

  return (
    <View style={[selectionStyles.bar, { backgroundColor: c.background, borderBottomColor: c.hairline }]}>
      <Text style={[selectionStyles.count, { color: c.text }]}>
        {selectedCount} selected
      </Text>
      <View style={selectionStyles.actions}>
        {useNative ? (
          // ── Native SwiftUI buttons — each in its own NativeHost ────────
          (<>
            {actions.map((action) => (
              <NativeHost key={action.key} matchContents>
                <NativeButton
                  label={action.label}
                  role={action.destructive ? 'destructive' : 'default'}
                  systemImage={action.icon as any}
                  onPress={() => onAction(action.key)}
                  modifiers={[
                    btnStyle('borderedProminent'),
                    ctrlSize('regular'),
                    ...(action.destructive ? [] : [tintMod('#007AFF')]),
                  ]}
                />
              </NativeHost>
            ))}
            <NativeHost matchContents>
              <NativeButton
                label="Done"
                role="cancel"
                onPress={onDone}
                modifiers={[
                  btnStyle('bordered'),
                  ctrlSize('regular'),
                ]}
              />
            </NativeHost>
          </>)
        ) : (
          // ── Pressable fallback (Android / @expo/ui unavailable) ─────────
          (<>
            {actions.map((action) => (
              <Pressable
                key={action.key}
                style={[
                  selectionStyles.actionBtn,
                  action.destructive && selectionStyles.actionBtnDestructive,
                ]}
                onPress={() => onAction(action.key)}
              >
                <Text style={selectionStyles.actionLabel}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={[selectionStyles.cancelBtn, { backgroundColor: dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }]}
              onPress={onDone}
            >
              <Text style={[selectionStyles.cancelLabel, { color: c.text }]}>Done</Text>
            </Pressable>
          </>)
        )}
      </View>
    </View>
  );
}
