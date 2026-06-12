'use client'

import React from 'react'

/**
 * List menu item — Bulk Publish action.
 *
 * Web admin: renders a button in the list controls popup.
 * Mobile (via codegen): transpiled to React Native Pressable.
 */
export const BulkPublishAction: React.FC = () => {
  const handleBulkPublish = () => {
    // On the web admin this would use useSelection() from @payloadcms/ui.
    // The mobile side handles selection + publishing via the action handler registry.
    console.log('Bulk publish triggered')
  }

  return (
    <button
      type="button"
      onClick={handleBulkPublish}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: 'transparent',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        color: '#1f1f1f',
        width: '100%',
        textAlign: 'left',
      }}
    >
      Publish Selected
    </button>
  )
}

export default BulkPublishAction
