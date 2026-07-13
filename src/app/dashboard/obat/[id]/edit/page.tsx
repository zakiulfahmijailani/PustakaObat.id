import { notFound, redirect } from 'next/navigation'
import { DrugForm } from '@/components/drug/DrugForm'
import { requireActiveProfile } from '@/lib/auth/server'
import type { Drug, DrugMonographSection } from '@/types'

export const dynamic = 'force-dynamic'

export default async function EditDrugPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { supabase, user, profile } = await requireActiveProfile(['pharmacist', 'verifier', 'admin'])
  const [{ data: drug }, { data: sections }, { data: categories }] = await Promise.all([
    supabase.from('drugs').select('*').eq('id', id).single(),
    supabase.from('drug_monograph_sections').select('*').eq('drug_id', id).order('created_at'),
    supabase.from('drug_categories').select('id, name').order('name'),
  ])
  if (!drug) notFound()
  if (profile.role === 'pharmacist' && drug.submitted_by !== user.id) redirect('/dashboard/obat')

  return <div className="py-6"><DrugForm initialData={{ ...(drug as Drug), sections: (sections || []) as DrugMonographSection[] }} categories={categories || []} mode="edit" userId={user.id} /></div>
}
