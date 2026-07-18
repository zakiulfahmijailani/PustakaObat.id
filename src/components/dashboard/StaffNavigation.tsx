'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { StaffNavItem } from '@/components/dashboard/StaffShell'

function activeFor(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function StaffNavigation({ items, label, mobile = false }: { items: StaffNavItem[]; label: string; mobile?: boolean }) {
  const pathname = usePathname()

  return (
    <nav className={mobile ? 'flex gap-2 overflow-x-auto pb-2' : 'flex-1 space-y-1.5'} aria-label={label}>
      {items.map((item) => {
        const active = activeFor(pathname, item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={mobile
              ? `flex min-h-11 shrink-0 items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors ${active ? 'border-primary bg-primary text-white' : 'border-border bg-surface text-text-muted hover:border-primary hover:text-primary'}`
              : `group flex min-h-12 items-center gap-4 rounded-2xl px-5 py-3 text-sm font-bold transition-colors ${active ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:bg-primary/5 hover:text-primary'}`
            }
          >
            <item.icon className={`h-5 w-5 shrink-0 ${active ? '' : 'transition-transform group-hover:scale-105'}`} aria-hidden="true" />
            <span>{item.title}</span>
          </Link>
        )
      })}
    </nav>
  )
}
