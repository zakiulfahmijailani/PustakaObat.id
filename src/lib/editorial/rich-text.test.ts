import { describe, expect, it } from 'vitest'
import {
  indentLines,
  citeSelectedLines,
  insertTable,
  makeBulletList,
  makeNumberedList,
  outdentLines,
  parseRichText,
  setTextStyle,
  wrapSelection,
} from './rich-text'

describe('editorial rich text', () => {
  it('parses safe inline formatting, lists, indentation, and tables', () => {
    const blocks = parseRichText('Teks **tebal** dan *miring*.\n\n- Satu\n  - Dua\n\n| Obat | Dosis |\n| --- | --- |\n| A | 5 mg |')
    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toMatchObject({ type: 'paragraph' })
    expect(blocks[1]).toMatchObject({ type: 'unordered-list', items: [{ indent: 0 }, { indent: 1 }] })
    expect(blocks[2]).toMatchObject({ type: 'table', rows: [[expect.any(Array), expect.any(Array)]] })
  })

  it('wraps the selected text without losing the selection', () => {
    expect(wrapSelection({ value: 'Dosis obat', selectionStart: 0, selectionEnd: 5 }, '**', '**', 'teks')).toEqual({
      value: '**Dosis** obat', selectionStart: 2, selectionEnd: 7,
    })
  })

  it('creates and indents lists', () => {
    const selection = { value: 'Satu\nDua', selectionStart: 0, selectionEnd: 8 }
    expect(makeBulletList(selection).value).toBe('- Satu\n- Dua')
    expect(makeNumberedList(selection).value).toBe('1. Satu\n2. Dua')
    expect(outdentLines(indentLines(selection)).value).toBe(selection.value)
  })

  it('inserts a complete editable table template', () => {
    const result = insertTable({ value: 'Pengantar', selectionStart: 9, selectionEnd: 9 })
    expect(result.value).toContain('| Kolom 1 | Kolom 2 |')
    expect(result.value).toContain('| --- | --- |')
  })

  it('parses and applies title, subtitle, and text styles', () => {
    const blocks = parseRichText('# Judul\n## Subjudul\nTeks biasa')
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 })
    expect(blocks[1]).toMatchObject({ type: 'heading', level: 2 })
    expect(setTextStyle({ value: 'Paragraf', selectionStart: 0, selectionEnd: 8 }, 'title').value).toBe('# Paragraf')
    expect(setTextStyle({ value: '# Judul', selectionStart: 0, selectionEnd: 6 }, 'text').value).toBe('Judul')
  })

  it('attaches a source citation to the selected paragraph', () => {
    const result = citeSelectedLines({ value: 'Dosis diberikan setiap hari.', selectionStart: 0, selectionEnd: 5 }, 'FDA · dosage', 'https://open.fda.gov')
    expect(result.value).toContain('[[cite:FDA%20%C2%B7%20dosage|https%3A%2F%2Fopen.fda.gov]]')
    expect(parseRichText(result.value)[0]).toMatchObject({ type: 'paragraph' })
  })
})
