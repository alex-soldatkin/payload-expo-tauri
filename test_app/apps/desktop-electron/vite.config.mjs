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
    // `find` entries are matched in order; the '@payloadcms/ui/<subpath>'
    // aliases MUST precede the bare '@payloadcms/ui' one (a string alias also
    // matches by prefix, so the bare entry would otherwise hijack the subpaths
    // and rewrite them to `<index.ts>/elements/Button`, which doesn't exist).
    alias: [
      // local-db's upload queue dynamically imports this Expo module; on
      // desktop it must not pull in expo-modules-core/react-native.
      {
        find: 'expo-file-system/legacy',
        replacement: fileURLToPath(
          new URL('./src/renderer/shims/expo-fs-legacy.ts', import.meta.url),
        ),
      },
      // Heavy passthrough components (Ketcher loader, d3 dashboards) lazy-load
      // via next/dynamic; resolve it to the React.lazy-backed shim.
      {
        find: 'next/dynamic',
        replacement: fileURLToPath(
          new URL('./src/renderer/form/ui-shim/next-dynamic.ts', import.meta.url),
        ),
      },
      // Subpath imports of the UI kit (e.g. '@payloadcms/ui/elements/Button',
      // '/fields/Select', '/fields/Text', '/fields/Textarea', '/elements/*')
      // all resolve to the DOM shim index, which re-exports the matching named
      // components (Button, SelectInput, TextInput, TextareaInput, Banner,
      // Collapsible, RenderFields, …). One regex covers every subpath.
      {
        find: /^@payloadcms\/ui\/.*$/,
        replacement: fileURLToPath(
          new URL('./src/renderer/form/ui-shim/index.ts', import.meta.url),
        ),
      },
      // Codegen-passthrough custom components import '@payloadcms/ui' — the
      // real package is Next-only; resolve it to the DOM shim (issue #28).
      {
        find: '@payloadcms/ui',
        replacement: fileURLToPath(
          new URL('./src/renderer/form/ui-shim/index.ts', import.meta.url),
        ),
      },
      // Passthrough action components (written for the Next admin) import
      // next/navigation — resolve it to the shim's tab-navigation adapter.
      {
        find: 'next/navigation',
        replacement: fileURLToPath(
          new URL('./src/renderer/form/ui-shim/navigation.ts', import.meta.url),
        ),
      },
      // Passthrough sources keep their project's '@/x' alias; the gen mirror
      // preserves configDir-relative structure, so '@' maps onto it directly.
      {
        find: '@',
        replacement: fileURLToPath(
          new URL('./src/renderer/form/custom/gen', import.meta.url),
        ),
      },
    ],
  },
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    // ketcher-standalone/-react ship mixed CJS/ESM; without this the bundle
    // keeps literal require() calls that throw in the ESM renderer.
    commonjsOptions: { transformMixedEsModules: true },
  },
  server: {
    port: 5183,
    strictPort: true,
  },
  optimizeDeps: {
    exclude: ['@payload-universal/local-db', '@payload-universal/admin-schema'],
  },
})
