// Reactive list of documents in a collection, backed by the local RxDB.
// Rows show a title-ish field + updatedAt + a dot when locally modified.
import { useLocalCollection, useLocalDB, useLocalMutations } from '@payload-universal/local-db'
import type { AdminSchema } from '@payload-universal/admin-schema'
import { collectionLabel } from '../lib/collections'
import { docTitle, formatUpdatedAt } from '../lib/doc'

type Props = {
  schema: AdminSchema
  slug: string
  onOpen: (id: string) => void
}

export function DocumentList({ schema, slug, onOpen }: Props) {
  const localDB = useLocalDB()
  const { docs, loading, totalDocs } = useLocalCollection(localDB, slug, {
    sort: '-updatedAt',
    limit: 100,
  })
  const { create } = useLocalMutations(localDB, slug)

  const meta = schema.menuModel.collections.find((c) => c.slug === slug)
  const label = meta ? collectionLabel(meta) : slug
  const useAsTitle = meta?.useAsTitle

  const createNew = async () => {
    if (!localDB) return
    try {
      // Drafts-enabled collections start as a draft so the server accepts the
      // (still empty) doc on first push; non-draft collections stay queued
      // locally until required fields are filled in and saved.
      const id = await create(meta?.drafts ? { _status: 'draft' } : {})
      onOpen(id)
    } catch (err) {
      console.error('Failed to create document:', err)
    }
  }

  return (
    <div className="main">
      <div className="main-header">
        <h2>{label}</h2>
        <span className="doc-row meta" style={{ padding: 0, border: 'none' }}>
          {totalDocs} {totalDocs === 1 ? 'item' : 'items'}
        </span>
        <div className="spacer" />
        <button className="primary" onClick={createNew} disabled={!localDB}>
          New document
        </button>
      </div>

      <div className="main-scroll">
        {!localDB || loading ? (
          <div className="empty">Loading…</div>
        ) : docs.length === 0 ? (
          <div className="empty">No documents yet. Create one to get started.</div>
        ) : (
          docs.map((doc) => {
            const id = String((doc as Record<string, unknown>).id ?? '')
            const modified = Boolean((doc as Record<string, unknown>)._locallyModified)
            return (
              <button key={id} className="doc-row" onClick={() => onOpen(id)}>
                <span className={`dot${modified ? '' : ' placeholder'}`} />
                <span className="title">{docTitle(doc as Record<string, unknown>, useAsTitle)}</span>
                <span className="meta">
                  {formatUpdatedAt((doc as Record<string, unknown>).updatedAt)}
                </span>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
