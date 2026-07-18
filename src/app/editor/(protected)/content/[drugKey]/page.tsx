import Link from 'next/link'
import { ArrowLeft, FilePenLine } from 'lucide-react'
import { notFound } from 'next/navigation'
import { EditorialDraftForm } from '@/components/editor/EditorialDraftForm'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { requireEditor } from '@/lib/auth/server'
import { getStagedDrugForEditor } from '@/lib/staging/queries'

export const dynamic = 'force-dynamic'

export default async function EditorContentDetailPage({ params }: { params: Promise<{ drugKey: string }> }) {
  await requireEditor()
  const { drugKey } = await params
  const { concept, drafts, candidates, error } = await getStagedDrugForEditor(drugKey)
  if (error || !concept) notFound()
  const sections = [...new Set([...drafts.map((draft) => draft.section_type), ...candidates.map((candidate) => candidate.section_type)])]
  return <div className="space-y-8"><Link href="/editor/content" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"><ArrowLeft size={17} />Kembali ke konten</Link><section className="rounded-[2.5rem] border border-primary/20 bg-primary/5 p-8 md:p-10"><div className="flex flex-wrap gap-2"><Badge>Ruang Editor</Badge><Badge variant="warning">Belum untuk publik</Badge></div><h1 className="mt-5 font-serif text-5xl text-text">{concept.preferred_name}</h1><p className="mt-3 max-w-3xl text-text-muted">Susun tulisan agar jelas dan mudah dibaca. Reviewer akan memeriksa informasi pada versi yang Anda kirim.</p></section><Card className="border-primary/20"><CardHeader><CardTitle className="flex items-center gap-2"><FilePenLine size={21} />Draf Bahasa Indonesia</CardTitle></CardHeader><CardContent><EditorialDraftForm drugKey={concept.drug_key} availableSections={sections} drafts={drafts} aiCandidates={candidates} /></CardContent></Card></div>
}
