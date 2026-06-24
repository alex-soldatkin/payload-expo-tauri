// ---------------------------------------------------------------------------
// Step 0 — OR-group overview (web WhereBuilder parity): groups as glass inset
// sections separated by an 'OR' pill divider, conditions within a group carry
// a subtle 'and' label, plus the query-presets section.
// ---------------------------------------------------------------------------
import React from 'react'
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native'

import type { ActiveFilter, FilterCondition } from '../../hooks/useDocumentListFilters'
import type { ListColorPalette } from '../../hooks/useListColors'
import type { FilterStyles } from '../types'
import type { useQueryPresets } from '../hooks/useQueryPresets'
import { formatFilterValue } from '../utils'
import { GroupSurface } from './GroupSurface'

type OverviewStepProps = {
  styles: FilterStyles
  colors: ListColorPalette
  overviewGroups: ActiveFilter[][]
  onRemoveFilter?: (id: string) => void
  prefillFromFilter: (filter: ActiveFilter) => void
  startAdd: (mode: 'and' | 'or') => void
  presetsEnabled: boolean
  presets: ReturnType<typeof useQueryPresets>
  activeFilters?: ActiveFilter[]
  onApplyFilterGroups?: (groups: FilterCondition[][]) => void
  handleClose: () => void
}

export const OverviewStep: React.FC<OverviewStepProps> = ({
  styles,
  colors,
  overviewGroups,
  onRemoveFilter,
  prefillFromFilter,
  startAdd,
  presetsEnabled,
  presets,
  activeFilters,
  onApplyFilterGroups,
  handleClose,
}) => {
  const {
    presets: presetDocs,
    presetsLoading,
    parsedPresets,
    presetSaveOpen,
    setPresetSaveOpen,
    presetTitle,
    setPresetTitle,
    presetSaving,
    presetError,
    setPresetError,
    handleSavePreset,
  } = presets

  return (
    <ScrollView
      style={styles.overviewScroll}
      contentContainerStyle={styles.overviewContent}
      showsVerticalScrollIndicator={false}
    >
      {overviewGroups.length === 0 && (
        <Text style={styles.emptyText}>No filters set</Text>
      )}
      {overviewGroups.map((group, gi) => (
        <React.Fragment key={group[0].id}>
          {gi > 0 && (
            <View style={styles.orPillRow}>
              <View style={styles.orPillLine} />
              <View style={styles.orPill}>
                <Text style={styles.orPillText}>OR</Text>
              </View>
              <View style={styles.orPillLine} />
            </View>
          )}
          <GroupSurface styles={styles}>
            {group.map((f, fi) => (
              <React.Fragment key={f.id}>
                {fi > 0 && (
                  <View style={styles.andRow}>
                    <Text style={styles.andLabel}>and</Text>
                    <View style={styles.andLine} />
                  </View>
                )}
                <Pressable
                  style={({ pressed }) => [
                    styles.conditionRow,
                    pressed && styles.conditionRowPressed,
                  ]}
                  onPress={() => prefillFromFilter(f)}
                >
                  <Text style={styles.conditionText} numberOfLines={2}>
                    <Text style={styles.conditionField}>{f.fieldLabel}</Text>
                    {` ${f.operatorLabel} `}
                    <Text style={styles.conditionValue}>{formatFilterValue(f)}</Text>
                  </Text>
                  {onRemoveFilter && (
                    <Pressable onPress={() => onRemoveFilter(f.id)} hitSlop={10}>
                      <Text style={styles.conditionRemove}>✕</Text>
                    </Pressable>
                  )}
                </Pressable>
              </React.Fragment>
            ))}
          </GroupSurface>
        </React.Fragment>
      ))}

      {/* '+ Add filter' ANDs into the current group; '+ Or' starts a new group */}
      <View style={styles.overviewActions}>
        <Pressable style={styles.addFilterBtn} onPress={() => startAdd('and')}>
          <Text style={styles.addFilterText}>+ Add filter</Text>
        </Pressable>
        {overviewGroups.length > 0 && (
          <Pressable style={styles.addOrBtn} onPress={() => startAdd('or')}>
            <Text style={styles.addOrText}>+ Or</Text>
          </Pressable>
        )}
      </View>

      {/* ── Query presets (payload-query-presets, REST-only) ───────── */}
      {presetsEnabled && (
        <View style={styles.presetSection}>
          <Text style={styles.presetHeading}>Presets</Text>
          {presetsLoading && presetDocs.length === 0 ? (
            <ActivityIndicator style={styles.presetLoading} />
          ) : parsedPresets.length === 0 ? (
            <Text style={styles.presetEmpty}>No saved presets</Text>
          ) : (
            parsedPresets.map(({ preset, groups: presetGroups, unsupported }) => (
              <Pressable
                key={preset.id}
                style={({ pressed }) => [styles.presetRow, pressed && styles.conditionRowPressed]}
                onPress={() => {
                  onApplyFilterGroups?.(presetGroups)
                  handleClose()
                }}
              >
                <View style={styles.presetRowBody}>
                  <Text style={styles.presetTitle} numberOfLines={1}>{preset.title}</Text>
                  {unsupported.length > 0 && (
                    <Text style={styles.presetWarn} numberOfLines={2}>
                      Includes conditions this device can't filter locally
                      {` (${unsupported.join(', ')})`}
                    </Text>
                  )}
                </View>
                {preset.isShared ? (
                  <View style={styles.presetBadge}>
                    <Text style={styles.presetBadgeText}>Shared</Text>
                  </View>
                ) : null}
              </Pressable>
            ))
          )}

          {/* Save the current filters as a new query preset */}
          {(activeFilters?.length ?? 0) > 0 && (
            presetSaveOpen ? (
              <View style={styles.presetSaveBox}>
                <TextInput
                  style={styles.textInput}
                  value={presetTitle}
                  onChangeText={setPresetTitle}
                  placeholder="Preset title"
                  placeholderTextColor={colors.textPlaceholder}
                  autoCapitalize="sentences"
                  autoCorrect={false}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleSavePreset}
                />
                {presetError && <Text style={styles.presetError}>{presetError}</Text>}
                <View style={styles.presetSaveActions}>
                  <Pressable
                    style={[
                      styles.addFilterBtn,
                      (!presetTitle.trim() || presetSaving) && styles.applyDisabled,
                    ]}
                    disabled={!presetTitle.trim() || presetSaving}
                    onPress={handleSavePreset}
                  >
                    <Text style={styles.addFilterText}>
                      {presetSaving ? 'Saving…' : 'Save preset'}
                    </Text>
                  </Pressable>
                  <Pressable
                    style={styles.addOrBtn}
                    onPress={() => {
                      setPresetSaveOpen(false)
                      setPresetError(null)
                    }}
                  >
                    <Text style={styles.addOrText}>Cancel</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [styles.presetRow, pressed && styles.conditionRowPressed]}
                onPress={() => setPresetSaveOpen(true)}
              >
                <Text style={styles.presetSaveLink}>+ Save filters as preset…</Text>
              </Pressable>
            )
          )}
        </View>
      )}
    </ScrollView>
  )
}
