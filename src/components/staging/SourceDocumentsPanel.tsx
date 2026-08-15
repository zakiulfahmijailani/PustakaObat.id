import { ArrowUpRight, BookOpenText } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import type { StagingSourceDocument } from '@/lib/staging/types'

function sourceLabel(name: string) {
  if (/medline/i.test(name)) return 'MedlinePlus'
  if (/dailymed/i.test(name)) return 'DailyMed'
  if (/who/i.test(name)) return 'WHO'
  return name
}

export function SourceDocumentsPanel({ sources, title = 'Sources', compact = false }: { sources: StagingSourceDocument[]; title?: string; compact?: boolean }) {
  return <section className="space-y-4">
    <div>
      <h2 className={compact ? 'font-serif text-2xl text-text' : 'font-serif text-3xl text-text'}>{title}</h2>
      <p className="mt-1 text-sm text-text-muted">Dokumen rujukan yang terhubung dengan obat ini. Buka sumber asli untuk memeriksa konteks dan versi terbaru.</p>
    </div>
    {sources.length ? <div className={compact ? 'space-y-3' : 'grid gap-4 md:grid-cols-2'}>
      {sources.map((source) => <Card key={source.source_document_key} className="bg-surface">
        <CardContent className={compact ? 'p-4' : 'p-6'}>
          <div className="flex flex-wrap items-center gap-2">
            <BookOpenText size={18} className="text-primary" />
            <strong>{sourceLabel(source.source_name)}</strong>
            <Badge variant="outline">{source.validation_status.replaceAll('_', ' ')}</Badge>
          </div>
          <p className="mt-2 break-all text-xs text-text-muted">{source.source_document_id || 'ID sumber tidak tersedia'}</p>
          <p className="mt-1 text-xs text-text-muted">{source.usage_scope.replaceAll('_', ' ')}</p>
          {source.source_url && <a href={source.source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm font-bold text-primary">Buka sumber <ArrowUpRight size={16} /></a>}
        </CardContent>
      </Card>)}
    </div> : <div className="rounded-2xl border border-dashed border-border p-5 text-sm text-text-muted">Belum ada dokumen sumber DailyMed, MedlinePlus, WHO, atau sumber lain yang terhubung.</div>}
  </section>
}
