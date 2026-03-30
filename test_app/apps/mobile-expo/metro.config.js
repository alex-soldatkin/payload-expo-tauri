const { getDefaultConfig } = require('expo/metro-config')
const { withNativeWind } = require('nativewind/metro')
const path = require('path')

const projectRoot = __dirname
const workspaceRoot = path.resolve(projectRoot, '../..')
const monoRoot = path.resolve(workspaceRoot, '..')

const config = getDefaultConfig(projectRoot)

// Watch both the test_app workspace and the payload_universal packages
config.watchFolders = [workspaceRoot, path.resolve(monoRoot, 'payload_universal/packages')]

// The single copies of react, react-native, and @expo/ui that everything must use.
// @expo/ui must resolve to the canary version matching the native binary — the
// workspace may also contain a stable version (55.0.6) with incompatible native views.
const singletonModules = {
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-native': path.resolve(projectRoot, 'node_modules/react-native'),
  '@expo/ui': path.resolve(projectRoot, 'node_modules/@expo/ui'),
}

config.resolver = {
  ...config.resolver,
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
  ],
  extraNodeModules: {
    ...singletonModules,
    'react-freeze': path.resolve(projectRoot, 'node_modules/react-freeze'),
  },
  // Force react and react-native to always resolve to the Expo app's copy,
  // no matter where the import originates from.
  resolveRequest: (context, moduleName, platform) => {
    if (singletonModules[moduleName]) {
      return {
        filePath: require.resolve(moduleName, { paths: [projectRoot] }),
        type: 'sourceFile',
      }
    }
    return context.resolveRequest(context, moduleName, platform)
  },
}

module.exports = withNativeWind(config, { input: './global.css' })
