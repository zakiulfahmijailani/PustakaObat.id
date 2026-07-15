import React from 'react'
import Link from 'next/link'
import { 
  LayoutDashboard, 
  Pill, 
  MessageSquare, 
  Users, 
  History, 
  BookOpenCheck,
  Database,
  LogOut,
  User,
  Settings,
  Bell,
  Search,
  Menu
} from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/Button'
import { requireActiveProfile } from '@/lib/auth/server'

interface NavItem {
  title: string
  href: string
  icon: React.ElementType
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { profile } = await requireActiveProfile()

  const reviewerNav: NavItem[] = [
    { title: 'Overview', href: '/dashboard', icon: LayoutDashboard },
    { title: 'Review Data WHO', href: '/dashboard/who', icon: BookOpenCheck },
  ]

  const adminNav: NavItem[] = [
    { title: 'Kelola Monografi', href: '/dashboard/obat', icon: Pill },
    { title: 'Tanya Farmasis', href: '/dashboard/tanya', icon: MessageSquare },
    { title: 'User Management', href: '/dashboard/admin/users', icon: Users },
    { title: 'Audit Logs', href: '/dashboard/admin/audit', icon: History },
    { title: 'Kelola Data WHO', href: '/dashboard/admin/who', icon: Database },
    { title: 'System Settings', href: '/dashboard/admin/settings', icon: Settings },
  ]

  const navItems = profile.role === 'admin' ? [...reviewerNav, ...adminNav] : reviewerNav

  return (
    <div className="min-h-screen bg-surface flex">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-80 bg-surface-2 border-r border-border flex-col p-8 sticky top-0 h-screen transition-all duration-500">
        <div className="mb-10">
          <Logo />
        </div>
        
        <nav className="flex-1 space-y-1.5">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-4 px-5 py-4 rounded-2xl text-text-muted hover:text-primary hover:bg-primary/5 transition-all group"
            >
              <item.icon className="w-5 h-5 group-hover:scale-110 transition-transform" />
              <span className="font-bold uppercase tracking-widest text-[10px]">{item.title}</span>
            </Link>
          ))}
        </nav>

        <div className="pt-8 border-t border-border mt-8">
          <div className="flex items-center gap-4 p-4 rounded-3xl bg-surface mb-6 border border-border/50">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
              <User size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-text truncate">{profile.full_name}</p>
              <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">{profile.role}</p>
            </div>
          </div>
          <form action="/api/auth/logout" method="post">
            <Button type="submit" variant="outline" className="w-full rounded-2xl h-12 gap-3 border-border hover:bg-error/5 hover:text-error hover:border-error/20 transition-all font-bold uppercase tracking-widest text-[10px]"><LogOut size={16} />Keluar Sesi</Button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header - Mobile & Shared */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-border px-6 md:px-10 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4 lg:hidden">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Menu size={24} />
            </Button>
            <Logo />
          </div>

          <div className="hidden md:flex items-center relative group max-w-lg flex-1 mr-10">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-text-muted group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Cari obat, pertanyaan, atau log..." 
              className="w-full pl-12 pr-4 py-3 rounded-2xl bg-surface-2 border border-border focus:outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all text-sm font-medium"
            />
          </div>

          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-xl relative text-text-muted hover:text-primary">
              <Bell size={22} />
              <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-white" />
            </Button>
            <div className="w-10 h-10 rounded-2xl bg-surface-2 border border-border flex lg:hidden items-center justify-center text-primary">
              <User size={20} />
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="p-6 md:p-10 lg:p-14 overflow-y-auto max-h-[calc(100vh-80px)] custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  )
}

