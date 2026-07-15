import { BookOpenCheck, History, LayoutDashboard, UserRound } from 'lucide-react'
import { StaffShell, type StaffNavItem } from '@/components/dashboard/StaffShell'
import { requireReviewer } from '@/lib/auth/server'

const navItems: StaffNavItem[] = [
  { title: 'Ringkasan', href: '/reviewer/dashboard', icon: LayoutDashboard },
  { title: 'Antrean WHO', href: '/reviewer/medicines', icon: BookOpenCheck },
  { title: 'Riwayat Saya', href: '/reviewer/history', icon: History },
  { title: 'Profil Profesi', href: '/reviewer/profile', icon: UserRound },
]

export default async function ReviewerLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireReviewer()
  return <StaffShell profile={profile} navItems={navItems} workspaceLabel="Apoteker Reviewer">{children}</StaffShell>
}
