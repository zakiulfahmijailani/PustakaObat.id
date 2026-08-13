'use client'

import { useRef } from 'react'
import { Bold, IndentDecrease, IndentIncrease, Italic, List, ListOrdered, Table2 } from 'lucide-react'
import { RichTextContent } from '@/components/editor/RichTextContent'
import { Textarea } from '@/components/ui/Textarea'
import {
  indentLines,
  insertTable,
  makeBulletList,
  makeNumberedList,
  outdentLines,
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

export function RichTextEditor({ label, value, onChange, disabled = false, helperText, className }: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function applyEdit(edit: (selection: TextSelection) => TextEditResult) {
    const textarea = textareaRef.current
    if (!textarea || disabled) return
    const result = edit({ value, selectionStart: textarea.selectionStart, selectionEnd: textarea.selectionEnd })
    onChange(result.value)
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd)
    })
  }

  return <div className="space-y-3">
    <div className="space-y-1.5">
      <p className="text-sm font-medium leading-none text-text">{label}</p>
      <div className="flex flex-wrap gap-1 rounded-2xl border border-border bg-surface-2/60 p-2" role="toolbar" aria-label={`Pemformatan ${label}`}>
        {tools.map((tool) => {
          const Icon = tool.icon
          return <button key={tool.label} type="button" disabled={disabled} onMouseDown={(event) => event.preventDefault()} onClick={() => applyEdit(tool.apply)} title={tool.label} aria-label={tool.label} className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-xs font-semibold text-text transition-colors hover:bg-surface hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-40">
            <Icon size={16} aria-hidden="true" />
            <span>{tool.label}</span>
          </button>
        })}
      </div>
    </div>
    <Textarea ref={textareaRef} aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled} className={className} helperText={helperText} />
    {value.trim() && <div className="rounded-2xl border border-border bg-surface p-4">
      <p className="mb-3 text-xs font-bold uppercase tracking-wider text-text-muted">Pratinjau format</p>
      <RichTextContent value={value} className="text-sm text-text" />
    </div>}
  </div>
}
