/**
 * Icon registry — maps lucide icon names to:
 *   1. React Native components (lucide-react-native) for rendering in the UI
 *   2. SF Symbol names (iOS) for native menus and system integration
 *
 * Supports two icon formats:
 *   - Lucide icon name:  e.g. 'users', 'image', 'file-text'
 *   - Raw SVG string:    e.g. '<svg viewBox="0 0 24 24">...</svg>'
 *
 * The registry is extensible at runtime via `registerIcon()`.
 */
import type { ComponentType } from 'react'

// ---------------------------------------------------------------------------
// Type for a lucide-style icon component
// ---------------------------------------------------------------------------

export type IconComponent = ComponentType<{ size?: number; color?: string }>

// ---------------------------------------------------------------------------
// SF Symbol mapping (lucide name → iOS SF Symbol name)
// ---------------------------------------------------------------------------

const sfSymbolMap: Record<string, string> = {
  // People
  users: 'person.2',
  user: 'person',
  'user-plus': 'person.badge.plus',
  'user-check': 'person.fill.checkmark',
  'user-x': 'person.fill.xmark',
  contact: 'person.crop.rectangle',

  // Files & Documents
  file: 'doc',
  'file-text': 'doc.text',
  'file-plus': 'doc.badge.plus',
  'file-check': 'doc.badge.checkmark',
  files: 'doc.on.doc',
  folder: 'folder',
  'folder-open': 'folder.badge.minus',
  'folder-plus': 'folder.badge.plus',

  // Images & Media
  image: 'photo',
  camera: 'camera',
  video: 'video',
  film: 'film',
  music: 'music.note',
  headphones: 'headphones',
  mic: 'mic',

  // Communication
  mail: 'envelope',
  'message-square': 'bubble.left',
  'message-circle': 'bubble.right',
  send: 'paperplane',
  phone: 'phone',
  'phone-call': 'phone.fill',
  inbox: 'tray',
  'at-sign': 'at',

  // Navigation & Actions
  home: 'house',
  settings: 'gear',
  search: 'magnifyingglass',
  plus: 'plus',
  'plus-circle': 'plus.circle',
  pencil: 'pencil',
  edit: 'pencil',
  'edit-3': 'pencil',
  trash: 'trash',
  'trash-2': 'trash',
  download: 'arrow.down.circle',
  upload: 'arrow.up.circle',
  'external-link': 'arrow.up.right.square',
  refresh: 'arrow.clockwise',
  'rotate-cw': 'arrow.clockwise',
  copy: 'doc.on.doc',
  clipboard: 'doc.on.clipboard',
  'clipboard-list': 'doc.on.clipboard',
  'check': 'checkmark',
  'check-circle': 'checkmark.circle',
  x: 'xmark',
  'x-circle': 'xmark.circle',

  // Content
  book: 'book',
  'book-open': 'book',
  bookmark: 'bookmark',
  newspaper: 'newspaper',
  'pen-tool': 'pencil.tip',
  type: 'textformat',
  'align-left': 'text.alignleft',
  'align-center': 'text.aligncenter',
  'align-right': 'text.alignright',
  quote: 'text.quote',

  // Commerce
  'shopping-cart': 'cart',
  'shopping-bag': 'bag',
  'credit-card': 'creditcard',
  'dollar-sign': 'dollarsign.circle',
  tag: 'tag',
  tags: 'tag',
  receipt: 'receipt',
  percent: 'percent',
  store: 'storefront',
  gift: 'gift',
  truck: 'shippingbox',

  // Data & Charts
  database: 'externaldrive',
  'hard-drive': 'externaldrive',
  table: 'tablecells',
  'bar-chart': 'chart.bar',
  'bar-chart-2': 'chart.bar',
  'pie-chart': 'chart.pie',
  'trending-up': 'arrow.up.right',
  'trending-down': 'arrow.down.right',
  activity: 'waveform.path',
  'line-chart': 'chart.xyaxis.line',

  // Layout & Grid
  layout: 'rectangle.split.3x3',
  'layout-dashboard': 'rectangle.split.3x3',
  grid: 'square.grid.2x2',
  list: 'list.bullet',
  columns: 'rectangle.split.2x1',
  rows: 'rectangle.split.1x2',
  sidebar: 'sidebar.left',
  'panel-left': 'sidebar.left',

  // Maps & Location
  globe: 'globe',
  map: 'map',
  'map-pin': 'mappin.and.ellipse',
  navigation: 'location',
  compass: 'safari',

  // Time
  clock: 'clock',
  calendar: 'calendar',
  'calendar-days': 'calendar',
  timer: 'timer',
  history: 'clock.arrow.circlepath',

  // Social & Feedback
  star: 'star',
  heart: 'heart',
  'thumbs-up': 'hand.thumbsup',
  'thumbs-down': 'hand.thumbsdown',
  smile: 'face.smiling',
  flag: 'flag',
  award: 'medal',
  trophy: 'trophy',

  // Alerts & Status
  bell: 'bell',
  'bell-ring': 'bell.badge',
  'alert-circle': 'exclamationmark.circle',
  'alert-triangle': 'exclamationmark.triangle',
  info: 'info.circle',
  'help-circle': 'questionmark.circle',

  // Security
  lock: 'lock',
  unlock: 'lock.open',
  shield: 'shield',
  'shield-check': 'shield.checkered',
  key: 'key',
  fingerprint: 'touchid',

  // Connection
  link: 'link',
  'link-2': 'link',
  unlink: 'link.badge.plus',
  share: 'square.and.arrow.up',
  'share-2': 'square.and.arrow.up',
  wifi: 'wifi',
  bluetooth: 'wave.3.right',
  'cloud': 'cloud',
  'cloud-off': 'cloud.slash',

  // Visibility
  eye: 'eye',
  'eye-off': 'eye.slash',

  // Shapes & Objects
  zap: 'bolt',
  'zap-off': 'bolt.slash',
  package: 'shippingbox',
  box: 'cube',
  layers: 'square.3.layers.3d',
  archive: 'archivebox',
  filter: 'line.3.horizontal.decrease.circle',
  sliders: 'slider.horizontal.3',
  tool: 'wrench',
  wrench: 'wrench',
  cog: 'gear',
  puzzle: 'puzzlepiece',
  code: 'chevron.left.forwardslash.chevron.right',
  terminal: 'terminal',
  hash: 'number',
  binary: 'number',

  // Arrows
  'arrow-up': 'arrow.up',
  'arrow-down': 'arrow.down',
  'arrow-left': 'arrow.left',
  'arrow-right': 'arrow.right',
  'chevron-up': 'chevron.up',
  'chevron-down': 'chevron.down',
  'chevron-left': 'chevron.left',
  'chevron-right': 'chevron.right',
  'move': 'arrow.up.and.down.and.arrow.left.and.right',

  // Toggle / Controls
  toggle: 'switch.2',
  power: 'power',

  // Misc
  palette: 'paintpalette',
  paintbrush: 'paintbrush',
  crop: 'crop',
  scissors: 'scissors',
  sun: 'sun.max',
  moon: 'moon',
  thermometer: 'thermometer',
  droplet: 'drop',
  flame: 'flame',
  'coffee': 'cup.and.saucer',
  pizza: 'fork.knife',
  apple: 'applelogo',
}

