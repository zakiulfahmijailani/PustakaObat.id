'use client'

import { useEffect, useRef, useState } from 'react'
import { Bold, BookMarked, IndentDecrease, IndentIncrease, Italic, List, ListOrdered, Table2, Undo2 } from 'lucide-react'
import { RichTextContent } from '@/components/editor/RichTextContent'
import { Textarea } from '@/components/ui/Textarea'
import {
  indentLines,
  citeSelectedLines,
  insertTable,
  makeBulletList,
  makeNumberedList,
  outdentLines,
  setTextStyle,
  wrapSelection,
  type TextEditResult,
  type TextSelection,
} from '@/lib/editorial/rich-text'

interface RichTextEditorProps {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  helperText?: string
  className?: string
  citationSources?: Array<{ id: string; label: string; href?: string }>
}

const tools = [
  { label: 'Tebal', icon: Bold, apply: (selection: TextSelection) => wrapSelection(selection, '**', '**', 'teks tebal') },
  { label: 'Miring', icon: Italic, apply: (selection: TextSelection) => wrapSelection(selection, '*', '*', 'teks miring') },
  { label: 'Bullet', icon: List, apply: makeBulletList },
  { label: 'Nomor', icon: ListOrdered, apply: makeNumberedList },
  { label: 'Tambah inden', icon: IndentIncrease, apply: indentLines },
  { label: 'Kurangi inden', icon: IndentDecrease, apply: outdentLines },
  { label: 'Tabel', icon: Table2, apply: insertTable },
]

export function RichTextEditor({ label, value, onChange, disabled = false, helperText, className, citationSources = [] }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastValueRef = useRef(value)
  const historyRef = useRef<Array<{ value: string; selectionStart: number; selectionEnd: number }>>([])
  const [canUndo, setCanUndo] = useState(false)
  const [citationSourceId, setCitationSourceId] = useState(citationSources[0]?.id || '')

  useEffect(() => {
    if (!citationSources.some((source) => source.id === citationSourceId)) setCitationSourceId(citationSources[0]?.id || '')
  }, [citationSourceId, citationSources])

  useEffect(() => {
    if (value !== lastValueRef.current) {
      lastValueRef.current = value
      historyRef.current = []
      setCanUndo(false)
    }
  }, [value])

  function rememberCurrentValue() {
    const textarea = textareaRef.current
    if (!textarea) return
    historyRef.current = [...historyRef.current.slice(-99), {
      value,
      selectionStart: textarea.selectionStart,
      selectionEnd: textarea.selectionEnd,
    }]
    setCanUndo(true)
  }

  function applyEdit(edit: (selection: TextSelection) => TextEditResult) {
    const textarea = textareaRef.current
    if (!textarea || disabled) return
    rememberCurrentValue()
    const result = edit({ value, selectionStart: textarea.selectionStart, selectionEnd: textarea.selectionEnd })
    lastValueRef.current = result.value
    onChange(result.value)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  function undo() {
    const textarea = textareaRef.current
    const previous = historyRef.current.pop()
    if (!textarea || !previous || disabled) return
    lastValueRef.current = previous.value
    onChange(previous.value)
    setCanUndo(historyRef.current.length > 0)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(previous.selectionStart, previous.selectionEnd)
    })
  }

  function handleChange(nextValue: string) {
    if (nextValue === value) return
    rememberCurrentValue()
    lastValueRef.current = nextValue
    onChange(nextValue)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey) {
      event.preventDefault()
      undo()
    }
  }

  function applyTextStyle(style: 'title' | 'subtitle' | 'text') {
    applyEdit((selection) => setTextStyle(selection, style))
  }

  function addCitation() {
    const source = citationSources.find((item) => item.id === citationSourceId)
    if (!source) return
    applyEdit((selection) => citeSelectedLines(selection, source.label, source.href))
  }

  return <div className="space-y-3">
    <div className="space-y-1.5">
      <p className="text-sm font-medium leading-none text-text">{label}</p>
      <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-surface-2/60 p-2" role="toolbar" aria-label={`Pemformatan ${label}`}>
        <button type="button" disabled={disabled || !canUndo} onMouseDown={(event) => event.preventDefault()} onClick={undo} title="Undo" aria-label="Undo" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-text transition-colors hover:bg-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40">
          <Undo2 size={16} aria-hidden="true" />
          <span>Undo</span>
        </button>
        <label className="sr-only" htmlFor={`${label}-text-style`}>Gaya teks</label>
        <select id={`${label}-text-style`} defaultValue="text" disabled={disabled} onChange={(event) => applyTextStyle(event.target.value as 'title' | 'subtitle' | 'text')} title="Gaya teks" aria-label="Gaya teks" className="min-h-10 rounded-xl border border-border bg-surface px-3 text-xs font-semibold text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40">
          <option value="title">Judul</option>
          <option value="subtitle">Subjudul</option>
          <option value="text">Teks</option>
        </select>
        {tools.map((tool) => {
          const Icon = tool.icon
          return <button key={tool.label} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => applyEdit(tool.apply)} title={tool.label} aria-label={tool.label} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-text transition-colors hover:bg-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40">
            <Icon size={16} aria-hidden="true" />
            <span>{tool.label}</span>
          </button>
        })}
        {citationSources.length > 0 && <div className="flex min-h-10 items-stretch gap-1 rounded-xl border border-border bg-surface p-1">
          <label className="sr-only" htmlFor={`${label}-citation-source`}>Sumber sitasi</label>
          <select id={`${label}-citation-source`} value={citationSourceId} disabled={disabled} onChange={(event) => setCitationSourceId(event.target.value)} className="max-w-52 bg-transparent px-2 text-xs font-semibold text-text outline-none disabled:opacity-40">
            {citationSources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
          </select>
          <button type="button" disabled={disabled || !citationSourceId} onMouseDown={(event) => event.preventDefault()} onClick={addCitation} className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 text-xs font-bold text-white disabled:opacity-40" title="Kaitkan baris yang dipilih dengan sumber"><BookMarked size={15} />Tambah sitasi</button>
        </div>}
      </div>
    </div>
    <Textarea ref={textareaRef} aria-label={label} value={value} onChange={(event) => handleChange(event.target.value)} onKeyDown={handleKeyDown} disabled={disabled} className={className} helperText={helperText} />
    {value.trim() && <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">Pratinjau format</p>
      <RichTextContent value={value} className="text-sm text-text" />
    </div>}
  </div>
}
