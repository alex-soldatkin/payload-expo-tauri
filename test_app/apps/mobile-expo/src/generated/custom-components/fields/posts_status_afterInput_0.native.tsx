/**
 * StatusDashboard — afterInput component for the posts.status field.
 *
 * Exercises: Card, Pill, Banner, Button, Collapsible, Gutter,
 *            useField, useForm, useAuth, useTranslation, FieldLabel,
 *            div→View, span→Text, onClick→onPress, CSS inline styles
 */
import React, { useState, useCallback } from 'react'
import {
    useField,
    useForm,
    useAuth,
    useTranslation,
    Card,
    Pill,
    Banner,
    Button,
    Collapsible,
    Gutter,
    FieldLabel,
    FieldDescription,
    Loading,
} from '@payload-universal/ui'
import { View, Text } from "react-native";

const statusColors: Record<string, string> = {
    draft: 'warning',
    published: 'success',
    archived: 'light-gray',
}

const statusMessages: Record<string, string> = {
    draft: 'This post is not yet visible to the public.',
    published: 'This post is live and visible to all visitors.',
    archived: 'This post has been archived and is no longer visible.',
}

export const StatusDashboard: React.FC<{ path: string }> = ({ path }) => {
    const { value: status } = useField<string>({ path })
    const { value: publishedDate } = useField<string>({ path: 'publishedDate' })
    const { value: featured } = useField<boolean>({ path: 'featured' })
    const { getData } = useForm()
    const { user } = useAuth()
    const { t } = useTranslation()
    const [showHistory, setShowHistory] = useState(false)

    const formData = getData()
    const title = typeof formData?.title === 'string' ? formData.title : 'Untitled'

    const pillStyle = statusColors[status ?? 'draft'] ?? 'light'
    const message = statusMessages[status ?? 'draft'] ?? ''

    const formatDate = (dateStr: string | undefined) => {
        if (!dateStr) return 'Not set'
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
            })
        } catch {
            return dateStr
        }
    }

    const handleQuickPublish = useCallback(() => {
        // This would trigger a form update — just a UI demo
        alert(`Would publish "${title}" now`)
    }, [title])

    return (
        <Card>
            <View style={{ marginBottom: 12 }}>
                <FieldLabel label="Post Status Overview" />
            </View>

            {/* Status pill + message banner */}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Pill pillStyle={pillStyle as any}>
                    {(status ?? 'draft').toUpperCase()}
                </Pill>
                {featured && (
                    <Pill pillStyle="dark">FEATURED</Pill>
                )}
            </View>

            <Banner type={status === 'published' ? 'success' : status === 'archived' ? 'error' : 'info'}>
                <Text>{message}</Text>
            </Banner>

            {/* Metadata rows */}
            <Gutter>
                <View style={{ marginTop: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 4 }}>
                        <Text style={{ color: '#666', fontSize: 13 }}>Title:</Text>
                        <Text style={{ fontWeight: 600 }}>{title}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 4 }}>
                        <Text style={{ color: '#666', fontSize: 13 }}>Published:</Text>
                        <Text>{formatDate(publishedDate)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 4 }}>
                        <Text style={{ color: '#666', fontSize: 13 }}>Author:</Text>
                        <Text>{user?.email ?? 'Unknown'}</Text>
                    </View>
                </View>
            </Gutter>

            {/* Quick publish button */}
            {status === 'draft' && (
                <View style={{ marginTop: 12 }}>
                    <Button onPress={handleQuickPublish} buttonStyle="primary" size="small">
                        Quick Publish
                    </Button>
                </View>
            )}

            {/* Collapsible history section */}
            <View style={{ marginTop: 16 }}>
                <Collapsible label="Status History" initCollapsed>
                    <View style={{ padding: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Pill pillStyle="light-gray">v3</Pill>
                            <Text style={{ fontSize: 12, color: '#888' }}>Published on Mar 15, 2026</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                            <Pill pillStyle="light-gray">v2</Pill>
                            <Text style={{ fontSize: 12, color: '#888' }}>Draft saved on Mar 14, 2026</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Pill pillStyle="light-gray">v1</Pill>
                            <Text style={{ fontSize: 12, color: '#888' }}>Created on Mar 10, 2026</Text>
                        </View>
                    </View>
                </Collapsible>
            </View>

            <FieldDescription description="Status dashboard powered by @payloadcms/ui custom components" />
        </Card>
    )
}

export default StatusDashboard
