import Link from 'next/link'
import { Clock3, History } from 'lucide-react'
import { requireReviewer } from '@/lib/auth/server'
import { queryNeon } from '@/lib/neon/server'
import { Badge } from '@/components/ui/Badge'

interface ReviewHistoryRow { id: string; medicine_id: string; medicine_name: string; editorial_name: string | null; status: string; note: string | null; created_at: string }

export const dynamic = 'force-dynamic'

export default async function ReviewerHistoryPage() {
  const { profile } = await requireReviewer()
  const history = await queryNeon<ReviewHistoryRow>(`
    SELECT v.id, v.medicine_id, m.medicine_name, m.editorial_name, v.status, v.note, v.created_at
    FROM public.who_medicine_verifications v
    JOIN public.who_medicines m ON m.id = v.medicine_id
    WHERE v.verified_by = $1
    ORDER BY v.created_at DESC
    LIMIT 100
  `, [profile.id])

  return <div className="space-y-8"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Aktivitas pribadi</p><h1 className="mt-2 text-4xl font-serif text-text">Riwayat review saya</h1><p className="mt-2 text-text-muted">100 keputusan verifikasi terbaru yang Anda simpan.</p></div>
    {history.length ? <div className="space-y-4">{history.map((item) => <Link key={item.id} href={`/reviewer/medicines/${item.medicine_id}`} className="flex flex-col justify-between gap-4 rounded-3xl border border-border bg-surface p-6 transition-colors hover:border-primary/30 md:flex-row md:items-center"><div><h2 className="text-xl font-serif text-text">{item.editorial_name || item.medicine_name}</h2><p className="mt-2 text-sm text-text-muted">{item.note || 'Tidak ada catatan.'}</p></div><div className="flex items-center gap-3"><Badge variant={item.status === 'verified' ? 'success' : item.status === 'rejected' ? 'destructive' : 'warning'}>{item.status.replace('_', ' ')}</Badge><span className="flex items-center gap-1 text-xs text-text-muted"><Clock3 size={14} />{new Date(item.created_at).toLocaleString('id-ID')}</span></div></Link>)}</div> : <div className="rounded-3xl border border-dashed border-border p-16 text-center text-text-muted"><History className="mx-auto mb-4 opacity-30" size={38} />Belum ada keputusan review dari akun ini.</div>}
  </div>
}
