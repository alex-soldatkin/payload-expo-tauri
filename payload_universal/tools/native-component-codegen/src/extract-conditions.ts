/**
 * Conditions extractor (epic #28 phase 1).
 *
 * admin.condition values are functions, so the runtime config walk (cli.ts)
 * cannot emit them — by the time the config is imported they are live
 * closures. This pass reads the SOURCE instead: a ts-morph walk over the
 * server's collection/global modules that mirrors traverseFields' key
 * conventions exactly (cli.ts:572-660):
 *   - named group/tab fields prefix their segment; unnamed tabs are transparent
 *   - row/collapsible are transparent
 *   - block sub-fields are keyed `{blocksFieldPath}.{blockSlug}.{name}`
 *   - array sub-fields keep index-less paths (`sessions.title`)
 *
 * Output: a ConditionRegistry module (slug → path → verbatim arrow source),
 * consumable by both the mobile ConditionRegistryProvider and the Electron
 * renderer's condition registry. Conditions must be self-contained arrows
 * (data, siblingData) => boolean — module-scope captures are rejected loudly.
 */
import path from 'node:path'
import {
  Node,
  ObjectLiteralExpression,
  Project,
  PropertyAssignment,
  SyntaxKind,
} from 'ts-morph'

export type ExtractedCondition = {
  slug: string
  fieldPath: string
  /** Verbatim source of the condition function. */
  source: string
  file: string
}

/** Resolve an array element to an object literal (inline or via identifier). */
function toObjectLiteral(node: Node): ObjectLiteralExpression | undefined {
  if (Node.isObjectLiteralExpression(node)) return node
  if (Node.isIdentifier(node)) {
    const def = node.getDefinitionNodes()[0]
    if (def && Node.isVariableDeclaration(def)) {
      const init = def.getInitializer()
      if (init && Node.isObjectLiteralExpression(init)) return init
      // `satisfies` / `as` wrappers
      if (init) {
        const inner = init.getFirstDescendantByKind(SyntaxKind.ObjectLiteralExpression)
        if (inner) return inner
      }
    }
  }
  return undefined
}

function getProp(obj: ObjectLiteralExpression, name: string): PropertyAssignment | undefined {
  const prop = obj.getProperty(name)
  return prop && Node.isPropertyAssignment(prop) ? prop : undefined
}

function getString(obj: ObjectLiteralExpression, name: string): string | undefined {
  const init = getProp(obj, name)?.getInitializer()
  return init && (Node.isStringLiteral(init) || Node.isNoSubstitutionTemplateLiteral(init))
    ? init.getLiteralText()
    : undefined
}

function getArray(obj: ObjectLiteralExpression, name: string) {
  const init = getProp(obj, name)?.getInitializer()
  return init && Node.isArrayLiteralExpression(init) ? init : undefined
}

/** Walk one field object; `prefix` is the accumulated path (no trailing dot). */
function walkField(
  field: ObjectLiteralExpression,
  prefix: string,
  slug: string,
  file: string,
  out: ExtractedCondition[],
): void {
  const name = getString(field, 'name')
  const type = getString(field, 'type')
  const fieldPath = name ? (prefix ? `${prefix}.${name}` : name) : prefix

  // admin.condition on this field?
  const admin = getProp(field, 'admin')?.getInitializer()
  if (admin && Node.isObjectLiteralExpression(admin)) {
    const cond = getProp(admin, 'condition')?.getInitializer()
    if (cond) {
      const source = cond.getText()
      // Self-containment check: reject obvious module-scope captures.
      if (!Node.isArrowFunction(cond) && !Node.isFunctionExpression(cond)) {
        console.warn(
          `[conditions] ${slug}.${fieldPath} (${file}): condition is not an inline function — skipped (add it to the hand-written registry).`,
        )
      } else {
        out.push({ slug, fieldPath, source, file })
      }
    }
  }

  // Containers
  const childBase = (() => {
    if (type === 'group' || type === 'array') return fieldPath // named adds segment via `name` above
    if (type === 'row' || type === 'collapsible') return prefix // transparent
    return fieldPath
  })()

  const children = getArray(field, 'fields')
  if (children && type !== 'blocks') {
    for (const el of children.getElements()) {
      const child = toObjectLiteral(el)
      if (child) walkField(child, type === 'row' || type === 'collapsible' ? prefix : childBase, slug, file, out)
    }
  }

  // tabs: named tab prefixes its name; unnamed transparent
  const tabs = getArray(field, 'tabs')
  if (tabs) {
    for (const el of tabs.getElements()) {
      const tab = toObjectLiteral(el)
      if (!tab) continue
      const tabName = getString(tab, 'name')
      const tabBase = tabName ? (prefix ? `${prefix}.${tabName}` : tabName) : prefix
      const tabFields = getArray(tab, 'fields')
      if (tabFields) {
        for (const f of tabFields.getElements()) {
          const child = toObjectLiteral(f)
          if (child) walkField(child, tabBase, slug, file, out)
        }
      }
    }
  }

  // blocks: sub-fields keyed {fieldPath}.{blockSlug}.{name}
  const blocks = getArray(field, 'blocks')
  if (blocks && type === 'blocks') {
    for (const el of blocks.getElements()) {
      const block = toObjectLiteral(el)
      if (!block) continue
      const blockSlug = getString(block, 'slug')
      const blockFields = getArray(block, 'fields')
      if (!blockSlug || !blockFields) continue
      for (const f of blockFields.getElements()) {
        const child = toObjectLiteral(f)
        if (child) walkField(child, `${fieldPath}.${blockSlug}`, slug, file, out)
      }
    }
  }
}

