export type RichTextInline = {
  type: 'text' | 'bold' | 'italic'
  text: string
}

export type RichTextBlock =
  | {
      type: 'heading'
      level: 1 | 2
      content: RichTextInline[]
    }
  | {
      type: 'paragraph'
      lines: Array<{ indent: number; content: RichTextInline[] }>
    }
  | {
      type: 'unordered-list' | 'ordered-list'
      items: Array<{ indent: number; content: RichTextInline[] }>
    }
  | {
      type: 'table'
      headers: RichTextInline[][]
      rows: RichTextInline[][][]
    }

const LIST_LINE = /^(\s*)(?:(-)|(?:([0-9]+)\.))\s+(.+)$/
const HEADING_LINE = /^(#{1,2})\s+(.+)$/

function indentationLevel(whitespace: string) {
  return Math.min(6, Math.floor(whitespace.replaceAll('\t', '  ').length / 2))
}

export function parseInlineFormatting(value: string): RichTextInline[] {
  const result: RichTextInline[] = []
  let cursor = 0

  const appendText = (text: string) => {
    if (!text) return
    const previous = result.at(-1)
    if (previous?.type === 'text') previous.text += text
    else result.push({ type: 'text', text })
  }

  while (cursor < value.length) {
    if (value.startsWith('**', cursor)) {
      const end = value.indexOf('**', cursor + 2)
      if (end > cursor + 2) {
        result.push({ type: 'bold', text: value.slice(cursor + 2, end) })
        cursor = end + 2
        continue
      }
    }

    if (value[cursor] === '*') {
      const end = value.indexOf('*', cursor + 1)
      if (end > cursor + 1) {
        result.push({ type: 'italic', text: value.slice(cursor + 1, end) })
        cursor = end + 1
        continue
      }
    }

    appendText(value[cursor])
    cursor += 1
  }

  return result
}

function splitTableRow(line: string) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((cell) => cell.trim())
}

function isTableStart(lines: string[], index: number) {
  if (index + 1 >= lines.length || !lines[index].includes('|')) return false
  const separators = splitTableRow(lines[index + 1])
  return separators.length > 0 && separators.every((cell) => /^:?-{3,}:?$/.test(cell))
}

export function parseRichText(value: string): RichTextBlock[] {
  const lines = value.replace(/\r\n?/g, '\n').split('\n')
  const blocks: RichTextBlock[] = []
  let index = 0

  while (index < lines.length) {
    if (!lines[index].trim()) {
      index += 1
      continue
    }

    const heading = lines[index].match(HEADING_LINE)
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2, content: parseInlineFormatting(heading[2]) })
      index += 1
      continue
    }

    if (isTableStart(lines, index)) {
      const headers = splitTableRow(lines[index]).map(parseInlineFormatting)
      const rows: RichTextInline[][][] = []
      index += 2
      while (index < lines.length && lines[index].includes('|') && lines[index].trim()) {
        rows.push(splitTableRow(lines[index]).map(parseInlineFormatting))
        index += 1
      }
      blocks.push({ type: 'table', headers, rows })
      continue
    }

    const firstListItem = lines[index].match(LIST_LINE)
    if (firstListItem) {
      const type = firstListItem[2] ? 'unordered-list' : 'ordered-list'
      const items: Array<{ indent: number; content: RichTextInline[] }> = []
      while (index < lines.length) {
        const item = lines[index].match(LIST_LINE)
        if (!item || (item[2] ? 'unordered-list' : 'ordered-list') !== type) break
        items.push({ indent: indentationLevel(item[1]), content: parseInlineFormatting(item[4]) })
        index += 1
      }
      blocks.push({ type, items })
      continue
    }

    const paragraphLines: Array<{ indent: number; content: RichTextInline[] }> = []
    while (index < lines.length && lines[index].trim() && !lines[index].match(LIST_LINE) && !isTableStart(lines, index)) {
      const match = lines[index].match(/^(\s*)(.*)$/)!
      paragraphLines.push({ indent: indentationLevel(match[1]), content: parseInlineFormatting(match[2]) })
      index += 1
    }
    blocks.push({ type: 'paragraph', lines: paragraphLines })
  }

  return blocks
}

