// DOM port of server StatusDashboard — an afterInput overview for posts.status.
// Mirrors the original's status → colour/message maps and shows the current
// option as a badge with a per-status message banner. The original also read
// user/publishedDate/featured and rendered a demo "quick publish" + fake
// history; here we keep the status-centric visual (badge + step trail across
// draft/review/published/archived) which is the load-bearing part.
import { useWatch } from 'react-hook-form'
import type { FieldComponentProps } from '../types'

const STEPS = ['draft', 'review', 'published', 'archived'] as const

const statusColors: Record<string, string> = {
  draft: '#ca8a04',
  review: '#8a8f98',
  published: '#16a34a',
  archived: '#6b7280',
}

const statusMessages: Record<string, string> = {
  draft: 'This post is not yet visible to the public.',
  review: 'This post is awaiting editorial review before publishing.',
  published: 'This post is live and visible to all visitors.',
  archived: 'This post has been archived and is no longer visible.',
}

export function StatusDashboard(props: FieldComponentProps) {
  const raw = useWatch({ control: props.control, name: props.path }) as unknown
  const status = typeof raw === 'string' ? raw : 'draft'
  const featured = Boolean(useWatch({ control: props.control, name: 'featured' }))

  const color = statusColors[status] ?? '#8a8f98'
  const message = statusMessages[status] ?? ''
  const activeIndex = STEPS.indexOf(status as (typeof STEPS)[number])

  return (
    <div style={{ marginTop: 8 }}>
      <div className="field-label" style={{ marginBottom: 6 }}>
        Post Status Overview
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span
          className="chip"
          style={{ background: `${color}33`, borderColor: `${color}88`, fontWeight: 600 }}
        >
          {status.toUpperCase()}
        </span>
        {featured && (
          <span
            className="chip"
            style={{ background: 'rgba(124, 92, 255, 0.25)', borderColor: 'rgba(124, 92, 255, 0.6)' }}
          >
            FEATURED
          </span>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {STEPS.map((step, i) => {
          const reached = activeIndex >= 0 && i <= activeIndex
          return (
            <div key={step} style={{ flex: 1, textAlign: 'center' }}>
              <div
                style={{
                  height: 4,
                  borderRadius: 2,
                  background: reached ? statusColors[step] : 'rgba(255, 255, 255, 0.12)',
                }}
              />
              <div
                className="field-description"
                style={{ marginTop: 3, color: i === activeIndex ? 'var(--ink)' : undefined }}
              >
                {step}
              </div>
            </div>
          )
        })}
      </div>

      <div className="field-description">{message}</div>
    </div>
  )
}

export default StatusDashboard
