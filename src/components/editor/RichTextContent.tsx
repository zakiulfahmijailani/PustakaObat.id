import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { parseRichText, type RichTextInline } from '@/lib/editorial/rich-text'

function InlineContent({ content }: { content: RichTextInline[] }) {
  return content.map((part, index) => {
    const key = `${part.type}-${index}`
    if (part.type === 'bold') return <strong key={key}>{part.text}</strong>
    if (part.type === 'italic') return <em key={key}>{part.text}</em>
    return <Fragment key={key}>{part.text}</Fragment>
  })
}

export function RichTextContent({ value, className }: { value: string; className?: string }) {
  const blocks = parseRichText(value)
  const content: ReactNode[] = blocks.map((block, blockIndex) => {
    if (block.type === 'table') {
      return <div key={blockIndex} className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-surface-2"><tr>{block.headers.map((cell, index) => <th key={index} className="border-b border-border px-4 py-3 font-bold text-text"><InlineContent content={cell} /></th>)}</tr></thead>
          <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b border-border last:border-0">{block.headers.map((_, cellIndex) => <td key={cellIndex} className="px-4 py-3 align-top"><InlineContent content={row[cellIndex] || []} /></td>)}</tr>)}</tbody>
        </table>
      </div>
    }

    if ('items' in block) {
      const Tag = block.type === 'unordered-list' ? 'ul' : 'ol'
      return <Tag key={blockIndex} className={cn('space-y-1 pl-6', block.type === 'unordered-list' ? 'list-disc' : 'list-decimal')}>
        {block.items.map((item, index) => <li key={index} style={{ marginInlineStart: `${item.indent * 1.25}rem` }}><InlineContent content={item.content} /></li>)}
      </Tag>
    }

    return <p key={blockIndex}>{block.lines.map((line, index) => <span key={index} className="block" style={{ marginInlineStart: `${line.indent * 1.25}rem` }}><InlineContent content={line.content} /></span>)}</p>
  })

  return <div className={cn('space-y-4 break-words leading-relaxed', className)}>{content}</div>
}
