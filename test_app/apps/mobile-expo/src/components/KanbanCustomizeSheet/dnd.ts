/**
 * Optional drag-to-reorder (react-native-reanimated-dnd v2 + worklets 0.7.x
 * are installed in the app; keep the require guarded for Expo Go parity with
 * the DocumentList summary-fields picker precedent)
 */
let Sortable: any = null
let SortableItem: any = null
try {
  const dnd = require('react-native-reanimated-dnd')
  Sortable = dnd.Sortable
  SortableItem = dnd.SortableItem
} catch {
  /* drag unavailable — lists stay toggle-only */
}

export { Sortable, SortableItem }
