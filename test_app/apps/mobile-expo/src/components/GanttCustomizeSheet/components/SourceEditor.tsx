/**
 * SourceEditor — the add/edit-a-source view for the GanttCustomizeSheet:
 *   - start date-field picker (radio list over the collection's date fields)
 *   - optional end date-field picker ('None — point diamonds' + remaining
 *     date fields; sources without an end render as shiftable, non-resizable
 *     16pt diamonds on the chart)
 *   - label input (auto-filled from the start field's label until touched)
 *   - colour — native SwiftUI ColorPicker via the admin-native registry
 *     (null-checked) with the curated 8-swatch fallback row
 *
 * The native ColorPicker renders here, OUTSIDE any Sortable tree (@expo/ui
 * must never render inside a reanimated-dnd Sortable).
 */
import React from 'react'
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native'
import { Check, Circle, CircleCheck } from 'lucide-react-native'
import { type ListColorPalette } from '@payload-universal/admin-native'
import { nativeComponents, NativeHost } from '@payload-universal/admin-native/fields'

import type { CalendarDateFieldOption } from '@/src/components/CalendarCustomizeSheet'
import { SWATCHES, type SheetStyles } from '../styles'
import type { SourceEditorState } from '../types'

const NativeColorPicker = nativeComponents.ColorPicker

export type SourceEditorProps = {
  editor: SourceEditorState
  setEditor: React.Dispatch<React.SetStateAction<SourceEditorState | null>>
  dateFieldOptions: CalendarDateFieldOption[]
  styles: SheetStyles
  colors: ListColorPalette
  fieldLabel: (name: string | null | undefined) => string
  handlePickStartField: (name: string) => void
  handlePickEndField: (name: string | null) => void
  handleEditorSave: () => void
}

export function SourceEditor({
  editor,
  setEditor,
  dateFieldOptions,
  styles,
  colors,
  fieldLabel,
  handlePickStartField,
  handlePickEndField,
  handleEditorSave,
}: SourceEditorProps) {
  return (
    <>
      <View style={styles.sheetHeader}>
        <Pressable onPress={() => setEditor(null)} hitSlop={8} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.sheetTitleCentered}>
          {editor.index == null ? 'New Source' : 'Edit Source'}
        </Text>
        <Pressable onPress={handleEditorSave} hitSlop={8} disabled={!editor.startField}>
          <View
            style={[
              styles.saveBtn,
              { backgroundColor: colors.primary },
              !editor.startField && styles.saveBtnDisabled,
            ]}
          >
            <Check size={20} color={colors.primaryText} />
          </View>
        </Pressable>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        {/* ── Start field ──────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>START DATE FIELD</Text>
        {dateFieldOptions.map((field) => {
          const selected = editor.startField === field.name
          return (
            <Pressable
              key={field.name}
              style={styles.row}
              onPress={() => handlePickStartField(field.name)}
            >
              <View style={styles.checkbox}>
                {selected ? (
                  <CircleCheck size={22} color={colors.primary} />
                ) : (
                  <Circle size={22} color={colors.border} />
                )}
              </View>
              <View style={styles.fieldInfo}>
                <Text style={styles.rowLabel}>{field.label}</Text>
                <Text style={styles.fieldType}>{field.name}</Text>
              </View>
            </Pressable>
          )
        })}

        {/* ── End field (optional) ─────────────────────────────────── */}
        <Text style={styles.sectionLabel}>END DATE FIELD — optional</Text>
        <Pressable style={styles.row} onPress={() => handlePickEndField(null)}>
          <View style={styles.checkbox}>
            {editor.endField == null ? (
              <CircleCheck size={22} color={colors.primary} />
            ) : (
              <Circle size={22} color={colors.border} />
            )}
          </View>
          <View style={styles.fieldInfo}>
            <Text style={styles.rowLabel}>None</Text>
            <Text style={styles.fieldType}>point diamonds — shiftable, not resizable</Text>
          </View>
        </Pressable>
        {dateFieldOptions
          .filter((field) => field.name !== editor.startField)
          .map((field) => {
            const selected = editor.endField === field.name
            return (
              <Pressable
                key={field.name}
                style={styles.row}
                onPress={() => handlePickEndField(field.name)}
              >
                <View style={styles.checkbox}>
                  {selected ? (
                    <CircleCheck size={22} color={colors.primary} />
                  ) : (
                    <Circle size={22} color={colors.border} />
                  )}
                </View>
                <View style={styles.fieldInfo}>
                  <Text style={styles.rowLabel}>{field.label}</Text>
                  <Text style={styles.fieldType}>{field.name}</Text>
                </View>
              </Pressable>
            )
          })}

        {/* ── Label ────────────────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>LABEL</Text>
        <TextInput
          style={styles.textInput}
          value={editor.label}
          onChangeText={(label) =>
            setEditor((prev) => (prev ? { ...prev, label, labelTouched: true } : prev))
          }
          placeholder={fieldLabel(editor.startField) || 'Source label'}
          placeholderTextColor={colors.textPlaceholder}
          returnKeyType="done"
        />

        {/* ── Colour (OUTSIDE any Sortable tree — @expo/ui allowed) ── */}
        <Text style={styles.sectionLabel}>COLOR</Text>
        {NativeColorPicker ? (
          <View style={styles.colorPickerWrap}>
            <NativeHost matchContents>
              <NativeColorPicker
                selection={editor.color}
                label="Source color"
                supportsOpacity={false}
                onSelectionChange={(hex) =>
                  setEditor((prev) => (prev ? { ...prev, color: hex } : prev))
                }
              />
            </NativeHost>
          </View>
        ) : (
          <View style={styles.swatchRow}>
            {SWATCHES.map((hex) => {
              const selected = editor.color.toLowerCase() === hex.toLowerCase()
              return (
                <Pressable
                  key={hex}
                  onPress={() => setEditor((prev) => (prev ? { ...prev, color: hex } : prev))}
                  style={[
                    styles.swatchLarge,
                    { backgroundColor: hex },
                    selected && { borderColor: colors.text, borderWidth: 2 },
                  ]}
                />
              )
            })}
          </View>
        )}
      </ScrollView>
    </>
  )
}
