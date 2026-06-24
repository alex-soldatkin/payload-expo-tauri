/**
 * Multi-select + bulk-action state for the collection-list screen — selection
 * mode, the selected-id set, the bulk-edit sheet toggle and the custom
 * list-action dispatcher (shared by the native toolbar Actions menu and the
 * Pressable selection action bar).
 *
 * Extracted verbatim from the route file.
 */
import { useCallback, useState } from 'react'
import { Alert } from 'react-native'
import { useBaseURL, useAuth, useListActionHandlers } from '@payload-universal/admin-native'
import { useLocalDB } from '@payload-universal/local-db'

type LocalDB = ReturnType<typeof useLocalDB>

export function useListActions(slug: string, localDB: LocalDB, allDocs: Record<string, unknown>[]) {
  const baseURL = useBaseURL()
  const { token } = useAuth()
  const listHandlers = useListActionHandlers(slug)

  // Multi-select state for bulk actions
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  // Bulk edit (web EditMany parity) — generic, available for every collection
  const [bulkEditOpen, setBulkEditOpen] = useState(false)

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id],
    )
  }, [])

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false)
    setSelectedIds([])
  }, [])

  const openBulkEdit = useCallback(() => {
    if (selectedIds.length === 0) {
      Alert.alert('No Selection', 'Select one or more items to edit.')
      return
    }
    setBulkEditOpen(true)
  }, [selectedIds.length])

  // Custom list-action dispatch — shared by the native toolbar Actions menu
  // and the Pressable selection action bar.
  const runListAction = useCallback(
    (key: string) => {
      const handler = listHandlers[key]
      if (handler) {
        handler({
          collectionSlug: slug,
          selectedIds,
          allDocs,
          localDB,
          baseURL,
          token,
        })
      }
    },
    [listHandlers, slug, selectedIds, allDocs, localDB, baseURL, token],
  )

  return {
    selectionMode,
    setSelectionMode,
    selectedIds,
    toggleSelection,
    exitSelectionMode,
    bulkEditOpen,
    setBulkEditOpen,
    openBulkEdit,
    runListAction,
  }
}
