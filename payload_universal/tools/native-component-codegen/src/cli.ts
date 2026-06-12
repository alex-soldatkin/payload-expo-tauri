import { Command } from 'commander'
import { Project, SyntaxKind } from 'ts-morph'
import path from 'node:path'
import fs from 'node:fs/promises'
import { detectWebOnlyPatterns, transformComponent } from './transform.js'
import { pathToFileURL } from 'node:url'

const program = new Command()

async function importConfigSafe(configPath: string) {
  try {
    const rawConfig = await import(pathToFileURL(configPath).href)
    return rawConfig.default || rawConfig
  } catch (err) {
    console.error('Failed to import config cleanly. Using fallback parser:', err)
    return null
  }
}

/** Try to resolve a file path, checking directory/index and extensions. */
async function resolveFilePath(basePath: string): Promise<string | null> {
  // Try exact path
  try {
    const stat = await fs.stat(basePath)
    if (stat.isFile()) return basePath
    if (stat.isDirectory()) {
      // Check for index files
      for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
        const indexPath = path.join(basePath, `index${ext}`)
        try {
          await fs.stat(indexPath)
          return indexPath
        } catch { /* continue */ }
      }
    }
  } catch { /* continue */ }

  // Try adding extensions
  for (const ext of ['.tsx', '.ts', '.jsx', '.js']) {
    try {
      await fs.stat(basePath + ext)
      return basePath + ext
    } catch { /* continue */ }
  }

  return null
}

/**
 * Extract the text label from an action component's source file.
 *
 * Looks for the text content of `<button>` or `<Pressable>` elements
 * (the primary action text). Returns the first text child found.
 */
function extractActionLabel(project: Project, filePath: string): string | null {
  try {
    const sf = project.getSourceFile(filePath)
    if (!sf) return null

    // Look for JSX text inside <button> elements (before transform)
    // or <Pressable> elements (after transform)
    const jsxElements = [
      ...sf.getDescendantsOfKind(SyntaxKind.JsxElement),
    ]

    for (const el of jsxElements) {
      const tagName = el.getOpeningElement().getTagNameNode().getText()
      if (tagName === 'button' || tagName === 'Pressable') {
        // Get direct text children
        for (const child of el.getJsxChildren()) {
          if (child.getKind() === SyntaxKind.JsxText) {
            const text = child.getText().trim()
            if (text.length > 0) return text
          }
        }
      }
    }
  } catch {
    // ignore parse errors
  }
  return null
}

type DiscoveredComponent = {
  slot: string
  type: 'admin' | 'fields' | 'views' | 'listActions' | 'editActions'
  key: string
  filePath: string
  /**
   * Pre-block-slug registry key for block-nested fields (e.g.
   * "pages.layout.heading" when `key` is "pages.layout.hero.heading").
   * Emitted as a backward-compatible alias when unambiguous.
   */
  legacyKey?: string
}

