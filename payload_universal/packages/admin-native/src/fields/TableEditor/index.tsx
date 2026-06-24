/**
 * TableEditor — native editable grid for Lexical table nodes.
 *
 * Renders a horizontally scrollable table with borderless iOS-Settings-style
 * cells. Supports adding/removing rows and columns, toggling a header row,
 * and direct text editing in each cell.
 *
 * Uses GlassView on iOS 26+ for the table container and action buttons.
 */
import React, { useCallback, useState } from 'react'
import { Platform, Pressable, ScrollView, Text, View } from 'react-native'

import { ActionButton } from './components/ActionButton'
import { Cell } from './components/Cell'
import { MIN_CELL_WIDTH } from './constants'
import { GlassView, liquidGlassAvailable } from './glass'
import {
  addColumn,
  addRow,
  removeColumn,
  removeRow,
  setCellText,
  toggleHeaderRow,
} from './helpers'
import { styles } from './styles'
import type { TableEditorProps, TableNode } from './types'

// Re-export the public API so `from './TableEditor'` resolves identically.
export type {
  ParagraphNode,
  TableCellNode,
  TableEditorProps,
  TableNode,
  TableRowNode,
  TextNode,
} from './types'
export {
  addColumn,
  addRow,
  createEmptyTable,
  getCellText,
  removeColumn,
  removeRow,
  setCellText,
  toggleHeaderRow,
} from './helpers'

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export const TableEditor: React.FC<TableEditorProps> = ({
  data,
  onChange,
  disabled = false,
}) => {
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null)

  const rows = data.children ?? []
  const colCount = rows[0]?.children.length ?? 0
  const hasHeaderRow = rows[0]?.children[0]?.headerState === 1

  const handleCellChange = useCallback(
    (rowIdx: number, colIdx: number, text: string) => {
      const newChildren = data.children.map((row, ri) => {
        if (ri !== rowIdx) return row
        return {
          ...row,
          children: row.children.map((cell, ci) => {
            if (ci !== colIdx) return cell
            return setCellText(cell, text)
          }),
        }
      })
      onChange({ ...data, children: newChildren })
    },
    [data, onChange],
  )

  const handleToggleHeader = useCallback(() => {
    onChange(toggleHeaderRow(data))
  }, [data, onChange])

  const handleAddRow = useCallback(() => {
    onChange(addRow(data))
  }, [data, onChange])

  const handleAddColumn = useCallback(() => {
    onChange(addColumn(data))
  }, [data, onChange])

  const handleRemoveRow = useCallback(
    (index: number) => {
      onChange(removeRow(data, index))
    },
    [data, onChange],
  )

  const handleRemoveColumn = useCallback(
    (index: number) => {
      onChange(removeColumn(data, index))
    },
    [data, onChange],
  )

  const tableContent = (
    <>
      {/* Header toggle button (top-left corner) */}
      {!disabled && (
        <View style={styles.headerToggleRow}>
          <Pressable
            style={({ pressed }) => [
              styles.headerToggle,
              hasHeaderRow && styles.headerToggleActive,
              pressed && styles.actionBtnPressed,
            ]}
            onPress={handleToggleHeader}
          >
            <Text
              style={[
                styles.headerToggleText,
                hasHeaderRow && styles.headerToggleTextActive,
              ]}
            >
              H
            </Text>
          </Pressable>
          <Text style={styles.headerToggleLabel}>
            {hasHeaderRow ? 'Header row on' : 'Header row off'}
          </Text>
        </View>
      )}

      {/* Scrollable grid */}
      <ScrollView horizontal showsHorizontalScrollIndicator={Platform.OS !== 'ios'} bounces>
        <View>
          {/* Column remove buttons */}
          {!disabled && colCount > 1 && (
            <View style={styles.colActionsRow}>
              {Array.from({ length: colCount }, (_, ci) => (
                <View key={`col-rm-${ci}`} style={[styles.colActionCell, { minWidth: MIN_CELL_WIDTH }]}>
                  <ActionButton label="-" onPress={() => handleRemoveColumn(ci)} variant="remove" />
                </View>
              ))}
            </View>
          )}

          {/* Table rows */}
          {rows.map((row, ri) => (
            <View key={`row-${ri}`} style={styles.tableRow}>
              {row.children.map((cell, ci) => (
                <Cell
                  key={`cell-${ri}-${ci}`}
                  cell={cell}
                  isFocused={focusedCell?.row === ri && focusedCell?.col === ci}
                  disabled={disabled}
                  onChangeText={(text) => handleCellChange(ri, ci, text)}
                  onFocus={() => setFocusedCell({ row: ri, col: ci })}
                  onBlur={() => setFocusedCell(null)}
                />
              ))}

              {/* Row remove button */}
              {!disabled && rows.length > 1 && (
                <View style={styles.rowAction}>
                  <ActionButton label="-" onPress={() => handleRemoveRow(ri)} variant="remove" />
                </View>
              )}
            </View>
          ))}

          {/* Add row button */}
          {!disabled && (
            <View style={styles.addRowContainer}>
              <ActionButton label="+" onPress={handleAddRow} />
              <Text style={styles.addLabel}>Row</Text>
            </View>
          )}
        </View>

        {/* Add column button (positioned beside last column) */}
        {!disabled && (
          <View style={styles.addColContainer}>
            <ActionButton label="+" onPress={handleAddColumn} />
            <Text style={styles.addLabel}>Col</Text>
          </View>
        )}
      </ScrollView>
    </>
  )

  if (liquidGlassAvailable && GlassView) {
    return (
      <GlassView style={styles.containerGlass} glassEffectStyle="regular">
        {tableContent}
      </GlassView>
    )
  }

  return <View style={styles.container}>{tableContent}</View>
}
