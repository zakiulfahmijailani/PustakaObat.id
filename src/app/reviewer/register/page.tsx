import { AuthPageShell } from '@/components/auth/AuthPageShell'
import { RegisterForm } from '@/components/auth/RegisterForm'

export const dynamic = 'force-dynamic'

export default function ReviewerRegisterPage() {
  return <AuthPageShell eyebrow="Pendaftaran Reviewer"><RegisterForm /></AuthPageShell>
}
