import { Activity, Database, FileText, LayoutDashboard, MessageSquare, Settings, Users } from 'lucide-react'
import { StaffShell, type StaffNavItem } from '@/components/dashboard/StaffShell'
import { requireAdmin } from '@/lib/auth/server'

const navItems: StaffNavItem[] = [
  { title: 'Ringkasan', href: '/admin/dashboard', icon: LayoutDashboard },
  { title: 'Data Obat', href: '/admin/medicines', icon: FileText },
  { title: 'Tanya Farmasis', href: '/admin/questions', icon: MessageSquare },
  { title: 'Reviewer & User', href: '/admin/users', icon: Users },
  { title: 'Import WHO', href: '/admin/imports', icon: Database },
  { title: 'Audit Aktivitas', href: '/admin/audit', icon: Activity },
  { title: 'Pengaturan', href: '/admin/settings', icon: Settings },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin()
  return <StaffShell profile={profile} navItems={navItems} workspaceLabel="Administration" badgeVariant="destructive">{children}</StaffShell>
}
