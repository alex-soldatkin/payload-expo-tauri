/**
 * Root layout – wraps the entire app in:
 *   PayloadNativeProvider → auth + schema
 *   LocalDBProvider       → local-first RxDB with Payload replication
 *   ToastProvider         → in-app notifications
 *
 * Auth gate: unauthenticated → login screen, authenticated → admin tabs.
 * Shows sync progress on splash screen and toasts for background updates.
 */
import '../global.css'
// Hermes lacks crypto.getRandomValues/subtle.digest, which RxDB needs.
// Must run before any local-db / rxdb code loads.
import '@payload-universal/local-db/polyfills/hermesCrypto'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ActivityIndicator, Text, View, useColorScheme, useWindowDimensions } from 'react-native'
import { Slot, useRouter, useSegments } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import * as Notifications from 'expo-notifications'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { vars } from 'nativewind'


import {
  ActionRegistryProvider,
  ConditionRegistryProvider,
  CustomComponentProvider,
  PayloadNativeProvider,
  registerIcon,
  ScrollablePreviewProvider,
  ToastProvider,
  useAdminSchema,
  useAuth,
  useBaseURL,
  useListColors,
  usePayloadNative,
  useToast,
} from '@payload-universal/admin-native'
import { LayoutTemplate, PanelBottom } from 'lucide-react-native'
import * as ScrollablePreview from '@/modules/scrollable-preview'
import { customComponentRegistry } from '@/src/generated/custom-components/_registry'
import { actionHandlers } from '@/src/actions'
import { clientConditions } from '@/src/conditions'
// Module import also registers the relationship inline-create field wrapper
// over fieldRegistry.relationship (onRequestCreate injection).
import { RelationshipInlineCreateProvider } from '@/src/components/RelationshipInlineCreate'
import { applyStoredAppearance } from '@/src/preferences'

// Icons used by the new server collections/globals that aren't in the
// built-in lucide→SF Symbol registry (Pages 'layout-template', Footer
// 'panel-bottom'). Registered once at module load so the tab long-press
// menu, sidebar, and dashboard all resolve them.
registerIcon('layout-template', LayoutTemplate, 'rectangle.3.group')
registerIcon('panel-bottom', PanelBottom, 'dock.rectangle')
import {
  ClientValidatorProvider,
  LocalDBProvider,
  getRxStorageSQLite,
  getSQLiteBasicsExpoSQLiteAsync,
  useLocalDBStatus,
  type SyncProgress,
} from '@payload-universal/local-db'
import { clientHooksConfig } from '@/src/validators'
import * as SQLite from 'expo-sqlite'

// Configure local notifications to show banners while the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
})

const TOKEN_KEY = 'payload_auth_token'
const BASE_URL_KEY = 'payload_base_url'

/**
 * Provides the NativeWind theme tokens (--color-ink/-paper/-surface/…) as
 * runtime `vars()` for the whole app.
 *
 * Why not the `@media (prefers-color-scheme: dark)` block in global.css?
 * On native, css-interop resolves that media query against its own
 * module-level colorScheme observable, which is snapshotted at JS-init and
 * misses Appearance events fired while the app isn't "active" (i.e. during
 * launch, when the stored preference override is applied) — so `bg-paper`
 * could stay light while RN useColorScheme() correctly said dark.
 *
 * Here the variables derive from useListColors — the exact palette (and the
 * exact RN useColorScheme() source) that package components use — so the
 * Tailwind tokens and JS palettes are coherent by construction, flip live on
 * system changes, and honor the persisted 'system' | 'light' | 'dark'
 * preference applied via Appearance.setColorScheme at boot.
 */
function ThemeVarsProvider({ children }: { children: React.ReactNode }) {
  const { colors } = useListColors()
  const themeVars = useMemo(
    () =>
      vars({
        '--color-ink': colors.text,
        '--color-ink-muted': colors.textMuted,
        '--color-paper': colors.background,
        '--color-surface': colors.surface,
        '--color-line': colors.border,
        '--color-danger': colors.error,
        '--color-danger-bg': colors.errorBackground,
        '--color-warn': colors.warning,
        '--color-warn-bg': colors.warningBackground,
      }),
    [colors],
  )

  return (
    <View className="flex-1" style={themeVars}>
      {children}
    </View>
  )
}

const DEFAULT_BASE_URL = __DEV__ ? 'http://192.168.40.114:3050' : 'https://your-server.com'
const DEFAULT_WS_URL = __DEV__ ? 'ws://192.168.40.114:3051' : 'wss://your-server.com/ws'

// Persistent SQLite storage for RxDB (custom full implementation — no trial limits)
const sqliteStorage = getRxStorageSQLite({
  sqliteBasics: getSQLiteBasicsExpoSQLiteAsync(SQLite.openDatabaseSync),
})

