import Link from 'next/link'
import { FilePenLine, MessageSquareText, Send, Sparkles } from 'lucide-react'
import { requireEditor } from '@/lib/auth/server'
import { queryNeon } from '@/lib/neon/server'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface EditorCounts { drafts: number; submitted: number; revisions: number }

export const dynamic = 'force-dynamic'

export default async function EditorDashboardPage() {
  const { profile } = await requireEditor()
  const rows = await queryNeon<EditorCounts>(`select
    count(*) filter (where status = 'draft')::int as drafts,
    count(*) filter (where status = 'submitted')::int as submitted,
    count(*) filter (where status = 'changes_requested')::int as revisions
    from public.monograph_editorial_drafts where authored_by = $1`, [profile.id])
  const counts = rows[0] || { drafts: 0, submitted: 0, revisions: 0 }
  const stats = [{ title: 'Draf aktif', value: counts.drafts, icon: FilePenLine }, { title: 'Menunggu review', value: counts.submitted, icon: Send }, { title: 'Perlu revisi', value: counts.revisions, icon: MessageSquareText }]
  return <div className="space-y-10"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Editor Studio</p><h1 className="mt-2 text-4xl font-serif text-text">Halo, {profile.full_name}</h1><p className="mt-2 max-w-2xl text-text-muted">Rapikan susunan tulisan dan bahasa agar Reviewer dapat fokus menilai ketepatan informasi.</p></div><div className="grid gap-5 md:grid-cols-3">{stats.map((stat) => <Card key={stat.title} className="border-none bg-surface-2/50"><CardContent className="flex items-center gap-5 p-7"><div className="rounded-2xl bg-primary/10 p-4 text-primary"><stat.icon size={24} /></div><div><p className="text-xs font-bold uppercase tracking-wider text-text-muted">{stat.title}</p><p className="mt-1 text-3xl font-bold text-text">{stat.value}</p></div></CardContent></Card>)}</div><div className="grid gap-5 md:grid-cols-2"><Card className="border-none bg-primary/5"><CardContent className="p-8"><FilePenLine className="mb-5 text-primary" size={32} /><h2 className="font-serif text-2xl text-text">Mulai menyusun draf</h2><p className="mb-6 mt-2 text-sm leading-relaxed text-text-muted">Pilih monografi, susun bagian tulisan, lalu kirimkan versi rapi untuk ditinjau Reviewer.</p><Button asChild><Link href="/editor/content">Buka konten</Link></Button></CardContent></Card><Card className="border-none bg-surface-2/50"><CardContent className="p-8"><Sparkles className="mb-5 text-primary" size={32} /><h2 className="font-serif text-2xl text-text">Prinsip ruang Editor</h2><p className="mt-2 text-sm leading-relaxed text-text-muted">Editor mengatur struktur dan bahasa. Tidak ada tombol persetujuan klinis atau publikasi di ruang ini.</p><Button variant="outline" className="mt-6" asChild><Link href="/editor/style-guide">Baca panduan gaya</Link></Button></CardContent></Card></div></div>
}
