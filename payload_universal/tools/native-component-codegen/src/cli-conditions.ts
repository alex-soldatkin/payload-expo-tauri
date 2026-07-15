/**
 * Standalone conditions codegen (epic #28 phase 1).
 * Run from test_app/: `pnpm codegen:conditions`
 * Emits the extracted admin.condition registry for the Electron renderer.
 * (Will fold into the main cli.ts multi-target orchestration in phase 2.)
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { extractConditions, renderConditionsModule } from './extract-conditions'

const serverSrc = path.resolve(process.cwd(), 'apps/server/src')
const conditions = extractConditions(serverSrc)
console.log(`[codegen:conditions] extracted ${conditions.length} conditions`)
for (const c of conditions) console.log(`  ${c.slug} :: ${c.fieldPath} (${c.file})`)

const targets = [path.resolve(process.cwd(), 'apps/desktop-electron/src/renderer/generated')]
const moduleSource = renderConditionsModule(conditions)
for (const dir of targets) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(path.join(dir, 'conditions.gen.ts'), moduleSource)
  console.log(`[codegen:conditions] emitted ${path.join(dir, 'conditions.gen.ts')}`)
}