/** Shows sync progress indicator below the spinner during initial load. */
function SyncProgressIndicator() {
  const { syncStatus, syncProgress } = useLocalDBStatus()
  const isDark = useColorScheme() === 'dark'

  if (syncStatus !== 'syncing' || syncProgress.total === 0) return null

  const pct = Math.round((syncProgress.completed / syncProgress.total) * 100)

  return (
    <View style={{ marginTop: 16, alignItems: 'center' }}>
      <Text style={{ fontSize: 13, color: '#8E8E93', marginBottom: 4 }}>
        Syncing{syncProgress.current ? ` ${syncProgress.current}` : ''}...
      </Text>
      {/* Progress bar */}
      <View style={{
        width: 180,
        height: 4,
        backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : '#e5e5e5',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <View style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: isDark ? '#f2f2f2' : '#1f1f1f',
          borderRadius: 2,
        }} />
      </View>
      <Text style={{ fontSize: 11, color: '#8E8E93', marginTop: 4 }}>
        {syncProgress.completed}/{syncProgress.total} collections
      </Text>
    </View>
  )
}

/** Fires toasts when background sync receives updates. */
function SyncToastBridge() {
  const toast = useToast()
  const { syncStatus } = useLocalDBStatus()
  const prevStatus = useRef(syncStatus)

  useEffect(() => {
    if (prevStatus.current === 'syncing' && syncStatus === 'idle') {
      toast.showToast('Sync complete', { type: 'success', icon: 'sync', duration: 2000 })
    }
    if (syncStatus === 'error' && prevStatus.current !== 'error') {
      toast.showToast('Sync error — using local data', { type: 'error', icon: 'syncError' })
    }
    prevStatus.current = syncStatus
  }, [syncStatus, toast])

  return null
}

/** Inner component that has access to PayloadNativeProvider context. */
function LocalDBGate({ children }: { children: React.ReactNode }) {
  const schema = useAdminSchema()
  const baseURL = useBaseURL()
  const { auth } = usePayloadNative()

  return (
    <ClientValidatorProvider config={clientHooksConfig}>
      <LocalDBProvider
        schema={schema}
        baseURL={baseURL}
        token={auth.token}
        wsURL={DEFAULT_WS_URL}
        storage={sqliteStorage}
      >
        {children}
      </LocalDBProvider>
    </ClientValidatorProvider>
  )
}

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth()
  const { isReady } = useLocalDBStatus()
  const segments = useSegments()
  const router = useRouter()

  useEffect(() => {
    if (isLoading) return

    const inAuthGroup = segments[0] === '(admin)'

    if (!isAuthenticated && inAuthGroup) {
      router.replace('/login')
    } else if (isAuthenticated && !inAuthGroup) {
      router.replace('/(admin)')
    }
  }, [isAuthenticated, isLoading, segments, router])

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-paper">
        <ActivityIndicator size="large" />
        <SyncProgressIndicator />
      </View>
    )
  }

  return (
    <>
      <SyncToastBridge />
      <Slot />
    </>
  )
}

export default function RootLayout() {
  // Explicit window dimensions force native re-layout on iPad window resize
  // (flex: 1 alone doesn't reliably propagate size changes from the native root)
  const { width: windowWidth, height: windowHeight } = useWindowDimensions()

  const [initialToken, setInitialToken] = useState<string | null>(null)
  const [baseURL, setBaseURL] = useState<string>(DEFAULT_BASE_URL)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const init = async () => {
      // Apply the persisted appearance preference (System/Light/Dark) on boot
      await applyStoredAppearance()
      try {
        const token = await SecureStore.getItemAsync(TOKEN_KEY)
        const url = await SecureStore.getItemAsync(BASE_URL_KEY)
        if (token) setInitialToken(token)
        if (url) setBaseURL(url)
      } catch {
        // SecureStore may not be available in some environments
      }
      setReady(true)
    }
    init()
  }, [])

  const handleTokenChange = useCallback(async (token: string | null) => {
    try {
      if (token) {
        await SecureStore.setItemAsync(TOKEN_KEY, token)
      } else {
        await SecureStore.deleteItemAsync(TOKEN_KEY)
      }
    } catch {
      // ignore
    }
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1, width: windowWidth, height: windowHeight }}>
      <SafeAreaProvider>
        <ThemeVarsProvider>
        {!ready ? (
          <View className="flex-1 items-center justify-center bg-paper">
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <PayloadNativeProvider
            baseURL={baseURL}
            initialToken={initialToken}
            onTokenChange={handleTokenChange}
          >
            <CustomComponentProvider registry={customComponentRegistry}>
              <ActionRegistryProvider registry={actionHandlers}>
                <ConditionRegistryProvider registry={clientConditions}>
                  <ScrollablePreviewProvider value={ScrollablePreview}>
                    <LocalDBGate>
                      <ToastProvider>
                        <RelationshipInlineCreateProvider>
                          <StatusBar style="auto" />
                          <AuthGate />
                        </RelationshipInlineCreateProvider>
                      </ToastProvider>
                    </LocalDBGate>
                  </ScrollablePreviewProvider>
                </ConditionRegistryProvider>
              </ActionRegistryProvider>
            </CustomComponentProvider>
          </PayloadNativeProvider>
        )}
        </ThemeVarsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
