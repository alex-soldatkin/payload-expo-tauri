// ---------------------------------------------------------------------------
// Plain-text extraction (when react-native-enriched is not installed)
// ---------------------------------------------------------------------------

export const richTextToPlain = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'string') {
    const trimmed = value.trim()
    // JSON-stringified Lexical state → recurse into the parsed object
    if (trimmed.startsWith('{')) {
      try {
        return richTextToPlain(JSON.parse(trimmed))
      } catch { /* fall through */ }
    }
    // HTML string → strip tags for plain-text editing
    if (trimmed.startsWith('<')) {
      return trimmed
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(?:p|h[1-6]|li|blockquote|div|tr)>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }
    return value
  }
  if (typeof value === 'object' && 'root' in (value as Record<string, unknown>)) {
    const extract = (node: unknown): string => {
      if (node == null) return ''
      if (typeof node === 'string') return node
      const n = node as Record<string, unknown>
      if (typeof n.text === 'string') return n.text
      if (Array.isArray(n.children)) return n.children.map(extract).join('\n')
      return ''
    }
    return extract((value as Record<string, unknown>).root)
  }
  if (Array.isArray(value)) {
    const extract = (node: unknown): string => {
      if (node == null) return ''
      const n = node as Record<string, unknown>
      if (typeof n.text === 'string') return n.text
      if (Array.isArray(n.children)) return n.children.map(extract).join('')
      return ''
    }
    return value.map(extract).join('\n')
  }
  return JSON.stringify(value, null, 2)
}
