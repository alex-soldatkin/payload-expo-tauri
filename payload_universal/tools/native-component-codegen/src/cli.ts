import { Command } from 'commander'
import { Project } from 'ts-morph'
import path from 'node:path'
import fs from 'node:fs/promises'
import { transformComponent } from './transform.js'
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

type DiscoveredComponent = {
  slot: string
  type: 'admin' | 'fields' | 'views'
  key: string
  filePath: string
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

    // 2. Walk collection fields
    if (Array.isArray(config.collections)) {
      for (const collection of config.collections) {
        traverseFields(collection.fields, collection.slug, configDir, discoveredComponents)
      }
    }

    // 3. Walk global fields
    if (Array.isArray(config.globals)) {
      for (const global of config.globals) {
        traverseFields(global.fields, global.slug, configDir, discoveredComponents)
      }
    }

    console.log(`  Discovered ${discoveredComponents.length} component(s):\n`)

    const adminImports: string[] = []
    const fieldImports: string[] = []
    const adminAssignments: string[] = []
    const fieldAssignments: string[] = []
    // Track array slots (afterInput, beforeInput) separately
    const fieldArraySlots = new Map<string, Record<string, string[]>>()
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

      const bailedOut = transformComponent(sourceFile)

      if (bailedOut) {
        warnings.push(`  WARN: ${comp.key}.${comp.slot} uses web-only patterns (document/window/canvas) — may need WebView fallback`)
      }

      // Determine output path
      // Sanitize slot: afterInput[0] → afterInput_0
      const safeSlotFile = comp.slot.replace(/\[/g, '_').replace(/\]/g, '')
      const targetSubpath =
        comp.type === 'admin'
          ? path.join('admin', `${safeSlotFile}.native.tsx`)
          : path.join(
              'fields',
              `${comp.key.replace(/\./g, '_')}_${safeSlotFile}.native.tsx`,
            )

      const outPath = path.join(outputDir, targetSubpath)
      await fs.mkdir(path.dirname(outPath), { recursive: true })

      sourceFile.formatText()
      await fs.writeFile(outPath, sourceFile.getFullText())
      console.log(`    Output:  ${outPath}`)

      // Sanitize slot name for variable: afterInput[0] → afterInput_0
      const safeSlot = comp.slot.replace(/\[/g, '_').replace(/\]/g, '')
      const varName = `${safeSlot}Component${importCounter++}`
      const importFile = targetSubpath.replace(/\.native\.tsx$/, '.native')

      if (comp.type === 'admin') {
        adminImports.push(
          `import ${varName} from './${importFile}'`,
        )
        adminAssignments.push(`    "${comp.slot}": ${varName}`)
      } else if (comp.type === 'fields') {
        fieldImports.push(
          `import ${varName} from './${importFile}'`,
        )
        // For array slots like afterInput[0], afterInput[1], accumulate into arrays
        const isArraySlot = /\[\d+\]$/.test(comp.slot)
        if (isArraySlot) {
          const baseSlot = comp.slot.replace(/\[\d+\]$/, '') // afterInput[0] → afterInput
          fieldArraySlots.set(
            comp.key,
            fieldArraySlots.get(comp.key) ?? {},
          )
          const entry = fieldArraySlots.get(comp.key)!
          if (!entry[baseSlot]) entry[baseSlot] = []
          entry[baseSlot].push(varName)
        } else {
          fieldAssignments.push(`    "${comp.key}": { ${comp.slot}: ${varName} }`)
        }
      }
    }

    // Merge array slots (afterInput, beforeInput) into field assignments
    for (const [fieldKey, slots] of fieldArraySlots) {
      // Check if this field already has non-array slots
      const existingIdx = fieldAssignments.findIndex(a => a.includes(`"${fieldKey}"`))
      if (existingIdx >= 0) {
        // Merge array slots into existing entry
        let existing = fieldAssignments[existingIdx]
        for (const [slotName, vars] of Object.entries(slots)) {
          existing = existing.replace(
            /\}$/,
            `, ${slotName}: [${vars.join(', ')}] }`,
          )
        }
        fieldAssignments[existingIdx] = existing
      } else {
        // Create new entry with array slots
        const slotEntries = Object.entries(slots)
          .map(([name, vars]) => `${name}: [${vars.join(', ')}]`)
          .join(', ')
        fieldAssignments.push(`    "${fieldKey}": { ${slotEntries} }`)
      }
    }

    // Generate registry
    const registryCode = `// AUTO-GENERATED by payload-native-codegen — do not edit manually.
// Re-run: pnpm codegen:native
import type { CustomComponentRegistry } from '@payload-universal/admin-native'

${adminImports.join('\n')}
${fieldImports.join('\n')}

export const customComponentRegistry: CustomComponentRegistry = {
  fields: {
${fieldAssignments.join(',\n')}
  },
  views: {},
  admin: {
${adminAssignments.join(',\n')}
  },
}

export default customComponentRegistry
`

    const registryPath = path.join(outputDir, '_registry.ts')
    await fs.writeFile(registryPath, registryCode)

    console.log(`\n  Registry:  ${registryPath}`)

    if (warnings.length > 0) {
      console.log(`\n  Warnings:`)
      for (const w of warnings) {
        console.log(w)
      }
    }

    console.log(`\n  Done. ${discoveredComponents.length} component(s) processed.\n`)
  })

// ---------------------------------------------------------------------------
// Recursive field traversal
// ---------------------------------------------------------------------------

function traverseFields(
  fields: any[],
  prefix: string,
  configDir: string,
  result: DiscoveredComponent[],
) {
  if (!Array.isArray(fields)) return

  for (const field of fields) {
    if (!field) continue

    // Check for admin.components on this field
    if (field.admin?.components) {
      const fieldKey = field.name ? `${prefix}.${field.name}` : prefix

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
            })
          }
        }
      }
    }

    // Recurse into nested structures
    if (field.fields) {
      const childPrefix = field.name ? `${prefix}.${field.name}` : prefix
      traverseFields(field.fields, childPrefix, configDir, result)
    }

    if (field.tabs) {
      for (const tab of field.tabs) {
        const tabPrefix = tab.name ? `${prefix}.${tab.name}` : prefix
        traverseFields(tab.fields ?? [], tabPrefix, configDir, result)
      }
    }

    if (field.blocks) {
      for (const block of field.blocks) {
        const blockPrefix = field.name ? `${prefix}.${field.name}` : prefix
        traverseFields(block.fields ?? [], blockPrefix, configDir, result)
      }
    }
  }
}

program.parse(process.argv)
