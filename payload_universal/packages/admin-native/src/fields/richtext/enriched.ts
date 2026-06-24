// ---------------------------------------------------------------------------
// Optional EnrichedTextInput — try/catch for graceful fallback
// ---------------------------------------------------------------------------

export let EnrichedTextInput: any = null

export let enrichedAvailable = false
try {
  // react-native-enriched uses codegenNativeComponent('EnrichedTextInputView',
  // { interfaceOnly: true }). Two problems prevent it from working out of the box:
  //
  // 1. The Codegen Babel plugin (@react-native/babel-plugin-codegen) should
  //    transform this into an inline JS view config at bundle time, but it
  //    crashed on RN 0.83 + @babel/traverse 7.29 (SDK 55 canary era).
  //
  // 2. The fallback codegenNativeComponent function calls requireNativeComponent
  //    → getNativeComponentAttributes → UIManager.getViewManagerConfig. In
  //    Bridgeless mode, getViewManagerConfig returns null for interfaceOnly
  //    components (no Paper ViewManager). The lazy view config callback then
  //    returns null → invariant violation at render time.
  //
  // Fix: patch UIManager.getViewManagerConfig to return a valid config for
  // EnrichedTextInputView. Metro's singleton resolver (metro.config.js) ensures
  // all react-native/* imports resolve to one copy, so this patch is seen by
  // both the registration and the renderer.
  //
  // RN 0.85 / SDK 56 (2026-06-12): kept intentionally. Even if the babel
  // codegen crash (#1) is fixed in 0.85, the Bridgeless null-view-config
  // fallback (#2) is a runtime path that only an on-device repro can rule
  // out. The patch is additive (only intercepts EnrichedTextInputView) and
  // harmless when the codegen transform works. Re-test removal on a new
  // SDK 56 dev build before deleting.
  const { UIManager } = require('react-native')
  const origGetConfig = UIManager.getViewManagerConfig
  if (origGetConfig) {
    UIManager.getViewManagerConfig = (name: string) => {
      if (name === 'EnrichedTextInputView') {
        return {
          Commands: {
            focus: 0, blur: 1, setValue: 2, setSelection: 3,
            toggleBold: 4, toggleItalic: 5, toggleUnderline: 6,
            toggleStrikeThrough: 7, toggleInlineCode: 8,
            toggleH1: 9, toggleH2: 10, toggleH3: 11, toggleH4: 12,
            toggleH5: 13, toggleH6: 14, toggleCodeBlock: 15,
            toggleBlockQuote: 16, toggleOrderedList: 17,
            toggleUnorderedList: 18, toggleCheckboxList: 19,
            addLink: 20, removeLink: 21, addImage: 22,
            startMention: 23, addMention: 24, requestHTML: 25,
          },
          NativeProps: {
            autoFocus: 'boolean', editable: 'boolean', defaultValue: 'string',
            placeholder: 'string', placeholderTextColor: 'Color',
            mentionIndicators: 'Array', cursorColor: 'Color',
            selectionColor: 'Color', autoCapitalize: 'string',
            htmlStyle: 'Map', scrollEnabled: 'boolean', linkRegex: 'Map',
            contextMenuItems: 'Array', returnKeyType: 'string',
            returnKeyLabel: 'string', submitBehavior: 'string',
            color: 'Color', fontSize: 'float', lineHeight: 'float',
            fontFamily: 'string', fontWeight: 'string', fontStyle: 'string',
            isOnChangeHtmlSet: 'boolean', isOnChangeTextSet: 'boolean',
            androidExperimentalSynchronousEvents: 'boolean',
            useHtmlNormalizer: 'boolean',
          },
        }
      }
      return origGetConfig.call(UIManager, name)
    }
  }

  const enrichedModule = require('react-native-enriched')
  EnrichedTextInput = enrichedModule.EnrichedTextInput
  enrichedAvailable = !!EnrichedTextInput
} catch (e) {
  console.log('[richtext] react-native-enriched not available:', String(e).slice(0, 120))
}
