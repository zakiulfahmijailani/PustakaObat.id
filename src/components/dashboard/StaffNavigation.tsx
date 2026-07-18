'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Activity,
  BookOpenCheck,
  BookOpenText,
  Database,
  FilePenLine,
  FileText,
  FlaskConical,
  History,
  LayoutDashboard,
  MessageSquare,
  RotateCcw,
  Settings,
  ShieldCheck,
  UserRound,
  Users,
} from 'lucide-react'
import type { StaffNavItem } from '@/components/dashboard/StaffShell'

const iconComponents = {
  activity: Activity,
  'book-open-check': BookOpenCheck,
  'book-open-text': BookOpenText,
  database: Database,
  'file-pen-line': FilePenLine,
  'file-text': FileText,
  'flask-conical': FlaskConical,
  history: History,
  'layout-dashboard': LayoutDashboard,
  'message-square': MessageSquare,
  'rotate-ccw': RotateCcw,
  settings: Settings,
  'shield-check': ShieldCheck,
  'user-round': UserRound,
  users: Users,
} as const

function activeFor(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function StaffNavigation({ items, label, mobile = false }: { items: StaffNavItem[]; label: string; mobile?: boolean }) {
  const pathname = usePathname()

  return (
    <nav className={mobile ? 'flex gap-2 overflow-x-auto pb-2' : 'flex-1 space-y-1.5'} aria-label={label}>
      {items.map((item) => {
        const active = activeFor(pathname, item.href)
        const Icon = iconComponents[item.icon]
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
            <Icon className={`h-5 w-5 shrink-0 ${active ? '' : 'transition-transform group-hover:scale-105'}`} aria-hidden="true" />
            <span>{item.title}</span>
          </Link>
        )
      })}
    </nav>
  )
}
