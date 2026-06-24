import React from 'react'
import { Text, View } from 'react-native'

import type { ClientField } from '../../types'
import { deepEqual, diffWords, extractLexicalText, getRelationLabel } from '../../utils/diff'
import { useDiffTheme } from '../theme'
import {
  MONO_TYPES,
  TEXTISH_TYPES,
  formatScalar,
  isLocaleMap,
  isPrimitiveArray,
  isRecord,
  textishValue,
} from '../utils'
import { InlineDiffText } from './InlineDiffText'
import { OldNewBoxes } from './OldNewBoxes'
import { RowsDiff } from './RowsDiff'

// ---------------------------------------------------------------------------
// DiffBody — per-field-type diff visualization
// ---------------------------------------------------------------------------

const DiffBodyInner: React.FC<{
  field: ClientField
  valueFrom: unknown
  valueTo: unknown
}> = ({ field, valueFrom, valueTo }) => {
  const { styles } = useDiffTheme()
  const type = field.type

  if (type === 'array' || type === 'blocks') {
    return <RowsDiff field={field} valueFrom={valueFrom} valueTo={valueTo} />
  }

  if (type === 'richText') {
    const fromText = extractLexicalText(valueFrom)
    const toText = extractLexicalText(valueTo)
    if (fromText === toText) {
      return <Text style={styles.formattingOnlyNote}>(formatting-only change)</Text>
    }
    return <InlineDiffText segments={diffWords(fromText, toText)} />
  }

  if (TEXTISH_TYPES.has(type)) {
    return (
      <InlineDiffText
        segments={diffWords(textishValue(field, valueFrom), textishValue(field, valueTo))}
        mono={MONO_TYPES.has(type)}
      />
    )
  }

  if (type === 'relationship' || type === 'upload') {
    return (
      <OldNewBoxes
        fromStr={getRelationLabel(valueFrom) || '—'}
        toStr={getRelationLabel(valueTo) || '—'}
      />
    )
  }

  // Scalars and unknown complex values (primitive arrays render inline)
  const isComplexValue = (v: unknown): boolean =>
    v != null && typeof v === 'object' && !isPrimitiveArray(v)
  const isComplex = isComplexValue(valueFrom) || isComplexValue(valueTo)
  return (
    <OldNewBoxes
      fromStr={formatScalar(valueFrom, type)}
      toStr={formatScalar(valueTo, type)}
      mono={isComplex}
      vertical={isComplex}
    />
  )
}

/** Wraps DiffBodyInner with per-locale sub-rows for localized values. */
export const DiffBody: React.FC<{
  field: ClientField
  valueFrom: unknown
  valueTo: unknown
}> = ({ field, valueFrom, valueTo }) => {
  const { styles } = useDiffTheme()

  if (isLocaleMap(field, valueFrom) || isLocaleMap(field, valueTo)) {
    const fromMap = isRecord(valueFrom) ? valueFrom : {}
    const toMap = isRecord(valueTo) ? valueTo : {}
    const locales = [...new Set([...Object.keys(fromMap), ...Object.keys(toMap)])]
    return (
      <View>
        {locales.map((locale) => {
          const lf = fromMap[locale]
          const lt = toMap[locale]
          const changed = !deepEqual(lf, lt)
          return (
            <View key={locale} style={styles.localeRow}>
              <View style={styles.localePill}>
                <Text style={styles.localePillText}>{locale}</Text>
              </View>
              <View style={styles.localeBody}>
                {changed ? (
                  <DiffBodyInner field={field} valueFrom={lf} valueTo={lt} />
                ) : (
                  <Text style={styles.rowsUnchangedNote}>Unchanged</Text>
                )}
              </View>
            </View>
          )
        })}
      </View>
    )
  }

  return <DiffBodyInner field={field} valueFrom={valueFrom} valueTo={valueTo} />
}
