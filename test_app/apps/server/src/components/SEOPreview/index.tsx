'use client'
/**
 * SEOPreview — custom Field component replacing posts.metaTitle field.
 *
 * Exercises: useField (read + write), useForm (getData), Card, Banner,
 *            TextInput, Button, Link, FieldLabel, FieldError,
 *            input→RNTextInput, a→Link, button→Pressable,
 *            CSS inline styles, conditional classes,
 *            complex state management
 */
import React, { useState, useCallback, useMemo } from 'react'
import {
  useField,
  useForm,
  useConfig,
  Card,
  Banner,
  Button,
  Pill,
  Link,
  FieldLabel,
  FieldError,
} from '@payloadcms/ui'

const MAX_TITLE_LENGTH = 60
const MAX_DESC_LENGTH = 160

export const SEOPreview: React.FC<{ path: string }> = ({ path }) => {
  const { value: metaTitle, setValue: setMetaTitle, errorMessage } = useField<string>({ path })
  const { value: metaDesc } = useField<string>({ path: 'metaDescription' })
  const { value: canonicalUrl } = useField<string>({ path: 'canonicalUrl' })
  const { value: noIndex } = useField<boolean>({ path: 'noIndex' })
  const { getData } = useForm()
  const { config } = useConfig()

  const [showPreview, setShowPreview] = useState(true)

  const formData = getData()
  const pageTitle = metaTitle || (typeof formData?.title === 'string' ? formData.title : '')
  const pageDesc = metaDesc || (typeof formData?.excerpt === 'string' ? formData.excerpt : '')
  const pageUrl = canonicalUrl || `https://example.com/posts/${formData?.slug ?? 'untitled'}`

  const titleLength = pageTitle.length
  const descLength = pageDesc.length

  const titleOk = titleLength > 0 && titleLength <= MAX_TITLE_LENGTH
  const descOk = descLength > 0 && descLength <= MAX_DESC_LENGTH

  const handleAutoFill = useCallback(() => {
    const title = typeof formData?.title === 'string' ? formData.title : ''
    if (title && !metaTitle) {
      setMetaTitle(title.slice(0, MAX_TITLE_LENGTH))
    }
  }, [formData, metaTitle, setMetaTitle])

  const issues = useMemo(() => {
    const list: string[] = []
    if (!titleOk) list.push(titleLength === 0 ? 'Missing meta title' : 'Meta title too long')
    if (!descOk) list.push(descLength === 0 ? 'Missing meta description' : 'Meta description too long')
    if (noIndex) list.push('Page is set to noindex')
    return list
  }, [titleOk, descOk, noIndex, titleLength, descLength])

  return (
    <div style={{ marginBottom: 16 }}>
      {/* Title input */}
      <FieldLabel label="Meta Title (SEO)" required />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <input
          type="text"
          value={metaTitle ?? ''}
          onChange={(e) => setMetaTitle(e.target.value)}
          placeholder="Enter meta title for search engines..."
          style={{ flex: 1, padding: 8, border: '1px solid #ddd', borderRadius: 4 }}
        />
        <button
          onClick={handleAutoFill}
          style={{ padding: '6px 12px', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer' }}
        >
          Auto-fill
        </button>
      </div>

      {/* Character counter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        <Pill pillStyle={titleOk ? 'success' : 'error'}>
          {titleLength}/{MAX_TITLE_LENGTH}
        </Pill>
        <Pill pillStyle={descOk ? 'success' : 'error'}>
          Desc: {descLength}/{MAX_DESC_LENGTH}
        </Pill>
        {noIndex && <Pill pillStyle="warning">NOINDEX</Pill>}
      </div>

      {errorMessage && <FieldError message={errorMessage} />}

      {/* Issues banner */}
      {issues.length > 0 && (
        <Banner type="error">
          <div>
            <h4 style={{ margin: 0, marginBottom: 4, fontSize: 14 }}>SEO Issues ({issues.length})</h4>
            <ul style={{ margin: 0, paddingLeft: 16 }}>
              {issues.map((issue, i) => (
                <li key={i} style={{ fontSize: 12, marginBottom: 2 }}>{issue}</li>
              ))}
            </ul>
          </div>
        </Banner>
      )}

      {/* Google preview */}
      <div style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <FieldLabel label="Search Preview" />
          <Button onClick={() => setShowPreview(!showPreview)} buttonStyle="pill" size="small">
            {showPreview ? 'Hide' : 'Show'}
          </Button>
        </div>

        {showPreview && (
          <Card>
            <div style={{ fontFamily: 'Arial, sans-serif' }}>
              <h3 style={{ color: '#1a0dab', fontSize: 18, margin: 0, marginBottom: 4, textDecoration: 'none' }}>
                {pageTitle || 'Page Title'}
              </h3>
              <p style={{ color: '#006621', fontSize: 13, margin: 0, marginBottom: 4 }}>
                {pageUrl}
              </p>
              <p style={{ color: '#545454', fontSize: 13, margin: 0, lineHeight: 1.4 }}>
                {pageDesc || 'No description set. Add a meta description for better search results.'}
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

export default SEOPreview
