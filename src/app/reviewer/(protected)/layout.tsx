import { StaffShell, type StaffNavItem } from '@/components/dashboard/StaffShell'
import { requireReviewer } from '@/lib/auth/server'

const navItems: StaffNavItem[] = [
  { title: 'Ringkasan', href: '/reviewer/dashboard', icon: 'layout-dashboard' },
  { title: 'Antrean WHO', href: '/reviewer/medicines', icon: 'book-open-check' },
  { title: 'Monografi Staging', href: '/reviewer/staging', icon: 'flask-conical' },
  { title: 'Diskusi Internal', href: '/reviewer/discussions', icon: 'message-square' },
  { title: 'Riwayat Saya', href: '/reviewer/history', icon: 'history' },
  { title: 'Profil Profesi', href: '/reviewer/profile', icon: 'user-round' },
]

export default async function ReviewerLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireReviewer()
  return <StaffShell profile={profile} navItems={navItems} workspaceLabel="Apoteker Reviewer">{children}</StaffShell>
}
