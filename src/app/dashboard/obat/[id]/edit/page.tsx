import { notFound } from 'next/navigation'
import { DrugForm } from '@/components/drug/DrugForm'
import { requireActiveProfile } from '@/lib/auth/server'
import { queryNeon } from '@/lib/neon/server'
import type { Drug, DrugMonographSection } from '@/types'

export const dynamic = 'force-dynamic'

export default async function EditDrugPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user } = await requireActiveProfile(['admin'])
  const [drugs, sections] = await Promise.all([
    queryNeon<Drug>('SELECT * FROM public.drugs WHERE id = $1 LIMIT 1', [id]),
    queryNeon<DrugMonographSection>('SELECT * FROM public.drug_monograph_sections WHERE drug_id = $1 ORDER BY created_at', [id]),
  ])
  const drug = drugs[0]
  const categories: { id: string; name: string }[] = []
  if (!drug) notFound()

  return <div className="py-6"><DrugForm initialData={{ ...drug, sections }} categories={categories} mode="edit" userId={user.id} /></div>
}
