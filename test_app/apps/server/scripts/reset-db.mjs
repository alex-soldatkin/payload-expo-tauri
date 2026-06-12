/**
 * Reset the Payload database to a truly fresh state.
 *
 * Resolves DATABASE_URL with the exact same precedence as scripts/dev.mjs
 * (repo root .env -> test_app/.env -> apps/server/.env, first value wins), so
 * it always targets the database the dev server actually uses — unlike
 * `payload migrate:fresh`, whose CLI loads only the cwd .env and can drop a
 * different database if the env files diverge.
 *
 * Drops EVERY collection in the target database, including Payload internals
 * (payload-preferences, payload-locked-documents, payload-migrations,
 * payload-kvs) and sync state (_sync_tombstones, _*_versions). Safe to run
 * while the dev server is up: collections are recreated on demand, and
 * /api/users/init flips to {"initialized":false} so /admin/create-first-user
 * serves the first-user form again.
 *
 * Usage: node ./scripts/reset-db.mjs [--yes]
 */
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline/promises'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'

const require = createRequire(import.meta.url)
const { MongoClient } = require('mongodb')

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const repoRoot = path.resolve(serverDir, '../../..')

// Same order + override:false as scripts/dev.mjs — first file to define a
// variable wins.
const envPaths = [
  path.join(repoRoot, '.env'),
  path.join(repoRoot, 'test_app', '.env'),
  path.join(serverDir, '.env'),
]

for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false })
  }
}

const url = process.env.DATABASE_URL
if (!url) {
  console.error('[reset-db] DATABASE_URL is not set in any .env file. Aborting.')
  process.exit(1)
}

const dbName = new URL(url).pathname.replace(/^\//, '')
if (!dbName) {
  console.error(`[reset-db] DATABASE_URL has no database name: ${url}. Aborting.`)
  process.exit(1)
}

const skipPrompt = process.argv.includes('--yes') || process.argv.includes('-y')

if (!skipPrompt) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const answer = await rl.question(
    `[reset-db] This will DROP ALL collections in "${dbName}" (${url}). Continue? [y/N] `,
  )
  rl.close()
  if (!/^y(es)?$/i.test(answer.trim())) {
    console.log('[reset-db] Aborted.')
    process.exit(0)
  }
}

const client = new MongoClient(url)

try {
  await client.connect()
  const db = client.db(dbName)
  const collections = await db.listCollections({}, { nameOnly: true }).toArray()
  const names = collections
    .map((c) => c.name)
    .filter((name) => !name.startsWith('system.'))
    .sort()

  if (names.length === 0) {
    console.log(`[reset-db] "${dbName}" is already empty.`)
  }

  for (const name of names) {
    await db.collection(name).drop()
    console.log(`[reset-db] Dropped ${dbName}.${name}`)
  }

  console.log(
    `[reset-db] Done — ${names.length} collection(s) dropped. ` +
      'Visit /admin to create the first user.',
  )
} finally {
  await client.close()
}
