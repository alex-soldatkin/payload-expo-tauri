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

// Modules that must resolve to the app's own copy (never hoisted/duplicated).
// expo-router joined this list on SDK 56: it VENDORS react-navigation
// (expo-router/react-navigation), so its navigation context lives inside the
// package — pnpm peer-hashing gives workspace packages (e.g.
// @payload-universal/ui's Link) a second physical expo-router@56.x copy,
// and a second copy means a second context → "Couldn't find a navigation
// object" crashes. Pinning to the app's copy keeps one instance app-wide.
const singletonModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  'expo-router': path.resolve(projectRoot, 'node_modules/expo-router'),
}

// Resolve the real path for @expo/ui (pnpm uses symlinks)
const expoUIReal = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/@expo/ui')
)

// SDK 56 NOTE: the former @react-navigation/native+core singleton pins are
// GONE — expo-router 56 no longer depends on @react-navigation/*; it vendors
// react-navigation internally (import from 'expo-router/react-navigation'),
// so a single navigation-context instance is guaranteed by construction.

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

    // Pin ALL @expo/ui imports (including subpaths like @expo/ui/swift-ui)
    // to the app's copy (stable 56.x since the SDK 56 migration; the canary
    // is gone and the workspace converges on one VERSION now). STILL
    // REQUIRED: pnpm peer-hashing materializes @expo/ui 56.x as multiple
    // physical copies (the app's vs the one linked into
    // @payload-universal/admin-native's node_modules), and Metro's
    // hierarchical resolution would load a second module instance for
    // imports inside admin-native source files without this pin.
    if (moduleName === '@expo/ui' || moduleName.startsWith('@expo/ui/')) {
      const pkg = require(path.join(expoUIReal, 'package.json'))
      const exportKey = moduleName === '@expo/ui'
        ? '.'
        : './' + moduleName.slice('@expo/ui/'.length)
      const exportEntry = pkg.exports?.[exportKey]
      if (exportEntry) {
        const entryFile = typeof exportEntry === 'string'
          ? exportEntry
          : exportEntry.default || exportEntry.import || Object.values(exportEntry)[0]
        const resolved = path.resolve(expoUIReal, entryFile)
        if (fs.existsSync(resolved)) {
          return { filePath: resolved, type: 'sourceFile' }
        }
      }
    }

    return context.resolveRequest(context, moduleName, platform)
  },
}

module.exports = withNativeWind(config, { input: './global.css' })
