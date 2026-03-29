import { withPayload } from '@payloadcms/next/withPayload'
import fs from 'node:fs'
import path from 'node:path'
import webpack from 'next/dist/compiled/webpack/webpack-lib.js'

// Common ancestor of test_app, payload_universal, and payload-main.
// Turbopack needs this to follow pnpm workspace symlinks that cross boundaries.
const monoRoot = path.resolve(import.meta.dirname, '../../..')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config here
  transpilePackages: [
    '@payload-universal/schema',
    '@payload-universal/admin-schema',
    '@payload-universal/admin-core',
  ],
  outputFileTracingRoot: monoRoot,
  experimental: {
    externalDir: true,
  },
  turbopack: {
    root: monoRoot,
  },
  webpack: (webpackConfig) => {
    const { NormalModuleReplacementPlugin } = webpack
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }

    webpackConfig.plugins = webpackConfig.plugins ?? []
    webpackConfig.plugins.push(
      new NormalModuleReplacementPlugin(/\\.js$/, (resource) => {
        if (!resource.context || !resource.request) {
          return
        }

        if (!resource.context.includes('@payloadcms')) {
          return
        }

        const candidate = resource.request.replace(/\\.js$/, '.ts')
        const resolved = path.resolve(resource.context, candidate)

        if (fs.existsSync(resolved)) {
          resource.request = candidate
        }
      }),
    )

    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
