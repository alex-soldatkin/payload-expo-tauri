/**
 * Polyfill globalThis.crypto for Hermes (React Native).
 * RxDB requires crypto.getRandomValues AND crypto.subtle.digest.
 * Hermes doesn't expose either. We polyfill both using expo-crypto.
 *
 * Import this ONCE in the Expo app entry (before LocalDBProvider):
 * ```ts
 * import '@payload-universal/local-db/polyfills/hermesCrypto'
 * ```
 * Electron/web have full WebCrypto and must NOT import this module —
 * keeping it out of database.ts is what makes the package bundle
 * without Expo installed.
 */
import { getRandomValues as expoGetRandomValues, digest as expoDigest, CryptoDigestAlgorithm } from 'expo-crypto'

const subtlePolyfill = {
  async digest(algorithm: string, data: ArrayBuffer): Promise<ArrayBuffer> {
    // Map Web Crypto algorithm names to expo-crypto
    const algoMap: Record<string, CryptoDigestAlgorithm> = {
      'SHA-1': CryptoDigestAlgorithm.SHA1,
      'SHA-256': CryptoDigestAlgorithm.SHA256,
      'SHA-384': CryptoDigestAlgorithm.SHA384,
      'SHA-512': CryptoDigestAlgorithm.SHA512,
    }
    const algo = algoMap[algorithm as string] ?? CryptoDigestAlgorithm.SHA256
    return expoDigest(algo, data)
  },
}

if (typeof globalThis.crypto === 'undefined') {
  ;(globalThis as any).crypto = {
    getRandomValues: expoGetRandomValues,
    subtle: subtlePolyfill,
  }
} else {
  if (typeof globalThis.crypto.getRandomValues === 'undefined') {
    ;(globalThis.crypto as any).getRandomValues = expoGetRandomValues
  }
  if (typeof globalThis.crypto.subtle === 'undefined') {
    ;(globalThis.crypto as any).subtle = subtlePolyfill
  } else if (typeof globalThis.crypto.subtle.digest === 'undefined') {
    ;(globalThis.crypto.subtle as any).digest = subtlePolyfill.digest
  }
}

export {}
