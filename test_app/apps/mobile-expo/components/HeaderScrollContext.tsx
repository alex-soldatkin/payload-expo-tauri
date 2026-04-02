/**
 * Shared scroll-offset context for scroll-driven header blur.
 *
 * The collections/globals stack layout provides an `Animated.Value`
 * via this context.  Each screen attaches its ScrollView / FlatList
 * scroll events to the value so the `ProgressiveBlurHeader` can
 * fade in as content scrolls under it.
 */
import React, { createContext, useContext, useRef } from 'react'
import { Animated } from 'react-native'

const Ctx = createContext<Animated.Value>(new Animated.Value(0))

/** Read the shared scroll-Y animated value. */
export const useHeaderScrollY = (): Animated.Value => useContext(Ctx)

/**
 * Create and provide a fresh `Animated.Value(0)` for the current
 * stack's scroll-driven header.
 */
export function HeaderScrollProvider({ children }: { children: React.ReactNode }) {
  const scrollY = useRef(new Animated.Value(0)).current
  return <Ctx.Provider value={scrollY}>{children}</Ctx.Provider>
}
