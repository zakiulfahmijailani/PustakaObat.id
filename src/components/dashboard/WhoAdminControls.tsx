'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Save } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import type { WhoMedicine } from '@/types'

export function WhoAdminControls({ medicine }: { medicine: WhoMedicine }) {
  const router = useRouter()
  const [name, setName] = useState(medicine.editorial_name || '')
  const [publication, setPublication] = useState(medicine.publication_status)
  const [active, setActive] = useState(medicine.is_active)
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const save = async () => {
    setPending(true)
    setMessage(null)
    const response = await fetch('/api/who/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        medicineId: medicine.id,
        editorialName: name,
        publicationStatus: publication,
        isActive: active,
      }),
    })
    const result = await response.json().catch(() => ({}))
    setMessage(response.ok ? 'Perubahan editorial tersimpan.' : result.error || 'Gagal menyimpan perubahan.')
    setPending(false)
    if (response.ok) router.refresh()
  }

  return (
    <div className="grid gap-4 rounded-2xl border border-border bg-surface-2/40 p-5 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
      <Input label="Nama tampilan editorial (opsional)" value={name} onChange={(event) => setName(event.target.value)} placeholder={medicine.medicine_name} />
      <label className="space-y-2 text-xs font-bold uppercase tracking-wider text-text-muted">
        Publikasi
        <select value={publication} onChange={(event) => setPublication(event.target.value as WhoMedicine['publication_status'])} className="block min-h-11 rounded-xl border border-border bg-surface px-3 text-sm font-medium normal-case tracking-normal text-text">
          <option value="published">Published</option>
          <option value="hidden">Hidden</option>
        </select>
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-text"><input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} /> Aktif</label>
      <Button onClick={save} disabled={pending}>{pending ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />} Simpan</Button>
      {message && <p role="status" className="text-sm text-text-muted lg:col-span-4">{message}</p>}
    </div>
  )
}
