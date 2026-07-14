// DOM port of server ContentMetrics — an afterInput decorator for posts.excerpt.
// Copies the original's metrics: excerpt word count, reading-time estimate
// (Math.ceil(words / 200) min), title char count (ok: 1..60), and tag count;
// warnings when title/excerpt fall outside their ok bands.
import { useWatch } from 'react-hook-form'
import type { FieldComponentProps } from '../types'

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function estimateReadTime(words: number): string {
  const minutes = Math.ceil(words / 200)
  if (minutes < 1) return 'Less than a minute'
  return `${minutes} min read`
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

export function ContentMetrics(props: FieldComponentProps) {
  const form = useWatch({ control: props.control }) as Record<string, unknown>
  const excerptWords = countWords(str(form.excerpt))
  const titleChars = str(form.title).length
  const tags = form.tags
  const tagCount = Array.isArray(tags) ? tags.length : 0

  const readTime = estimateReadTime(excerptWords)
  const titleOk = titleChars > 0 && titleChars <= 60
  const excerptOk = excerptWords >= 10 && excerptWords <= 50

  return (
    <div style={{ marginTop: 8 }}>
      <div className="field-label" style={{ marginBottom: 6 }}>
        Content Metrics
      </div>
      <div className="chips">
        <span className="chip" style={pill(excerptOk)}>
          {excerptWords} words
        </span>
        <span className="chip">{readTime}</span>
        <span className="chip" style={pill(titleOk)}>
          Title: {titleChars}/60 chars
        </span>
        {tagCount > 0 && (
          <span className="chip">
            {tagCount} tag{tagCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {!titleOk && (
        <div className="field-description" style={{ color: '#ca8a04', marginTop: 4 }}>
          Title should be between 1 and 60 characters for SEO.
        </div>
      )}
      {!excerptOk && excerptWords > 0 && (
        <div className="field-description" style={{ color: '#ca8a04', marginTop: 4 }}>
          Excerpt should be 10–50 words for optimal preview display.
        </div>
      )}
    </div>
  )
}

function pill(ok: boolean): React.CSSProperties {
  return ok
    ? { background: 'rgba(46, 160, 67, 0.2)', borderColor: 'rgba(46, 160, 67, 0.5)' }
    : { background: 'rgba(202, 138, 4, 0.2)', borderColor: 'rgba(202, 138, 4, 0.5)' }
}

export default ContentMetrics