/** Extract conditions from every collection/global module under the server src. */
export function extractConditions(serverSrcDir: string): ExtractedCondition[] {
  const project = new Project({ skipAddingFilesFromTsConfig: true })
  project.addSourceFilesAtPaths([
    path.join(serverSrcDir, 'collections/**/*.ts'),
    path.join(serverSrcDir, 'globals/**/*.ts'),
  ])

  const out: ExtractedCondition[] = []
  for (const sf of project.getSourceFiles()) {
    for (const obj of sf.getDescendantsOfKind(SyntaxKind.ObjectLiteralExpression)) {
      const slug = getString(obj, 'slug')
      const fields = getArray(obj, 'fields')
      if (!slug || !fields) continue
      // Only top-level collection/global configs (avoid nested field objects
      // that happen to have slug+fields — blocks. Blocks are handled inside
      // walkField; skip objects that are themselves inside a `blocks` array).
      const isBlockDef = Boolean(
        obj.getFirstAncestor(
          (a) => Node.isPropertyAssignment(a) && a.getName() === 'blocks',
        ),
      )
      if (isBlockDef) continue
      // Standalone block consts (`const HeroBlock: Block = {...}`) also carry
      // slug+fields — their conditions are reached through the blocks walk of
      // the collection that references them, so skip them here.
      const varDecl = obj.getFirstAncestorByKind(SyntaxKind.VariableDeclaration)
      const typeText = varDecl?.getTypeNode()?.getText() ?? ''
      if (/\bBlock\b/.test(typeText)) continue
      for (const el of fields.getElements()) {
        const field = toObjectLiteral(el)
        if (field) walkField(field, '', slug, sf.getBaseName(), out)
      }
    }
  }
  return out
}

/** Render the generated registry module. */
export function renderConditionsModule(conditions: ExtractedCondition[]): string {
  const bySlug = new Map<string, ExtractedCondition[]>()
  for (const c of conditions) {
    const list = bySlug.get(c.slug) ?? []
    list.push(c)
    bySlug.set(c.slug, list)
  }
  const lines: string[] = [
    '// GENERATED by native-component-codegen (extract-conditions) — do not edit.',
    '// Sources: apps/server/src/{collections,globals} admin.condition functions.',
    '// Re-run: pnpm codegen:native',
    'type ConditionFn = (data: Record<string, unknown>, siblingData: Record<string, unknown>) => boolean',
    '',
    'export const generatedConditions: Record<string, Record<string, ConditionFn>> = {',
  ]
  for (const [slug, list] of [...bySlug.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push(`  '${slug}': {`)
    for (const c of list.sort((a, b) => a.fieldPath.localeCompare(b.fieldPath))) {
      lines.push(`    // ${c.file}`)
      lines.push(`    '${c.fieldPath}': (${c.source}) as ConditionFn,`)
    }
    lines.push('  },')
  }
  lines.push('}', '')
  return lines.join('\n')
}
