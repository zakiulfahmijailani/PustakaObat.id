import { BookOpenText, FilePenLine, LayoutDashboard, RotateCcw } from 'lucide-react'
import { StaffShell, type StaffNavItem } from '@/components/dashboard/StaffShell'
import { requireEditor } from '@/lib/auth/server'

const navItems: StaffNavItem[] = [
  { title: 'Beranda', href: '/editor/dashboard', icon: LayoutDashboard },
  { title: 'Konten Saya', href: '/editor/content', icon: FilePenLine },
  { title: 'Perlu Revisi', href: '/editor/revisions', icon: RotateCcw },
  { title: 'Panduan Gaya', href: '/editor/style-guide', icon: BookOpenText },
]

export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireEditor()
  return <StaffShell profile={profile} navItems={navItems} workspaceLabel="Editor Studio">{children}</StaffShell>
}
