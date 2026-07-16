import { ShieldCheck } from 'lucide-react'
import { requireAdmin } from '@/lib/auth/server'
import { queryNeon } from '@/lib/neon/server'
import { AdminManagement, type ManagedAdminRow } from '@/components/dashboard/AdminManagement'
import { Badge } from '@/components/ui/Badge'

export const dynamic = 'force-dynamic'

export default async function AdminManagementPage() {
  const { profile } = await requireAdmin()
  const admins = await queryNeon<ManagedAdminRow>(`
    SELECT
      p.id,
      p.email,
      p.full_name,
      p.account_status,
      p.is_active,
      p.auth_user_id,
      p.auth_provider,
      p.auth_linked_at,
      p.last_login_at,
      p.created_at,
      u.email AS google_email,
      u."emailVerified" AS google_email_verified
    FROM public.profiles p
    LEFT JOIN public.users u ON u.id = p.auth_user_id
    WHERE p.role::text = 'admin'
    ORDER BY p.is_active DESC, p.full_name, p.email
  `)

  return <div className="space-y-8">
    <div>
      <Badge variant="destructive" className="mb-4"><ShieldCheck size={13} className="mr-1" />Admin only</Badge>
      <h1 className="text-4xl font-serif text-text">Admin Management</h1>
      <p className="mt-2 max-w-3xl text-text-muted">Praotorisasi email Google untuk Admin baru dan pantau apakah identitas Google sudah tertaut. Tidak perlu membuka Neon SQL Editor.</p>
    </div>
    <AdminManagement admins={admins} currentAdminId={profile.id} />
  </div>
}
