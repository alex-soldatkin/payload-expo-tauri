/**
 * Account screen – shows the authenticated user info, sync status,
 * and provides logout.
 *
 * On tablet, content is constrained to a comfortable reading width.
 */
import React from 'react'
import { Alert, Platform, Pressable, ScrollView, Text, View } from 'react-native'

// Optional: GlassView for liquid glass cards on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

import {
  SyncStatusSection,
  useAdminSchema,
  useAuth,
  useBaseURL,
  useMenuModel,
  usePayloadNative,
} from '@payload-universal/admin-native'
import { useLocalDB, useLocalDBStatus, usePendingUploads } from '@payload-universal/local-db'
import { useResponsive } from '@/hooks/useResponsive'

export default function AccountScreen() {
  const { user, logout } = useAuth()
  const baseURL = useBaseURL()
  const schema = useAdminSchema()
  const menuModel = useMenuModel()
  const { refreshSchema, isSchemaLoading } = usePayloadNative()
  const { isTablet } = useResponsive()

  const localDB = useLocalDB()
  const dbStatus = useLocalDBStatus()
  const uploads = usePendingUploads(localDB)

  const displayName =
    (user?.name as string) ||
    (user?.email as string) ||
    'Admin'

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
    ])
  }

  // Card wrapper: GlassView on iOS 26+, plain View otherwise
  const Card = ({ children, style }: { children: React.ReactNode; style?: any }) =>
    liquidGlassAvailable && GlassView ? (
      <GlassView
        style={[{ borderRadius: 16, padding: 20 }, style]}
        glassEffectStyle="regular"
      >
        {children}
      </GlassView>
    ) : (
      <View className="rounded-2xl bg-surface p-5" style={style}>
        {children}
      </View>
    )

  // Action button: GlassView interactive on iOS 26+, plain Pressable otherwise
  const ActionButton = ({ children, onPress, disabled, style }: { children: React.ReactNode; onPress: () => void; disabled?: boolean; style?: any }) =>
    liquidGlassAvailable && GlassView ? (
      <Pressable onPress={onPress} disabled={disabled} style={disabled ? { opacity: 0.5 } : undefined}>
        <GlassView
          style={[{ borderRadius: 16, padding: 16 }, style]}
          isInteractive
          glassEffectStyle="regular"
        >
          {children}
        </GlassView>
      </Pressable>
    ) : (
      <Pressable
        className="rounded-2xl bg-surface p-4"
        onPress={onPress}
        disabled={disabled}
        style={[disabled ? { opacity: 0.5 } : undefined, style]}
      >
        {children}
      </Pressable>
    )

  return (
    <ScrollView
      className="flex-1 bg-paper"
      contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 56 }}
    >
      <View style={isTablet ? { maxWidth: 600, width: '100%', alignSelf: 'center' as const } : undefined}>
        {/* Profile card */}
        <Card>
          <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-black">
            <Text className="text-xl font-bold text-white">
              {displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text className="text-lg font-bold text-ink">{displayName}</Text>
          {user?.email && (
            <Text className="mt-1 text-sm text-ink-muted">{user.email as string}</Text>
          )}
          {user?.id && (
            <Text className="mt-1 text-xs text-ink-muted">ID: {user.id as string}</Text>
          )}
        </Card>

        {/* Sync Status */}
        <Card style={{ marginTop: 16 }}>
          <SyncStatusSection
            pendingUploads={uploads.items}
            syncStatus={dbStatus.syncStatus}
            onRetryUpload={(id) => uploads.retry(id)}
            onRetryAllUploads={() => uploads.retryAll()}
            onRemoveUpload={(id) => uploads.remove(id)}
            onClearCompleted={() => uploads.clearCompleted()}
          />
          {dbStatus.isReady && (
            <Text className="mt-2 text-xs text-ink-muted">
              Local database: ready · {Object.keys(schema?.collections ?? {}).length} collections synced
            </Text>
          )}
          {dbStatus.error && (
            <Text className="mt-2 text-xs text-red-600">
              Local DB error: {dbStatus.error}
            </Text>
          )}
        </Card>

        {/* Server info */}
        <Card style={{ marginTop: 16 }}>
          <Text className="text-sm font-semibold text-ink">Server</Text>
          <Text className="mt-1 text-xs text-ink-muted">{baseURL}</Text>

          {schema?.generatedAt && (
            <>
              <Text className="mt-3 text-sm font-semibold text-ink">Schema</Text>
              <Text className="mt-1 text-xs text-ink-muted">
                Generated: {new Date(schema.generatedAt).toLocaleString()}
              </Text>
              <Text className="text-xs text-ink-muted">
                Collections: {Object.keys(schema.collections).length}
                {' · '}
                Globals: {Object.keys(schema.globals).length}
              </Text>
            </>
          )}

          {menuModel && menuModel.groups.length > 0 && (
            <>
              <Text className="mt-3 text-sm font-semibold text-ink">Groups</Text>
              <Text className="mt-1 text-xs text-ink-muted">
                {menuModel.groups.join(', ')}
              </Text>
            </>
          )}
        </Card>

        {/* Actions */}
        <View className="mt-4 gap-2">
          <ActionButton onPress={refreshSchema} disabled={isSchemaLoading}>
            <Text className="text-base text-ink">
              {isSchemaLoading ? 'Refreshing...' : 'Refresh Schema'}
            </Text>
          </ActionButton>

          <ActionButton onPress={handleLogout}>
            <Text className="text-base font-semibold text-red-600">Sign Out</Text>
          </ActionButton>
        </View>
      </View>
    </ScrollView>
  )
}
