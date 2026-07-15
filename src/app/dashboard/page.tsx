import Link from 'next/link'
import { BookOpenCheck, CheckCircle2, Clock3, Database, Users } from 'lucide-react'
import { requireActiveProfile } from '@/lib/auth/server'
import { queryNeon } from '@/lib/neon/server'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface DashboardCounts {
  pending_medicines: number
  verified_medicines: number
  pending_reviewers: number
}

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { profile } = await requireActiveProfile()
  const rows = await queryNeon<DashboardCounts>(`
    SELECT
      (SELECT count(*)::int FROM public.who_medicines WHERE verification_status = 'pending' AND is_active = true) AS pending_medicines,
      (SELECT count(*)::int FROM public.who_medicines WHERE verification_status = 'verified' AND is_active = true) AS verified_medicines,
      (SELECT count(*)::int FROM public.profiles WHERE role::text = 'reviewer' AND account_status = 'pending_review') AS pending_reviewers
  `)
  const counts = rows[0] || { pending_medicines: 0, verified_medicines: 0, pending_reviewers: 0 }
  const stats = [
    { title: 'WHO menunggu review', value: counts.pending_medicines, icon: Clock3 },
    { title: 'WHO terverifikasi', value: counts.verified_medicines, icon: CheckCircle2 },
    ...(profile.role === 'admin' ? [{ title: 'Pengajuan reviewer', value: counts.pending_reviewers, icon: Users }] : []),
  ]

  return <div className="space-y-10">
    <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">{profile.role === 'admin' ? 'Administrator' : 'Apoteker Reviewer'}</p><h1 className="mt-2 text-4xl font-serif text-text">Halo, {profile.full_name}</h1><p className="mt-2 text-text-muted">Kelola verifikasi data dengan jejak keputusan yang dapat diaudit.</p></div>
    <div className={`grid gap-6 ${stats.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>{stats.map((stat) => <Card key={stat.title} className="border-none bg-surface-2/50"><CardContent className="flex items-center gap-5 p-7"><div className="rounded-2xl bg-primary/10 p-4 text-primary"><stat.icon size={25} /></div><div><p className="text-xs font-bold uppercase tracking-wider text-text-muted">{stat.title}</p><p className="mt-1 text-3xl font-bold text-text">{stat.value}</p></div></CardContent></Card>)}</div>
    <div className="grid gap-6 md:grid-cols-2"><Card className="border-none bg-primary/5"><CardContent className="p-8"><BookOpenCheck className="mb-5 text-primary" size={30} /><h2 className="text-2xl font-serif text-text">Review katalog WHO</h2><p className="mt-2 mb-6 text-sm text-text-muted">Verifikasi representasi data sumber WHO tanpa mengubah klaim sumber atau menganggapnya sebagai status BPOM.</p><Button asChild><Link href="/dashboard/who">Buka antrean review</Link></Button></CardContent></Card>{profile.role === 'admin' && <Card className="border-none bg-surface-2/50"><CardContent className="p-8"><Database className="mb-5 text-primary" size={30} /><h2 className="text-2xl font-serif text-text">Administrasi platform</h2><p className="mt-2 mb-6 text-sm text-text-muted">Periksa pengajuan reviewer, kelola status akun, dan pantau audit.</p><Button variant="outline" asChild><Link href="/dashboard/admin/users">Kelola pengguna</Link></Button></CardContent></Card>}</div>
  </div>
}
