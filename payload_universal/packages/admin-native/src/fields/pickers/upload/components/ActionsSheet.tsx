import React from 'react'
import { Pressable, Text } from 'react-native'

import { LucideIcon, type PickerPalette, sharedStyles } from '../../shared'
import { DocumentPicker } from '../utils'

/**
 * Default sheet mode — the source picker action list (browse existing,
 * library, camera, optional document picker, cancel).
 */
export const ActionsSheet: React.FC<{
  relationTo: string
  palette: PickerPalette
  onBrowse: () => void
  onPickFromLibrary: () => void
  onTakePhoto: () => void
  onPickDocument: () => void
  onCancel: () => void
}> = ({ relationTo, palette, onBrowse, onPickFromLibrary, onTakePhoto, onPickDocument, onCancel }) => {
  const sheetAction = (icon: string, label: string, onPress: () => void, last = false) => (
    <Pressable
      style={[sharedStyles.optionRow, { borderBottomColor: palette.separator }, last && { borderBottomWidth: 0 }]}
      onPress={onPress}
    >
      <LucideIcon name={icon} size={18} color={palette.textMuted} />
      <Text style={[sharedStyles.optionText, { color: palette.text }]}>{label}</Text>
    </Pressable>
  )
  return (
    <>
      <Text style={[sharedStyles.sheetTitle, { color: palette.text }]}>{`Add to ${relationTo}`}</Text>
      {sheetAction('Images', 'Browse existing', onBrowse)}
      {sheetAction('ImagePlus', 'Choose from Library', onPickFromLibrary)}
      {sheetAction('Camera', 'Take Photo', onTakePhoto)}
      {DocumentPicker?.getDocumentAsync != null && sheetAction('FileText', 'Choose File', onPickDocument)}
      <Pressable style={[sharedStyles.optionRow, { borderBottomWidth: 0 }]} onPress={onCancel}>
        <Text style={[sharedStyles.optionText, { color: palette.textMuted }]}>Cancel</Text>
      </Pressable>
    </>
  )
}
