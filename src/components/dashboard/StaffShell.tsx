import Link from 'next/link'
import type { ReactNode } from 'react'
import { ExternalLink, Repeat2, User } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { Badge } from '@/components/ui/Badge'
import { StaffNavigation } from '@/components/dashboard/StaffNavigation'

export interface StaffNavItem {
  title: string
  href: string
  icon: StaffNavIcon
}

export type StaffNavIcon =
  | 'activity'
  | 'book-open-check'
  | 'book-open-text'
  | 'database'
  | 'file-pen-line'
  | 'file-text'
  | 'flask-conical'
  | 'history'
  | 'layout-dashboard'
  | 'message-square'
  | 'rotate-ccw'
  | 'settings'
  | 'shield-check'
  | 'user-round'
  | 'users'

export function StaffShell({
  children,
  profile,
  navItems,
  workspaceLabel,
  badgeVariant = 'default',
}: {
  children: ReactNode
  profile: { full_name: string; role: string }
  navItems: StaffNavItem[]
  workspaceLabel: string
  badgeVariant?: 'default' | 'destructive'
}) {
  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="sticky top-0 hidden h-screen w-80 flex-col border-r border-border bg-surface-2 p-8 lg:flex">
        <div className="mb-3"><Logo /></div>
        <Badge variant={badgeVariant} className="mb-9 w-fit">{workspaceLabel}</Badge>
        <StaffNavigation items={navItems} label={`Navigasi ${workspaceLabel}`} />
        <Link href="/" className="mb-5 flex items-center gap-3 rounded-2xl px-5 py-3 text-xs font-semibold text-text-muted hover:bg-surface hover:text-primary"><ExternalLink size={16} /> Lihat situs publik</Link>
        {profile.role === 'super_admin' && <Link href="/super-admin/choose-role" className="mb-5 flex items-center gap-3 rounded-2xl px-5 py-3 text-xs font-semibold text-text-muted hover:bg-surface hover:text-primary"><Repeat2 size={16} /> Ganti ruang kerja</Link>}
        <div className="border-t border-border pt-6">
          <div className="mb-5 flex items-center gap-4 rounded-3xl border border-border/50 bg-surface p-4"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary"><User size={20} /></div><div className="min-w-0"><p className="truncate text-sm font-bold text-text">{profile.full_name}</p><p className="text-xs font-bold uppercase tracking-wide text-text-muted">{profile.role}</p></div></div>
          <LogoutButton variant="outline" className="h-12 w-full rounded-2xl text-xs font-bold uppercase tracking-wide">Keluar sesi</LogoutButton>
        </div>
      </aside>
      <main id="main-content" tabIndex={-1} className="min-w-0 flex-1 outline-none">
        <header className="sticky top-0 z-30 border-b border-border bg-white/90 px-5 py-4 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-4"><Logo /><Badge variant={badgeVariant}>{workspaceLabel}</Badge></div>
          <div className="mt-4"><StaffNavigation items={navItems} label={`Navigasi mobile ${workspaceLabel}`} mobile /></div>
        </header>
        <div className="p-6 md:p-10 lg:p-14">{children}</div>
      </main>
    </div>
  )
}
