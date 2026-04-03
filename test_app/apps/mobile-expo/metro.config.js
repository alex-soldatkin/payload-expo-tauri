const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')
const fs = require('fs')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')
const monoRoot = path.resolve(workspaceRoot, '..')

const config = getDefaultConfig(projectRoot)

// Watch test_app workspace, payload_universal, and payload-main/packages
config.watchFolders = [
  workspaceRoot,
  path.resolve(monoRoot, 'payload_universal/packages'),
  path.resolve(monoRoot, 'payload_universal/tools'),
  path.resolve(monoRoot, 'payload-main/packages'),
]

// Modules that must resolve to the app's own copy (never hoisted/duplicated)
const singletonModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
}

// Resolve the real path for @expo/ui (pnpm uses symlinks)
const expoUIReal = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/@expo/ui')
)

config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  extraNodeModules: {
    ...singletonModules,
    '@expo/ui': expoUIReal,
    'react-freeze': path.resolve(projectRoot, 'node_modules/react-freeze'),
    '@payload-universal/ui': path.resolve(monoRoot, 'payload_universal/packages/payload-universal-ui'),
  },
  resolveRequest: (context, moduleName, platform) => {
    // Pin react / react-native singletons
    if (singletonModules[moduleName]) {
      return {
        filePath: require.resolve(moduleName, { paths: [projectRoot] }),
        type: 'sourceFile',
      }
    }

    // Pin ALL @expo/ui imports (including subpaths like @expo/ui/swift-ui)
    // to the app's canary version, preventing Metro from resolving the
    // incompatible stable version from the workspace root.
    if (moduleName === '@expo/ui' || moduleName.startsWith('@expo/ui/')) {
      const subpath = moduleName === '@expo/ui'
        ? ''
        : moduleName.slice('@expo/ui/'.length)

      // Use the package.json exports to resolve the subpath
      if (subpath) {
        const pkg = require(path.join(expoUIReal, 'package.json'))
        const exportKey = './' + subpath
        const exportEntry = pkg.exports?.[exportKey]
        if (exportEntry) {
          const entryFile = typeof exportEntry === 'string'
            ? exportEntry
            : exportEntry.default || exportEntry.import || Object.values(exportEntry)[0]
          const resolved = path.resolve(expoUIReal, entryFile)
          return { filePath: resolved, type: 'sourceFile' }
        }
      }

      // Root import
      const mainEntry = path.resolve(expoUIReal, 'src/index.ts')
      if (fs.existsSync(mainEntry)) {
        return { filePath: mainEntry, type: 'sourceFile' }
      }
    }

    return context.resolveRequest(context, moduleName, platform)
  },
}

module.exports = withNativeWind(config, { input: './global.css' })
