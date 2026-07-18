import Link from 'next/link'
import { Logo } from '@/components/layout/Logo'

export function AuthPageShell({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-4 py-16">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
      <div className="pointer-events-none absolute -right-48 -top-48 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />
      <div className="relative z-10 flex w-full max-w-4xl flex-col items-center gap-8">
        <Link href="/" aria-label="Kembali ke beranda PustakaObat.id"><Logo className="scale-110" /></Link>
        {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">{eyebrow}</p>}
        {children}
        <Link href="/" className="text-xs font-semibold uppercase tracking-wider text-text-muted hover:text-primary">Kembali ke beranda</Link>
      </div>
    </div>
  )
}
