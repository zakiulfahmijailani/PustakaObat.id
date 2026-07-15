import React from 'react'
import { DrugForm } from '@/components/drug/DrugForm'
import { requireActiveProfile } from '@/lib/auth/server'

export default async function NewDrugPage() {
  const { user } = await requireActiveProfile(['admin'])
  const categories: { id: string; name: string }[] = []

  return (
    <div className="py-6">
      <DrugForm categories={categories} mode="create" userId={user.id} />
    </div>
  )
}
