// DOM port of server ReadTimeChart — an afterInput bar for posts.readTime.
// The original drew a <canvas> bar (a deliberate mobile WebView bail-out); here
// we render an equivalent DOM bar with the same scale (maxMinutes = 30) and
// colour thresholds (≤5 green, ≤15 amber, else red).
import { useWatch } from 'react-hook-form'
import type { FieldComponentProps } from '../types'

const MAX_MINUTES = 30

function barColor(minutes: number): string {
  if (minutes <= 5) return '#16a34a'
  if (minutes <= 15) return '#ca8a04'
  return '#dc2626'
}

export function ReadTimeChart(props: FieldComponentProps) {
  const raw = useWatch({ control: props.control, name: props.path }) as unknown
  const minutes = typeof raw === 'number' && !Number.isNaN(raw) ? raw : 0
  const pct = Math.min(minutes / MAX_MINUTES, 1) * 100

  return (
    <div style={{ marginTop: 8 }}>
      <div className="field-label" style={{ marginBottom: 6 }}>
        Read Time Visualization
      </div>
      <div
        style={{
          position: 'relative',
          height: 24,
          borderRadius: 6,
          background: 'rgba(255, 255, 255, 0.06)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.max(pct, 2)}%`,
            background: barColor(minutes),
            borderRadius: 6,
            transition: 'width 120ms ease',
          }}
        />
      </div>
      <div className="field-description" style={{ marginTop: 4 }}>
        {minutes} min read
      </div>
    </div>
  )
}

export default ReadTimeChart
