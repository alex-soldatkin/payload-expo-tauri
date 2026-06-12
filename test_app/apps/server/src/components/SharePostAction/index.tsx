'use client'

import React from 'react'

/**
 * Edit menu item — Share Post action.
 *
 * Web admin: renders a button in the document controls dropdown.
 * Mobile (via codegen): transpiled to React Native Pressable with Share API.
 */
export const SharePostAction: React.FC = () => {
  const handleShare = () => {
    // On the web admin this would open a share dialog or copy a URL.
    // The mobile side uses the native Share API via the action handler registry.
    console.log('Share post triggered')
  }

  return (
    <button
      type="button"
      onClick={handleShare}
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
      Share Post
    </button>
  )
}

export default SharePostAction
