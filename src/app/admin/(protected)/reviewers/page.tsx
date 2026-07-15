import { redirect } from 'next/navigation'

export default function AdminReviewersPage() {
  redirect('/admin/users?role=reviewer&status=pending_review')
}
