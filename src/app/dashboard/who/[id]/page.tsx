import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, Clock3 } from 'lucide-react'
import { requireActiveProfile } from '@/lib/auth/server'
import { WHO_REVIEW_ROLES } from '@/lib/auth/permissions'
import { getWhoMedicineForStaff } from '@/lib/who/queries'
import { WhoReviewActions } from '@/components/dashboard/WhoReviewActions'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'

export const dynamic = 'force-dynamic'

export default async function WhoReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireActiveProfile(WHO_REVIEW_ROLES)
  const { id } = await params
  const { medicine, history } = await getWhoMedicineForStaff(id)
  if (!medicine) notFound()

  return (
    <div className="space-y-8">
      <Link href="/dashboard/who" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"><ArrowLeft size={17} /> Kembali ke antrean</Link>
      <div className="grid gap-8 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="rounded-3xl"><CardContent className="space-y-6 p-8">
            <div className="flex flex-wrap gap-2"><Badge>WHO</Badge><Badge variant="outline">{medicine.data_status}</Badge>{medicine.aware_category && <Badge variant="warning">AWaRe · {medicine.aware_category}</Badge>}</div>
            <h1 className="text-5xl font-serif text-text">{medicine.editorial_name || medicine.medicine_name}</h1>
            <dl className="grid gap-5 md:grid-cols-2">
              <div><dt className="text-xs font-bold uppercase tracking-widest text-text-muted">WHO eEML</dt><dd className="mt-1 text-text">{medicine.is_who_eeml ? 'Listed' : medicine.is_not_on_eml ? 'Not listed' : 'Unknown'}</dd></div>
              <div><dt className="text-xs font-bold uppercase tracking-widest text-text-muted">Status review</dt><dd className="mt-1 text-text">{medicine.verification_status}</dd></div>
            </dl>
            {medicine.official_source_url && <a href={medicine.official_source_url} target="_blank" rel="noreferrer" className="inline-flex min-h-11 items-center gap-2 font-bold text-primary">Periksa sumber resmi WHO <ArrowUpRight size={17} /></a>}
          </CardContent></Card>
          <WhoReviewActions medicineId={medicine.id} />
        </div>
        <aside className="space-y-4"><h2 className="font-serif text-2xl text-text">Riwayat verifikasi</h2>{history.length ? history.map((item) => <div key={item.id} className="rounded-2xl border border-border bg-surface p-5"><div className="flex items-center justify-between"><Badge>{item.status.replace('_', ' ')}</Badge><Clock3 size={16} className="text-text-muted" /></div><p className="mt-3 text-sm text-text-muted">{item.note || 'Tidak ada catatan.'}</p><p className="mt-3 text-xs text-text-muted">{new Date(item.created_at).toLocaleString('id-ID')} · Reviewer {item.verified_by.slice(0, 8)}</p></div>) : <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-text-muted">Belum ada riwayat.</p>}</aside>
      </div>
    </div>
  )
}
