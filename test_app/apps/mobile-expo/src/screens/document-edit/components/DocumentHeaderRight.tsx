import React from 'react'
import { Pressable, Text, View } from 'react-native'
import { Save } from 'lucide-react-native'

import { DocumentActionsMenu } from '@payload-universal/admin-native'

import { localeLabel } from '../utils'
import type { DocumentToolbarProps } from '../types'

/**
 * headerRight fallback — rendered when the experimental Stack.Toolbar API is
 * missing (older expo-router) or on Android. Mirrors the native toolbar:
 * DocumentActionsMenu (versions/draft/publish + generic + custom + API +
 * locale actions) plus a dirty-state Save button.
 */
export const DocumentHeaderRight: React.FC<DocumentToolbarProps> = ({
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
  onViewVersions,
  onDuplicate,
  onDelete,
}) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginRight: 4 }}>
    <DocumentActionsMenu
      hasVersions={hasVersions}
      hasDrafts={hasDrafts}
      currentStatus={docStatus}
      onViewVersions={onViewVersions}
      onSaveDraft={() => formRef.current?.submitWithStatus('draft')}
      onPublish={() => formRef.current?.submitWithStatus('published')}
      onUnpublish={() => formRef.current?.submitWithStatus('draft')}
      extraActions={[
        // Generic document actions — every collection
        {
          label: 'Duplicate',
          icon: 'plus.square.on.square',
          onPress: onDuplicate,
        },
        {
          label: 'Delete',
          icon: 'trash',
          destructive: true,
          onPress: onDelete,
        },
        ...resolvedEditActions.map((action) => ({
          label: action.label,
          icon: action.icon,
          destructive: action.destructive,
          onPress: () => {
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
          },
        })),
        // API inspector (web admin parity)
        {
          label: 'API',
          icon: 'curlybraces',
          onPress: () => router.push(`/collections/${slug}/api?id=${id}`),
        },
        // Locale switcher (Localizer parity)
        ...(localization
          ? localization.locales.map((l) => ({
              label: `${activeLocale === l.code ? '✓ ' : ''}Locale: ${localeLabel(l)}`,
              icon: 'globe',
              onPress: () => setActiveLocale(l.code),
            }))
          : []),
      ]}
    />
    <Pressable
      disabled={!formDirty}
      onPress={() => {
        if (hasDrafts) {
          const status = (docStatus === 'published' ? 'published' : 'draft') as 'draft' | 'published'
          formRef.current?.submitWithStatus(status)
        } else {
          formRef.current?.submit()
        }
      }}
      hitSlop={8}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: formDirty ? 1 : 0.45 }}
    >
      <Save size={22} color={formDirty ? pc.primary : pc.textMuted} />
      <Text style={{ color: formDirty ? pc.primary : pc.textMuted, fontSize: 15, fontWeight: '600' }}>Save</Text>
    </Pressable>
  </View>
)
