// Schema-driven globals editor — the online-only sibling of DocumentForm.
// Globals aren't synced by local-db (issue #27 slice), so this loads/saves
// over REST. RHF holds one nested value object seeded from the server doc;
// relationship/upload fields inside globals still read their candidates from
// the LOCAL db (collections ARE synced), so those work offline-of-globals.
// Validation errors map stays empty in v1 — REST errors surface at the save bar.
import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import type { AdminSchema } from '@payload-universal/admin-schema'
import type { SchemaField } from '../../form/types'
import { FormEngineProvider, renderField } from '../../form/FieldRenderer'
import { globalLabel } from '../../lib/collections'
import { getGlobalRootFields, fetchGlobal, saveGlobal } from './api'

/** Keys never shown or written by the form (mirrors DocumentForm). */
const INTERNAL_KEYS = new Set(['id', 'globalType', 'createdAt', 'updatedAt'])

function editableValues(doc: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(doc)) {
    if (INTERNAL_KEYS.has(k)) continue
    if (k.startsWith('_') && k !== '_status') continue
    out[k] = v
  }
  return out
}

type Props = {
  slug: string
  schema: AdminSchema
  serverURL: string
  token: string
  /** Reports the global's display label (tab labels). */
  onTitle?: (title: string) => void
}

export function GlobalForm({ slug, schema, serverURL, token, onTitle }: Props) {
  const rootFields = useMemo(() => getGlobalRootFields(schema, slug), [schema, slug])

  const { control, getValues, setValue, handleSubmit, reset, formState } = useForm<
    Record<string, unknown>
  >({ defaultValues: {} })

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Report the label once (from the menu model), independent of the load.
  useEffect(() => {
    const meta = schema.menuModel.globals.find((g) => g.slug === slug)
    onTitle?.(meta ? globalLabel(meta) : slug)
  }, [schema, slug, onTitle])

  const load = async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const doc = await fetchGlobal(serverURL, token, slug)
      reset(editableValues(doc))
    } catch {
      // Any fetch failure here is treated as "no connection" — globals are
      // online-only, so there's nothing local to fall back to.
      setLoadError('Globals require a connection.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverURL, token, slug])

  const { mainFields, sidebarFields } = useMemo(() => {
    const main: SchemaField[] = []
    const side: SchemaField[] = []
    for (const f of rootFields) {
      if (f.admin?.position === 'sidebar') side.push(f)
      else main.push(f)
    }
    return { mainFields: main, sidebarFields: side }
  }, [rootFields])

  const save = handleSubmit(async (values) => {
    setBusy(true)
    setSaved(false)
    setSubmitError(null)
    try {
      const updated = await saveGlobal(serverURL, token, slug, values)
      reset(editableValues(updated))
      setSaved(true)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Save failed.')
    } finally {
      setBusy(false)
    }
  })

  // Relationship/upload candidates come from the local db (synced collections),
  // so docId isn't needed for globals; slug doubles as the id. Errors map is
  // empty v1 — REST validation errors are shown at the save bar instead.
  const engine = {
    slug,
    serverURL,
    token,
    docId: slug,
    control,
    getValues,
    setValue,
    errors: {} as Record<string, string>,
    onEdit: () => {},
  }

  if (loading) return <div className="empty">Loading…</div>
  if (loadError) {
    return (
      <div className="empty globals-offline">
        <p>{loadError}</p>
        <button onClick={() => void load()}>Retry</button>
      </div>
    )
  }

  return (
    <FormEngineProvider value={engine}>
      <div className="main">
        <div className="form-layout">
          <div className="form-main">{mainFields.map((f) => renderField(f, ''))}</div>
          {sidebarFields.length > 0 && (
            <div className="form-sidebar">{sidebarFields.map((f) => renderField(f, ''))}</div>
          )}
        </div>

        <div className="editor-actions">
          <button className="primary" onClick={save} disabled={busy || !formState.isDirty}>
            {busy ? 'Saving…' : 'Save'}
          </button>
          {submitError && <span className="editor-error">{submitError}</span>}
          {saved && !submitError && <span className="editor-saved">Saved</span>}
          <div className="spacer" />
        </div>
      </div>
    </FormEngineProvider>
  )
}