program
  .name('payload-native-codegen')
  .description('Transforms Payload Web components to React Native')
  .option('-c, --config <path>', 'path to native-codegen.config.ts', '')
  .action(async (options) => {
    const cwd = process.cwd()
    const payloadConfigPath = path.resolve(cwd, './apps/server/src/payload.config.ts')
    const outputDir = path.resolve(cwd, './apps/mobile-expo/src/generated/custom-components/')

    console.log(`\n  Payload Native Component Codegen`)
    console.log(`  ================================`)
    console.log(`  Config: ${payloadConfigPath}`)
    console.log(`  Output: ${outputDir}\n`)

    const project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: { allowJs: true },
    })

    const config = await importConfigSafe(payloadConfigPath)
    if (!config) {
      console.error('  Failed to load Payload config.')
      process.exit(1)
    }

    const discoveredComponents: DiscoveredComponent[] = []
    const configDir = path.dirname(payloadConfigPath)

    // 1. Walk admin-level components
    if (config.admin?.components) {
      for (const [slot, comp] of Object.entries(config.admin.components)) {
        if (comp && typeof comp === 'object' && 'path' in (comp as any)) {
          const compPath = (comp as any).path
          if (typeof compPath === 'string') {
            discoveredComponents.push({
              slot,
              type: 'admin',
              key: slot,
              filePath: path.resolve(configDir, compPath),
            })
          }
        }
      }
    }

    // 2. Walk collection-level components (listMenuItems, editMenuItems)
    if (Array.isArray(config.collections)) {
      for (const collection of config.collections) {
        const adminComps = collection.admin?.components
        if (adminComps) {
          // listMenuItems — array of components at admin.components.listMenuItems
          if (Array.isArray(adminComps.listMenuItems)) {
            for (let i = 0; i < adminComps.listMenuItems.length; i++) {
              const item = adminComps.listMenuItems[i]
              if (item && typeof item === 'object' && 'path' in item) {
                const compPath = (item as any).path
                if (typeof compPath === 'string') {
                  discoveredComponents.push({
                    slot: `listAction[${i}]`,
                    type: 'listActions',
                    key: collection.slug,
                    filePath: path.resolve(configDir, compPath),
                  })
                }
              }
            }
          }
          // editMenuItems — array at admin.components.edit.editMenuItems
          const editComps = adminComps.edit
          if (editComps && typeof editComps === 'object' && Array.isArray((editComps as any).editMenuItems)) {
            const editItems = (editComps as any).editMenuItems
            for (let i = 0; i < editItems.length; i++) {
              const item = editItems[i]
              if (item && typeof item === 'object' && 'path' in item) {
                const compPath = (item as any).path
                if (typeof compPath === 'string') {
                  discoveredComponents.push({
                    slot: `editAction[${i}]`,
                    type: 'editActions',
                    key: collection.slug,
                    filePath: path.resolve(configDir, compPath),
                  })
                }
              }
            }
          }
        }
      }
    }

    // 3. Walk collection fields
    if (Array.isArray(config.collections)) {
      for (const collection of config.collections) {
        traverseFields(collection.fields, collection.slug, configDir, discoveredComponents)
      }
    }

    // 4. Walk global fields
    if (Array.isArray(config.globals)) {
      for (const global of config.globals) {
        traverseFields(global.fields, global.slug, configDir, discoveredComponents)
      }
    }

    console.log(`  Discovered ${discoveredComponents.length} component(s):\n`)

    const adminImports: string[] = []
    const fieldImports: string[] = []
    const listActionImports: string[] = []
    const editActionImports: string[] = []
    const adminAssignments: string[] = []
    // Field registry entries keyed by registry key. `singles` holds
    // (slot, varName) pairs; `arrays` accumulates beforeInput/afterInput slots.
    type FieldEntryParts = { singles: Array<[string, string]>; arrays: Record<string, string[]> }
    const fieldEntries = new Map<string, FieldEntryParts>()
    // Legacy (pre-block-slug) key → block-scoped keys that map onto it.
    const legacyAliasCandidates = new Map<string, Set<string>>()
    // Track list/edit action components per collection slug
    const listActionsBySlug = new Map<string, string[]>()
    const editActionsBySlug = new Map<string, string[]>()
    // Track extracted labels per variable name (for action components)
    const actionLabels = new Map<string, string>()
    // Files written this run — anything else in the output dir is stale.
    const generatedFiles = new Set<string>()
    const warnings: string[] = []
    let importCounter = 0

    for (const comp of discoveredComponents) {
      const actualPath = await resolveFilePath(comp.filePath)
      if (!actualPath) {
        warnings.push(`  SKIP: Could not find file for ${comp.type}.${comp.key}.${comp.slot} at ${comp.filePath}`)
        continue
      }

      console.log(`  Transform: ${comp.type}.${comp.key}.${comp.slot}`)
      console.log(`    Source:   ${actualPath}`)

      project.addSourceFileAtPath(actualPath)
      const sourceFile = project.getSourceFileOrThrow(actualPath)

      // For action components, extract the button label BEFORE transform
      // (because transform rewrites <button> → <Pressable>)
      let extractedLabel: string | null = null
      if (comp.type === 'listActions' || comp.type === 'editActions') {
        extractedLabel = extractActionLabel(project, actualPath)
        if (extractedLabel) {
          console.log(`    Label:   "${extractedLabel}"`)
        }
      }

      // Bail-out: components using web-only APIs (canvas/document/window/...)
      // cannot be transformed — emit a WebViewFieldBridge wrapper instead of
      // broken RN code. Clean components keep the normal transform path.
      const bailOutReasons = detectWebOnlyPatterns(sourceFile)
      let outputCode: string
      if (bailOutReasons.length > 0) {
        outputCode = generateWebViewFallback(comp, actualPath, bailOutReasons)
        warnings.push(
          `  WEBVIEW: ${comp.key}.${comp.slot} uses web-only patterns (${bailOutReasons.join(', ')}) — emitted WebViewFieldBridge wrapper`,
        )
      } else {
        transformComponent(sourceFile)
        sourceFile.formatText()
        outputCode = sourceFile.getFullText()
      }

      // Determine output path
      // Sanitize slot: afterInput[0] → afterInput_0, listAction[0] → listAction_0
      const safeSlotFile = comp.slot.replace(/\[/g, '_').replace(/\]/g, '')
      let targetSubpath: string
      if (comp.type === 'admin') {
        targetSubpath = path.join('admin', `${safeSlotFile}.native.tsx`)
      } else if (comp.type === 'listActions') {
        targetSubpath = path.join('actions', `${comp.key}_${safeSlotFile}.native.tsx`)
      } else if (comp.type === 'editActions') {
        targetSubpath = path.join('actions', `${comp.key}_${safeSlotFile}.native.tsx`)
      } else {
        targetSubpath = path.join(
          'fields',
          `${comp.key.replace(/\./g, '_')}_${safeSlotFile}.native.tsx`,
        )
      }

      const outPath = path.join(outputDir, targetSubpath)
      await fs.mkdir(path.dirname(outPath), { recursive: true })

      await fs.writeFile(outPath, outputCode)
      generatedFiles.add(outPath)
      console.log(`    Output:  ${outPath}${bailOutReasons.length > 0 ? ' (WebView fallback)' : ''}`)

      // Sanitize slot name for variable: afterInput[0] → afterInput_0
      const safeSlot = comp.slot.replace(/\[/g, '_').replace(/\]/g, '')
      const varName = `${safeSlot}Component${importCounter++}`
      const importFile = targetSubpath.replace(/\.native\.tsx$/, '.native')

      if (comp.type === 'admin') {
        adminImports.push(
          `import ${varName} from './${importFile}'`,
        )
        adminAssignments.push(`    "${comp.slot}": ${varName}`)
      } else if (comp.type === 'listActions') {
        listActionImports.push(
          `import ${varName} from './${importFile}'`,
        )
        if (!listActionsBySlug.has(comp.key)) listActionsBySlug.set(comp.key, [])
        listActionsBySlug.get(comp.key)!.push(varName)
        if (extractedLabel) actionLabels.set(varName, extractedLabel)
      } else if (comp.type === 'editActions') {
        editActionImports.push(
          `import ${varName} from './${importFile}'`,
        )
        if (!editActionsBySlug.has(comp.key)) editActionsBySlug.set(comp.key, [])
        editActionsBySlug.get(comp.key)!.push(varName)
        if (extractedLabel) actionLabels.set(varName, extractedLabel)
      } else if (comp.type === 'fields') {
        fieldImports.push(
          `import ${varName} from './${importFile}'`,
        )
        const entry = fieldEntries.get(comp.key) ?? { singles: [], arrays: {} }
        fieldEntries.set(comp.key, entry)
        // For array slots like afterInput[0], afterInput[1], accumulate into arrays
        const isArraySlot = /\[\d+\]$/.test(comp.slot)
        if (isArraySlot) {
          const baseSlot = comp.slot.replace(/\[\d+\]$/, '') // afterInput[0] → afterInput
          if (!entry.arrays[baseSlot]) entry.arrays[baseSlot] = []
          entry.arrays[baseSlot].push(varName)
        } else {
          entry.singles.push([comp.slot, varName])
        }
        // Remember legacy (pre-block-slug) key candidates for aliasing
        if (comp.legacyKey && comp.legacyKey !== comp.key) {
          const aliasSet = legacyAliasCandidates.get(comp.legacyKey) ?? new Set<string>()
          aliasSet.add(comp.key)
          legacyAliasCandidates.set(comp.legacyKey, aliasSet)
        }
      }
    }

    // Format field registry entries (singles first, then array slots)
    const formatFieldEntry = (parts: FieldEntryParts): string => {
      const segments = [
        ...parts.singles.map(([slot, varName]) => `${slot}: ${varName}`),
        ...Object.entries(parts.arrays).map(([slot, vars]) => `${slot}: [${vars.join(', ')}]`),
      ]
      return `{ ${segments.join(', ')} }`
    }

    const fieldAssignments: string[] = []
    for (const [key, parts] of fieldEntries) {
      fieldAssignments.push(`    "${key}": ${formatFieldEntry(parts)}`)
    }

    // Backward compatibility: block-nested fields are now keyed with the
    // block slug ("pages.layout.hero.heading"). Where the legacy slug-less
    // key is unambiguous (field name unique across the field's blocks) emit
    // it too so existing lookups keep resolving. Colliding legacy keys are
    // dropped — only the block-scoped keys disambiguate those.
    for (const [legacyKey, scopedKeys] of legacyAliasCandidates) {
      if (fieldEntries.has(legacyKey)) continue // a real entry owns this key
      if (scopedKeys.size > 1) {
        warnings.push(
          `  WARN: legacy key "${legacyKey}" is ambiguous across blocks (${[...scopedKeys].join(', ')}) — emitted block-scoped keys only`,
        )
        continue
      }
      const [scopedKey] = scopedKeys
      fieldAssignments.push(
        `    // Legacy alias for "${scopedKey}" (pre-block-slug key)\n    "${legacyKey}": ${formatFieldEntry(fieldEntries.get(scopedKey)!)}`,
      )
    }

    // Build listActions / editActions assignments with { component, label } entries
    const formatActionEntry = (varName: string): string => {
      const label = actionLabels.get(varName)
      if (label) {
        return `{ component: ${varName}, label: ${JSON.stringify(label)} }`
      }
      return `{ component: ${varName} }`
    }

    const listActionAssignments: string[] = []
    for (const [slug, vars] of listActionsBySlug) {
      listActionAssignments.push(`    "${slug}": [${vars.map(formatActionEntry).join(', ')}]`)
    }
    const editActionAssignments: string[] = []
    for (const [slug, vars] of editActionsBySlug) {
      editActionAssignments.push(`    "${slug}": [${vars.map(formatActionEntry).join(', ')}]`)
    }

    const allImports = [
      ...adminImports,
      ...fieldImports,
      ...listActionImports,
      ...editActionImports,
    ].filter(Boolean)

    // Generate registry
    const registryCode = `// AUTO-GENERATED by payload-native-codegen — do not edit manually.
// Re-run: pnpm codegen:native
import type { CustomComponentRegistry } from '@payload-universal/admin-native'

${allImports.join('\n')}

export const customComponentRegistry: CustomComponentRegistry = {
  fields: {
${fieldAssignments.join(',\n')}
  },
  views: {},
  admin: {
${adminAssignments.join(',\n')}
  },${listActionAssignments.length > 0 ? `
  listActions: {
${listActionAssignments.join(',\n')}
  },` : ''}${editActionAssignments.length > 0 ? `
  editActions: {
${editActionAssignments.join(',\n')}
  },` : ''}
}

export default customComponentRegistry
`

    const registryPath = path.join(outputDir, '_registry.ts')
    await fs.writeFile(registryPath, registryCode)
    generatedFiles.add(registryPath)

    console.log(`\n  Registry:  ${registryPath}`)

    // Remove stale outputs (files from previous runs that were not
    // regenerated above) and prune emptied subdirectories.
    const removedFiles = await cleanStaleOutputs(outputDir, generatedFiles)
    if (removedFiles.length > 0) {
      console.log(`\n  Cleaned ${removedFiles.length} stale output(s):`)
      for (const file of removedFiles) {
        console.log(`    - ${path.relative(outputDir, file)}`)
      }
    }

    if (warnings.length > 0) {
      console.log(`\n  Warnings:`)
      for (const w of warnings) {
        console.log(w)
      }
    }

    console.log(`\n  Done. ${discoveredComponents.length} component(s) processed.\n`)
  })

