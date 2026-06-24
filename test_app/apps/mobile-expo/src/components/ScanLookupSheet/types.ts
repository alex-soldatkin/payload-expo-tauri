import type React from 'react'
import type { StyleProp, ViewStyle } from 'react-native'

// ---------------------------------------------------------------------------
// Optional native deps — shapes (graceful degradation tiers)
// ---------------------------------------------------------------------------

export type PermissionShape = { granted: boolean; canAskAgain: boolean } | null
export type UseCameraPermissions = () => readonly [
  PermissionShape,
  () => Promise<unknown>,
  ...unknown[],
]

export type CameraViewProps = {
  style?: StyleProp<ViewStyle>
  facing?: 'front' | 'back'
  enableTorch?: boolean
  barcodeScannerSettings?: { barcodeTypes: string[] }
  onBarcodeScanned?: (result: { data: string; type: string }) => void
}

export type CameraModuleShape = {
  CameraView: React.ComponentType<CameraViewProps>
  useCameraPermissions: UseCameraPermissions
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type ScanLookupSheetProps = {
  visible: boolean
  onClose: () => void
  /** Fired once per accepted (debounced) read with the decoded string. */
  onScanned: (value: string) => void
  /** Heading; defaults to 'Scan code'. */
  title?: string
}