export interface TextSelection {
  value: string
  selectionStart: number
  selectionEnd: number
}

export type TextEditResult = TextSelection

export function wrapSelection(selection: TextSelection, prefix: string, suffix: string, placeholder: string): TextEditResult {
  const selected = selection.value.slice(selection.selectionStart, selection.selectionEnd)
  const content = selected || placeholder
  const replacement = `${prefix}${content}${suffix}`
  return {
    value: selection.value.slice(0, selection.selectionStart) + replacement + selection.value.slice(selection.selectionEnd),
    selectionStart: selection.selectionStart + prefix.length,
    selectionEnd: selection.selectionStart + prefix.length + content.length,
  }
}

function selectedLineRange(selection: TextSelection) {
  const start = selection.value.lastIndexOf('\n', Math.max(0, selection.selectionStart - 1)) + 1
  const followingBreak = selection.value.indexOf('\n', selection.selectionEnd)
  const end = followingBreak === -1 ? selection.value.length : followingBreak
  return { start, end }
}

function replaceSelectedLines(selection: TextSelection, transform: (lines: string[]) => string[]) {
  const { start, end } = selectedLineRange(selection)
  const replacement = transform(selection.value.slice(start, end).split('\n')).join('\n')
  return {
    value: selection.value.slice(0, start) + replacement + selection.value.slice(end),
    selectionStart: start,
    selectionEnd: start + replacement.length,
  }
}

function splitIndent(line: string) {
  const match = line.match(/^(\s*)(.*)$/)!
  return { indent: match[1], content: match[2].replace(/^(?:[-+*]\s+|[0-9]+\.\s+)/, '') }
}

export function makeBulletList(selection: TextSelection): TextEditResult {
  return replaceSelectedLines(selection, (lines) => lines.map((line) => {
    if (!line.trim()) return '- Item daftar'
    const { indent, content } = splitIndent(line)
    return `${indent}- ${content}`
  }))
}

export function makeNumberedList(selection: TextSelection): TextEditResult {
  return replaceSelectedLines(selection, (lines) => lines.map((line, index) => {
    if (!line.trim()) return `${index + 1}. Item daftar`
    const { indent, content } = splitIndent(line)
    return `${indent}${index + 1}. ${content}`
  }))
}

export function indentLines(selection: TextSelection): TextEditResult {
  return replaceSelectedLines(selection, (lines) => lines.map((line) => line.trim() ? `  ${line}` : line))
}

export function outdentLines(selection: TextSelection): TextEditResult {
  return replaceSelectedLines(selection, (lines) => lines.map((line) => line.startsWith('\t') ? line.slice(1) : line.replace(/^ {1,2}/, '')))
}

export function setTextStyle(selection: TextSelection, style: 'title' | 'subtitle' | 'text'): TextEditResult {
  const prefix = style === 'title' ? '# ' : style === 'subtitle' ? '## ' : ''
  return replaceSelectedLines(selection, (lines) => lines.map((line) => {
    const match = line.match(/^(\s*)#{1,2}\s+(.*)$/)
    const plainLine = line.match(/^(\s*)(.*)$/)!
    const indent = match?.[1] || plainLine[1]
    const content = match?.[2] || plainLine[2]
    return content ? `${indent}${prefix}${content}` : line
  }))
}

export function insertTable(selection: TextSelection): TextEditResult {
  const template = '| Kolom 1 | Kolom 2 |\n| --- | --- |\n| Isi | Isi |'
  const needsLeadingBreak = selection.selectionStart > 0 && selection.value[selection.selectionStart - 1] !== '\n'
  const needsTrailingBreak = selection.selectionEnd < selection.value.length && selection.value[selection.selectionEnd] !== '\n'
  const replacement = `${needsLeadingBreak ? '\n\n' : ''}${template}${needsTrailingBreak ? '\n\n' : ''}`
  const value = selection.value.slice(0, selection.selectionStart) + replacement + selection.value.slice(selection.selectionEnd)
  const firstCell = selection.selectionStart + (needsLeadingBreak ? 2 : 0) + 2
  return { value, selectionStart: firstCell, selectionEnd: firstCell + 'Kolom 1'.length }
}
