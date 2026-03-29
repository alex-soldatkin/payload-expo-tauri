'use client'

import { useState } from 'react'
import { fetchAdminSchema } from '@payload-universal/admin-schema/client'

const buildSchemaPaths = (entries: Array<[string, any]>, limit = 12) =>
  entries
    .map(([path, field]) => ({
      path,
      type: field?.type || (field?.fields ? 'group' : 'unknown'),
    }))
    .slice(0, limit)

const buildRootFields = (entries: Array<[string, any]>, slug: string) => {
  const map = new Map(entries)
  const root = map.get(slug)

  if (!root || !Array.isArray(root.fields)) {
    return []
  }

  return root.fields.map((field: any) => ({
    name: field.name || '(unnamed)',
    type: field.type || 'unknown',
  }))
}

export default function Page() {
  const [baseURL, setBaseURL] = useState('')
  const [language, setLanguage] = useState('')
  const [token, setToken] = useState('')
  const [includeCredentials, setIncludeCredentials] = useState(true)
  const [status, setStatus] = useState('')
  const [schema, setSchema] = useState<any>(null)
  const [error, setError] = useState('')

  const handleLoad = async () => {
    setError('')
    setStatus('Loading admin schema...')

    try {
      const result = await fetchAdminSchema({
        baseURL: baseURL || undefined,
        language: language || undefined,
        requestInit: {
          credentials: includeCredentials ? 'include' : 'omit',
          headers: token ? { Authorization: `JWT ${token}` } : undefined,
        },
      })

      setSchema(result)
      setStatus('Schema loaded successfully.')
    } catch (err) {
      setSchema(null)
      setStatus('')
      setError(err instanceof Error ? err.message : 'Failed to load schema.')
    }
  }

  const collections = schema
    ? Object.entries(schema.collections).map(([slug, entries]) => ({
        slug,
        count: (entries as Array<[string, any]>).length,
        fields: buildRootFields(entries as Array<[string, any]>, slug),
        paths: buildSchemaPaths(entries as Array<[string, any]>),
      }))
    : []

  const globals = schema
    ? Object.entries(schema.globals).map(([slug, entries]) => ({
        slug,
        count: (entries as Array<[string, any]>).length,
        fields: buildRootFields(entries as Array<[string, any]>, slug),
        paths: buildSchemaPaths(entries as Array<[string, any]>),
      }))
    : []

  return (
    <div className="page">
      <header className="header">
        <h1>Admin Schema Preview</h1>
        <p>Fetches <code>/api/admin-schema</code> and renders a basic summary.</p>
      </header>

      <section className="controls">
        <label className="field">
          <span>Base URL (optional)</span>
          <input
            value={baseURL}
            placeholder="http://localhost:3000"
            onChange={(event) => setBaseURL(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Language</span>
          <input
            value={language}
            placeholder="en"
            onChange={(event) => setLanguage(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Auth token (optional)</span>
          <input
            value={token}
            type="password"
            placeholder="JWT token"
            onChange={(event) => setToken(event.target.value)}
          />
        </label>
        <label className="toggle">
          <input
            type="checkbox"
            checked={includeCredentials}
            onChange={(event) => setIncludeCredentials(event.target.checked)}
          />
          <span>Include credentials</span>
        </label>
        <button type="button" onClick={handleLoad}>Load schema</button>
      </section>

      {(status || error) && (
        <section className="status">
          <div className="status-message" style={{ background: error ? '#f8d7da' : undefined }}>
            {error || status}
          </div>
        </section>
      )}

      <section className="results">
        <div className="panel">
          <h2>Summary</h2>
          {schema ? (
            <div>
              <p><strong>Generated at:</strong> {schema.generatedAt}</p>
              <p><strong>Collections:</strong> {Object.keys(schema.collections).length}</p>
              <p><strong>Globals:</strong> {Object.keys(schema.globals).length}</p>
            </div>
          ) : (
            <p>No schema loaded yet.</p>
          )}
        </div>

        <div className="panel">
          <h2>Collections</h2>
          <div className="list">
            {collections.length === 0 && <p>No entries found.</p>}
            {collections.map((collection) => (
              <div key={collection.slug} className="card">
                <h3>{collection.slug}</h3>
                <p><strong>{collection.count}</strong> schema entries</p>
                <ul>
                  {collection.fields.map((field) => (
                    <li key={`${collection.slug}-${field.name}`}>
                      <span className="code">{field.name}</span> — {field.type}
                    </li>
                  ))}
                </ul>
                <details className="paths">
                  <summary>Schema paths (first {collection.paths.length})</summary>
                  <ul>
                    {collection.paths.map((entry) => (
                      <li key={`${collection.slug}-${entry.path}`}>
                        <span className="code">{entry.path}</span> — {entry.type}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            ))}
          </div>
        </div>

        <div className="panel">
          <h2>Globals</h2>
          <div className="list">
            {globals.length === 0 && <p>No entries found.</p>}
            {globals.map((global) => (
              <div key={global.slug} className="card">
                <h3>{global.slug}</h3>
                <p><strong>{global.count}</strong> schema entries</p>
                <ul>
                  {global.fields.map((field) => (
                    <li key={`${global.slug}-${field.name}`}>
                      <span className="code">{field.name}</span> — {field.type}
                    </li>
                  ))}
                </ul>
                <details className="paths">
                  <summary>Schema paths (first {global.paths.length})</summary>
                  <ul>
                    {global.paths.map((entry) => (
                      <li key={`${global.slug}-${entry.path}`}>
                        <span className="code">{entry.path}</span> — {entry.type}
                      </li>
                    ))}
                  </ul>
                </details>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
