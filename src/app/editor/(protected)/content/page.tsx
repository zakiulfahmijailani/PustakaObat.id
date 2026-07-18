import { FilePenLine } from 'lucide-react'
import { EditorContentQueue } from '@/components/editor/EditorContentQueue'
import { requireEditor } from '@/lib/auth/server'
import type { StagingFilters } from '@/lib/staging/queries'

export const dynamic = 'force-dynamic'

export default async function EditorContentPage({ searchParams }: { searchParams: Promise<StagingFilters> }) {
  await requireEditor()
  return <div className="space-y-8"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Konten Saya</p><h1 className="mt-2 flex items-center gap-3 font-serif text-4xl text-text"><FilePenLine size={32} />Susun monografi</h1><p className="mt-2 max-w-2xl text-text-muted">Pilih konten, kemudian rapikan susunan dan bahasa draf sebelum dikirim ke Reviewer.</p></div><EditorContentQueue filters={await searchParams} /></div>
}
