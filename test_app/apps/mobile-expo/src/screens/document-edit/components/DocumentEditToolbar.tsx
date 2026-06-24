import React from 'react'
import { Stack } from 'expo-router'
import type { SFSymbol } from 'sf-symbols-typescript'

import { localeLabel } from '../utils'
import type { DocumentToolbarProps } from '../types'

/**
 * Native iOS header toolbar (experimental Stack.Toolbar → react-native-screens
 * bar button items). Rendered only when the experimental API exists; the
 * headerRight fallback (DocumentHeaderRight) renders otherwise. Explicit
 * tintColor on every item so header items stay visible in both color schemes.
 */
export const DocumentEditToolbar: React.FC<DocumentToolbarProps> = ({
  pc,
  hasVersions,
  hasDrafts,
  docStatus,
  resolvedEditActions,
  editHandlers,
  doc,
  slug,
  id,
  localDB,
  baseURL,
  token,
  localization,
  activeLocale,
  setActiveLocale,
  formDirty,
  formRef,
  router,
  windowWidth,
  onViewVersions,
  onDuplicate,
  onDelete,
}) => (
  <Stack.Toolbar placement="right">
    {/* Always rendered: the API inspector entry exists for every collection.
        Explicit tintColor on every item: header items must stay visible
        in both color schemes (no reliance on inherited header tint). */}
    <Stack.Toolbar.Menu icon="ellipsis.circle" title="Actions" tintColor={pc.text}>
        {hasVersions && (
          <Stack.Toolbar.MenuAction
            icon="clock.arrow.circlepath"
            onPress={onViewVersions}
          >
            Versions
          </Stack.Toolbar.MenuAction>
        )}
        {hasDrafts && docStatus !== 'published' && (
          <Stack.Toolbar.MenuAction
            icon="arrow.up.doc"
            onPress={() => formRef.current?.submitWithStatus('published')}
          >
            Publish
          </Stack.Toolbar.MenuAction>
        )}
        {hasDrafts && docStatus === 'published' && (
          <Stack.Toolbar.MenuAction
            icon="arrow.down.doc"
            onPress={() => formRef.current?.submitWithStatus('draft')}
          >
            Unpublish
          </Stack.Toolbar.MenuAction>
        )}
        {/* Generic document actions — every collection */}
        <Stack.Toolbar.MenuAction
          icon="plus.square.on.square"
          onPress={onDuplicate}
        >
          Duplicate
        </Stack.Toolbar.MenuAction>
        <Stack.Toolbar.MenuAction
          icon="trash"
          destructive
          onPress={onDelete}
        >
          Delete
        </Stack.Toolbar.MenuAction>
        {/* Custom edit actions from Payload config */}
        {resolvedEditActions.map((action) => (
          <Stack.Toolbar.MenuAction
            key={action.key}
            icon={(action.icon || 'bolt') as SFSymbol}
            onPress={() => {
              const handler = editHandlers[action.key]
              if (handler && doc) {
                handler({
                  collectionSlug: slug,
                  documentId: id,
                  doc: doc as Record<string, unknown>,
                  localDB,
                  baseURL,
                  token,
                })
              }
            }}
          >
            {action.label}
          </Stack.Toolbar.MenuAction>
        ))}
        {/* API inspector — web admin "API" view parity (formSheet) */}
        <Stack.Toolbar.MenuAction
          icon="curlybraces"
          onPress={() => router.push(`/collections/${slug}/api?id=${id}`)}
        >
          API
        </Stack.Toolbar.MenuAction>
      </Stack.Toolbar.Menu>
    {/* Locale switcher (Localizer parity) — only when localization is configured */}
    {localization && (
      <Stack.Toolbar.Menu icon="globe" title="Locale" tintColor={pc.text}>
        {localization.locales.map((l) => (
          <Stack.Toolbar.MenuAction
            key={l.code}
            isOn={activeLocale === l.code}
            onPress={() => setActiveLocale(l.code)}
          >
            {localeLabel(l)}
          </Stack.Toolbar.MenuAction>
        ))}
      </Stack.Toolbar.Menu>
    )}
    {/* Sidebar details — opens/dismisses the formSheet. Wide layouts
        (iPad) get DocumentForm's Notes-style edge tab instead, so the
        toolbar button only renders on phone-width windows. */}
    {windowWidth < 768 && (
      <Stack.Toolbar.Button
        icon="sidebar.right"
        tintColor={pc.text}
        onPress={() => router.push(`/collections/${slug}/details?id=${id}`)}
      />
    )}
    {/* Save — large checkmark icon, dirty-state driven (iOS convention):
        blue + enabled while the form has unsaved edits, gray + disabled
        otherwise. Explicit tint per scheme so it can never vanish. */}
    <Stack.Toolbar.Button
      icon="checkmark.circle.fill"
      variant="done"
      disabled={!formDirty}
      tintColor={formDirty ? pc.primary : pc.textMuted}
      accessibilityLabel="Save"
      onPress={() => {
        if (hasDrafts) {
          const status = (docStatus === 'published' ? 'published' : 'draft') as 'draft' | 'published'
          formRef.current?.submitWithStatus(status)
        } else {
          formRef.current?.submit()
        }
      }}
    >
      Save
    </Stack.Toolbar.Button>
  </Stack.Toolbar>
)
