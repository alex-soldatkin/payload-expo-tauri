import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Tailwind serves the codegen-passthrough components (production configs
  // style their admin components with utility classes); the app's own design
  // system stays token/CSS-based.
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // local-db's upload queue dynamically imports this Expo module; on
      // desktop it must not pull in expo-modules-core/react-native.
      'expo-file-system/legacy': fileURLToPath(
        new URL('./src/renderer/shims/expo-fs-legacy.ts', import.meta.url),
      ),
      // Codegen-passthrough custom components import '@payloadcms/ui' — the
      // real package is Next-only; resolve it to the DOM shim (issue #28).
      '@payloadcms/ui': fileURLToPath(
        new URL('./src/renderer/form/ui-shim/index.ts', import.meta.url),
      ),
      // Passthrough action components (written for the Next admin) import
      // next/navigation — resolve it to the shim's tab-navigation adapter.
      'next/navigation': fileURLToPath(
        new URL('./src/renderer/form/ui-shim/navigation.ts', import.meta.url),
      ),
      // Passthrough sources keep their project's '@/x' alias; the gen mirror
      // preserves configDir-relative structure, so '@' maps onto it directly.
      '@': fileURLToPath(
        new URL('./src/renderer/form/custom/gen', import.meta.url),
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
