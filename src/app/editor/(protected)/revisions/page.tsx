import Link from 'next/link'
import { MessageSquareText, RotateCcw } from 'lucide-react'
import { requireEditor } from '@/lib/auth/server'
import { queryNeon } from '@/lib/neon/server'
import { Badge } from '@/components/ui/Badge'

interface RevisionRow { drug_key: string; preferred_name: string; section_type: string; reviewer_note: string | null; updated_at: string }
export const dynamic = 'force-dynamic'

export default async function EditorRevisionsPage() {
  const { profile } = await requireEditor()
  const rows = await queryNeon<RevisionRow>(`select d.drug_key, s.preferred_name, d.section_type, d.reviewer_note, d.updated_at from public.monograph_editorial_drafts d join public.monograph_staging_drugs s on s.drug_key = d.drug_key where d.authored_by = $1 and d.status = 'changes_requested' order by d.updated_at desc`, [profile.id])
  return <div className="space-y-8"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Tindak lanjut</p><h1 className="mt-2 font-serif text-4xl text-text">Perlu revisi</h1><p className="mt-2 text-text-muted">Perbaiki susunan dan bahasa berdasarkan catatan Reviewer, lalu kirim kembali.</p></div>{rows.length ? <div className="space-y-4">{rows.map((row) => <Link key={`${row.drug_key}-${row.section_type}`} href={`/editor/content/${row.drug_key}`} className="block rounded-3xl border border-border bg-surface p-6 transition-colors hover:border-primary/30"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><div className="flex gap-2"><Badge variant="warning"><RotateCcw className="mr-1" size={13} />Perlu revisi</Badge><Badge variant="outline">{row.section_type.replaceAll('_', ' ')}</Badge></div><h2 className="mt-3 font-serif text-2xl text-text">{row.preferred_name}</h2><p className="mt-2 text-sm leading-relaxed text-text-muted">{row.reviewer_note || 'Reviewer meminta perbaikan pada bagian ini.'}</p></div><span className="text-xs text-text-muted">{new Date(row.updated_at).toLocaleDateString('id-ID')}</span></div></Link>)}</div> : <div className="rounded-3xl border border-dashed border-border p-14 text-center text-text-muted"><MessageSquareText className="mx-auto mb-4 opacity-30" size={38} />Belum ada draf yang perlu direvisi.</div>}</div>
}
