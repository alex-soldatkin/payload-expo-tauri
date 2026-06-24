import React from 'react'
import { TextInput, View } from 'react-native'

import { useListColors } from '../../../hooks/useListColors'
import { MIN_CELL_WIDTH } from '../constants'
import { getCellText } from '../helpers'
import { styles } from '../styles'
import type { TableCellNode } from '../types'

/** A single editable table cell. */
export const Cell: React.FC<{
  cell: TableCellNode
  isFocused: boolean
  disabled: boolean
  onChangeText: (text: string) => void
  onFocus: () => void
  onBlur: () => void
}> = React.memo(({ cell, isFocused, disabled, onChangeText, onFocus, onBlur }) => {
  const { dark, colors: c } = useListColors()
  const isHeader = cell.headerState === 1
  const text = getCellText(cell)

  return (
    <View
      style={[
        styles.cell,
        { borderColor: c.separator },
        isHeader && { backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)' },
        isFocused && [styles.cellFocused, { borderColor: c.primary }],
        cell.width ? { width: Math.max(cell.width, MIN_CELL_WIDTH) } : { minWidth: MIN_CELL_WIDTH },
      ]}
    >
      <TextInput
        style={[styles.cellInput, { color: c.text }, isHeader && styles.cellInputHeader]}
        value={text}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        editable={!disabled}
        placeholder={isHeader ? 'Header' : ''}
        placeholderTextColor={c.textPlaceholder}
        returnKeyType="next"
        blurOnSubmit={false}
        multiline={false}
      />
    </View>
  )
})