// ---------------------------------------------------------------------------
// WebView fallback generation
// ---------------------------------------------------------------------------

/** Derive a display name from the component file path ("ReadTimeChart"). */
function componentNameFromPath(filePath: string): string {
  const base = path.basename(filePath).replace(/\.(tsx|ts|jsx|js)$/, '')
  return base === 'index' ? path.basename(path.dirname(filePath)) : base
}

/**
 * Generate a WebViewFieldBridge wrapper for a component that uses web-only
 * APIs (canvas/document/window/...) and cannot be AST-transformed to RN.
 *
 * The wrapper passes through the slot props it receives at runtime
 * (field/value/onChange/path/...) and falls back to the identifiers the
 * codegen knows (collection slug, field path) when a prop is absent, so the
 * bridge can always initialize the WebView.
 */
function generateWebViewFallback(
  comp: DiscoveredComponent,
  sourcePath: string,
  reasons: string[],
): string {
  const componentName = componentNameFromPath(sourcePath)
  const exportName = `${componentName.replace(/[^A-Za-z0-9_$]/g, '_')}WebViewFallback`

  // Thread what the codegen knows about this slot into the wrapper.
  let collectionSlug: string | null = null
  let fieldPath: string
  if (comp.type === 'fields') {
    // key shape: "<collectionOrGlobalSlug>.<field.path>"
    const segments = comp.key.split('.')
    collectionSlug = segments[0] ?? null
    fieldPath = segments.slice(1).join('.') || comp.key
  } else if (comp.type === 'listActions' || comp.type === 'editActions') {
    collectionSlug = comp.key
    fieldPath = comp.slot
  } else {
    fieldPath = comp.slot
  }
  const fieldName = fieldPath.split('.').pop() || componentName

  return `// AUTO-GENERATED by payload-native-codegen — DO NOT EDIT.
// Re-run: pnpm codegen:native
//
// WebView fallback wrapper.
//
// The source web component could not be transformed to React Native because
// it uses web-only patterns: ${reasons.join(', ')}.
// It renders inside WebViewFieldBridge instead, which bridges field values
// (INIT / VALUE_UPDATE / FIELD_CHANGE) and local-db requests (LOCAL_QUERY /
// LOCAL_MUTATION) between the WebView and the native app.
//
// Source:     ${sourcePath}
// Slot:       ${comp.type}.${comp.key}.${comp.slot}
// Collection: ${collectionSlug ?? '(none)'}
// Field path: ${comp.type === 'fields' ? fieldPath : '(not a field slot)'}
import React from 'react'
import { WebViewFieldBridge } from '@payload-universal/admin-native'

const COMPONENT_NAME = ${JSON.stringify(componentName)}
const COLLECTION_SLUG = ${collectionSlug === null ? 'null' : JSON.stringify(collectionSlug)}
const FIELD_PATH = ${JSON.stringify(fieldPath)}

/**
 * Slot props are passed through when provided (Field slots receive
 * field/value/onChange/path; beforeInput/afterInput slots receive
 * field/path/value). Codegen-known identifiers fill the gaps so the
 * bridge always has a field + path to initialize the WebView with.
 */
const ${exportName}: React.FC<Record<string, any>> = (props) => (
  <WebViewFieldBridge
    field={props.field ?? ({ name: ${JSON.stringify(fieldName)}, type: 'ui', _collectionSlug: COLLECTION_SLUG } as any)}
    value={props.value ?? null}
    onChange={props.onChange ?? (() => { /* read-only slot (e.g. afterInput) */ })}
    path={props.path ?? FIELD_PATH}
    disabled={props.disabled}
    error={props.error}
    componentName={COMPONENT_NAME}
    minHeight={120}
    onLocalQuery={props.onLocalQuery}
    onLocalMutation={props.onLocalMutation}
  />
)

export default ${exportName}
`
}

