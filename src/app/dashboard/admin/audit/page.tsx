import Link from 'next/link'
import { Activity, Clock, Database, Search } from 'lucide-react'
import { requireActiveProfile } from '@/lib/auth/server'
import { queryNeon } from '@/lib/neon/server'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface AuditRow {
  id: string
  action: string
  resource_type: string
  resource_id: string | null
  metadata: Record<string, unknown> | null
  ip_address: string | null
  created_at: string
  full_name: string | null
  role: string | null
}

export const dynamic = 'force-dynamic'

export default async function AdminAuditPage({ searchParams }: { searchParams: Promise<{ action?: string; q?: string }> }) {
  await requireActiveProfile(['admin'])
  const { action = 'all', q = '' } = await searchParams
  const parameters: unknown[] = []
  const conditions: string[] = []
  if (action !== 'all') { parameters.push(action); conditions.push(`a.action = $${parameters.length}`) }
  if (q.trim()) { parameters.push(`%${q.trim()}%`); conditions.push(`(a.action ILIKE $${parameters.length} OR a.resource_type ILIKE $${parameters.length} OR p.full_name ILIKE $${parameters.length})`) }

  const logs = await queryNeon<AuditRow>(`
    SELECT a.id, a.action, a.resource_type, a.resource_id, a.metadata, a.ip_address,
      a.created_at, p.full_name, p.role::text AS role
    FROM public.audit_logs a
    LEFT JOIN public.profiles p ON p.id = a.user_id
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY a.created_at DESC
    LIMIT 100
  `, parameters)

  const actions = ['all', 'LOGIN', 'REGISTER_REVIEWER', 'REVIEWER_ACCOUNT_APPROVE', 'REVIEWER_ACCOUNT_REJECT', 'REVIEWER_ACCOUNT_NEEDS_REVISION', 'REVIEW_WHO_MEDICINE', 'UPDATE_WHO_MEDICINE', 'BOOTSTRAP_ADMIN']
  const actionHref = (value: string) => `/dashboard/admin/audit?action=${encodeURIComponent(value)}${q ? `&q=${encodeURIComponent(q)}` : ''}`

  return <div className="space-y-10">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6"><div><Badge variant="destructive" className="mb-4">Security & Compliance</Badge><h1 className="text-4xl font-serif text-text">Audit aktivitas Neon</h1><p className="mt-2 text-text-muted">Login, keputusan akun, dan perubahan data penting dicatat di server.</p></div><Database className="text-primary opacity-30" size={38} /></div>
    <Card className="border-none bg-surface-2/40"><CardContent className="space-y-5 p-6"><form className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} /><input name="q" defaultValue={q} placeholder="Cari aksi, resource, atau pengguna" className="w-full rounded-xl border border-border bg-surface py-3 pl-12 pr-4 outline-none focus:border-primary" /><input type="hidden" name="action" value={action} /></form><div className="flex gap-2 overflow-x-auto">{actions.map((value) => <Link key={value} href={actionHref(value)} className={`whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold ${action === value ? 'border-primary bg-primary text-white' : 'border-border text-text-muted'}`}>{value === 'all' ? 'Semua' : value.replaceAll('_', ' ')}</Link>)}</div></CardContent></Card>
    <div className="space-y-4">{logs.length ? logs.map((log) => <Card key={log.id} className="border-none bg-surface-2/40"><CardContent className="flex flex-col md:flex-row md:items-start justify-between gap-5 p-6"><div className="flex gap-4"><div className="rounded-2xl bg-primary/10 p-3 text-primary"><Activity size={20} /></div><div><div className="flex flex-wrap gap-2"><Badge>{log.action}</Badge><span className="text-xs text-text-muted">{new Date(log.created_at).toLocaleString('id-ID')}</span></div><p className="mt-2 text-sm text-text">{log.full_name || 'System'} · {log.resource_type}</p>{log.metadata && <pre className="mt-3 max-w-3xl overflow-x-auto rounded-xl border border-border bg-surface p-3 text-xs text-text-muted">{JSON.stringify(log.metadata, null, 2)}</pre>}</div></div><span className="text-xs text-text-muted">{log.ip_address || 'server'}</span></CardContent></Card>) : <div className="rounded-3xl border border-dashed border-border p-20 text-center text-text-muted"><Clock className="mx-auto mb-4 opacity-30" size={36} />Belum ada audit log pada filter ini.</div>}</div>
  </div>
}
