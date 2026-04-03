/**
 * CollectionIcon — renders a collection's icon from its schema definition.
 *
 * Supports two formats (set via `admin.icon` in the Payload collection config):
 *   1. **Lucide icon name**  – e.g. `'users'`, `'image'`, `'file-text'`
 *      Looked up in the icon registry and rendered as a lucide-react-native component.
 *   2. **Raw SVG string**    – e.g. `'<svg viewBox="0 0 24 24">…</svg>'`
 *      Rendered via react-native-svg's SvgXml.
 *
 * Falls back to a generic "File" icon when the name is not recognised.
 */
import React from 'react'
import { getIconComponent, isRawSVG } from './utils/iconRegistry'

// Optional: SvgXml for raw SVG string rendering
let SvgXml: React.ComponentType<{
  xml: string
  width?: number
  height?: number
  color?: string
}> | null = null

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const svg = require('react-native-svg')
  SvgXml = svg.SvgXml
} catch {
  /* react-native-svg not installed */
}

// Fallback icon (lucide "File")
let FallbackIcon: React.ComponentType<{ size?: number; color?: string }> | null = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  FallbackIcon = require('lucide-react-native').File
} catch {
  /* lucide-react-native not installed */
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type CollectionIconProps = {
  /** The icon value from `menuModel.collections[n].icon`. */
  icon?: string
  /** Icon size in dp (default 20). */
  size?: number
  /** Icon colour (default '#666'). */
  color?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CollectionIcon: React.FC<CollectionIconProps> = ({
  icon,
  size = 20,
  color = '#666',
}) => {
  // 1. Raw SVG string
  if (icon && isRawSVG(icon) && SvgXml) {
    return <SvgXml xml={icon} width={size} height={size} color={color} />
  }

  // 2. Lucide icon name
  if (icon) {
    const Icon = getIconComponent(icon)
    if (Icon) return <Icon size={size} color={color} />
  }

  // 3. Fallback
  if (FallbackIcon) return <FallbackIcon size={size} color={color} />
  return null
}
