import React from 'react'
import { DrugForm } from '@/components/drug/DrugForm'
import { requireActiveProfile } from '@/lib/auth/server'

export default async function NewDrugPage() {
  const { supabase, user } = await requireActiveProfile(['pharmacist', 'admin'])

  const { data: categories } = await supabase
    .from('drug_categories')
    .select('id, name')
    .order('name')

  return (
    <div className="py-6">
      <DrugForm categories={categories || []} mode="create" userId={user.id} />
    </div>
  )
}
