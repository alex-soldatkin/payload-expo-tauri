// ---------------------------------------------------------------------------
// Lazy converter imports
// ---------------------------------------------------------------------------

export let lexicalToHtml: (value: unknown) => string = () => ''
export let htmlToLexical: (html: string) => unknown = () => ({
  root: { type: 'root', children: [], direction: 'ltr', format: '', indent: 0, version: 1 },
})
/** Wrap editor HTML in the <html>...</html> envelope react-native-enriched requires. */
export let wrapEditorHtml: (html: string) => string = (html) => (html ? `<html>\n${html}\n</html>` : '')

try {
  const mod = require('../../utils/lexicalToHtml')
  lexicalToHtml = mod.lexicalToHtml ?? mod.default ?? lexicalToHtml
  wrapEditorHtml = mod.wrapEditorHtml ?? wrapEditorHtml
} catch { /* converter not available yet */ }

try {
  const mod = require('../../utils/htmlToLexical')
  htmlToLexical = mod.htmlToLexical ?? mod.default ?? htmlToLexical
} catch { /* converter not available yet */ }
