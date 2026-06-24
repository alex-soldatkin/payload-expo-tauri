import type { TableNode } from '../TableEditor'

/** Matches the EnrichedTextInputInstance ref from react-native-enriched */
export type EditorRef = {
  focus: () => void
  blur: () => void
  getHTML: () => Promise<string>
  setValue: (value: string) => void
  setSelection: (start: number, end: number) => void
  toggleBold: () => void
  toggleItalic: () => void
  toggleUnderline: () => void
  toggleStrikeThrough: () => void
  toggleInlineCode: () => void
  toggleH1: () => void
  toggleH2: () => void
  toggleH3: () => void
  toggleBlockQuote: () => void
  toggleCodeBlock: () => void
  toggleOrderedList: () => void
  toggleUnorderedList: () => void
  toggleCheckboxList: (checked: boolean) => void
  setLink: (start: number, end: number, text: string, url: string) => void
  removeLink: (start: number, end: number) => void
  startMention: (indicator: string) => void
  setMention: (indicator: string, text: string, attributes?: Record<string, string>) => void
  setImage: (src: string, width: number, height: number) => void
}

// EnrichedTextInput can't render <table>. We extract tables from the Lexical
// tree and render them as separate TableEditor components.
export type ContentBlock =
  | { type: 'text'; nodes: any[] }
  | { type: 'table'; index: number; node: TableNode }

export interface PreparedContent {
  blocks: ContentBlock[]
  tables: TableNode[]
  /** Editor HTML for the non-table content (NOT yet <html>-wrapped). */
  html: string
}
