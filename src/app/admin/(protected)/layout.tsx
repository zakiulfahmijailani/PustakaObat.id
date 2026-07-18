import { StaffShell, type StaffNavItem } from '@/components/dashboard/StaffShell'
import { requireAdmin } from '@/lib/auth/server'

const navItems: StaffNavItem[] = [
  { title: 'Ringkasan', href: '/admin/dashboard', icon: 'layout-dashboard' },
  { title: 'Data Obat', href: '/admin/medicines', icon: 'file-text' },
  { title: 'Tanya Farmasis', href: '/admin/questions', icon: 'message-square' },
  { title: 'Reviewer & User', href: '/admin/users', icon: 'users' },
  { title: 'Editor', href: '/admin/editors', icon: 'file-pen-line' },
  { title: 'Admin Management', href: '/admin/admins', icon: 'shield-check' },
  { title: 'Import WHO', href: '/admin/imports', icon: 'database' },
  { title: 'Audit Aktivitas', href: '/admin/audit', icon: 'activity' },
  { title: 'Pengaturan', href: '/admin/settings', icon: 'settings' },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireAdmin()
  return <StaffShell profile={profile} navItems={navItems} workspaceLabel="Administration" badgeVariant="destructive">{children}</StaffShell>
}
