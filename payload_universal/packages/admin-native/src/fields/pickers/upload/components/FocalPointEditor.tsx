import React, { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Image,
  PanResponder,
  Pressable,
  Text,
  View,
} from 'react-native'

import { defaultTheme as t } from '../../../../theme'
import { payloadApi } from '../../../../utils/api'
import { type PickerPalette, sharedStyles } from '../../shared'
import { styles } from '../styles'
import type { MediaDoc } from '../types'
import { clampPct, fullURLFor } from '../utils'

// ---------------------------------------------------------------------------
// Focal point editor (pure RN — PanResponder draggable dot)
// ---------------------------------------------------------------------------

export const FocalPointEditor: React.FC<{
  doc: MediaDoc
  collection: string
  baseURL: string
  token: string | null
  palette: PickerPalette
  onSaved: (doc: MediaDoc) => void
  onCancel: () => void
}> = ({ doc, collection, baseURL, token, palette, onSaved, onCancel }) => {
  const initialX = typeof doc.focalX === 'number' ? doc.focalX : 50
  const initialY = typeof doc.focalY === 'number' ? doc.focalY : 50
  const [focal, setFocal] = useState({ x: clampPct(initialX), y: clampPct(initialY) })
  const [boxWidth, setBoxWidth] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const sizeRef = useRef({ w: 0, h: 0 })

  const aspect = (() => {
    const w = Number(doc.width)
    const h = Number(doc.height)
    return Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 ? w / h : 4 / 3
  })()

  let dispW = boxWidth
  let dispH = boxWidth > 0 ? boxWidth / aspect : 0
  if (dispH > 320) { dispH = 320; dispW = 320 * aspect }
  sizeRef.current = { w: dispW, h: dispH }

  const updateFromTouch = (x: number, y: number) => {
    const { w, h } = sizeRef.current
    if (w <= 0 || h <= 0) return
    setFocal({ x: clampPct((x / w) * 100), y: clampPct((y / h) * 100) })
  }

  // The Image + dot below are pointerEvents="none", so locationX/Y stay
  // relative to this responder container.
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => updateFromTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
      onPanResponderMove: (evt) => updateFromTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
    }),
  ).current

  const save = async () => {
    const id = String(doc.id ?? '')
    if (!id) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await payloadApi.update({ baseURL, token }, collection, id, {
        focalX: Math.round(focal.x),
        focalY: Math.round(focal.y),
      })
      onSaved(updated)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save focal point')
    } finally {
      setSaving(false)
    }
  }

  const uri = fullURLFor(baseURL, doc)

  return (
    <View style={{ flex: 1 }}>
      <Text style={[sharedStyles.sheetTitle, { color: palette.text }]}>Focal point</Text>
      <View style={styles.focalBox} onLayout={(e) => setBoxWidth(e.nativeEvent.layout.width)}>
        {uri && dispW > 0 ? (
          <View
            style={{ width: dispW, height: dispH, alignSelf: 'center' }}
            {...pan.panHandlers}
          >
            <View pointerEvents="none">
              <Image source={{ uri }} style={{ width: dispW, height: dispH, borderRadius: t.borderRadius.sm }} />
            </View>
            <View
              pointerEvents="none"
              style={[
                styles.focalDot,
                {
                  left: (focal.x / 100) * dispW - 14,
                  top: (focal.y / 100) * dispH - 14,
                  borderColor: palette.dark ? '#fff' : '#fff',
                },
              ]}
            >
              <View style={styles.focalDotInner} />
            </View>
          </View>
        ) : (
          <ActivityIndicator style={{ marginVertical: t.spacing.xl }} />
        )}
      </View>
      <Text style={[styles.focalHint, { color: palette.textMuted }]}>
        {`Drag the dot to set the focal point (${Math.round(focal.x)}%, ${Math.round(focal.y)}%)`}
      </Text>
      {saveError && <Text style={[styles.focalHint, { color: palette.destructive }]}>{saveError}</Text>}
      <View style={styles.focalActions}>
        <Pressable
          style={[styles.focalSaveBtn, { backgroundColor: palette.primary }, saving && { opacity: 0.6 }]}
          onPress={save}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color={palette.primaryText} />
            : <Text style={[styles.focalSaveText, { color: palette.primaryText }]}>Save</Text>}
        </Pressable>
        <Pressable style={styles.focalCancelBtn} onPress={onCancel} disabled={saving}>
          <Text style={[styles.focalCancelText, { color: palette.textMuted }]}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  )
}
