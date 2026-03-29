/**
 * Root layout – wraps the entire app in:
 *   PayloadNativeProvider → auth + schema
 *   LocalDBProvider       → local-first RxDB with Payload replication
 *   ToastProvider         → in-app notifications
 *
 * Auth gate: unauthenticated → login screen, authenticated → admin tabs.
 */
import '../global.css'

import React, { useCallback, useEffect, useState } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { Slot, useRouter, useSegments } from 'expo-router'
import * as SecureStore from 'expo-secure-store'
import * as Notifications from 'expo-notifications'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import {
  PayloadNativeProvider,
  ToastProvider,
  useAdminSchema,
  useAuth,
  useBaseURL,
  usePayloadNative,
} from '@payload-universal/admin-native'
import { LocalDBProvider } from '@payload-universal/local-db'
import { getRxStorageSQLite } from 'rxdb/plugins/storage-sqlite'
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

// Persistent SQLite storage for RxDB
const sqliteStorage = getRxStorageSQLite({
  sqliteQueryWithParams: (db: any, sql: string, params: any[]) => {
    const result = db.getAllSync(sql, params)
    return { rows: result }
  },
  openSQLiteDatabase: (name: string) => {
    return SQLite.openDatabaseSync(name)
  },
})

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
      pullInterval={30_000}
      storage={sqliteStorage}
    >
      {children}
    </LocalDBProvider>
  )
}

function AuthGate() {
  const { isAuthenticated, isLoading } = useAuth()
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
      </View>
    )
  }

  return <Slot />
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

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f6f4f1' }}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <SafeAreaProvider>
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
    </SafeAreaProvider>
  )
}
