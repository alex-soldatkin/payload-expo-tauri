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

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { ActivityIndicator, Text, View } from 'react-native'
import { Slot, useRouter, useSegments } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import * as Notifications from 'expo-notifications'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { GestureHandlerRootView } from 'react-native-gesture-handler'


import {
  PayloadNativeProvider,
  ToastProvider,
  useAdminSchema,
  useAuth,
  useBaseURL,
  usePayloadNative,
  useToast,
} from '@payload-universal/admin-native'
import {
  LocalDBProvider,
  getRxStorageSQLite,
  getSQLiteBasicsExpoSQLiteAsync,
  useLocalDBStatus,
  type SyncProgress,
} from '@payload-universal/local-db'
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

const DEFAULT_BASE_URL = __DEV__ ? 'http://localhost:3000' : 'https://your-server.com'
const DEFAULT_WS_URL = __DEV__ ? 'ws://localhost:3001' : 'wss://your-server.com/ws'

// Persistent SQLite storage for RxDB (custom full implementation — no trial limits)
const sqliteStorage = getRxStorageSQLite({
  sqliteBasics: getSQLiteBasicsExpoSQLiteAsync(SQLite.openDatabaseSync),
})

/** Shows sync progress indicator below the spinner during initial load. */
function SyncProgressIndicator() {
  const { syncStatus, syncProgress } = useLocalDBStatus()

  if (syncStatus !== 'syncing' || syncProgress.total === 0) return null

  const pct = Math.round((syncProgress.completed / syncProgress.total) * 100)

  return (
    <View style={{ marginTop: 16, alignItems: 'center' }}>
      <Text style={{ fontSize: 13, color: '#888', marginBottom: 4 }}>
        Syncing{syncProgress.current ? ` ${syncProgress.current}` : ''}...
      </Text>
      {/* Progress bar */}
      <View style={{
        width: 180,
        height: 4,
        backgroundColor: '#e5e5e5',
        borderRadius: 2,
        overflow: 'hidden',
      }}>
        <View style={{
          width: `${pct}%`,
          height: '100%',
          backgroundColor: '#1f1f1f',
          borderRadius: 2,
        }} />
      </View>
      <Text style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
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
    <LocalDBProvider
      schema={schema}
      baseURL={baseURL}
      token={auth.token}
      wsURL={DEFAULT_WS_URL}
      storage={sqliteStorage}
    >
      {children}
    </LocalDBProvider>
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
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f4f1' }}>
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
  const [initialToken, setInitialToken] = useState<string | null>(null)
  const [baseURL, setBaseURL] = useState<string>(DEFAULT_BASE_URL)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const init = async () => {
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        {!ready ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f4f1' }}>
            <ActivityIndicator size="large" />
          </View>
        ) : (
          <PayloadNativeProvider
            baseURL={baseURL}
            initialToken={initialToken}
            onTokenChange={handleTokenChange}
          >
            <LocalDBGate>
              <ToastProvider>
                <StatusBar style="dark" />
                <AuthGate />
              </ToastProvider>
            </LocalDBGate>
          </PayloadNativeProvider>
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}
