module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      // Required for Fabric-only native components (interfaceOnly: true) like
      // react-native-enriched. Transforms codegenNativeComponent() calls into
      // inline JS view configs at bundle time — without this, the runtime
      // fallback tries requireNativeComponent() which fails in Bridgeless mode.
      '@react-native/babel-plugin-codegen',
    ],
  }
}