// ---------------------------------------------------------------------------
// Stale output cleanup
// ---------------------------------------------------------------------------

/**
 * Delete files inside the (fully codegen-owned) output directory that were
 * not regenerated this run, then prune emptied subdirectories.
 * Returns the deleted file paths.
 */
async function cleanStaleOutputs(dir: string, keep: Set<string>): Promise<string[]> {
  const removed: string[] = []
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return removed // output dir missing — nothing to clean
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

// ---------------------------------------------------------------------------
// Recursive field traversal
// ---------------------------------------------------------------------------

function traverseFields(
  fields: any[],
  prefix: string,
  configDir: string,
  result: DiscoveredComponent[],
  /**
   * Pre-block-slug key prefix. Defined only while inside at least one
   * blocks field; used to emit backward-compatible legacy registry keys.
   */
  legacyPrefix?: string,
) {
  if (!Array.isArray(fields)) return

  /** Append `name` to the legacy prefix, mirroring the main prefix logic. */
  const legacyJoin = (name: string | undefined): string | undefined =>
    legacyPrefix === undefined ? undefined : name ? `${legacyPrefix}.${name}` : legacyPrefix

  for (const field of fields) {
    if (!field) continue

    // Check for admin.components on this field
    if (field.admin?.components) {
      const fieldKey = field.name ? `${prefix}.${field.name}` : prefix
      const legacyKey = legacyJoin(field.name)

      for (const [slot, comp] of Object.entries(field.admin.components)) {
        // Handle array slots (beforeInput, afterInput)
        if (Array.isArray(comp)) {
          for (let i = 0; i < comp.length; i++) {
            const item = comp[i]
            if (item && typeof item === 'object' && 'path' in item) {
              const compPath = (item as any).path
              if (typeof compPath === 'string') {
                result.push({
                  slot: `${slot}[${i}]`,
                  type: 'fields',
                  key: fieldKey,
                  filePath: path.resolve(configDir, compPath),
                  legacyKey,
                })
              }
            }
          }
        }
        // Handle single component slots (Field, Cell, Label, etc.)
        else if (comp && typeof comp === 'object' && 'path' in (comp as any)) {
          const compPath = (comp as any).path
          if (typeof compPath === 'string') {
            result.push({
              slot,
              type: 'fields',
              key: fieldKey,
              filePath: path.resolve(configDir, compPath),
              legacyKey,
            })
          }
        }
      }
    }

    // Recurse into nested structures
    if (field.fields) {
      const childPrefix = field.name ? `${prefix}.${field.name}` : prefix
      traverseFields(field.fields, childPrefix, configDir, result, legacyJoin(field.name))
    }

    if (field.tabs) {
      for (const tab of field.tabs) {
        const tabPrefix = tab.name ? `${prefix}.${tab.name}` : prefix
        traverseFields(tab.fields ?? [], tabPrefix, configDir, result, legacyJoin(tab.name))
      }
    }

    if (field.blocks) {
      for (const block of field.blocks) {
        const fieldPrefix = field.name ? `${prefix}.${field.name}` : prefix
        // Include the block slug so identically-named fields in different
        // blocks get distinct registry keys ("pages.layout.hero.heading"
        // vs "pages.layout.cta.heading" instead of both colliding on
        // "pages.layout.heading").
        const blockPrefix = block.slug ? `${fieldPrefix}.${block.slug}` : fieldPrefix
        // The legacy prefix never includes block slugs. When this is the
        // outermost blocks field, the legacy lineage starts here.
        const legacyFieldPrefix = legacyJoin(field.name) ?? fieldPrefix
        traverseFields(block.fields ?? [], blockPrefix, configDir, result, legacyFieldPrefix)
      }
    }
  }
}

program.parse(process.argv)
