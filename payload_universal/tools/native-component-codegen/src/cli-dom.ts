#!/usr/bin/env tsx
/**
 * DOM passthrough codegen (issue #28 phase 3, desktop target).
 *
 * Walks a Payload config for field-level admin.components (Field /
 * beforeInput / afterInput / RowLabel) AND collection/global-level custom
 * ACTION components (admin.components.listMenuItems — bulk/list actions;
 * admin.components.edit.editMenuItems — document actions). Copies each
 * component's ORIGINAL source verbatim into the target app (stripping
 * 'use client'), following its RELATIVE and '@/'-aliased import closure, and
 * emits a register.gen.ts that registers them against the desktop form
 * registry via the ui-shim adapters. Copied sources import '@payloadcms/ui',
 * which the desktop bundler aliases to the DOM shim — so the same file that
 * renders in the web admin renders on desktop, no transform.
 *
 * Unlike the RN transform (cli.ts), there is no web-API bail-out — canvas,
 * document and window all exist in the Electron renderer. A component is
 * skipped only when its import closure reaches a bare (package) import outside
 * the shimmed surface (react / @payloadcms/ui / next/navigation / --allow'd);
 * `import type` from anywhere is fine (erased by esbuild).
 *
 * IMPORT CLOSURE: copied components may import RELATIVE modules
 * (e.g. './CombineOrdersModal') and PROJECT-ALIAS modules ('@/utilities/foo',
 * where '@/*' maps to '<configDir>/*'). A BFS walks each component's closure,
 * resolving those specifiers, adding them to the copy queue, and emitting them
 * into the out dir MIRRORING their path relative to configDir. '@/x'
 * specifiers are rewritten to the correct RELATIVE path within the mirror;
 * relative specifiers need no rewrite. The closure is capped at 40 files per
 * component — beyond that the component is skipped ('closure too large').
 *
 * Field-component registry keys mirror the desktop runtime's form paths: named
 * tabs/groups nest, unnamed containers are transparent, and array/blocks
 * children are emitted WITHOUT block slugs or row indexes (the registry lookup
 * normalizes indexes away). Action components register per collection/global
 * slug + kind ('list' | 'edit') preserving declaration order.
 *
 * HEAVYWIDTH SCIENTIFIC COMPONENTS (Ketcher + d3 charts) — conventions the
 * desktop app must satisfy to un-skip these closures (all via --allow, no hand
 * edits to generated files):
 *   - next/dynamic: allow 'next/dynamic'. The app aliases it (vite + tsconfig
 *     paths) to form/ui-shim/next-dynamic.ts, a React.lazy+Suspense stand-in
 *     that honors { ssr:false, loading } and forwards refs (Ketcher's loader
 *     passes a ref through to the wrapper).
 *   - @payloadcms/ui SUBPATHS: allow each used subpath (e.g.
 *     '@payloadcms/ui/elements/Button', '/fields/Select', '/fields/Text',
 *     '/fields/Textarea', '/elements/Collapsible', '/elements/Banner'). A vite
 *     regex alias /^@payloadcms\/ui\/.*$/ maps them all onto the shim index,
 *     which re-exports the matching named components; verify each subpath's
 *     export name exists in the shim (Button/SelectInput/TextInput/…).
 *   - GROUP passthroughs that render children via '@payloadcms/ui' RenderFields
 *     (StructureFilesCollapsibleGroup wrapping the Ketcher `ketcherTool`): the
 *     shim's RenderFields delegates back to the desktop FieldRenderer, so nested
 *     custom fields mount. Add shim exports (RenderFields, usePreferences) as
 *     needed when a group/collapsible passthrough reaches for them.
 *   - Ketcher runtime deps (installed into the desktop app):
 *     ketcher-standalone/ketcher-react/ketcher-core (match the config's version,
 *     here 3.12.0-dev.1) + miew, plus 'ketcher-react/dist/index.css',
 *     'miew/dist/Miew.css', 'ketcher-standalone/dist/binaryWasm'. The
 *     3.12 binaryWasm build is VITE-NATIVE: it spawns its indigo worker via
 *     `new Worker(new URL('indigoWorker-*.js', import.meta.url), {type:'module'})`
 *     and the worker loads the .wasm via `new URL('indigo-ketcher-*.wasm',
 *     import.meta.url)`. Vite bundles the worker chunk and emits the .wasm as a
 *     hashed asset automatically — NO manual public/wasm copy or vite plugin is
 *     required (unlike assemblon's Next postinstall patch). Verify against the
 *     vite DEV SERVER (http origin), since the worker fetches wasm with
 *     `fetch(new URL(binaryFile, self.location.origin))`, which an http origin
 *     satisfies but a bare file:// packaged build may not.
 *   - d3 charts (TritylCharts, ColumnPerformanceCharts): allow 'd3' — small,
 *     self-contained closures; no other infra needed.
 *   - LC-MS / HPLC dashboards (LCMSDashboardWrapper) remain SKIPPED: 150+ file
 *     closure (>MAX_CLOSURE) with a broad package surface (zustand, idb-keyval,
 *     @radix-ui/*, class-variance-authority, @payload-config) AND a separate
 *     Python lcms_backend service ('/api/lcms/*' Next rewrite → lcms_backend:8000).
 *     Unlocking them is a larger effort (raise the cap, add the deps, stand up
 *     the backend) intentionally out of scope for the codegen pass.
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
  /** Config-declared clientProps (e.g. StatusBadge colorMap) — JSON only. */
  clientProps?: Record<string, unknown>
}

