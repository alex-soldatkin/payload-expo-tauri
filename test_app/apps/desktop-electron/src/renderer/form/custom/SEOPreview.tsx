// DOM port of server SEOPreview — a metaTitle editor plus a Google-SERP-style
// preview. Mirrors the original's fallbacks: title ← metaTitle || title;
// description ← metaDescription || excerpt; url ← canonicalUrl ||
// `https://example.com/posts/${slug ?? 'untitled'}`. Char limits and the
// success/error length checks are copied from the original.
import { useWatch } from 'react-hook-form'
import type { FieldComponentProps } from '../types'
import { FieldShell, useFieldValue, isReadOnly, placeholderOf } from '../fields/shared'

const MAX_TITLE_LENGTH = 60
const MAX_DESC_LENGTH = 160

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function SEOPreview(props: FieldComponentProps) {
  const { value: metaTitle, setValue, onBlur } = useFieldValue<string | undefined>(props)
  const readOnly = isReadOnly(props)

  const form = useWatch({ control: props.control }) as Record<string, unknown>
  const metaDesc = str(form.metaDescription)
  const canonicalUrl = str(form.canonicalUrl)
  const noIndex = Boolean(form.noIndex)

  const pageTitle = str(metaTitle) || str(form.title)
  const pageDesc = metaDesc || str(form.excerpt)
  const slug = str(form.slug) || 'untitled'
  const pageUrl = canonicalUrl || `https://example.com/posts/${slug}`

  const titleLength = pageTitle.length
  const descLength = pageDesc.length
  const titleOk = titleLength > 0 && titleLength <= MAX_TITLE_LENGTH
  const descOk = descLength > 0 && descLength <= MAX_DESC_LENGTH

  return (
    <FieldShell props={props}>
      <input
        className="input"
        type="text"
        value={metaTitle ?? ''}
        placeholder={placeholderOf(props) ?? 'Enter meta title for search engines…'}
        readOnly={readOnly}
        onBlur={onBlur}
        onChange={(e) => setValue(e.target.value === '' ? undefined : e.target.value)}
      />

      <div className="chips" style={{ marginTop: 6 }}>
        <span className="chip" style={pillStyle(titleOk)}>
          {titleLength}/{MAX_TITLE_LENGTH}
        </span>
        <span className="chip" style={pillStyle(descOk)}>
          Desc: {descLength}/{MAX_DESC_LENGTH}
        </span>
        {noIndex && (
          <span className="chip" style={pillStyle(false)}>
            NOINDEX
          </span>
        )}
      </div>

      <div
        style={{
          marginTop: 10,
          padding: 12,
          borderRadius: 8,
          background: 'rgba(255, 255, 255, 0.06)',
          border: '1px solid rgba(124, 92, 255, 0.25)',
        }}
      >
        <div style={{ color: '#8ab4f8', fontSize: 16, marginBottom: 2 }}>
          {pageTitle || 'Page Title'}
        </div>
        <div style={{ color: '#5f9e6a', fontSize: 12, marginBottom: 4 }}>{pageUrl}</div>
        <div style={{ color: 'var(--ink-muted)', fontSize: 12, lineHeight: 1.4 }}>
          {pageDesc || 'No description set. Add a meta description for better search results.'}
        </div>
      </div>
    </FieldShell>
  )
}

function pillStyle(ok: boolean): React.CSSProperties {
  return ok
    ? { background: 'rgba(46, 160, 67, 0.2)', borderColor: 'rgba(46, 160, 67, 0.5)' }
    : { background: 'rgba(229, 72, 77, 0.2)', borderColor: 'rgba(229, 72, 77, 0.5)' }
}

export default SEOPreview