// ---------------------------------------------------------------------------
// Lucide component registry (name → component)
// ---------------------------------------------------------------------------

const componentRegistry: Record<string, IconComponent> = {}
let builtinsLoaded = false

/**
 * Lazily load the built-in lucide components.
 * Done on first access so the import cost is deferred.
 */
function ensureBuiltins() {
  if (builtinsLoaded) return
  builtinsLoaded = true
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const lucide = require('lucide-react-native')

    // Build a map of kebab-case names → components.
    // Lucide exports PascalCase names (e.g. FileText for 'file-text').
    // We iterate the known SF Symbol keys since they use kebab-case names
    // that match the lucide icon naming convention.
    for (const kebab of Object.keys(sfSymbolMap)) {
      const pascal = kebabToPascal(kebab)
      if (lucide[pascal]) {
        componentRegistry[kebab] = lucide[pascal]
      }
    }
  } catch {
    /* lucide-react-native not installed */
  }
}

/** Convert 'file-text' → 'FileText' */
function kebabToPascal(s: string): string {
  return s
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('')
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Check whether an icon string is raw SVG (starts with '<'). */
export const isRawSVG = (icon: string): boolean => icon.trimStart().startsWith('<')

/**
 * Get the SF Symbol name for a lucide icon name.
 * Returns the SF Symbol string, or `'doc'` as the default fallback.
 */
export function getSFSymbol(name: string | undefined): string {
  if (!name) return 'doc'
  return sfSymbolMap[name] ?? 'doc'
}

/**
 * Get the React Native component for a lucide icon name.
 * Returns `null` if the name isn't in the registry.
 */
export function getIconComponent(name: string | undefined): IconComponent | null {
  if (!name) return null
  ensureBuiltins()
  return componentRegistry[name] ?? null
}

/**
 * Register a custom icon at runtime.
 * Useful for app-specific icons not in the built-in set.
 *
 * @example
 * ```ts
 * import { Rocket } from 'lucide-react-native'
 * registerIcon('rocket', Rocket, 'airplane')
 * ```
 */
export function registerIcon(
  name: string,
  component: IconComponent,
  sfSymbol?: string,
): void {
  componentRegistry[name] = component
  if (sfSymbol) sfSymbolMap[name] = sfSymbol
}
