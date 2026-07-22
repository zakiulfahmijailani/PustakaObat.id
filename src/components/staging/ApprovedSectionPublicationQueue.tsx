'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, ExternalLink, Loader2, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

export interface ApprovedSectionQueueItem {
  draft_id: string
  drug_key: string
  drug_name: string
  slug: string
  section_type: string
  reviewed_at: string
  reviewer_name: string
  version: number
}

const SECTION_LABELS: Record<string, string> = {
  indication: 'Indikasi', dosage: 'Dosis dan penggunaan', warnings: 'Peringatan',
  side_effects: 'Efek samping', drug_interactions: 'Interaksi obat',
  specific_populations: 'Populasi khusus', pregnancy: 'Kehamilan',
  clinical_pharmacology: 'Farmakologi klinis', mechanism: 'Mekanisme kerja',
  pharmacokinetics: 'Farmakokinetik', storage: 'Penyimpanan',
  how_supplied: 'Sediaan', contraindication: 'Kontraindikasi',
}

export function ApprovedSectionPublicationQueue({ items }: { items: ApprovedSectionQueueItem[] }) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function publish(item: ApprovedSectionQueueItem) {
    setPending(item.draft_id)
    setMessage(null)
    try {
      const response = await fetch('/api/staging/editorial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish_section', draftId: item.draft_id }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Bagian belum dapat diterbitkan.')
      setMessage(`${SECTION_LABELS[item.section_type] || item.section_type} untuk ${item.drug_name} berhasil diterbitkan.`)
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Bagian belum dapat diterbitkan.')
    } finally {
      setPending(null)
    }
  }

  if (!items.length) return <div className="rounded-3xl border border-dashed border-border p-14 text-center"><CheckCircle2 className="mx-auto text-success" size={34} /><h2 className="mt-4 font-serif text-2xl text-text">Antrean publikasi kosong</h2><p className="mt-2 text-sm text-text-muted">Belum ada bagian baru yang disetujui Reviewer dan menunggu publikasi Admin.</p></div>

  return <div className="space-y-4">
    {message && <p role="status" className="rounded-2xl bg-success/10 p-4 text-sm text-success">{message}</p>}
    {items.map((item) => <article key={item.draft_id} className="rounded-3xl border border-border bg-surface p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2"><Badge variant="success">Disetujui Reviewer</Badge><Badge variant="outline">Versi {item.version}</Badge></div>
          <h2 className="mt-4 font-serif text-2xl text-text">{item.drug_name}</h2>
          <p className="mt-1 font-bold text-primary">{SECTION_LABELS[item.section_type] || item.section_type}</p>
          <p className="mt-2 text-xs text-text-muted">Disetujui oleh {item.reviewer_name} pada {new Date(item.reviewed_at).toLocaleString('id-ID')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" asChild><Link href={`/admin/staging/${item.drug_key}`}><ExternalLink size={16} />Periksa detail</Link></Button>
          <Button disabled={pending === item.draft_id} onClick={() => publish(item)}>{pending === item.draft_id ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />}{pending === item.draft_id ? 'Menerbitkan...' : 'Terbitkan bagian'}</Button>
        </div>
      </div>
    </article>)}
  </div>
}
