import Link from 'next/link'
import { BadgeCheck, Search, ShieldPlus, Users } from 'lucide-react'
import { requireActiveProfile } from '@/lib/auth/server'
import { queryNeon } from '@/lib/neon/server'
import { UserTable, type AdminProfileRow } from '@/components/dashboard/UserTable'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ role?: string; q?: string; status?: string }> }) {
  const { profile: currentAdmin } = await requireActiveProfile(['admin'])
  const { role = 'all', q = '', status = 'all' } = await searchParams
  const params: unknown[] = []
  const filters: string[] = []

  if (role !== 'all' && ['reviewer', 'admin'].includes(role)) {
    params.push(role)
    filters.push(`p.role::text = $${params.length}`)
  }
  if (status !== 'all' && ['pending_review', 'needs_revision', 'active', 'rejected', 'suspended'].includes(status)) {
    params.push(status)
    filters.push(`p.account_status = $${params.length}`)
  }
  if (q.trim()) {
    params.push(`%${q.trim()}%`)
    filters.push(`(p.full_name ILIKE $${params.length} OR p.email ILIKE $${params.length} OR p.institution ILIKE $${params.length})`)
  }

  const profiles = await queryNeon<AdminProfileRow>(`
    SELECT
      p.id, p.email, p.full_name, p.role::text AS role, p.account_status,
      p.is_active, p.institution, p.sipa_number, p.professional_license_number,
      p.phone, p.created_at, p.last_login_at,
      application.application_status, application.review_note, application.submitted_at
    FROM public.profiles p
    LEFT JOIN LATERAL (
      SELECT application_status, review_note, submitted_at
      FROM public.reviewer_applications ra
      WHERE ra.profile_id = p.id
      ORDER BY ra.created_at DESC
      LIMIT 1
    ) application ON true
    ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
    ORDER BY
      CASE p.account_status WHEN 'pending_review' THEN 0 WHEN 'needs_revision' THEN 1 ELSE 2 END,
      p.created_at DESC
  `, params)

  const pendingCount = profiles.filter((profile) => profile.account_status === 'pending_review').length
  const roleOptions = [['all', 'Semua'], ['reviewer', 'Reviewer'], ['admin', 'Admin']]
  const statusOptions = [['all', 'Semua status'], ['pending_review', 'Pending'], ['needs_revision', 'Perlu revisi'], ['active', 'Aktif'], ['rejected', 'Ditolak'], ['suspended', 'Ditangguhkan']]
  const hrefFor = (next: { role?: string; status?: string }) => {
    const search = new URLSearchParams({ role: next.role || role, status: next.status || status })
    if (q) search.set('q', q)
    return `/admin/users?${search}`
  }

  return <div className="space-y-10">
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div><Badge variant="destructive" className="mb-4">Admin · Access Control</Badge><h1 className="text-4xl font-serif text-text">Pengguna & pengajuan reviewer</h1><p className="mt-2 text-text-muted">Admin dibuat secara internal; pendaftaran publik hanya untuk Apoteker Reviewer.</p></div>
      <div className="flex items-center gap-4"><div className="text-right"><p className="text-xs uppercase tracking-widest text-text-muted">Menunggu review</p><p className="text-3xl font-bold text-error">{pendingCount}</p></div><BadgeCheck className="text-primary" size={34} /></div>
    </div>

    <Card className="border-none bg-surface-2/40 rounded-3xl"><CardContent className="p-6 space-y-5">
      <form className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} /><input name="q" defaultValue={q} placeholder="Cari nama, email, atau institusi" className="w-full rounded-xl border border-border bg-surface py-3 pl-12 pr-4 outline-none focus:border-primary" /><input type="hidden" name="role" value={role} /><input type="hidden" name="status" value={status} /></form>
      <div className="flex flex-wrap gap-2">{roleOptions.map(([value, label]) => <Link key={value} href={hrefFor({ role: value })} className={`rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider ${role === value ? 'bg-primary text-white border-primary' : 'border-border text-text-muted'}`}>{label}</Link>)}</div>
      <div className="flex flex-wrap gap-2">{statusOptions.map(([value, label]) => <Link key={value} href={hrefFor({ status: value })} className={`rounded-full border px-4 py-2 text-xs font-semibold ${status === value ? 'bg-text text-white border-text' : 'border-border text-text-muted'}`}>{label}</Link>)}</div>
    </CardContent></Card>

    {profiles.length ? <UserTable profiles={profiles} currentUserId={currentAdmin.id} /> : <div className="rounded-3xl border border-dashed border-border p-20 text-center text-text-muted"><Users className="mx-auto mb-5 opacity-30" size={40} />Tidak ada pengguna yang cocok dengan filter.</div>}
    <div className="pt-10 border-t border-border text-center"><ShieldPlus className="mx-auto mb-4 text-primary opacity-30" size={42} /><p className="mx-auto max-w-2xl text-sm text-text-muted">Periksa nomor profesi dan institusi sebelum mengaktifkan reviewer. Setiap keputusan disimpan di audit log.</p></div>
  </div>
}
