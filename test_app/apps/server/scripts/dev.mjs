import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import dotenv from 'dotenv'

const nextBin = path.resolve(process.cwd(), 'node_modules/next/dist/bin/next')
const repoRoot = path.resolve(process.cwd(), '../../..')
const payloadRoot = path.join(repoRoot, 'payload-main')
const patchScript = path.join(repoRoot, 'test_app', 'scripts', 'patch-payload-exports.mjs')

const envPaths = [
  path.join(repoRoot, '.env'),
  path.join(repoRoot, 'test_app', '.env'),
  path.join(process.cwd(), '.env'),
]

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false })
  }
}

const runCommand = (command, args, options = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit', ...options })
    child.on('error', reject)
    child.on('exit', (code) => resolve(code ?? 1))
  })

const fallbackMatchers = [
  /Module not found: Can't resolve/i,
  /The module has no exports at all/i,
  /Package .* can't be external/i,
  /Failed to load next\.config/i,
  /does not provide an export/i,
]

const runNext = (args, { allowFallback = false } = {}) =>
  new Promise((resolve) => {
    const child = spawn(process.execPath, [nextBin, ...args], {
      stdio: ['inherit', 'pipe', 'pipe'],
    })

    let requestedFallback = false

    const handleOutput = (chunk, writer) => {
      const text = chunk.toString()
      writer.write(text)

      if (allowFallback && !requestedFallback) {
        for (const matcher of fallbackMatchers) {
          if (matcher.test(text)) {
            requestedFallback = true
            child.kill('SIGTERM')
            break
          }
        }
      }
    }

    child.stdout.on('data', (chunk) => handleOutput(chunk, process.stdout))
    child.stderr.on('data', (chunk) => handleOutput(chunk, process.stderr))

    child.on('exit', (code, signal) => resolve({ code, signal, requestedFallback }))
  })

const ensurePayloadBuild = async () => {
  const distChecks = [
    path.join(payloadRoot, 'packages', 'payload', 'dist', 'index.js'),
    path.join(payloadRoot, 'packages', 'ui', 'dist', 'exports', 'client', 'index.js'),
    path.join(payloadRoot, 'packages', 'next', 'dist', 'withPayload', 'withPayload.js'),
    path.join(payloadRoot, 'packages', 'richtext-lexical', 'dist', 'index.js'),
    path.join(payloadRoot, 'packages', 'translations', 'dist', 'exports', 'index.js'),
    path.join(payloadRoot, 'packages', 'graphql', 'dist', 'index.js'),
    path.join(payloadRoot, 'packages', 'db-mongodb', 'dist', 'index.js'),
  ]

  const missing = distChecks.filter((check) => !fs.existsSync(check))
  if (missing.length === 0) {
    return
  }

  console.log('[payload-universal] Building Payload packages for Turbopack...')
  const forceBuild = process.env.PAYLOAD_FORCE_BUILD === '1'
  if (forceBuild) {
    const cleanCode = await runCommand('pnpm', ['clean:build'], { cwd: payloadRoot })
    if (cleanCode !== 0) {
      throw new Error('Failed to clean Payload build artifacts.')
    }
  }

  const buildArgs = [
    'turbo',
    'build',
    '--filter=payload',
    '--filter=@payloadcms/ui',
    '--filter=@payloadcms/next',
    '--filter=@payloadcms/db-mongodb',
    '--filter=@payloadcms/richtext-lexical',
    '--filter=@payloadcms/translations',
    '--filter=@payloadcms/graphql',
    '--filter=!@payloadcms/drizzle',
    '--filter=!@payloadcms/db-postgres',
    '--filter=!create-payload-app',
  ]
  if (forceBuild) {
    buildArgs.push('--force')
  }
  const code = await runCommand('pnpm', buildArgs, { cwd: payloadRoot })
  if (code !== 0) {
    throw new Error('Failed to build Payload packages for Turbopack.')
  }
}

const patchPayloadExports = async () => {
  if (!fs.existsSync(patchScript)) {
    return
  }

  const code = await runCommand(process.execPath, [patchScript])
  if (code !== 0) {
    throw new Error('Failed to patch Payload package exports.')
  }
}

await ensurePayloadBuild()
await patchPayloadExports()

const turbo = await runNext(['dev', '--turbo'], { allowFallback: true })

if (turbo.code === 0) {
  process.exit(0)
}

if (turbo.signal && !turbo.requestedFallback) {
  process.exit(1)
}

if (turbo.requestedFallback) {
  console.warn('[payload-universal] Turbopack encountered unsupported module imports; falling back to webpack.')
} else {
  console.warn('[payload-universal] Turbopack failed, falling back to webpack.')
}

const fallback = await runNext(['dev', '--webpack'])
process.exit(fallback.code ?? 1)
