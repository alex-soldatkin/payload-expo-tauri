import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // local-db's upload queue dynamically imports this Expo module; on
      // desktop it must not pull in expo-modules-core/react-native.
      'expo-file-system/legacy': fileURLToPath(
        new URL('./src/renderer/shims/expo-fs-legacy.ts', import.meta.url),
      ),
    },
  },
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  server: {
    port: 5183,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: ['@payload-universal/local-db', '@payload-universal/admin-schema'],
  },
})
