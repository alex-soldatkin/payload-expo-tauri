// Upload editor: value is a media doc id (same shape as a mono relationship).
// Renders the current selection as a thumbnail + filename; the picker is a grid
// of local media docs. Thumbnail URLs are resolved against the server base URL.
import { useMemo, useRef, useState } from 'react'
import { useLocalCollection, useLocalDB, useLocalDocument } from '@payload-universal/local-db'
import type { PayloadDoc } from '@payload-universal/local-db'
import type { FieldComponentProps } from '../types'
import { useFormEngine } from '../FieldRenderer'
import { uploadToCollection } from '../upload'
import { FieldShell, isReadOnly, useFieldValue } from './shared'

/** Read a possibly-populated upload id defensively (depth>0 → object). */
function idOf(v: unknown): string {
  if (v && typeof v === 'object') return String((v as { id?: unknown }).id ?? '')
  return String(v ?? '')
}

type MediaShape = {
  url?: string
  filename?: string
  alt?: string
  sizes?: { thumbnail?: { url?: string } }
}

/** Best thumbnail source for a media doc, absolute against the server URL. */
function thumbSrc(doc: PayloadDoc | MediaShape | null, serverURL: string): string | null {
  if (!doc) return null
  const media = doc as MediaShape
  const raw = media.sizes?.thumbnail?.url ?? media.url
  if (!raw) return null
  try {
    return new URL(raw, serverURL).toString()
  } catch {
    return null
  }
}

export function UploadField(props: FieldComponentProps) {
  const { field } = props
  const { value, setValue } = useFieldValue(props)
  const readOnly = isReadOnly(props)
  const { serverURL, token } = useFormEngine()
  const localDB = useLocalDB()

  const mediaSlug = typeof field.relationTo === 'string' ? field.relationTo : 'media'
  const currentId = idOf(value)

  const { doc: current } = useLocalDocument(localDB, mediaSlug, currentId || null)
  const [open, setOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const select = (id: string) => {
    setValue(id)
    setOpen(false)
  }

  // Upload a file directly to the related upload collection and select it. The
  // local copy arrives on the next sync pull; the value id is set immediately.
  // `alt` defaults to the filename so collections that require it don't reject.
  const upload = (file: File) => {
    setUploading(true)
    setUploadError(null)
    uploadToCollection(file, mediaSlug, serverURL, token, { alt: file.name })
      .then((doc) => setValue(doc.id))
      .catch((err) => setUploadError(err instanceof Error ? err.message : 'Upload failed.'))
      .finally(() => setUploading(false))
  }

  // Drop → upload the first file of ANY type (images, PDFs, documents): the
  // related collection decides which MIME types it accepts, not the client.
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (readOnly || uploading) return
    const file = Array.from(e.dataTransfer.files)[0]
    if (file) upload(file)
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-picking the same file
    if (file) upload(file)
  }

  const dropHandlers = readOnly
    ? {}
    : {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault()
          setDragOver(true)
        },
        onDragLeave: () => setDragOver(false),
        onDrop,
      }

  return (
    <FieldShell props={props}>
      <div
        className={`picker-value upload-drop${dragOver ? ' over' : ''}`}
        {...dropHandlers}
      >
        {!readOnly && (
          <input
            ref={fileInputRef}
            type="file"
            hidden
            onChange={onPick}
          />
        )}
        {currentId ? (
          <>
            <Thumb doc={current} serverURL={serverURL} />
            <span className="title">{(current as MediaShape | null)?.filename ?? currentId}</span>
            {!readOnly && (
              <>
                <button type="button" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
                <button type="button" onClick={() => setOpen((o) => !o)}>
                  Change
                </button>
                <button type="button" onClick={() => setValue(null)}>
                  Clear
                </button>
              </>
            )}
          </>
        ) : (
          <>
            <span className="doc-meta">
              {uploading ? 'Uploading…' : 'No file selected — drop a file here'}
            </span>
            {!readOnly && !uploading && (
              <>
                <button type="button" onClick={() => fileInputRef.current?.click()}>
                  Upload
                </button>
                <button type="button" onClick={() => setOpen((o) => !o)}>
                  Select
                </button>
              </>
            )}
          </>
        )}
      </div>
      {uploadError && <div className="field-error">{uploadError}</div>}
      {!readOnly && open && (
        <MediaPicker slug={mediaSlug} serverURL={serverURL} onSelect={select} />
      )}
    </FieldShell>
  )
}

/** A media thumbnail or a placeholder box when no url is resolvable. */
function Thumb({ doc, serverURL }: { doc: PayloadDoc | MediaShape | null; serverURL: string }) {
  const src = thumbSrc(doc, serverURL)
  if (!src) return <span className="upload-thumb" style={{ background: 'rgba(255,255,255,0.08)' }} />
  const alt = (doc as MediaShape | null)?.alt ?? ''
  return <img className="upload-thumb" src={src} alt={alt} />
}

/** Grid of local media docs to pick from. */
function MediaPicker({
  slug,
  serverURL,
  onSelect,
}: {
  slug: string
  serverURL: string
  onSelect: (id: string) => void
}) {
  const localDB = useLocalDB()
  const { docs } = useLocalCollection(localDB, slug, { limit: 100 })
  const items = useMemo(() => docs, [docs])

  return (
    <div className="picker-menu">
      {items.length === 0 && <div className="option doc-meta">No media.</div>}
      {items.map((doc) => {
        const media = doc as MediaShape
        return (
          <button key={doc.id} type="button" className="option" onClick={() => onSelect(doc.id)}>
            <Thumb doc={doc} serverURL={serverURL} />
            <span className="title">{media.filename ?? doc.id}</span>
            {media.alt && <span className="doc-meta">{media.alt}</span>}
          </button>
        )
      })}
    </div>
  )
}
