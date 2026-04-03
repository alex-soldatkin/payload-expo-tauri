/**
 * ContentMetrics — afterInput component for posts.excerpt field.
 *
 * Exercises: useField (reading sibling fields), Pill, FieldDescription,
 *            div→View, span→Text, p→Text, h3→Text,
 *            CSS class names, inline styles, conditional rendering
 */
import React, { useMemo } from 'react'
import {
    useField,
    useDocumentInfo,
    Pill,
    FieldLabel,
    FieldDescription,
} from '@payload-universal/ui'
import { View, Text } from "react-native";

function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length
}

function estimateReadTime(words: number): string {
    const minutes = Math.ceil(words / 200)
    if (minutes < 1) return 'Less than a minute'
    return `${minutes} min read`
}

export const ContentMetrics: React.FC<{ path: string }> = ({ path }) => {
    const { value: excerpt } = useField<string>({ path: 'excerpt' })
    const { value: title } = useField<string>({ path: 'title' })
    const { value: tags } = useField<string[]>({ path: 'tags' })
    const { id, collectionSlug } = useDocumentInfo()

    const metrics = useMemo(() => {
        const excerptWords = countWords(excerpt ?? '')
        const titleChars = (title ?? '').length
        const tagCount = Array.isArray(tags) ? tags.length : 0

        return {
            excerptWords,
            titleChars,
            tagCount,
            readTime: estimateReadTime(excerptWords),
            titleOk: titleChars > 0 && titleChars <= 60,
            excerptOk: excerptWords >= 10 && excerptWords <= 50,
        }
    }, [excerpt, title, tags])

    return (
        <View className="content-metrics" style={{ marginTop: 8, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <FieldLabel label="Content Metrics" />
                {id && (
                    <Text style={{ fontSize: 11, color: '#aaa' }}>
                        ID: {String(id).slice(0, 8)}...
                    </Text>
                )}
            </View>

            {/* Metric pills */}
            <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                <Pill pillStyle={metrics.excerptOk ? 'success' : 'warning'}>
                    {metrics.excerptWords} words
                </Pill>
                <Pill pillStyle="light">
                    {metrics.readTime}
                </Pill>
                <Pill pillStyle={metrics.titleOk ? 'success' : 'error'}>
                    Title: {metrics.titleChars}/60 chars
                </Pill>
                {metrics.tagCount > 0 && (
                    <Pill pillStyle="dark">
                        {metrics.tagCount} tag{metrics.tagCount !== 1 ? 's' : ''}
                    </Pill>
                )}
            </View>

            {/* Warnings */}
            {!metrics.titleOk && (
                <Text style={{ fontSize: 12, color: '#ca8a04', margin: 0, marginBottom: 4 }}>
                    Title should be between 1 and 60 characters for SEO.
                </Text>
            )}
            {!metrics.excerptOk && metrics.excerptWords > 0 && (
                <Text style={{ fontSize: 12, color: '#ca8a04', margin: 0, marginBottom: 4 }}>
                    Excerpt should be 10-50 words for optimal preview display.
                </Text>
            )}

            <FieldDescription description={`Collection: ${collectionSlug ?? 'unknown'}`} />
        </View>
    )
}

export default ContentMetrics
