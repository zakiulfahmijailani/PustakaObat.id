import { FilePenLine } from 'lucide-react'
import { EditorManagement, type ManagedEditorRow } from '@/components/dashboard/EditorManagement'
import { Badge } from '@/components/ui/Badge'
import { requireAdmin } from '@/lib/auth/server'
import { queryNeon } from '@/lib/neon/server'

export const dynamic = 'force-dynamic'

export default async function AdminEditorsPage() {
  await requireAdmin()
  const editors = await queryNeon<ManagedEditorRow>(`select id, email, full_name, account_status, is_active, auth_user_id, auth_provider, last_login_at from public.profiles where role::text = 'editor' order by is_active desc, full_name, email`)
  return <div className="space-y-8"><div><Badge variant="destructive" className="mb-4"><FilePenLine className="mr-1" size={13} />Admin only</Badge><h1 className="font-serif text-4xl text-text">Manajemen Editor</h1><p className="mt-2 max-w-3xl text-text-muted">Tetapkan akses Editor untuk menyusun dan merapikan draf monografi sebelum masuk ke pemeriksaan Reviewer.</p></div><EditorManagement editors={editors} /></div>
}
