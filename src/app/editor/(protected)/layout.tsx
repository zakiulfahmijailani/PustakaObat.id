import { StaffShell, type StaffNavItem } from '@/components/dashboard/StaffShell'
import { requireEditor } from '@/lib/auth/server'

const navItems: StaffNavItem[] = [
  { title: 'Beranda', href: '/editor/dashboard', icon: 'layout-dashboard' },
  { title: 'Konten Saya', href: '/editor/content', icon: 'file-pen-line' },
  { title: 'Perlu Revisi', href: '/editor/revisions', icon: 'rotate-ccw' },
  { title: 'Diskusi Internal', href: '/editor/discussions', icon: 'message-square' },
  { title: 'Panduan Gaya', href: '/editor/style-guide', icon: 'book-open-text' },
]

export default async function EditorLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireEditor()
  return <StaffShell profile={profile} navItems={navItems} workspaceLabel="Editor Studio">{children}</StaffShell>
}
