/**
 * Tabs field — tab bar + active tab content.
 *
 * Tab bar tiers (via SegmentedIndexPicker, registry-gated):
 *   1. SwiftUI Picker + pickerStyle('segmented')  — iOS
 *   2. JC Picker variant='segmented'              — Android (≤6 tabs)
 *   3. JS pill bar (scrollable beyond 6 tabs)     — everywhere else
 *
 * INTERNAL — import via the `fields/structural` barrel only.
 */
import React, { useContext, useMemo, useState } from 'react'
import { StyleSheet, View } from 'react-native'

import type { ClientField, ClientTabsField, FieldComponentProps } from '../../types'
import { defaultTheme as t } from '../../theme'
import {
  ErrorMapContext,
  countErrorsForPrefix,
  getTabLabel,
  renderSubFieldsWithWidth,
  SegmentedIndexPicker,
  subPath,
  TabDepthContext,
  useCompactFields,
  useRenderField,
  useTabDepth,
  type RenderFieldFn,
} from './common'

/** Shared tab error counting logic. */
const useTabErrorCounts = (tabs: any[], path: string) => {
  const errors = useContext(ErrorMapContext)
  return useMemo(() =>
    tabs.map((tab) => {
      let count = 0
      for (const sub of tab.fields ?? []) {
        const fp = tab.name ? `${subPath(path, tab.name)}.${sub.name ?? ''}` : subPath(path, sub.name)
        count += countErrorsForPrefix(errors, fp)
      }
      return count
    }), [tabs, path, errors])
}

/** Render active tab content, wrapped in depth+1 context for nested tabs. */
const TabContent: React.FC<{
  activeTab: any
  path: string
  depth: number
  renderField: RenderFieldFn
}> = ({ activeTab, path, depth, renderField }) => {
  const compact = useCompactFields()
  if (!activeTab) return null
  return (
    <TabDepthContext.Provider value={depth + 1}>
      <View style={styles.tabContent}>
        {renderSubFieldsWithWidth(
          activeTab.fields ?? [],
          (sub: ClientField) => activeTab.name ? `${subPath(path, activeTab.name)}.${sub.name ?? ''}` : subPath(path, sub.name),
          renderField,
          activeTab.name || 'tab',
          compact,
        )}
      </View>
    </TabDepthContext.Provider>
  )
}

export const TabsField: React.FC<FieldComponentProps<ClientTabsField>> = ({
  field, path,
}) => {
  const renderField = useRenderField()
  const depth = useTabDepth()
  const tabs = field.tabs ?? []
  const [activeIndex, setActiveIndex] = useState(0)
  const activeTab = tabs[activeIndex]
  const tabErrorCounts = useTabErrorCounts(tabs, path)

  const labels = tabs.map((tab, i) => getTabLabel(tab, i))

  return (
    <View style={[styles.tabsContainer, depth > 0 && styles.tabsNested]}>
      <SegmentedIndexPicker
        labels={labels}
        selectedIndex={activeIndex}
        onSelect={setActiveIndex}
        errorCounts={tabErrorCounts}
      />
      <TabContent activeTab={activeTab} path={path} depth={depth} renderField={renderField} />
    </View>
  )
}

const styles = StyleSheet.create({
  tabsContainer: { marginBottom: t.spacing.xs },
  tabsNested: { marginBottom: 2, marginTop: 2 },
  tabContent: { paddingTop: 4 },
})
