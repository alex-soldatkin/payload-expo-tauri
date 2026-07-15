#!/usr/bin/env tsx
/**
 * DOM passthrough codegen (issue #28 phase 3, desktop target).
 *
 * Walks a Payload config for field-level admin.components (Field /
 * beforeInput / afterInput / RowLabel), copies each component's ORIGINAL
 * source verbatim into the target app (stripping 'use client'), and emits a
 * register.gen.ts that registers them against the desktop form registry via
 * the ui-shim adapters. The copied sources import '@payloadcms/ui', which the
 * desktop bundler aliases to the DOM shim — so the same file that renders in
 * the web admin renders on desktop, no transform.
 *
 * Unlike the RN transform (cli.ts), there is no web-API bail-out — canvas,
 * document and window all exist in the Electron renderer. A component is
 * skipped only when it has runtime imports outside the shimmed surface
 * (react / @payloadcms/ui); `import type` from anywhere is fine (erased).
 *
 * Registry keys mirror the desktop runtime's form paths: named tabs/groups
 * nest, unnamed containers are transparent, and array/blocks children are
 * emitted WITHOUT block slugs or row indexes (the registry lookup normalizes
 * indexes away).
 */
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { Command } from 'commander'

type Discovered = {
  /** Registry slot: Field | beforeInput | afterInput | RowLabel. */
  slot: 'Field' | 'beforeInput' | 'afterInput' | 'RowLabel'
  /** Registry key: `${slug}.${runtimeFieldPath}`. */
  key: string
  filePath: string
}

async function importConfigSafe(configPath: string): Promise<Record<string, unknown> | null> {
  try {
    const raw = await import(pathToFileURL(configPath).href)
    return (raw.default || raw) as Record<string, unknown>
  } catch (err) {
    console.error('  Failed to import Payload config:', err)
    return null
  }
}

/** Resolve a component path to a file, trying directory/index and extensions. */
async function resolveFilePath(basePath: string): Promise<string | null> {
  try {
    const stat = await fs.stat(basePath)
    if (stat.isFile()) return basePath
    if (stat.isDirectory()) {
      for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
        const idx = path.join(basePath, `index${ext}`)
        try {
          await fs.stat(idx)
          return idx
        } catch {
          /* keep trying */
        }
      }
    }
  } catch {
    /* keep trying */
  }
  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
    try {
      await fs.stat(basePath + ext)
      return basePath + ext
    } catch {
      /* keep trying */
    }
  }
  return null
}

function componentNameFromPath(filePath: string): string {
  const base = path.basename(filePath).replace(/\.(tsx|ts|jsx|js)$/, '')
  return base === 'index' ? path.basename(path.dirname(filePath)) : base
}

const FIELD_SLOTS = new Set(['Field', 'beforeInput', 'afterInput', 'RowLabel'])

/** Pull `{path}`-shaped component refs out of one admin.components value. */
function componentPaths(comp: unknown): string[] {
  if (Array.isArray(comp)) return comp.flatMap(componentPaths)
  if (comp && typeof comp === 'object' && 'path' in comp) {
    const p = (comp as { path?: unknown }).path
    return typeof p === 'string' ? [p] : []
  }
  if (typeof comp === 'string') return [comp]
  return []
}

/**
 * Walk fields mirroring the desktop runtime's path semantics (FieldRenderer's
 * subPath): named fields join the prefix; unnamed tabs/rows/collapsibles are
 * transparent; blocks children are keyed without the block slug (colliding
 * same-named fields across blocks get one shared registration — warned).
 */
function walkFields(fields: unknown, prefix: string, configDir: string, out: Discovered[]): void {
  if (!Array.isArray(fields)) return
  for (const field of fields as Array<Record<string, any>>) {
    if (!field) continue
    const fieldKey = field.name ? (prefix ? `${prefix}.${field.name}` : field.name) : prefix

    const comps = field.admin?.components
    if (comps && typeof comps === 'object') {
      for (const [slot, comp] of Object.entries(comps)) {
        if (!FIELD_SLOTS.has(slot)) continue
        for (const compPath of componentPaths(comp)) {
          out.push({
            slot: slot as Discovered['slot'],
            key: fieldKey,
            filePath: path.resolve(configDir, compPath),
          })
        }
      }
    }

    if (field.fields) {
      walkFields(field.fields, fieldKey, configDir, out)
    }
    if (field.tabs) {
      for (const tab of field.tabs as Array<Record<string, any>>) {
        const tabPrefix = tab.name ? (prefix ? `${prefix}.${tab.name}` : tab.name) : prefix
        walkFields(tab.fields ?? [], tabPrefix, configDir, out)
      }
    }
    if (field.blocks) {
      for (const block of field.blocks as Array<Record<string, any>>) {
        walkFields(block.fields ?? [], fieldKey, configDir, out)
      }
    }
  }
}

/**
 * A component can pass through only if every RUNTIME import resolves in the
 * desktop bundle: react, the (aliased) @payloadcms/ui surface. Type-only
 * imports are erased by the bundler and allowed from anywhere.
 */
const ALLOWED_RUNTIME_IMPORTS = /^(react|react\/jsx-runtime|@payloadcms\/ui)$/

