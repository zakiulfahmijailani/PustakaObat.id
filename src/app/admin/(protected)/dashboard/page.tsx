import Link from 'next/link'
import { Activity, BookOpenCheck, Database, FileText, ShieldCheck, Users } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/server'
import { queryNeon } from '@/lib/neon/server'
import { Card, CardContent } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

interface AdminCounts { medicines: number; pending_medicines: number; pending_reviewers: number; active_reviewers: number; ready_sections: number }

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  const { profile } = await requireAdmin()
  const rows = await queryNeon<AdminCounts>(`SELECT
    (SELECT count(*)::int FROM public.who_medicines WHERE is_active = true) AS medicines,
    (SELECT count(*)::int FROM public.who_medicines WHERE verification_status = 'pending' AND is_active = true) AS pending_medicines,
    (SELECT count(*)::int FROM public.profiles WHERE role::text = 'reviewer' AND account_status = 'pending_review') AS pending_reviewers,
    (SELECT count(*)::int FROM public.profiles WHERE role::text = 'reviewer' AND account_status = 'active') AS active_reviewers,
    (SELECT count(*)::int
      FROM public.monograph_editorial_drafts d
      LEFT JOIN public.monograph_publication_sections ps ON ps.editorial_draft_id = d.id
      WHERE d.status = 'pharmacist_approved' AND ps.id IS NULL) AS ready_sections`)
  const counts = rows[0] || { medicines: 0, pending_medicines: 0, pending_reviewers: 0, active_reviewers: 0, ready_sections: 0 }
  const stats = [
    { title: 'Data WHO aktif', value: counts.medicines, icon: Database },
    { title: 'Menunggu verifikasi', value: counts.pending_medicines, icon: FileText },
    { title: 'Pengajuan reviewer', value: counts.pending_reviewers, icon: Users },
    { title: 'Reviewer aktif', value: counts.active_reviewers, icon: Activity },
    { title: 'Bagian siap terbit', value: counts.ready_sections, icon: BookOpenCheck },
  ]
  return <div className="space-y-10"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-error">Administrator</p><h1 className="mt-2 text-4xl font-serif text-text">Halo, {profile.full_name}</h1><p className="mt-2 text-text-muted">Pantau data, akses pengguna, import, dan aktivitas sistem dari ruang Admin.</p></div><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">{stats.map((stat) => <Card key={stat.title} className="border-none bg-surface-2/50"><CardContent className="p-6"><stat.icon className="mb-5 text-primary" size={25} /><p className="text-xs font-bold uppercase tracking-wider text-text-muted">{stat.title}</p><p className="mt-1 text-3xl font-bold text-text">{stat.value}</p></CardContent></Card>)}</div><div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"><Card className="border-none bg-success/5"><CardContent className="p-8"><BookOpenCheck className="mb-5 text-success" size={30} /><h2 className="text-2xl font-serif text-text">Monografi siap terbit</h2><p className="mb-6 mt-2 text-sm text-text-muted">Terbitkan bagian monografi yang sudah disetujui Reviewer.</p><Button asChild><Link href="/admin/publication-queue">Buka antrean</Link></Button></CardContent></Card><Card className="border-none bg-primary/5"><CardContent className="p-8"><Users className="mb-5 text-primary" size={30} /><h2 className="text-2xl font-serif text-text">Pengajuan Reviewer</h2><p className="mb-6 mt-2 text-sm text-text-muted">Periksa identitas profesi sebelum mengaktifkan akses Reviewer.</p><Button asChild><Link href="/admin/reviewers">Buka pengajuan</Link></Button></CardContent></Card><Card className="border-none bg-error/5"><CardContent className="p-8"><ShieldCheck className="mb-5 text-error" size={30} /><h2 className="text-2xl font-serif text-text">Admin Management</h2><p className="mb-6 mt-2 text-sm text-text-muted">Praotorisasi email Google Admin dan pantau status penautannya.</p><Button variant="outline" asChild><Link href="/admin/admins">Kelola Admin</Link></Button></CardContent></Card><Card className="border-none bg-surface-2/50"><CardContent className="p-8"><Database className="mb-5 text-primary" size={30} /><h2 className="text-2xl font-serif text-text">Import dan provenance</h2><p className="mb-6 mt-2 text-sm text-text-muted">Pantau batch WHO tanpa melakukan write produksi dari browser.</p><Button variant="outline" asChild><Link href="/admin/imports">Lihat import</Link></Button></CardContent></Card></div></div>
}
