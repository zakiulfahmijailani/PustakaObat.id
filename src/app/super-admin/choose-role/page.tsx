import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { SuperAdminWorkspaceChooser } from '@/components/auth/SuperAdminWorkspaceChooser'
import { requireSuperAdmin } from '@/lib/auth/server'

export const dynamic = 'force-dynamic'

export default async function SuperAdminChooseRolePage() {
  const { profile } = await requireSuperAdmin()
  return <AuthPageShell eyebrow="Super Admin PustakaObat.id"><div className="w-full text-center"><h1 className="text-4xl font-serif text-text">Pilih ruang kerja Anda</h1><p className="mx-auto mt-3 max-w-2xl text-text-muted">Halo, {profile.full_name}. Pilihan ini mengatur batas tindakan untuk sesi Anda saat ini.</p></div><SuperAdminWorkspaceChooser /></AuthPageShell>
}
