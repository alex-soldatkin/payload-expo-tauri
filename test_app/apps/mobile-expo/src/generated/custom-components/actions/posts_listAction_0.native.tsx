import React from 'react'
import { NativeActionButton } from "@payload-universal/ui";

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
        <NativeActionButton
            onPress={handleBulkPublish}
        >
            Publish Selected
        </NativeActionButton>
    )
}

export default BulkPublishAction
