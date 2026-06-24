import React from 'react'
import { useWindowDimensions, View } from 'react-native'

import type { ClientField } from '../../../types'
import { groupFieldsByWidth, isFieldHidden } from '../../../utils/schemaHelpers'
import type { RenderFieldFn } from './contexts'
import { commonStyles } from './styles'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve an i18n label record (or plain string) to a display string. */
export const resolveI18nText = (
  text: string | Record<string, string> | undefined,
  fallback = '',
): string => {
  if (!text) return fallback
  if (typeof text === 'string') return text
  return text.en || Object.values(text)[0] || fallback
}

/** Resolve a tab's display label from i18n object or string. */
export const getTabLabel = (tab: { label?: string | Record<string, string>; name?: string }, index: number): string => {
  if (tab.label) return resolveI18nText(tab.label, `Tab ${index + 1}`)
  return tab.name || `Tab ${index + 1}`
}

/** Build the full path for a sub-field within a parent. */
export const subPath = (basePath: string, fieldName?: string): string =>
  `${basePath ? basePath + '.' : ''}${fieldName ?? ''}`

/**
 * Breakpoint (px) below which admin.width is treated as guidance —
 * fields stack vertically to avoid cramped layouts on small phones.
 * Above this, widths are honoured as flex ratios (tablet / landscape).
 * Matches Payload web admin's `@include mid-break` behaviour.
 */
export const FIELD_WIDTH_BREAKPOINT = 500

/**
 * Hook that returns whether the current screen is too narrow to
 * honour admin.width values. Uses window width directly.
 */
export const useCompactFields = (): boolean => {
  const { width } = useWindowDimensions()
  return width < FIELD_WIDTH_BREAKPOINT
}

/**
 * Render sub-fields, grouping consecutive fields with `admin.width` into
 * flex rows so they lay out side-by-side (e.g. two 50% fields in one row).
 *
 * When `compact` is true (small screens), width-grouped fields are rendered
 * stacked vertically instead of in rows, treating admin.width as guidance.
 *
 * Fields that would render as empty placeholders are dropped BEFORE any row
 * wrapper exists (canonical section contract): `admin.hidden` sub-fields are
 * filtered up front, and condition-hidden fields (renderFn returns null) skip
 * their Fragment wrapper entirely — so SubFieldRows / FormSection never wrap
 * an empty row or draw a separator around one.
 */
export const renderSubFieldsWithWidth = (
  fields: ClientField[],
  buildPath: (field: ClientField) => string,
  renderFn: RenderFieldFn,
  keyPrefix: string,
  compact = false,
): React.ReactNode[] => {
  const groups = groupFieldsByWidth(fields.filter((f) => !isFieldHidden(f)))
  return groups.map((group, gi) => {
    if (group.type === 'width-row') {
      const rendered = group.fields
        .map((sub) => ({ sub, node: renderFn(sub, buildPath(sub)) }))
        .filter(({ node }) => node != null && node !== false)
      if (rendered.length === 0) return null
      if (compact) {
        // On small screens: render each field full-width, stacked vertically
        return (
          <React.Fragment key={`${keyPrefix}-wrow-${gi}`}>
            {rendered.map(({ sub, node }) => (
              <React.Fragment key={sub.name || `${keyPrefix}-wf-${gi}`}>
                {node}
              </React.Fragment>
            ))}
          </React.Fragment>
        )
      }
      // On wide screens: render side-by-side with proportional flex
      return (
        <View key={`${keyPrefix}-wrow-${gi}`} style={commonStyles.widthRow}>
          {rendered.map(({ sub, node }) => (
            <View key={sub.name || `${keyPrefix}-wf-${gi}`} style={{ flex: parseFloat(sub.admin!.width!) / 100 }}>
              {node}
            </View>
          ))}
        </View>
      )
    }
    const sub = group.field
    const node = renderFn(sub, buildPath(sub))
    if (node == null || node === false) return null
    return (
      <React.Fragment key={sub.name || `${keyPrefix}-${gi}`}>
        {node}
      </React.Fragment>
    )
  })
}

/**
 * Append an error-count suffix to a string label. Used only where badges are
 * NOT feasible: native SwiftUI Section / DisclosureGroup / segmented-control
 * labels are plain strings.
 */
export const withErrorSuffix = (label: string, count: number): string =>
  count > 0 ? `${label} (${count})` : label

// Native segmented controls cap at SEGMENTED_THRESHOLD entries; beyond that
// the JS pill bar renders horizontally scrollable.
export const SEGMENTED_THRESHOLD = 6
