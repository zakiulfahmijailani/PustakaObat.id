import Link from 'next/link'
import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { LoginForm } from '@/components/auth/LoginForm'

export const dynamic = 'force-dynamic'

export default function EditorLoginPage() {
  return <AuthPageShell eyebrow="Editor"><LoginForm intent="editor_login" /><p className="text-sm text-text-muted">Reviewer atau Admin? <Link href="/masuk" className="font-semibold text-primary hover:underline">Pilih ruang kerja lain</Link></p></AuthPageShell>
}
