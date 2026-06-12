/**
 * Login screen – authenticates against the Payload /api/users/login endpoint.
 * Stores the JWT token via SecureStore (handled by the provider's onTokenChange).
 *
 * Spec A: surfaces structured login errors inline.
 * Spec B: detects an uninitialised server (GET /api/users/init) and switches to
 *         a "Create first admin user" flow using POST /api/users/first-register.
 *
 * On tablet, the form is constrained to a comfortable width and centered.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  AppState,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { useAuth, useListColors } from '@payload-universal/admin-native'
import { useResponsive } from '@/hooks/useResponsive'

// Optional: GlassView for liquid glass login button on iOS 26+
let GlassView: React.ComponentType<any> | null = null
let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* not available */
}

const BASE_URL_KEY = 'payload_base_url'
const DEFAULT_BASE_URL = __DEV__ ? 'http://192.168.40.114:3000' : 'https://your-server.com'
const INIT_DEBOUNCE_MS = 600

type ScreenMode = 'login' | 'create-first-user'

export default function LoginScreen() {
  const { login, firstRegister, isLoading } = useAuth()
  const { isTablet } = useResponsive()
  const isDark = useColorScheme() === 'dark'
  // Placeholder/keyboard colors can't come from Tailwind classes — use the
  // shared palette so they match the bg-surface inputs in both schemes.
  const { colors: c } = useListColors()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [serverURL, setServerURL] = useState(DEFAULT_BASE_URL)
  const [showServer, setShowServer] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmError, setConfirmError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [mode, setMode] = useState<ScreenMode>('login')
  const initDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Check whether the server is initialised and switch mode accordingly.
  const checkInit = useCallback(async (url: string) => {
    try {
      const res = await fetch(`${url}/api/users/init`)
      if (!res.ok) return // treat failure as initialized
      const data = await res.json() as { initialized?: boolean }
      if (data.initialized === false) {
        setMode('create-first-user')
      } else {
        setMode('login')
      }
    } catch {
      // Network failure — treat as initialized; show normal login
    }
  }, [])

  // Keep the latest URL visible to listeners without re-subscribing.
  const serverURLRef = useRef(serverURL)
  serverURLRef.current = serverURL

  // On mount: hydrate the persisted server URL (this screen previously only
  // WROTE it — the init probe then hit the hardcoded default and first-user
  // detection never saw the real server), then check init against it.
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const stored = await SecureStore.getItemAsync(BASE_URL_KEY).catch(() => null)
      if (cancelled) return
      if (stored && stored !== serverURLRef.current) {
        // setServerURL triggers the debounced re-check below.
        setServerURL(stored)
      } else {
        void checkInit(serverURLRef.current)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Re-check whenever the app returns to the foreground — the server may
  // have been reset/seeded while the app sat on this screen ("dynamic"
  // first-user detection without restarting the app).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void checkInit(serverURLRef.current)
    })
    return () => sub.remove()
  }, [checkInit])

  // Debounce re-check when serverURL changes (skip on initial render)
  const isFirstServerURLRender = useRef(true)
  useEffect(() => {
    if (isFirstServerURLRender.current) {
      isFirstServerURLRender.current = false
      return
    }
    if (initDebounceRef.current) clearTimeout(initDebounceRef.current)
    initDebounceRef.current = setTimeout(() => {
      void checkInit(serverURL)
    }, INIT_DEBOUNCE_MS)
    return () => {
      if (initDebounceRef.current) clearTimeout(initDebounceRef.current)
    }
  }, [serverURL, checkInit])

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email and password are required')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      // Persist the server URL for next launch
      await SecureStore.setItemAsync(BASE_URL_KEY, serverURL).catch(() => {})
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
      // A failed login may mean the database was reset since this screen
      // mounted — re-probe so the screen flips to create-first-user mode
      // dynamically when the server reports uninitialized.
      void checkInit(serverURLRef.current)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateFirstUser = async () => {
    setError(null)
    setConfirmError(null)
    if (!email || !password) {
      setError('Email and password are required')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    if (password !== confirmPassword) {
      setConfirmError('Passwords do not match')
      return
    }
    setIsSubmitting(true)
    try {
      await SecureStore.setItemAsync(BASE_URL_KEY, serverURL).catch(() => {})
      await firstRegister(email, password, confirmPassword)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inFlight = isLoading || isSubmitting
  const isCreateMode = mode === 'create-first-user'

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-paper"
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View
        className="flex-1 justify-center px-6"
        style={isTablet ? { maxWidth: 480, alignSelf: 'center', width: '100%' } : undefined}
      >
        {/* Header */}
        <View className="mb-10">
          <Text className="text-3xl font-bold text-ink">
            {isCreateMode ? 'Create Admin User' : 'Payload Admin'}
          </Text>
          <Text className="mt-2 text-base text-ink-muted">
            {isCreateMode
              ? 'Set up the first admin account'
              : 'Sign in to manage your content'}
          </Text>
        </View>

        {/* Server URL (tap to reveal) */}
        <Pressable onPress={() => setShowServer((v) => !v)} className="mb-4">
          <Text className="text-xs text-ink-muted">
            Server: {serverURL} {showServer ? '▲' : '▼'}
          </Text>
        </Pressable>
        {showServer && (
          <TextInput
            className="mb-4 rounded-xl border border-line bg-surface px-4 py-3 text-sm text-ink"
            value={serverURL}
            onChangeText={(v) => {
              setServerURL(v)
              setError(null)
            }}
            placeholder="https://your-server.com"
            placeholderTextColor={c.textPlaceholder}
            keyboardAppearance={isDark ? 'dark' : 'light'}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        )}

        {/* Email */}
        <Text className="mb-1 text-xs font-semibold text-ink-muted">Email</Text>
        <TextInput
          className="mb-4 rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink"
          value={email}
          onChangeText={(v) => {
            setEmail(v)
            setError(null)
          }}
          placeholder="admin@example.com"
          placeholderTextColor={c.textPlaceholder}
          keyboardAppearance={isDark ? 'dark' : 'light'}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!inFlight}
        />

        {/* Password */}
        <Text className="mb-1 text-xs font-semibold text-ink-muted">Password</Text>
        <TextInput
          className={`rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink ${isCreateMode ? 'mb-4' : 'mb-6'}`}
          value={password}
          onChangeText={(v) => {
            setPassword(v)
            setError(null)
          }}
          placeholder="Password"
          placeholderTextColor={c.textPlaceholder}
          keyboardAppearance={isDark ? 'dark' : 'light'}
          secureTextEntry
          textContentType="password"
          editable={!inFlight}
          onSubmitEditing={isCreateMode ? undefined : handleLogin}
        />

        {/* Confirm Password — create-first-user mode only */}
        {isCreateMode && (
          <>
            <Text className="mb-1 text-xs font-semibold text-ink-muted">Confirm Password</Text>
            <TextInput
              className="mb-6 rounded-xl border border-line bg-surface px-4 py-3 text-base text-ink"
              value={confirmPassword}
              onChangeText={(v) => {
                setConfirmPassword(v)
                setConfirmError(null)
              }}
              placeholder="Confirm password"
              placeholderTextColor={c.textPlaceholder}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              secureTextEntry
              textContentType="newPassword"
              editable={!inFlight}
              onSubmitEditing={handleCreateFirstUser}
            />
            {confirmError && (
              <View className="mb-4 rounded-xl bg-danger-bg px-4 py-3">
                <Text className="text-sm text-danger">{confirmError}</Text>
              </View>
            )}
          </>
        )}

        {/* Error */}
        {error && (
          <View className="mb-4 rounded-xl bg-danger-bg px-4 py-3">
            <Text className="text-sm text-danger">{error}</Text>
          </View>
        )}

        {/* Submit */}
        {liquidGlassAvailable && GlassView ? (
          <Pressable
            onPress={isCreateMode ? handleCreateFirstUser : handleLogin}
            disabled={inFlight}
            style={inFlight ? { opacity: 0.5 } : undefined}
          >
            <GlassView
              style={{ borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16, alignItems: 'center' }}
              isInteractive
              glassEffectStyle="regular"
              tintColor="rgba(0,0,0,0.8)"
            >
              {inFlight ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-center text-base font-semibold text-white">
                  {isCreateMode ? 'Create User' : 'Sign In'}
                </Text>
              )}
            </GlassView>
          </Pressable>
        ) : (
          <Pressable
            className="rounded-xl bg-ink px-4 py-4"
            style={inFlight ? { opacity: 0.5 } : undefined}
            onPress={isCreateMode ? handleCreateFirstUser : handleLogin}
            disabled={inFlight}
          >
            {inFlight ? (
              <ActivityIndicator color={isDark ? '#141414' : '#fff'} />
            ) : (
              <Text className="text-center text-base font-semibold text-paper">
                {isCreateMode ? 'Create User' : 'Sign In'}
              </Text>
            )}
          </Pressable>
        )}

        {/* Back to sign in — allows leaving create-first-user mode manually */}
        {isCreateMode && (
          <Pressable
            className="mt-4 items-center"
            onPress={() => {
              setMode('login')
              setError(null)
              setConfirmError(null)
              setConfirmPassword('')
            }}
          >
            <Text className="text-sm text-ink-muted">Back to sign in</Text>
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}
