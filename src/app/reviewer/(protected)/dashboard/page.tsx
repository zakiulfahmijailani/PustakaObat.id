import Link from 'next/link'
import { BookOpenCheck, CheckCircle2, Clock3, History } from 'lucide-react'
import { requireReviewer } from '@/lib/auth/server'
import { queryNeon } from '@/lib/neon/server'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface ReviewerCounts { pending_medicines: number; my_reviews: number; my_needs_revision: number }

export const dynamic = 'force-dynamic'

export default async function ReviewerDashboardPage() {
  const { profile } = await requireReviewer()
  const rows = await queryNeon<ReviewerCounts>(`
    SELECT
      (SELECT count(*)::int FROM public.who_medicines WHERE verification_status = 'pending' AND is_active = true) AS pending_medicines,
      (SELECT count(*)::int FROM public.who_medicine_verifications WHERE verified_by = $1) AS my_reviews,
      (SELECT count(*)::int FROM public.who_medicine_verifications WHERE verified_by = $1 AND status = 'needs_revision') AS my_needs_revision
  `, [profile.id])
  const counts = rows[0] || { pending_medicines: 0, my_reviews: 0, my_needs_revision: 0 }
  const stats = [
    { title: 'Menunggu review', value: counts.pending_medicines, icon: Clock3 },
    { title: 'Review saya', value: counts.my_reviews, icon: CheckCircle2 },
    { title: 'Perlu revisi', value: counts.my_needs_revision, icon: History },
  ]

  return <div className="space-y-10">
    <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Apoteker Reviewer</p><h1 className="mt-2 text-4xl font-serif text-text">Halo, {profile.full_name}</h1><p className="mt-2 text-text-muted">Fokuskan ruang kerja ini pada verifikasi data dan jejak keputusan profesional Anda.</p></div>
    <div className="grid gap-5 md:grid-cols-3">{stats.map((stat) => <Card key={stat.title} className="border-none bg-surface-2/50"><CardContent className="flex items-center gap-5 p-7"><div className="rounded-2xl bg-primary/10 p-4 text-primary"><stat.icon size={24} /></div><div><p className="text-xs font-bold uppercase tracking-wider text-text-muted">{stat.title}</p><p className="mt-1 text-3xl font-bold text-text">{stat.value}</p></div></CardContent></Card>)}</div>
    <Card className="border-none bg-primary/5"><CardContent className="p-8"><BookOpenCheck className="mb-5 text-primary" size={32} /><h2 className="text-2xl font-serif text-text">Antrean verifikasi WHO</h2><p className="mb-6 mt-2 max-w-2xl text-sm leading-relaxed text-text-muted">Periksa representasi data sumber WHO. Keputusan Reviewer tidak mengubah klaim WHO dan tidak menyatakan status registrasi BPOM.</p><Button asChild><Link href="/reviewer/medicines">Mulai review</Link></Button></CardContent></Card>
  </div>
}
