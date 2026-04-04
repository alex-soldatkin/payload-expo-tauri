/**
 * TableEditor — native editable grid for Lexical table nodes.
 *
 * Renders a horizontally scrollable table with borderless iOS-Settings-style
 * cells. Supports adding/removing rows and columns, toggling a header row,
 * and direct text editing in each cell.
 *
 * Uses GlassView on iOS 26+ for the table container and action buttons.
 */
import React, { useCallback, useMemo, useRef, useState } from 'react'
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { defaultTheme as t } from '../theme'

// ---------------------------------------------------------------------------
// Optional: GlassView for liquid glass on iOS 26+
// ---------------------------------------------------------------------------

let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

// ---------------------------------------------------------------------------
// Lexical table types
// ---------------------------------------------------------------------------

export type TextNode = {
  type: 'text'
  text: string
  format: 0
  detail: 0
  mode: 'normal'
  style: ''
  version: 1
}

export type ParagraphNode = {
  type: 'paragraph'
  children: TextNode[]
  direction: 'ltr'
  format: '' | number
  indent: 0
  version: 1
}

export type TableCellNode = {
  type: 'tablecell'
  headerState: number
  children: ParagraphNode[]
  direction: 'ltr'
  format: '' | number
  indent: 0
  version: 1
  colSpan?: number
  rowSpan?: number
  width?: number
  backgroundColor?: string | null
}

export type TableRowNode = {
  type: 'tablerow'
  children: TableCellNode[]
  direction: 'ltr'
  format: '' | number
  indent: 0
  version: 1
  height?: number
}

export type TableNode = {
  type: 'table'
  children: TableRowNode[]
  direction: 'ltr'
  format: '' | number
  indent: 0
  version: 1
}

