import React from 'react'
import { View } from 'react-native'

import { usePalette } from '../palette'
import { commonStyles } from '../styles'

// ---------------------------------------------------------------------------
// SubFieldRows — the FormSection separator system for NESTED field lists
// (group/collapsible bodies, array/blocks row cards). The enclosing card is
// supplied by the caller (glass or fill); this component owns the row chrome:
//   - each child wraps in a row with the canonical CONTENT_INSET and the
//     ROW_MIN_HEIGHT floor (centered) — children add no horizontal inset
//   - hairline separators BETWEEN rows only (never after the last, never for
//     a single child), inset CONTENT_INSET from the left, flush right
// Children must arrive pre-filtered (renderSubFieldsWithWidth drops hidden /
// condition-null fields), mirroring the FormSection caller contract.
// ---------------------------------------------------------------------------

export const SubFieldRows: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const palette = usePalette()
  const rows = React.Children.toArray(children).filter(Boolean)
  return (
    <>
      {rows.map((child, index) => (
        <React.Fragment key={`subrow-${index}`}>
          <View style={commonStyles.subRow}>{child}</View>
          {index < rows.length - 1 && (
            <View style={[commonStyles.subRowSeparator, { backgroundColor: palette.separator }]} />
          )}
        </React.Fragment>
      ))}
    </>
  )
}
