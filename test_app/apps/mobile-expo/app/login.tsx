/**
 * Login screen – authenticates against the Payload /api/users/login endpoint.
 * Stores the JWT token via SecureStore (handled by the provider's onTokenChange).
 *
 * On tablet, the form is constrained to a comfortable width and centered.
 */
import React, { useState } from 'react'
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import * as SecureStore from 'expo-secure-store'
import { useAuth } from '@payload-universal/admin-native'
import { useResponsive } from '@/hooks/useResponsive'

const BASE_URL_KEY = 'payload_base_url'
const DEFAULT_BASE_URL = __DEV__ ? 'http://192.168.40.114:3000' : 'https://your-server.com'

export default function LoginScreen() {
  const { login, isLoading } = useAuth()
  const { isTablet } = useResponsive()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [serverURL, setServerURL] = useState(DEFAULT_BASE_URL)
  const [showServer, setShowServer] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email and password are required')
      return
    }
    setError(null)
    try {
      // Persist the server URL for next launch
      await SecureStore.setItemAsync(BASE_URL_KEY, serverURL).catch(() => {})
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }

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
          <Text className="text-3xl font-bold text-ink">Payload Admin</Text>
          <Text className="mt-2 text-base text-ink-muted">
            Sign in to manage your content
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
            className="mb-4 rounded-xl border border-neutral-200 bg-surface px-4 py-3 text-sm text-ink"
            value={serverURL}
            onChangeText={setServerURL}
            placeholder="https://your-server.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
          />
        )}

        {/* Email */}
        <Text className="mb-1 text-xs font-semibold text-ink-muted">Email</Text>
        <TextInput
          className="mb-4 rounded-xl border border-neutral-200 bg-surface px-4 py-3 text-base text-ink"
          value={email}
          onChangeText={setEmail}
          placeholder="admin@example.com"
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          editable={!isLoading}
        />

        {/* Password */}
        <Text className="mb-1 text-xs font-semibold text-ink-muted">Password</Text>
        <TextInput
          className="mb-6 rounded-xl border border-neutral-200 bg-surface px-4 py-3 text-base text-ink"
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          secureTextEntry
          textContentType="password"
          editable={!isLoading}
          onSubmitEditing={handleLogin}
        />

        {/* Error */}
        {error && (
          <View className="mb-4 rounded-xl bg-red-50 px-4 py-3">
            <Text className="text-sm text-red-700">{error}</Text>
          </View>
        )}

        {/* Submit */}
        <Pressable
          className="rounded-xl bg-black px-4 py-4"
          style={isLoading ? { opacity: 0.5 } : undefined}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-center text-base font-semibold text-white">
              Sign In
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  )
}
