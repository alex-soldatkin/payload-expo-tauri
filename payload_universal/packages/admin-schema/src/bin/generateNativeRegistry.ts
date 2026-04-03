import fs from 'node:fs/promises'
import path from 'node:path'
import { builtinModules } from 'node:module'

import type { Config, Field, SanitizedConfig } from 'payload'
import { buildConfig } from 'payload'

type ComponentDef = { path?: string; exportName?: string } | string

async function generateNativeRegistry() {
  const args = process.argv.slice(2)
  if (args.length < 2) {
    console.error('Usage: generateNativeRegistry <payload-config-path> <output-file-path>')
    process.exit(1)
  }

  const payloadConfigPath = path.resolve(process.cwd(), args[0])
  const outputPath = path.resolve(process.cwd(), args[1])
  const outputDir = path.dirname(outputPath)

  console.log(`Loading Payload config from: ${payloadConfigPath}`)
  const rawConfig = await import(payloadConfigPath)
  const config = (rawConfig.default || rawConfig) as Config
  const sanitizedConfig = await buildConfig(config)

  const imports: string[] = []
  const adminOverrides: string[] = []
  const viewOverrides: string[] = []
  const fieldOverrides: string[] = []
  let importCounter = 0

  // We need to resolve paths relative to the payload config's directory,
  // then make them relative to the output file's directory.
  const configDir = path.dirname(payloadConfigPath)

  function addComponent(
    definition: ComponentDef | undefined,
    registryTarget: 'admin' | 'views' | 'fields',
    key: string,
    slot?: string
  ) {
    if (!definition) return

    let componentPath = ''
    let exportName = 'default'

    if (typeof definition === 'string') {
      componentPath = definition
    } else if (typeof definition === 'object') {
      if (!definition.path) return // no path to import
      componentPath = definition.path
      if (definition.exportName) {
        exportName = definition.exportName
      }
    }

    if (!componentPath) return

    // Resolve component path absolute
    let absolutePath: string
    if (path.isAbsolute(componentPath)) {
      absolutePath = componentPath
    } else if (componentPath.startsWith('.')) {
      absolutePath = path.resolve(configDir, componentPath)
    } else {
      // It might be a node_module or an aliased path.
      // We'll leave it as is, Metro should be able to resolve it if it's a package.
      absolutePath = componentPath
    }

    // Now make it relative to outputDir, if it is absolute
    let importPath = absolutePath
    if (path.isAbsolute(absolutePath)) {
      importPath = path.relative(outputDir, absolutePath)
      if (!importPath.startsWith('.')) {
        importPath = `./${importPath}`
      }
    }

    // Strip extensions for Metro
    importPath = importPath.replace(/\.(tsx?|jsx?)$/, '')

    const varName = `CustomComponent${importCounter++}`
    if (exportName === 'default') {
      imports.push(`import ${varName} from '${importPath}'`)
    } else {
      imports.push(`import { ${exportName} as ${varName} } from '${importPath}'`)
    }

    if (registryTarget === 'admin') {
      adminOverrides.push(`    "${key}": ${varName}`)
    } else if (registryTarget === 'views') {
      adminOverrides.push(`    "${key}": ${varName}`) // Views are separate if needed, but often lumped or struct is diff
    } else if (registryTarget === 'fields') {
      if (slot) {
        fieldOverrides.push(`    "${key}": { ...customComponents.fields["${key}"], ${slot}: ${varName} }`)
      } else {
        fieldOverrides.push(`    "${key}": ${varName}`)
      }
    }
  }

  function traverseFields(fields: Field[], prefix: string) {
    fields.forEach((field) => {
      // If the field has nested fields (e.g. group, array, block)
      if ('fields' in field && Array.isArray(field.fields)) {
        let newPrefix = prefix
        if ('name' in field && typeof field.name === 'string') {
          newPrefix = prefix ? `${prefix}.${field.name}` : field.name
        }
        traverseFields(field.fields, newPrefix)
      } else if (field.type === 'tabs' && 'tabs' in field) {
        field.tabs.forEach((tab) => {
          let newPrefix = prefix
          if ('name' in tab && typeof tab.name === 'string') {
            newPrefix = prefix ? `${prefix}.${tab.name}` : tab.name
          }
          traverseFields(tab.fields, newPrefix)
        })
      } else if (field.type === 'blocks' && 'blocks' in field) {
        field.blocks.forEach((block) => {
          // Block fields are somewhat tricky, but they usually start with the field name
          const newPrefix = prefix ? `${prefix}.${field.name}` : field.name
          traverseFields(block.fields, newPrefix)
        })
      }

      // Check for component overrides on this field
      if ('name' in field && field.admin?.components) {
        const fieldKey = prefix ? `${prefix}.${field.name}` : field.name
        const components = field.admin.components as Record<string, ComponentDef>
        for (const [slot, compDef] of Object.entries(components)) {
          // slot is usually 'Field' or 'Cell' or 'Filter'
          addComponent(compDef, 'fields', fieldKey, slot)
        }
      }
    })
  }

  // 1. Admin components (Nav, beforeDashboard, etc)
  if (sanitizedConfig.admin?.components) {
    for (const [key, compDef] of Object.entries(sanitizedConfig.admin.components)) {
      if (key !== 'views' && key !== 'graphics' && key !== 'providers') {
        addComponent(compDef as ComponentDef, 'admin', key)
      }
      if (key === 'graphics') {
        const graphics = compDef as Record<string, ComponentDef>
        for (const [gKey, gDef] of Object.entries(graphics || {})) {
          addComponent(gDef, 'admin', `graphics.${gKey}`)
        }
      }
    }
  }

  // 2. Collection overrides
  sanitizedConfig.collections.forEach((collection) => {
    traverseFields(collection.fields, collection.slug)
    // Collection admin level components
    /* (Currently ignoring custom list views or edit views since React Native form doesn't support them fully yet, but fields are fully traversed above) */
  })

  // 3. Global overrides
  sanitizedConfig.globals.forEach((global) => {
    traverseFields(global.fields, global.slug)
  })

  // Gather everything into the file
  const outCode = `// This file is auto-generated by the native component codegen script.
// Do not edit this file directly.

${imports.join('\n')}

export const customComponents: any = {
  admin: {
${adminOverrides.join(',\n')}
  },
  views: {
${viewOverrides.join(',\n')}
  },
  fields: {
    // Note: We use a getter or simple reduce if we had object merges, but for simple paths:
${fieldOverrides.join(',\n')}
  }
}

// Map the flat field overrides so slots are combined if there are multiple.
// The script currently produces separate entries, but in a real scenario we merge them:
const mergedFields: any = {}
Object.keys(customComponents.fields).forEach(key => {
  mergedFields[key] = { ...mergedFields[key], ...customComponents.fields[key] }
})
customComponents.fields = mergedFields

export default customComponents;
`

  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(outputPath, outCode, 'utf8')
  console.log(`Native registry successfully generated at: ${outputPath}`)
}

generateNativeRegistry().catch((err) => {
  console.error(err)
  process.exit(1)
})
