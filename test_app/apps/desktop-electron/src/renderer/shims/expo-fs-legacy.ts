// Desktop stub for 'expo-file-system/legacy' (aliased in vite.config.mjs).
// local-db's upload queue deletes staged local files after upload; the
// Electron sample doesn't use file uploads, so this is a no-op.
export async function deleteAsync(_uri: string, _options?: { idempotent?: boolean }): Promise<void> {
  // no-op on desktop
}
