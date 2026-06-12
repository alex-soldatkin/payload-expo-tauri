import React from 'react'
import { NativeActionButton } from "@payload-universal/ui";

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
        <NativeActionButton
            onPress={handleShare}
        >
            Share Post
        </NativeActionButton>
    )
}

export default SharePostAction
