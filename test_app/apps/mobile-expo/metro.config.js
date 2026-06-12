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

// Pin @react-navigation/* to the copies EXPO-ROUTER resolves. pnpm gives the
// app and expo-router different physical copies; @react-navigation context
// objects then differ per copy, so app-level useNavigation/usePreventRemove
// crash with "Couldn't find a navigation object" (2026-06-12, unsaved-changes
// guard). Anchoring resolution at expo-router's own directory guarantees one
// shared instance — and usePreventRemove's NATIVE dismiss prevention (sheet
// bounce-back on cancel) only works when the instances match.
const expoRouterDir = path.dirname(
  require.resolve('expo-router/package.json', { paths: [projectRoot] })
)
const navNativeDir = path.dirname(
  require.resolve('@react-navigation/native/package.json', { paths: [expoRouterDir] })
)
const navSingletonAnchors = {
  '@react-navigation/native': expoRouterDir,
  '@react-navigation/core': navNativeDir,
}

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
    // Pin react / react-native singletons — including DEEP imports like
    // 'react-native/Libraries/Utilities/codegenNativeComponent'. Without
    // this, pnpm resolves deep imports from workspace packages to different
    // physical copies of react-native, causing separate module instances
    // (e.g. ReactNativeViewConfigRegistry has separate Maps → register()
    // and get() operate on different instances → invariant violation).
    for (const [pkg] of Object.entries(singletonModules)) {
      if (moduleName === pkg || moduleName.startsWith(pkg + '/')) {
        try {
          // Use require.resolve from the app's projectRoot — this always
          // returns the app's own copy and gives Metro a path it can watch.
          // (fs.realpathSync on the pnpm store path points outside watchFolders.)
          const resolved = require.resolve(moduleName, { paths: [projectRoot] })
          return { filePath: resolved, type: 'sourceFile' }
        } catch { /* let default resolver handle it */ }
      }
    }

    // Pin @react-navigation/native + core (incl. deep imports) to the copies
    // expo-router resolves — single navigation context instance app-wide.
    for (const [pkg, anchorDir] of Object.entries(navSingletonAnchors)) {
      if (moduleName === pkg || moduleName.startsWith(pkg + '/')) {
        try {
          const resolved = require.resolve(moduleName, { paths: [anchorDir] })
          return { filePath: resolved, type: 'sourceFile' }
        } catch { /* let default resolver handle it */ }
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
