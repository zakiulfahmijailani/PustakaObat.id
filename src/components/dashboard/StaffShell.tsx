import Link from 'next/link'
import type { ElementType, ReactNode } from 'react'
import { ExternalLink, User } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { Badge } from '@/components/ui/Badge'

export interface StaffNavItem {
  title: string
  href: string
  icon: ElementType
}

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
        <nav className="flex-1 space-y-1.5" aria-label={`Navigasi ${workspaceLabel}`}>
          {navItems.map((item) => <Link key={item.href} href={item.href} className="group flex items-center gap-4 rounded-2xl px-5 py-4 text-text-muted transition-all hover:bg-primary/5 hover:text-primary"><item.icon className="h-5 w-5 transition-transform group-hover:scale-110" /><span className="text-[10px] font-bold uppercase tracking-widest">{item.title}</span></Link>)}
        </nav>
        <Link href="/" className="mb-5 flex items-center gap-3 rounded-2xl px-5 py-3 text-xs font-semibold text-text-muted hover:bg-surface hover:text-primary"><ExternalLink size={16} /> Lihat situs publik</Link>
        <div className="border-t border-border pt-6">
          <div className="mb-5 flex items-center gap-4 rounded-3xl border border-border/50 bg-surface p-4"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><User size={20} /></div><div className="min-w-0"><p className="truncate text-xs font-bold text-text">{profile.full_name}</p><p className="text-[10px] font-bold uppercase tracking-widest text-text-muted">{profile.role}</p></div></div>
          <LogoutButton variant="outline" className="h-12 w-full rounded-2xl text-[10px] font-bold uppercase tracking-widest">Keluar sesi</LogoutButton>
        </div>
      </aside>
      <main className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-border bg-white/90 px-5 py-4 backdrop-blur lg:hidden">
          <div className="flex items-center justify-between gap-4"><Logo /><Badge variant={badgeVariant}>{workspaceLabel}</Badge></div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label={`Navigasi mobile ${workspaceLabel}`}>{navItems.map((item) => <Link key={item.href} href={item.href} className="flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-border px-4 text-xs font-semibold text-text-muted"><item.icon size={16} />{item.title}</Link>)}</nav>
        </header>
        <div className="p-6 md:p-10 lg:p-14">{children}</div>
      </main>
    </div>
  )
}
