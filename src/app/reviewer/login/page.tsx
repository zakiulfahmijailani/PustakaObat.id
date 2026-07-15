import Link from 'next/link'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { LoginForm } from '@/components/auth/LoginForm'

export const dynamic = 'force-dynamic'

export default function ReviewerLoginPage() {
  return <AuthPageShell eyebrow="Apoteker Reviewer"><LoginForm intent="reviewer_login" /><p className="text-sm text-text-muted">Administrator? <Link href="/admin/login" className="font-semibold text-primary hover:underline">Gunakan akses Admin</Link></p></AuthPageShell>
}
