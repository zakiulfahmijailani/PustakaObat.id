'use client'

import { useState } from 'react'
import { CheckCircle2, Send } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { EditorialDraft, MonographPublication } from '@/lib/staging/types'
import { Button } from '@/components/ui/Button'

const REQUIRED_SECTIONS = ['indication', 'dosage', 'side_effects', 'contraindication', 'warnings']
const SECTION_LABELS: Record<string, string> = {
  indication: 'Indikasi',
  dosage: 'Dosis dan penggunaan',
  side_effects: 'Efek samping',
  contraindication: 'Kontraindikasi',
  warnings: 'Peringatan',
}

export function AdminPublicationPanel({ drugKey, drafts, publication }: { drugKey: string; drafts: EditorialDraft[]; publication: MonographPublication | null }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const approved = new Set(drafts.filter((draft) => draft.status === 'pharmacist_approved' && draft.reviewed_by && draft.reviewed_at).map((draft) => draft.section_type))
  const missing = REQUIRED_SECTIONS.filter((section) => !approved.has(section))
  const canPublish = !publication && missing.length === 0

  async function publish() {
    setPending(true)
    setMessage(null)
    try {
      const response = await fetch('/api/staging/editorial', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'publish_monograph', drugKey }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Monografi belum dapat diterbitkan.')
      setMessage('Monografi berhasil diterbitkan ke pustaka publik.')
      router.refresh()
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Monografi belum dapat diterbitkan.')
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="rounded-3xl border border-primary/25 bg-primary/5 p-6">
      <div className="flex items-start gap-3">
        <Send className="mt-1 shrink-0 text-primary" size={21} />
        <div>
          <h2 className="font-serif text-2xl text-text">Publikasi oleh Admin</h2>
          <p className="mt-2 text-sm leading-relaxed text-text-muted">Admin menerbitkan monografi setelah seluruh bagian inti disetujui Reviewer. Evidence FDA tetap menjadi sumber internal dan tidak disalin mentah ke halaman publik.</p>
        </div>
      </div>
      {publication ? (
        <p className="mt-5 rounded-2xl bg-success/10 p-4 text-sm font-medium text-success">Monografi sudah diterbitkan dengan {publication.published_section_count} bagian.</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap gap-2">
            {REQUIRED_SECTIONS.map((section) => <span key={section} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${approved.has(section) ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}><CheckCircle2 size={14} />{SECTION_LABELS[section]}: {approved.has(section) ? 'disetujui' : 'menunggu'}</span>)}
          </div>
          {missing.length > 0 && <p className="mt-4 text-sm text-warning">Publikasi belum tersedia. Reviewer masih perlu menyetujui: {missing.map((section) => SECTION_LABELS[section]).join(', ')}.</p>}
          <Button type="button" className="mt-5" disabled={pending || !canPublish} onClick={publish}><Send size={17} />{pending ? 'Menerbitkan...' : 'Terbitkan monografi ke publik'}</Button>
        </>
      )}
      {message && <p role="status" className="mt-4 rounded-xl bg-surface p-4 text-sm text-text">{message}</p>}
    </section>
  )
}
