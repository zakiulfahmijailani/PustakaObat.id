import { Fragment, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { parseRichText, type RichTextInline } from '@/lib/editorial/rich-text'

function InlineContent({ content }: { content: RichTextInline[] }) {
  return content.map((part, index) => {
    const key = `${part.type}-${index}`
    if (part.type === 'bold') return <strong key={key}>{part.text}</strong>
    if (part.type === 'italic') return <em key={key}>{part.text}</em>
    if (part.type === 'citation') {
      const safeHref = part.href && (/^https:\/\//.test(part.href) || part.href.startsWith('/')) ? part.href : undefined
      const className = "mx-1 inline-flex rounded-full bg-primary/10 px-2 py-0.5 align-middle text-[0.7rem] font-bold leading-5 text-primary"
      return safeHref
        ? <a key={key} href={safeHref} target={safeHref.startsWith('http') ? '_blank' : undefined} rel={safeHref.startsWith('http') ? 'noreferrer' : undefined} className={className}>[{part.text}]</a>
        : <span key={key} className={className}>[{part.text}]</span>
    }
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

    if (block.type === 'heading') {
      const Tag = block.level === 1 ? 'h2' : 'h3'
      return <Tag key={blockIndex} className={block.level === 1 ? 'font-serif text-2xl font-bold text-text' : 'font-serif text-xl font-semibold text-text'}><InlineContent content={block.content} /></Tag>
    }

    return <p key={blockIndex}>{block.lines.map((line, index) => <span key={index} className="block" style={{ marginInlineStart: `${line.indent * 1.25}rem` }}><InlineContent content={line.content} /></span>)}</p>
  })

  return <div className={cn('space-y-4 break-words leading-relaxed', className)}>{content}</div>
}
