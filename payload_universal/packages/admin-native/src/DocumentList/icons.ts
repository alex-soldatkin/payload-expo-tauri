/**
 * DocumentList — optional native-module requires shared across the list's
 * sub-components (lucide icons for the summary-fields picker, sort control
 * and empty states; the liquid-glass row card; the drag-to-reorder picker).
 * Each require is wrapped so a missing peer dep degrades to a JS fallback.
 */
import type React from 'react'

type IconComponent = React.ComponentType<{ size: number; color: string }> | null

// Lucide icons for the summary fields picker, sort control and empty states
export let GripVerticalIcon: IconComponent = null
export let CircleCheckIcon: IconComponent = null
export let CircleIcon: IconComponent = null
export let CheckIcon: IconComponent = null
export let XIcon: IconComponent = null
export let ArrowUpDownIcon: IconComponent = null
export let InboxIcon: IconComponent = null
export let SearchXIcon: IconComponent = null
export let FilterXIcon: IconComponent = null
export let ToggleLeftIcon: IconComponent = null
export let ToggleRightIcon: IconComponent = null
try {
  const lucide = require('lucide-react-native')
  GripVerticalIcon = lucide.GripVertical
  CircleCheckIcon = lucide.CircleCheck
  CircleIcon = lucide.Circle
  CheckIcon = lucide.Check
  XIcon = lucide.X
  ArrowUpDownIcon = lucide.ArrowUpDown
  InboxIcon = lucide.Inbox
  SearchXIcon = lucide.SearchX
  FilterXIcon = lucide.FilterX
  ToggleLeftIcon = lucide.ToggleLeft
  ToggleRightIcon = lucide.ToggleRight
} catch {
  /* lucide-react-native not available */
}

// Optional: drag-to-reorder in the summary fields picker
export let Sortable: any = null
export let SortableItem: any = null
try {
  const dnd = require('react-native-reanimated-dnd')
  Sortable = dnd.Sortable
  SortableItem = dnd.SortableItem
} catch {
  /* react-native-reanimated-dnd not installed — checkbox-only fallback */
}

// Optional: GlassView for liquid glass row cards on iOS 26+
export let GlassView: React.ComponentType<any> | null = null
export let liquidGlassAvailable = false
try {
  const glassModule = require('expo-glass-effect')
  GlassView = glassModule.GlassView
  liquidGlassAvailable = glassModule.isLiquidGlassAvailable?.() ?? false
} catch {
  /* expo-glass-effect not installed */
}
