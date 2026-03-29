import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const testAppRoot = path.resolve(scriptDir, '..')
const payloadRoot = path.resolve(testAppRoot, '..', 'payload-main')

const packages = [
  'payload',
  'next',
  'ui',
  'richtext-lexical',
  'translations',
  'db-mongodb',
  'graphql',
]

const patchPackage = (packageName) => {
  const packagePath = path.join(payloadRoot, 'packages', packageName, 'package.json')
  if (!fs.existsSync(packagePath)) {
    console.warn(`[patch-payload-exports] Missing ${packageName}`)
    return
  }

  const raw = fs.readFileSync(packagePath, 'utf8')
  const pkg = JSON.parse(raw)
  const publishConfig = pkg.publishConfig

  if (!publishConfig) {
    console.warn(`[patch-payload-exports] No publishConfig for ${pkg.name}`)
    return
  }

  if (publishConfig.exports) {
    pkg.exports = publishConfig.exports
  }

  if (publishConfig.main) {
    pkg.main = publishConfig.main
  }

  if (publishConfig.types) {
    pkg.types = publishConfig.types
  }

  if (publishConfig.bin) {
    pkg.bin = publishConfig.bin
  }

  fs.writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`)
}

packages.forEach(patchPackage)
