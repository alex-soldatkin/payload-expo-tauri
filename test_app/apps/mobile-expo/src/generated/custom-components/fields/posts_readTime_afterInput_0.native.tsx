/**
 * ReadTimeChart — afterInput component for posts.readTime field.
 *
 * THIS COMPONENT INTENTIONALLY USES <canvas> TO TRIGGER WEBVIEW FALLBACK.
 * The codegen's bail-out detection should flag this and generate a
 * WebViewFieldBridge wrapper instead of a native component.
 *
 * Exercises: WebView fallback path, canvas element detection,
 *            useField, Card, document.getElementById (bail-out trigger)
 */
import React, { useEffect, useRef } from 'react'
import { useField, Card, FieldLabel } from '@payload-universal/ui'
import { View, Text } from "react-native";

export const ReadTimeChart: React.FC<{ path: string }> = ({ path }) => {
    const { value: readTime } = useField<number>({ path })
    const canvasRef = useRef<HTMLCanvasElement>(null)

    useEffect(() => {
        const canvas = canvasRef.current
        if (!canvas) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const width = canvas.width
        const height = canvas.height
        const minutes = readTime ?? 0
        const maxMinutes = 30

        // Clear
        ctx.clearRect(0, 0, width, height)

        // Background
        ctx.fillStyle = '#f5f5f5'
        ctx.fillRect(0, 0, width, height)

        // Bar
        const barWidth = (minutes / maxMinutes) * (width - 20)
        const barColor = minutes <= 5 ? '#16a34a' : minutes <= 15 ? '#ca8a04' : '#dc2626'

        ctx.fillStyle = barColor
        ctx.beginPath()
        ctx.roundRect(10, 20, Math.max(barWidth, 4), 24, 4)
        ctx.fill()

        // Label
        ctx.fillStyle = '#333'
        ctx.font = '12px -apple-system, sans-serif'
        ctx.fillText(`${minutes} min read`, 10, 60)
    }, [readTime])

    return (
        <Card>
            <FieldLabel label="Read Time Visualization" />
            <View style={{ marginTop: 8 }}>
                <canvas
                    ref={canvasRef}
                    width={300}
                    height={70}
                    style={{ width: '100%', height: 70, borderRadius: 8 }}
                />
                <Text style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                    Estimated reading time based on content length.
                    This component uses canvas and will render in a WebView on mobile.
                </Text>
            </View>
        </Card>
    )
}

export default ReadTimeChart
