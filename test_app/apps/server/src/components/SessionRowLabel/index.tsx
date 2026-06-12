'use client'
/**
 * SessionRowLabel — custom RowLabel for the events.sessions array.
 *
 * Exercises: useRowLabel (row data + index), div→View, span→Text.
 * RN-translatable (no document/window/canvas).
 */
import React from 'react'
import { useRowLabel } from '@payloadcms/ui'

type SessionRow = {
  title?: string
  speaker?: string
}

export const SessionRowLabel: React.FC = () => {
  // Guarded call: the native shim may not export useRowLabel yet. The
  // condition is constant per platform, so hook order stays stable.
  const { data, rowNumber } =
    typeof useRowLabel === 'function'
      ? useRowLabel<SessionRow>()
      : { data: undefined as SessionRow | undefined, rowNumber: undefined as number | undefined }

  const label = data?.title || `Session ${String((rowNumber ?? 0) + 1).padStart(2, '0')}`

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontWeight: 600, fontSize: 13 }}>{label}</span>
      {data?.speaker ? (
        <span style={{ color: '#888', fontSize: 12 }}>{data.speaker}</span>
      ) : null}
    </div>
  )
}

export default SessionRowLabel
