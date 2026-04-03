'use client'
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
} from '@payloadcms/ui'

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
      <div style={{ marginBottom: 12 }}>
        <FieldLabel label="Post Status Overview" />
      </div>

      {/* Status pill + message banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Pill pillStyle={pillStyle as any}>
          {(status ?? 'draft').toUpperCase()}
        </Pill>
        {featured && (
          <Pill pillStyle="dark">FEATURED</Pill>
        )}
      </div>

      <Banner type={status === 'published' ? 'success' : status === 'archived' ? 'error' : 'info'}>
        <span>{message}</span>
      </Banner>

      {/* Metadata rows */}
      <Gutter>
        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 4 }}>
            <span style={{ color: '#666', fontSize: 13 }}>Title:</span>
            <span style={{ fontWeight: 600 }}>{title}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 4 }}>
            <span style={{ color: '#666', fontSize: 13 }}>Published:</span>
            <span>{formatDate(publishedDate)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: 4 }}>
            <span style={{ color: '#666', fontSize: 13 }}>Author:</span>
            <span>{user?.email ?? 'Unknown'}</span>
          </div>
        </div>
      </Gutter>

      {/* Quick publish button */}
      {status === 'draft' && (
        <div style={{ marginTop: 12 }}>
          <Button onClick={handleQuickPublish} buttonStyle="primary" size="small">
            Quick Publish
          </Button>
        </div>
      )}

      {/* Collapsible history section */}
      <div style={{ marginTop: 16 }}>
        <Collapsible label="Status History" initCollapsed>
          <div style={{ padding: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Pill pillStyle="light-gray">v3</Pill>
              <span style={{ fontSize: 12, color: '#888' }}>Published on Mar 15, 2026</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Pill pillStyle="light-gray">v2</Pill>
              <span style={{ fontSize: 12, color: '#888' }}>Draft saved on Mar 14, 2026</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Pill pillStyle="light-gray">v1</Pill>
              <span style={{ fontSize: 12, color: '#888' }}>Created on Mar 10, 2026</span>
            </div>
          </div>
        </Collapsible>
      </div>

      <FieldDescription description="Status dashboard powered by @payloadcms/ui custom components" />
    </Card>
  )
}

export default StatusDashboard