type ActionRef = {
  kind: 'list' | 'edit'
  slug: string
  filePath: string
  /** Declaration order within the slug+kind array. */
  order: number
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

/**
 * Turn a Payload component `path` spec into an absolute file base path.
 * Handles: `#NamedExport` suffixes (stripped — we always import the default),
 * '@/x' alias (→ configDir/x), and plain relative/absolute paths (resolved
 * against configDir). Returned path still needs resolveFilePath() to add the
 * extension / index file.
 */
/** `#NamedExport` hints per absolute base path — drives named imports. */
const exportHints = new Map<string, string>()

function specToAbsBase(spec: string, configDir: string): string {
  const [noExport, exportName] = spec.split('#')
  let abs: string
  if (noExport === '@' || noExport.startsWith('@/')) {
    const sub = noExport === '@' ? '' : noExport.slice(2)
    abs = path.resolve(configDir, sub)
  } else {
    abs = path.resolve(configDir, noExport)
  }
  if (exportName) exportHints.set(abs, exportName)
  return abs
}

/**
 * The import clause for an emitted entry component: named when the config
 * spec carried a '#Export' hint or the source has no default export (common —
 * many admin components only export a named symbol matching their filename).
 */
async function importClauseFor(localName: string, resolvedPath: string, absBase: string): Promise<string> {
  const hint = exportHints.get(absBase) ?? exportHints.get(resolvedPath)
  let named = hint ?? null
  if (!named) {
    try {
      const src = await fs.readFile(resolvedPath, 'utf8')
      if (!/export\s+default\b/.test(src)) {
        named = componentNameFromPath(resolvedPath)
      }
    } catch {
      /* fall through to default import */
    }
  }
  if (named && named !== localName) return `{ ${named} as ${localName} }`
  if (named) return `{ ${named} }`
  return localName
}

function componentNameFromPath(filePath: string): string {
  const base = path.basename(filePath).replace(/\.(tsx|ts|jsx|js)$/, '')
  return base === 'index' ? path.basename(path.dirname(filePath)) : base
}

const FIELD_SLOTS = new Set(['Field', 'beforeInput', 'afterInput', 'RowLabel'])

/** clientProps must be embeddable in generated source — JSON-clone or drop. */
function tryJsonClone(v: unknown): Record<string, unknown> | undefined {
  if (!v || typeof v !== 'object') return undefined
  try {
    return JSON.parse(JSON.stringify(v)) as Record<string, unknown>
  } catch {
    return undefined
  }
}

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
        // clientProps ride along with object-form component refs — components
        // read them as props in the web admin (e.g. StatusBadge's colorMap),
        // so the desktop registration must deliver them too.
        const clientProps =
          comp && typeof comp === 'object' && !Array.isArray(comp) && 'clientProps' in comp
            ? tryJsonClone((comp as { clientProps?: unknown }).clientProps)
            : undefined
        for (const compPath of componentPaths(comp)) {
          out.push({
            slot: slot as Discovered['slot'],
            key: fieldKey,
            filePath: specToAbsBase(compPath, configDir),
            clientProps,
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
 * Collect list/edit action component refs from a collection or global's
 * admin.components. `listMenuItems` and `edit.editMenuItems` are arrays whose
 * items are `{path}` objects or plain strings (reuse componentPaths). Order is
 * preserved via the array index.
 */
function collectActions(node: Record<string, any> | undefined, slug: string, configDir: string, out: ActionRef[]): void {
  const comps = node?.admin?.components
  if (!comps || typeof comps !== 'object') return

  const pushKind = (kind: 'list' | 'edit', items: unknown) => {
    if (!Array.isArray(items)) return
    let order = 0
    for (const item of items) {
      for (const compPath of componentPaths(item)) {
        out.push({ kind, slug, filePath: specToAbsBase(compPath, configDir), order: order++ })
      }
    }
  }

  pushKind('list', comps.listMenuItems)
  if (comps.edit && typeof comps.edit === 'object') {
    pushKind('edit', (comps.edit as Record<string, unknown>).editMenuItems)
  }
}

// ---------------------------------------------------------------------------
// Import parsing + closure
// ---------------------------------------------------------------------------

type ParsedImport = { spec: string; typeOnly: boolean }

/**
 * Parse the import specifiers from a source file. Detects `import type ...`
 * (whole-statement) and bare `import { type A, type B } from '...'` (every
 * named binding prefixed with `type`) as type-only — those are erased by
 * esbuild and never queued. Anything we can't be sure about is treated as
 * runtime (conservative). Side-effect imports (`import './x'`) count too.
 */
function parseImports(source: string): ParsedImport[] {
  const out: ParsedImport[] = []
  const seen = new Set<string>()

  // Dynamic `import('spec')` — always a runtime dependency. Missing these
  // let bare packages (e.g. exceljs) leak past the allowlist into the build.
  const dynRe = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  let dm: RegExpExecArray | null
  while ((dm = dynRe.exec(source))) {
    const spec = dm[1]
    if (!seen.has(spec)) {
      seen.add(spec)
      out.push({ spec, typeOnly: false })
    }
  }

  // `import ... from 'spec'` and bare `import 'spec'`
  const re =
    /\bimport\s+(type\s+)?(?:([^'";]*?)\s+from\s+)?['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    const [, stmtType, clause, spec] = m
    let typeOnly = Boolean(stmtType)
    if (!typeOnly && clause) {
      // `import { type A, type B }` — type-only iff the clause is ONLY a
      // named-binding block (no default/namespace binding) AND every binding
      // is `type`-prefixed. Anything outside the braces means a runtime
      // binding, so bail to runtime (conservative).
      const braceMatch = clause.match(/^\s*\{([^}]*)\}\s*$/)
      if (braceMatch) {
        const names = braceMatch[1]
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        if (names.length > 0 && names.every((n) => /^type\s+/.test(n))) {
          typeOnly = true
        }
      }
    }
    const uniqKey = `${spec}::${typeOnly}`
    if (seen.has(uniqKey)) continue
    seen.add(uniqKey)
    out.push({ spec, typeOnly })
  }
  return out
}

/** `export ... from 'spec'` re-exports (also pull dependencies into closure). */
function parseReExports(source: string): ParsedImport[] {
  const out: ParsedImport[] = []
  const re = /\bexport\s+(type\s+)?(?:\*|\{[^}]*\})\s+from\s+['"]([^'"]+)['"]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    out.push({ spec: m[2], typeOnly: Boolean(m[1]) })
  }
  return out
}

function isRelative(spec: string): boolean {
  return spec.startsWith('./') || spec.startsWith('../')
}

function isAtAlias(spec: string): boolean {
  return spec === '@' || spec.startsWith('@/')
}

/**
 * A component/dependency can pass through only if every RUNTIME bare (package)
 * import resolves in the desktop bundle. Relative and '@/' imports are
 * followed into the closure instead. `import type` from anywhere is fine.
 */
function makeAllowedBare(extra: string[]): (spec: string) => boolean {
  const allowed = new Set([
    'react',
    'react/jsx-runtime',
    'react-dom',
    '@payloadcms/ui',
    'next/navigation',
    ...extra,
  ])
  return (spec: string) => allowed.has(spec)
}

type CopyFile = {
  /** Absolute resolved source path. */
  srcPath: string
  /** Path relative to configDir (drives the mirrored out layout). */
  relToConfig: string
  source: string
}

type ClosureResult =
  | { ok: true; files: CopyFile[] }
  | { ok: false; reason: string }

/**
 * BFS the import closure of an entry file. Resolves relative + '@/' runtime
 * imports (and re-exports), mirrors each into the out layout, caps at
 * `maxFiles`, and fails the whole component if any file reaches a disallowed
 * bare runtime import (listing every offending specifier) or an unresolvable
 * relative/'@/' import.
 */
async function computeClosure(
  entrySrc: string,
  configDir: string,
  isAllowedBare: (spec: string) => boolean,
  maxFiles: number,
): Promise<ClosureResult> {
  const visited = new Set<string>()
  const files: CopyFile[] = []
  const queue: string[] = [entrySrc]
  const badBare = new Set<string>()

  while (queue.length > 0) {
    const abs = queue.shift()!
    if (visited.has(abs)) continue
    visited.add(abs)

    if (files.length >= maxFiles) {
      return { ok: false, reason: `closure too large (>${maxFiles} files)` }
    }

    let source: string
    try {
      source = await fs.readFile(abs, 'utf8')
    } catch {
      return { ok: false, reason: `source not found: ${path.relative(configDir, abs)}` }
    }

    files.push({ srcPath: abs, relToConfig: path.relative(configDir, abs), source })

    const specs = [...parseImports(source), ...parseReExports(source)]
    for (const { spec, typeOnly } of specs) {
      if (typeOnly) continue // erased by esbuild — never queued
      if (isRelative(spec)) {
        const base = path.resolve(path.dirname(abs), spec)
        const resolved = await resolveFilePath(base)
        if (!resolved) return { ok: false, reason: `unresolved relative import '${spec}' in ${path.relative(configDir, abs)}` }
        if (!visited.has(resolved)) queue.push(resolved)
      } else if (isAtAlias(spec)) {
        const sub = spec === '@' ? '' : spec.slice(2) // drop '@/'
        const base = path.resolve(configDir, sub)
        const resolved = await resolveFilePath(base)
        if (!resolved) return { ok: false, reason: `unresolved alias import '${spec}' in ${path.relative(configDir, abs)}` }
        if (!visited.has(resolved)) queue.push(resolved)
      } else if (!isAllowedBare(spec)) {
        badBare.add(spec)
      }
    }
  }

  if (badBare.size > 0) {
    return { ok: false, reason: `unshimmed imports: ${[...badBare].join(', ')}` }
  }
  return { ok: true, files }
}

/** Strip 'use client' and rewrite '@/x' specifiers to relative mirror paths. */
function emitBody(file: CopyFile, configDir: string): string {
  let body = file.source
    .split('\n')
    .filter((line) => !/^['"]use client['"];?\s*$/.test(line.trim()))
    .join('\n')

  // Rewrite '@/x' → relative path from this file's mirror dir to the target's
  // mirror (mirror preserves configDir-relative layout, so relative-from-src
  // is identical to relative-in-mirror). Plain string replace on the specifier
  // inside its import/export statement; everything else stays verbatim.
  const fileDir = path.dirname(file.srcPath)
  body = body.replace(
    /(\b(?:import|export)\b[^'"\n]*?['"])(@\/?[^'"]*)(['"])/g,
    (full, pre: string, spec: string, post: string) => {
      if (!isAtAlias(spec)) return full
      const sub = spec === '@' ? '' : spec.slice(2)
      const targetAbs = path.resolve(configDir, sub)
      let relSpec = path.relative(fileDir, targetAbs)
      if (!relSpec.startsWith('.')) relSpec = `./${relSpec}`
      // Normalize windows separators just in case.
      relSpec = relSpec.split(path.sep).join('/')
      return `${pre}${relSpec}${post}`
    },
  )
  return body
}

/**
 * Delete files inside the (fully codegen-owned) output dir that were not
 * written this run, then prune emptied subdirectories. Returns deleted paths.
 */
async function cleanStaleOutputs(dir: string, keep: Set<string>): Promise<string[]> {
  const removed: string[] = []
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return removed
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      removed.push(...(await cleanStaleOutputs(fullPath, keep)))
      const remaining = await fs.readdir(fullPath)
      if (remaining.length === 0) await fs.rmdir(fullPath)
    } else if (!keep.has(fullPath)) {
      await fs.unlink(fullPath)
      removed.push(fullPath)
    }
  }
  return removed
}

const GENERATED_HEADER = (rel: string): string =>
  [
    `// @ts-nocheck — generated passthrough of third-party admin code; type-\n// checked by its own project, not this app's strict config.\n// GENERATED PASSTHROUGH — do not edit. Regenerate with codegen:dom.`,
    `// Verbatim copy of ${rel} ('use client' stripped; '@/' imports rewritten);`,
    `// '@payloadcms/ui' resolves to the desktop ui-dom shim.`,
    '',
  ].join('\n')

const program = new Command()
program
  .name('payload-dom-codegen')
  .description('Copies Payload admin custom components into a DOM (Electron) app as shim-backed passthroughs')
  .option('-c, --config <path>', 'payload.config.ts path', './apps/server/src/payload.config.ts')
  .option('-o, --out <dir>', 'output dir (inside the desktop renderer)', './apps/desktop-electron/src/renderer/form/custom/gen')
  .option('--registry <spec>', 'import specifier for the form registry, relative to out', '../../registry')
  .option('--adapters <spec>', 'import specifier for the ui-shim adapters, relative to out', '../../ui-shim/adapters')
  .option('--allow <pkg>', 'additional bare package import to allow in closures (repeatable)', (val: string, acc: string[]) => {
    acc.push(val)
    return acc
  }, [] as string[])
  .action(async (options) => {
    const cwd = process.cwd()
    const configPath = path.resolve(cwd, options.config)
    const outDir = path.resolve(cwd, options.out)
    const MAX_CLOSURE = 40
    const isAllowedBare = makeAllowedBare(options.allow as string[])

    console.log(`\n  Payload DOM Passthrough Codegen`)
    console.log(`  ===============================`)
    console.log(`  Config: ${configPath}`)
    console.log(`  Output: ${outDir}\n`)

    const config = await importConfigSafe(configPath)
    if (!config) process.exit(1)
    const configDir = path.dirname(configPath)

    // --- Discovery: field components + action components -------------------
    const discovered: Discovered[] = []
    const actionRefs: ActionRef[] = []
    for (const collection of (config.collections as Array<Record<string, any>>) ?? []) {
      walkFields(collection?.fields, collection?.slug ?? '', configDir, discovered)
      collectActions(collection, collection?.slug ?? '', configDir, actionRefs)
    }
    for (const global of (config.globals as Array<Record<string, any>>) ?? []) {
      walkFields(global?.fields, global?.slug ?? '', configDir, discovered)
      collectActions(global, global?.slug ?? '', configDir, actionRefs)
    }
    console.log(`  Discovered ${discovered.length} field component ref(s), ${actionRefs.length} action component ref(s).`)

    await fs.mkdir(outDir, { recursive: true })

    // Shared emit bookkeeping. `emittedByRel` dedupes mirror files across
    // components/fields; `usedNames` dedupes register.gen.ts import identifiers.
    const emittedByRel = new Map<string, string>() // relToConfig -> written (for cycle-safe dedupe)
    const writtenPaths = new Set<string>() // absolute out paths written this run (for stale cleanup)
    const usedNames = new Set<string>()
    const nameByEntrySrc = new Map<string, string>() // entry srcPath -> component identifier
    const skipped: Array<{ what: string; reason: string }> = []

    /** Assign a unique JS identifier for an entry component file. */
    function identFor(srcPath: string): string {
      let name = componentNameFromPath(srcPath).replace(/[^A-Za-z0-9_$]/g, '_')
      if (/^[0-9]/.test(name)) name = `_${name}`
      while (usedNames.has(name)) name = `${name}_`
      usedNames.add(name)
      return name
    }

    /** Emit a closure's mirror files (dedup by relToConfig). */
    async function emitClosure(files: CopyFile[]): Promise<void> {
      for (const file of files) {
        if (emittedByRel.has(file.relToConfig)) continue
        emittedByRel.set(file.relToConfig, file.srcPath)
        const outPath = path.join(outDir, file.relToConfig)
        await fs.mkdir(path.dirname(outPath), { recursive: true })
        // Non-JS/TS closure files (JSON data tables, JSON-imported by a util —
        // e.g. sequence-conversion presets) must be copied VERBATIM: the JS
        // '// GENERATED …' header and the 'use client' / '@/'-rewrite pass in
        // emitBody are only valid for JS/TS. Prepending a comment to a .json
        // breaks the bundler's JSON parser.
        const isJsLike = /\.(tsx|ts|jsx|js|mjs|cjs)$/i.test(file.relToConfig)
        const contents = isJsLike
          ? GENERATED_HEADER(file.relToConfig) + emitBody(file, configDir)
          : file.source
        await fs.writeFile(outPath, contents)
        writtenPaths.add(outPath)
      }
    }

    /** Import path from register.gen.ts (in outDir) to an entry mirror file. */
    function registerImportPath(entryRelToConfig: string): string {
      let rel = entryRelToConfig.replace(/\.(tsx|ts|jsx|js)$/, '')
      rel = rel.split(path.sep).join('/')
      return rel.startsWith('.') ? rel : `./${rel}`
    }

    // --- Field components: resolve + closure + emit -----------------------
    // Keyed by entry source path; each carries its refs + import identifier.
    type FieldEntry = { name: string; entryRel: string; refs: Discovered[]; importClause?: string }
    const fieldEntries = new Map<string, FieldEntry>()
    let fieldClosureFiles = 0
    for (const ref of discovered) {
      const resolved = await resolveFilePath(ref.filePath)
      if (!resolved) {
        skipped.push({ what: `field ${ref.key}:${ref.slot}`, reason: 'source not found' })
        continue
      }
      let entry = fieldEntries.get(resolved)
      if (!entry) {
        const closure = await computeClosure(resolved, configDir, isAllowedBare, MAX_CLOSURE)
        if (!closure.ok) {
          skipped.push({ what: `field ${ref.key}:${ref.slot}`, reason: closure.reason })
          continue
        }
        await emitClosure(closure.files)
        fieldClosureFiles += closure.files.length
        const entryFile = closure.files[0]
        const name = identFor(resolved)
        nameByEntrySrc.set(resolved, name)
        entry = { name, entryRel: entryFile.relToConfig, refs: [], importClause: await importClauseFor(name, resolved, ref.filePath) }
        fieldEntries.set(resolved, entry)
      }
      entry.refs.push(ref)
    }

    // --- Action components: resolve + closure + emit ----------------------
    // Grouped by `${slug}.${kind}` in declaration order.
    type ActionEmit = { name: string; entryRel: string; importClause?: string }
    const actionsByKey = new Map<string, ActionEmit[]>() // `${slug}.${kind}` -> ordered
    // Per-source dedupe of identifiers for action entries reused across keys.
    const actionNameByEntry = new Map<string, { name: string; entryRel: string; importClause?: string }>()
    let actionsEmitted = 0
    const actionsSkippedByKind = { list: 0, edit: 0 }
    let actionClosureFiles = 0
    // Preserve declared order: sort by (slug, kind, order).
    const sortedActions = [...actionRefs].sort((a, b) =>
      a.slug === b.slug ? (a.kind === b.kind ? a.order - b.order : a.kind < b.kind ? -1 : 1) : a.slug < b.slug ? -1 : 1,
    )
    for (const ref of sortedActions) {
      const label = `action ${ref.slug}:${ref.kind}[${ref.order}]`
      const resolved = await resolveFilePath(ref.filePath)
      if (!resolved) {
        skipped.push({ what: label, reason: 'source not found' })
        actionsSkippedByKind[ref.kind]++
        continue
      }
      const key = `${ref.slug}.${ref.kind}`
      let emit = actionNameByEntry.get(resolved)
      if (!emit) {
        const closure = await computeClosure(resolved, configDir, isAllowedBare, MAX_CLOSURE)
        if (!closure.ok) {
          skipped.push({ what: label, reason: closure.reason })
          actionsSkippedByKind[ref.kind]++
          continue
        }
        await emitClosure(closure.files)
        actionClosureFiles += closure.files.length
        const name = identFor(resolved)
        emit = { name, entryRel: closure.files[0].relToConfig, importClause: await importClauseFor(name, resolved, ref.filePath) }
        actionNameByEntry.set(resolved, emit)
      }
      const arr = actionsByKey.get(key) ?? []
      arr.push(emit)
      actionsByKey.set(key, arr)
      actionsEmitted++
    }

    // --- Emit register.gen.ts ---------------------------------------------
    const lines: string[] = [
      `// @ts-nocheck — generated registration of third-party admin components.`,
      `// GENERATED — do not edit. Registers passthrough admin components`,
      `// (original web admin sources) into the desktop form registry.`,
      `import { registerFieldComponents, registerActionComponents } from '${options.registry}'`,
      `import { asPayloadField, asPayloadRowLabel } from '${options.adapters}'`,
    ]
    // Field imports.
    for (const entry of fieldEntries.values()) {
      lines.push(`import ${entry.importClause ?? entry.name} from '${registerImportPath(entry.entryRel)}'`)
    }
    // Action imports (dedup by identifier already ensured via actionNameByEntry).
    for (const emit of actionNameByEntry.values()) {
      lines.push(`import ${emit.importClause ?? emit.name} from '${registerImportPath(emit.entryRel)}'`)
    }
    lines.push('')

    // Field registrations (unchanged behavior).
    const seenReg = new Set<string>()
    for (const entry of fieldEntries.values()) {
      for (const ref of entry.refs) {
        const regKey = `${ref.key}::${ref.slot}`
        if (seenReg.has(regKey)) {
          console.warn(`  ! duplicate registration for ${regKey} — keeping first`)
          continue
        }
        seenReg.add(regKey)
        const extra = ref.clientProps ? `, ${JSON.stringify(ref.clientProps)}` : ''
        const wrapped =
          ref.slot === 'RowLabel' ? `asPayloadRowLabel(${entry.name})` : `asPayloadField(${entry.name}${extra})`
        lines.push(`registerFieldComponents('${ref.key}', { ${ref.slot}: ${wrapped} })`)
      }
    }
    // Action registrations, ordered.
    if (actionsByKey.size > 0) lines.push('')
    for (const [key, arr] of actionsByKey) {
      const dot = key.lastIndexOf('.')
      const slug = key.slice(0, dot)
      const kind = key.slice(dot + 1)
      const names = arr.map((a) => a.name).join(', ')
      lines.push(`registerActionComponents('${slug}', '${kind}', [${names}])`)
    }
    lines.push('')
    const registerPath = path.join(outDir, 'register.gen.ts')
    await fs.writeFile(registerPath, lines.join('\n'))
    writtenPaths.add(registerPath)

    // Prune stale outputs from prior runs (the gen dir is codegen-owned).
    const removed = await cleanStaleOutputs(outDir, writtenPaths)
    if (removed.length > 0) {
      console.log(`\n  Cleaned ${removed.length} stale output(s):`)
      for (const f of removed) console.log(`    - ${path.relative(outDir, f)}`)
    }

    // --- Reporting --------------------------------------------------------
    console.log(
      `  Wrote ${emittedByRel.size} passthrough file(s) (${fieldClosureFiles} field-closure + ${actionClosureFiles} action-closure) + register.gen.ts`,
    )
    console.log(`\n  Field components (${fieldEntries.size}):`)
    for (const entry of fieldEntries.values()) {
      console.log(`    ✓ ${entry.name}  (${entry.refs.map((r) => `${r.key}:${r.slot}`).join(', ')})`)
    }
    console.log(`\n  Action components (${actionsEmitted} emitted):`)
    for (const [key, arr] of actionsByKey) {
      console.log(`    ✓ ${key} → [${arr.map((a) => a.name).join(', ')}]`)
    }

    // Per-collection/global action summary (emitted vs skipped + reasons).
    const skippedActions = skipped.filter((s) => s.what.startsWith('action '))
    if (skippedActions.length > 0) {
      console.log(`\n  Skipped actions (${skippedActions.length}; list=${actionsSkippedByKind.list}, edit=${actionsSkippedByKind.edit}):`)
      for (const s of skippedActions) console.warn(`    ✗ ${s.what} — ${s.reason}`)
    }
    const skippedFields = skipped.filter((s) => s.what.startsWith('field '))
    if (skippedFields.length > 0) {
      console.log(`\n  Skipped fields (${skippedFields.length}):`)
      for (const s of skippedFields) console.warn(`    ✗ ${s.what} — ${s.reason}`)
    }
  })

program.parse(process.argv)
