import { redirect } from 'next/navigation'

export default function LegacyQuestionsPage() {
  redirect('/admin/discussions')
}
