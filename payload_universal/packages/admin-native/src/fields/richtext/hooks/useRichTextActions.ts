import { useCallback } from 'react'
import { ActionSheetIOS, Alert, Platform } from 'react-native'
import type { MutableRefObject } from 'react'
import type { NativeSyntheticEvent } from 'react-native'

import { createEmptyTable, type TableNode } from '../../TableEditor'
import { ImagePicker } from '../optional'
import type { ContentBlock, EditorRef } from '../types'

/**
 * Insertion + link actions for the RichText editor (image, paste, table, link).
 * Split out of useRichTextEditor to keep each unit focused; receives the shared
 * refs/state it needs from the orchestrating hook.
 */
export function useRichTextActions(ctx: {
  editorRef: MutableRefObject<EditorRef | null>
  contentBlocksRef: MutableRefObject<ContentBlock[]>
  selectionRef: MutableRefObject<{ start: number; end: number; text: string }>
  localDB: any
  tables: TableNode[]
  setTables: React.Dispatch<React.SetStateAction<TableNode[]>>
  currentLink: { url: string; text: string; start: number; end: number } | null
  setCurrentLink: React.Dispatch<
    React.SetStateAction<{ url: string; text: string; start: number; end: number } | null>
  >
  debouncedSync: () => void
}) {
  const {
    editorRef,
    contentBlocksRef,
    selectionRef,
    localDB,
    tables,
    setTables,
    currentLink,
    setCurrentLink,
    debouncedSync,
  } = ctx

  // ---------- Image insertion ----------

  const handleInsertImage = useCallback(() => {
    if (!ImagePicker) {
      Alert.alert('Unavailable', 'Image picker is not available on this device.')
      return
    }

    const insertImage = async (asset: { uri: string; width: number; height: number; fileName?: string | null; mimeType?: string | null }) => {
      editorRef.current?.setImage(asset.uri, asset.width || 300, asset.height || 200)

      // Queue background upload if local-db is available
      if (localDB?.uploadQueue) {
        try {
          await localDB.uploadQueue.enqueue({
            localUri: asset.uri,
            fileName: asset.fileName || `image-${Date.now()}.jpg`,
            mimeType: asset.mimeType || 'image/jpeg',
            targetCollection: 'media',
          })
        } catch { /* queue not available */ }
      }

      debouncedSync()
    }

    const pickFromLibrary = async () => {
      try {
        const { status } = await ImagePicker!.requestMediaLibraryPermissionsAsync()
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Permission to access media library was denied.')
          return
        }
        const result = await ImagePicker!.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.8,
        })
        if (result.canceled || !result.assets?.[0]) return
        const asset = result.assets[0]
        await insertImage(asset)
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to pick image')
      }
    }

    const takePhoto = async () => {
      try {
        const { status } = await ImagePicker!.requestCameraPermissionsAsync()
        if (status !== 'granted') {
          Alert.alert('Permission Denied', 'Permission to access camera was denied.')
          return
        }
        const result = await ImagePicker!.launchCameraAsync({ quality: 0.8 })
        if (result.canceled || !result.assets?.[0]) return
        const asset = result.assets[0]
        await insertImage(asset)
      } catch (err) {
        Alert.alert('Error', err instanceof Error ? err.message : 'Failed to take photo')
      }
    }

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Take Photo', 'Choose from Library', 'Cancel'],
          cancelButtonIndex: 2,
        },
        (buttonIndex) => {
          if (buttonIndex === 0) takePhoto()
          else if (buttonIndex === 1) pickFromLibrary()
        },
      )
    } else {
      // Android: use Alert as action sheet
      Alert.alert('Insert Image', '', [
        { text: 'Take Photo', onPress: takePhoto },
        { text: 'Choose from Library', onPress: pickFromLibrary },
        { text: 'Cancel', style: 'cancel' },
      ])
    }
  }, [editorRef, localDB, debouncedSync])

  // ---------- Paste images handler ----------

  const handlePasteImages = useCallback(
    (e: NativeSyntheticEvent<{ images: Array<{ uri: string; width: number; height: number }> }>) => {
      const images = e.nativeEvent.images
      if (!images?.length) return
      for (const img of images) {
        editorRef.current?.setImage(img.uri, img.width || 300, img.height || 200)

        // Queue background upload
        if (localDB?.uploadQueue) {
          localDB.uploadQueue.enqueue({
            localUri: img.uri,
            fileName: `paste-${Date.now()}.jpg`,
            mimeType: 'image/jpeg',
            targetCollection: 'media',
          }).catch(() => {})
        }
      }
      debouncedSync()
    },
    [editorRef, localDB, debouncedSync],
  )

  // ---------- Table insertion ----------

  const handleInsertTable = useCallback(() => {
    Alert.prompt(
      'Insert Table',
      'Enter rows × columns (e.g. 3x4):',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Insert',
          onPress: (input?: string) => {
            const match = input?.match(/(\d+)\s*[x×X]\s*(\d+)/)
            if (!match) return
            const rows = Math.max(1, Math.min(20, parseInt(match[1], 10)))
            const cols = Math.max(1, Math.min(10, parseInt(match[2], 10)))
            const newTable = createEmptyTable(rows, cols)
            setTables((prev) => [...prev, newTable])
            // Add a table block at the end of the content blocks
            contentBlocksRef.current.push({ type: 'table', index: tables.length, node: newTable })
            debouncedSync()
          },
        },
      ],
      'plain-text',
      '3x3',
    )
  }, [contentBlocksRef, tables, setTables, debouncedSync])

  const handleTableChange = useCallback((index: number, newData: TableNode) => {
    setTables((prev) => {
      const next = [...prev]
      next[index] = newData
      return next
    })
    debouncedSync()
  }, [setTables, debouncedSync])

  // ---------- Toolbar: Link insertion ----------

  const handleInsertLink = useCallback(() => {
    const sel = selectionRef.current
    const existingUrl = currentLink?.url ?? ''

    if (Platform.OS === 'ios') {
      Alert.prompt(
        currentLink ? 'Edit Link' : 'Insert Link',
        'Enter the URL:',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: currentLink ? 'Update' : 'Insert',
            onPress: (url?: string) => {
              if (!url || !editorRef.current) return
              if (currentLink) {
                editorRef.current.setLink(
                  currentLink.start, currentLink.end, currentLink.text, url,
                )
              } else {
                const text = sel.text || url
                editorRef.current.setLink(sel.start, sel.end, text, url)
              }
            },
          },
          ...(currentLink
            ? [{
                text: 'Remove',
                style: 'destructive' as const,
                onPress: () => {
                  if (currentLink && editorRef.current) {
                    editorRef.current.removeLink(currentLink.start, currentLink.end)
                  }
                  setCurrentLink(null)
                },
              }]
            : []),
        ],
        'plain-text',
        existingUrl || 'https://',
      )
    } else {
      // Android: simple prompt fallback
      Alert.alert('Insert Link', 'Enter URL', [
        { text: 'Cancel' },
        {
          text: 'OK',
          onPress: () => {
            const url = existingUrl || 'https://'
            const text = sel.text || url
            editorRef.current?.setLink(sel.start, sel.end, text, url)
          },
        },
      ])
    }
  }, [editorRef, selectionRef, currentLink, setCurrentLink])

  return {
    handleInsertImage,
    handlePasteImages,
    handleInsertTable,
    handleTableChange,
    handleInsertLink,
  }
}