export type TableEditorProps = {
  /** The Lexical table node data */
  data: TableNode
  /** Called when table data changes */
  onChange: (data: TableNode) => void
  /** Whether editing is disabled */
  disabled?: boolean
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/** Create a single text node. */
const makeTextNode = (text: string): TextNode => ({
  type: 'text',
  text,
  format: 0,
  detail: 0,
  mode: 'normal',
  style: '',
  version: 1,
})

/** Create a paragraph node wrapping a single text node. */
const makeParagraphNode = (text: string): ParagraphNode => ({
  type: 'paragraph',
  children: text ? [makeTextNode(text)] : [],
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
})

/** Create an empty cell. */
const makeCell = (headerState = 0): TableCellNode => ({
  type: 'tablecell',
  headerState,
  children: [makeParagraphNode('')],
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
  colSpan: 1,
  rowSpan: 1,
})

/** Create a table row with `cols` empty cells. */
const makeRow = (cols: number, headerState = 0): TableRowNode => ({
  type: 'tablerow',
  children: Array.from({ length: cols }, () => makeCell(headerState)),
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
})

/** Create a new table with empty cells. */
export const createEmptyTable = (rows: number, cols: number): TableNode => ({
  type: 'table',
  children: Array.from({ length: rows }, () => makeRow(cols)),
  direction: 'ltr',
  format: '',
  indent: 0,
  version: 1,
})

/** Extract plain text from a cell's paragraph children. */
export const getCellText = (cell: TableCellNode): string =>
  (cell.children ?? [])
    .flatMap((p) => (p.children ?? []).map((t) => t.text))
    .join('')

/** Return a new cell with its text replaced. */
export const setCellText = (cell: TableCellNode, text: string): TableCellNode => ({
  ...cell,
  children: [makeParagraphNode(text)],
})

/** Add a row at the bottom of the table. */
export const addRow = (table: TableNode): TableNode => {
  const cols = table.children[0]?.children.length ?? 1
  return {
    ...table,
    children: [...table.children, makeRow(cols)],
  }
}

/** Add a column at the right edge of the table. */
export const addColumn = (table: TableNode): TableNode => {
  const isHeaderRow = (rowIdx: number) =>
    table.children[rowIdx]?.children[0]?.headerState === 1

  return {
    ...table,
    children: table.children.map((row, ri) => ({
      ...row,
      children: [
        ...row.children,
        makeCell(isHeaderRow(ri) ? 1 : 0),
      ],
    })),
  }
}

/** Remove a row by index. Returns unchanged table if only one row remains. */
export const removeRow = (table: TableNode, index: number): TableNode => {
  if (table.children.length <= 1) return table
  return {
    ...table,
    children: table.children.filter((_, i) => i !== index),
  }
}

/** Remove a column by index. Returns unchanged table if only one column remains. */
export const removeColumn = (table: TableNode, index: number): TableNode => {
  const cols = table.children[0]?.children.length ?? 0
  if (cols <= 1) return table
  return {
    ...table,
    children: table.children.map((row) => ({
      ...row,
      children: row.children.filter((_, i) => i !== index),
    })),
  }
}

/** Toggle the first row between header (headerState=1) and normal (headerState=0). */
export const toggleHeaderRow = (table: TableNode): TableNode => {
  if (table.children.length === 0) return table
  const firstRow = table.children[0]
  const isHeader = firstRow.children[0]?.headerState === 1
  const newState = isHeader ? 0 : 1

  return {
    ...table,
    children: [
      {
        ...firstRow,
        children: firstRow.children.map((cell) => ({
          ...cell,
          headerState: newState,
        })),
      },
      ...table.children.slice(1),
    ],
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_CELL_WIDTH = 100
const CELL_PADDING = 8
const ACTION_BTN_SIZE = 28

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** A single editable table cell. */
const Cell: React.FC<{
  cell: TableCellNode
  isFocused: boolean
  disabled: boolean
  onChangeText: (text: string) => void
  onFocus: () => void
  onBlur: () => void
}> = React.memo(({ cell, isFocused, disabled, onChangeText, onFocus, onBlur }) => {
  const isHeader = cell.headerState === 1
  const text = getCellText(cell)

  return (
    <View
      style={[
        styles.cell,
        isHeader && styles.cellHeader,
        isFocused && styles.cellFocused,
        cell.width ? { width: Math.max(cell.width, MIN_CELL_WIDTH) } : { minWidth: MIN_CELL_WIDTH },
      ]}
    >
      <TextInput
        style={[styles.cellInput, isHeader && styles.cellInputHeader]}
        value={text}
        onChangeText={onChangeText}
        onFocus={onFocus}
        onBlur={onBlur}
        editable={!disabled}
        placeholder={isHeader ? 'Header' : ''}
        placeholderTextColor={t.colors.textPlaceholder}
        returnKeyType="next"
        blurOnSubmit={false}
        multiline={false}
      />
    </View>
  )
})

/** Small action button (+ or -). */
const ActionButton: React.FC<{
  label: string
  onPress: () => void
  variant?: 'add' | 'remove'
}> = ({ label, onPress, variant = 'add' }) => {
  const isRemove = variant === 'remove'

  if (liquidGlassAvailable && GlassView) {
    return (
      <Pressable onPress={onPress}>
        <GlassView style={styles.actionBtnGlass} isInteractive glassEffectStyle="regular">
          <Text style={[styles.actionBtnText, isRemove && styles.actionBtnTextRemove]}>
            {label}
          </Text>
        </GlassView>
      </Pressable>
    )
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.actionBtn,
        isRemove && styles.actionBtnRemove,
        pressed && styles.actionBtnPressed,
      ]}
      onPress={onPress}
    >
      <Text style={[styles.actionBtnText, isRemove && styles.actionBtnTextRemove]}>
        {label}
      </Text>
    </Pressable>
  )
}

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

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    marginBottom: t.spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    borderRadius: t.borderRadius.md,
    backgroundColor: t.colors.surface,
    overflow: 'hidden',
    padding: t.spacing.xs,
  },
  containerGlass: {
    marginBottom: t.spacing.sm,
    borderRadius: t.borderRadius.md,
    overflow: 'hidden',
    padding: t.spacing.xs,
  },

  // Header toggle
  headerToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: t.spacing.xs,
    gap: t.spacing.xs,
  },
  headerToggle: {
    width: ACTION_BTN_SIZE,
    height: ACTION_BTN_SIZE,
    borderRadius: t.borderRadius.sm / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.colors.background,
  },
  headerToggleActive: {
    backgroundColor: t.colors.primary,
    borderColor: t.colors.primary,
  },
  headerToggleText: {
    fontSize: t.fontSize.xs,
    fontWeight: '700',
    color: t.colors.textMuted,
  },
  headerToggleTextActive: {
    color: t.colors.primaryText,
  },
  headerToggleLabel: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
  },

  // Table grid
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },

  // Column action strip (remove buttons above columns)
  colActionsRow: {
    flexDirection: 'row',
    marginBottom: 2,
  },
  colActionCell: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },

  // Cell
  cell: {
    minWidth: MIN_CELL_WIDTH,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.separator,
    justifyContent: 'center',
    // Collapse double borders between adjacent cells
    marginRight: -StyleSheet.hairlineWidth,
    marginBottom: -StyleSheet.hairlineWidth,
  },
  cellHeader: {
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  cellFocused: {
    borderColor: t.colors.primary,
    borderWidth: 1.5,
    zIndex: 1,
  },
  cellInput: {
    paddingHorizontal: CELL_PADDING,
    paddingVertical: CELL_PADDING,
    fontSize: t.fontSize.sm,
    color: t.colors.text,
    minHeight: 36,
  },
  cellInputHeader: {
    fontWeight: '600',
  },

  // Row action (remove button beside each row)
  rowAction: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: t.spacing.xs,
  },

  // Add row/column containers
  addRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: t.spacing.xs,
    gap: t.spacing.xs,
  },
  addColContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: t.spacing.xs,
    gap: 2,
  },
  addLabel: {
    fontSize: t.fontSize.xs,
    color: t.colors.textMuted,
  },

  // Action buttons (+ / -)
  actionBtn: {
    width: ACTION_BTN_SIZE,
    height: ACTION_BTN_SIZE,
    borderRadius: ACTION_BTN_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: t.colors.border,
    backgroundColor: t.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnGlass: {
    width: ACTION_BTN_SIZE,
    height: ACTION_BTN_SIZE,
    borderRadius: ACTION_BTN_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnRemove: {
    borderColor: t.colors.destructive + '40',
    backgroundColor: t.colors.errorBackground,
  },
  actionBtnPressed: {
    opacity: 0.6,
  },
  actionBtnText: {
    fontSize: t.fontSize.md,
    fontWeight: '500',
    color: t.colors.textMuted,
    lineHeight: t.fontSize.md + 2,
  },
  actionBtnTextRemove: {
    color: t.colors.destructive,
  },
})
