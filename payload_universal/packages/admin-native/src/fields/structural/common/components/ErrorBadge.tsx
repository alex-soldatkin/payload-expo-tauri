import React from 'react'
import { Text, View } from 'react-native'

import { commonStyles } from '../styles'

// ---------------------------------------------------------------------------
// ErrorBadge — unified badge-style error count (replaces "(n errors)" text
// wherever a custom layout allows embedding views)
// ---------------------------------------------------------------------------

export const ErrorBadge: React.FC<{ count: number }> = ({ count }) => {
  if (count <= 0) return null
  return (
    <View style={commonStyles.errorBadge}>
      <Text style={commonStyles.errorBadgeText}>{count}</Text>
    </View>
  )
}