function disallowedImports(source: string): string[] {
  const bad: string[] = []
  const importRe = /^import\s+(type\s+)?[^'"]*from\s*['"]([^'"]+)['"]/gm
  let m: RegExpExecArray | null
  while ((m = importRe.exec(source))) {
    const [, typeOnly, spec] = m
    if (typeOnly) continue
    if (!ALLOWED_RUNTIME_IMPORTS.test(spec)) bad.push(spec)
  }
  return bad
}

const program = new Command()
program
  .name('payload-dom-codegen')
  .description('Copies Payload admin custom components into a DOM (Electron) app as shim-backed passthroughs')
  .option('-c, --config <path>', 'payload.config.ts path', './apps/server/src/payload.config.ts')
  .option('-o, --out <dir>', 'output dir (inside the desktop renderer)', './apps/desktop-electron/src/renderer/form/custom/gen')
  .option('--registry <spec>', 'import specifier for the form registry, relative to out', '../../registry')
  .option('--adapters <spec>', 'import specifier for the ui-shim adapters, relative to out', '../../ui-shim/adapters')
  .action(async (options) => {
    const cwd = process.cwd()
    const configPath = path.resolve(cwd, options.config)
    const outDir = path.resolve(cwd, options.out)

    console.log(`\n  Payload DOM Passthrough Codegen`)
    console.log(`  ===============================`)
    console.log(`  Config: ${configPath}`)
    console.log(`  Output: ${outDir}\n`)

    const config = await importConfigSafe(configPath)
    if (!config) process.exit(1)
    const configDir = path.dirname(configPath)

    const discovered: Discovered[] = []
    for (const collection of (config.collections as Array<Record<string, any>>) ?? []) {
      walkFields(collection?.fields, collection?.slug ?? '', configDir, discovered)
    }
    for (const global of (config.globals as Array<Record<string, any>>) ?? []) {
      walkFields(global?.fields, global?.slug ?? '', configDir, discovered)
    }
    console.log(`  Discovered ${discovered.length} field component ref(s).`)

    // Resolve + dedupe by source file; skip components with unshimmed imports.
    const byFile = new Map<string, { name: string; source: string; refs: Discovered[] }>()
    const skipped: Array<{ key: string; file: string; reason: string }> = []
    const usedNames = new Set<string>()
    for (const ref of discovered) {
      const resolved = await resolveFilePath(ref.filePath)
      if (!resolved) {
        skipped.push({ key: ref.key, file: ref.filePath, reason: 'source not found' })
        continue
      }
      let entry = byFile.get(resolved)
      if (!entry) {
        const source = await fs.readFile(resolved, 'utf8')
        const bad = disallowedImports(source)
        if (bad.length > 0) {
          skipped.push({ key: ref.key, file: resolved, reason: `unshimmed imports: ${bad.join(', ')}` })
          continue
        }
        let name = componentNameFromPath(resolved).replace(/[^A-Za-z0-9_$]/g, '_')
        while (usedNames.has(name)) name = `${name}_`
        usedNames.add(name)
        entry = { name, source, refs: [] }
        byFile.set(resolved, entry)
      }
      entry.refs.push(ref)
    }

    await fs.mkdir(outDir, { recursive: true })

    // Emit one passthrough module per source file.
    for (const [srcPath, entry] of byFile) {
      const rel = path.relative(configDir, srcPath)
      const body = entry.source
        .split('\n')
        .filter((line) => !/^['"]use client['"];?\s*$/.test(line.trim()))
        .join('\n')
      const header = [
        `// GENERATED PASSTHROUGH — do not edit. Regenerate with codegen:dom.`,
        `// Verbatim copy of ${rel} ('use client' stripped);`,
        `// '@payloadcms/ui' resolves to the desktop ui-dom shim.`,
        '',
      ].join('\n')
      await fs.writeFile(path.join(outDir, `${entry.name}.tsx`), header + body)
    }

    // Emit the registration module.
    const lines: string[] = [
      `// GENERATED — do not edit. Registers passthrough admin components`,
      `// (original web admin sources) into the desktop form registry.`,
      `import { registerFieldComponents } from '${options.registry}'`,
      `import { asPayloadField, asPayloadRowLabel } from '${options.adapters}'`,
    ]
    const entries = [...byFile.values()]
    for (const entry of entries) {
      lines.push(`import ${entry.name} from './${entry.name}'`)
    }
    lines.push('')
    const seenReg = new Set<string>()
    for (const entry of entries) {
      for (const ref of entry.refs) {
        const regKey = `${ref.key}::${ref.slot}`
        if (seenReg.has(regKey)) {
          console.warn(`  ! duplicate registration for ${regKey} — keeping first`)
          continue
        }
        seenReg.add(regKey)
        const wrapped =
          ref.slot === 'RowLabel' ? `asPayloadRowLabel(${entry.name})` : `asPayloadField(${entry.name})`
        lines.push(`registerFieldComponents('${ref.key}', { ${ref.slot}: ${wrapped} })`)
      }
    }
    lines.push('')
    await fs.writeFile(path.join(outDir, 'register.gen.ts'), lines.join('\n'))

    console.log(`  Wrote ${byFile.size} passthrough component(s) + register.gen.ts`)
    for (const [srcPath, entry] of byFile) {
      console.log(`    ✓ ${entry.name}  (${entry.refs.map((r) => `${r.key}:${r.slot}`).join(', ')})`)
      void srcPath
    }
    for (const s of skipped) {
      console.warn(`    ✗ skipped ${s.key} — ${s.reason}`)
    }
  })

program.parse(process.argv)
