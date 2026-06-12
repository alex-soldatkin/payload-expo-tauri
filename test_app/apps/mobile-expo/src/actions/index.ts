/**
 * Native action handlers for collection-level custom actions.
 *
 * These are Metro-bundled functions (like client validators) that provide
 * the actual logic for actions defined in the Payload config's
 * `admin.listActions` / `admin.editActions`.
 *
 * The action metadata (label, icon, key) flows through the admin schema.
 * The handlers here are matched by the `key` property.
 */
import { Alert, Share } from 'react-native'

import type { ActionHandlerRegistry } from '@payload-universal/admin-native'

export const actionHandlers: ActionHandlerRegistry = {
  posts: {
    list: {
      /**
       * Bulk Publish — marks all selected posts as published.
       * Writes directly to local RxDB; sync pushes to server in background.
       */
      bulkPublish: async ({ selectedIds, localDB, collectionSlug }) => {
        if (selectedIds.length === 0) {
          Alert.alert('No Selection', 'Select one or more posts to publish.')
          return
        }

        const col = localDB?.collections?.[collectionSlug]
        if (!col) {
          Alert.alert('Error', 'Local database not ready.')
          return
        }

        let published = 0
        for (const id of selectedIds) {
          try {
            const doc = await col.findOne(id).exec()
            if (doc) {
              await doc.incrementalPatch({
                _status: 'published',
                _locallyModified: true,
                updatedAt: new Date().toISOString(),
              })
              published++
            }
          } catch {
            // skip failed docs
          }
        }

        Alert.alert(
          'Published',
          `${published} post${published !== 1 ? 's' : ''} marked as published. Syncing to server...`,
        )
      },

      /**
       * Bulk Archive — marks all selected posts as archived.
       */
      bulkArchive: async ({ selectedIds, localDB, collectionSlug }) => {
        if (selectedIds.length === 0) {
          Alert.alert('No Selection', 'Select one or more posts to archive.')
          return
        }

        Alert.alert(
          'Archive Posts',
          `Archive ${selectedIds.length} post${selectedIds.length !== 1 ? 's' : ''}?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Archive',
              style: 'destructive',
              onPress: async () => {
                const col = localDB?.collections?.[collectionSlug]
                if (!col) return

                let archived = 0
                for (const id of selectedIds) {
                  try {
                    const doc = await col.findOne(id).exec()
                    if (doc) {
                      await doc.incrementalPatch({
                        status: 'archived',
                        _locallyModified: true,
                        updatedAt: new Date().toISOString(),
                      })
                      archived++
                    }
                  } catch {
                    // skip
                  }
                }

                Alert.alert('Archived', `${archived} post${archived !== 1 ? 's' : ''} archived.`)
              },
            },
          ],
        )
      },
    },

    edit: {
      /**
       * Share Post — uses the native Share API to share the post title and excerpt.
       */
      sharePost: async ({ doc }) => {
        const title = String(doc.title || 'Untitled Post')
        const excerpt = doc.excerpt ? String(doc.excerpt) : ''
        const slug = doc.slug ? String(doc.slug) : ''

        const message = [
          title,
          excerpt ? `\n${excerpt}` : '',
          slug ? `\nhttps://yoursite.com/posts/${slug}` : '',
        ]
          .filter(Boolean)
          .join('')

        try {
          await Share.share({
            title,
            message,
          })
        } catch {
          // User cancelled or share failed
        }
      },

      /**
       * Duplicate Post — creates a copy of the current post as a draft.
       */
      duplicatePost: async ({ doc, localDB, collectionSlug }) => {
        const col = localDB?.collections?.[collectionSlug]
        if (!col) {
          Alert.alert('Error', 'Local database not ready.')
          return
        }

        // Generate a new ID (24-char hex like MongoDB ObjectId)
        const bytes = new Uint8Array(12)
        // Use expo-crypto polyfilled globalThis.crypto
        globalThis.crypto.getRandomValues(bytes)
        const newId = Array.from(bytes)
          .map((b) => b.toString(16).padStart(2, '0'))
          .join('')

        // Clone the document data, stripping internal fields
        const {
          id: _id,
          _rev,
          _meta,
          _attachments,
          _deleted,
          _locallyModified,
          createdAt,
          updatedAt,
          ...rest
        } = doc

        const now = new Date().toISOString()
        const newDoc = {
          ...rest,
          id: newId,
          title: `${rest.title || 'Untitled'} (Copy)`,
          slug: rest.slug ? `${rest.slug}-copy` : undefined,
          _status: 'draft',
          _locallyModified: true,
          createdAt: now,
          updatedAt: now,
        }

        try {
          await col.insert(newDoc)
          Alert.alert('Duplicated', 'A draft copy has been created.')
        } catch (err) {
          Alert.alert('Error', err instanceof Error ? err.message : 'Failed to duplicate.')
        }
      },
    },
  },

  products: {
    list: {
      /**
       * Export Selected — shares a CSV summary of the selected products
       * via the native share sheet (expo-clipboard is NOT installed;
       * Share.share is the sanctioned path).
       */
      exportProducts: async ({ selectedIds, allDocs }) => {
        const docs =
          selectedIds.length > 0
            ? allDocs.filter((d) => selectedIds.includes(String(d.id)))
            : []

        if (docs.length === 0) {
          Alert.alert('No Selection', 'Select one or more products to export.')
          return
        }

        const csvEscape = (value: unknown): string => {
          const str = value == null ? '' : String(value)
          return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
        }

        const header = 'name,sku,availability,price,stockLevel'
        const rows = docs.map((doc) => {
          const pricing = (doc.pricing ?? {}) as Record<string, unknown>
          return [
            csvEscape(doc.name),
            csvEscape(doc.sku),
            csvEscape(doc.availability),
            csvEscape(pricing.price),
            csvEscape(doc.stockLevel),
          ].join(',')
        })
        const csv = [header, ...rows].join('\n')

        try {
          await Share.share({
            title: `Products Export (${docs.length})`,
            message: csv,
          })
        } catch {
          // User cancelled or share failed
        }
      },
    },

    edit: {
      /**
       * Archive Product — confirms, then marks the product as discontinued
       * (the closest status-ish field on Products). Writes to local RxDB;
       * sync pushes to the server in the background.
       */
      archiveProduct: async ({ doc, documentId, localDB, collectionSlug }) => {
        const name = String(doc.name || 'this product')
        Alert.alert(
          'Archive Product',
          `Mark "${name}" as discontinued? It will no longer be available.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Archive',
              style: 'destructive',
              onPress: async () => {
                const col = localDB?.collections?.[collectionSlug]
                if (!col) {
                  Alert.alert('Error', 'Local database not ready.')
                  return
                }
                try {
                  const rxDoc = await col.findOne(documentId).exec()
                  if (!rxDoc) {
                    Alert.alert('Error', 'Product not found locally.')
                    return
                  }
                  await rxDoc.incrementalPatch({
                    availability: 'discontinued',
                    _locallyModified: true,
                    updatedAt: new Date().toISOString(),
                  })
                  Alert.alert('Archived', `"${name}" marked as discontinued. Syncing to server...`)
                } catch (err) {
                  Alert.alert('Error', err instanceof Error ? err.message : 'Failed to archive.')
                }
              },
            },
          ],
        )
      },
    },
  },
}

export default actionHandlers
