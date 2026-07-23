'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, BookOpenText, LoaderCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

interface LabelSection {
  section_id: string
  section_type: string
  section_title_en: string | null
  section_title_id: string | null
  source_text: string | null
  source_character_count: number
}

interface ResponseBody {
  label?: { effective_time: string | null, sections: LabelSection[] }
  error?: string
  detail?: string
}

function sourceTitle(section: LabelSection) {
  return section.section_title_id || section.section_title_en || section.section_type.replaceAll('_', ' ')
}

export function BoundEvidencePanel({
  labelId,
  sectionTypes,
  drugName,
  onAvailabilityChange,
}: {
  labelId: string
  sectionTypes: string[]
  drugName: string
  onAvailabilityChange?: (available: boolean) => void
}) {
  const [sections, setSections] = useState<LabelSection[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const sectionTypeKey = sectionTypes.join('|')

  useEffect(() => {
    const controller = new AbortController()
    setSections([])
    setError(null)
    setLoaded(false)
    onAvailabilityChange?.(false)
    const typeQuery = sectionTypes.map((type) => `sectionType=${encodeURIComponent(type)}`).join('&')

    fetch(`/api/full-label/labels/${encodeURIComponent(labelId)}/sections?preview=1&${typeQuery}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json() as ResponseBody
        if (!response.ok || !body.label) throw new Error(body.detail || body.error || 'Evidence FDA tidak dapat dimuat.')
        setSections(body.label.sections)
        setLoaded(true)
        onAvailabilityChange?.(body.label.sections.length > 0)
      })
      .catch((requestError: unknown) => {
        if ((requestError as Error).name === 'AbortError') return
        setError(requestError instanceof Error ? requestError.message : 'Evidence FDA tidak dapat dimuat.')
        onAvailabilityChange?.(false)
      })

    return () => controller.abort()
  }, [drugName, labelId, onAvailabilityChange, sectionTypeKey])

  if (error) return <div className="rounded-2xl border border-error/25 bg-error/5 p-4 text-sm text-text-muted"><AlertTriangle className="mb-2 text-error" size={18} />{error}</div>
  if (!loaded) return <div className="flex items-center gap-2 rounded-2xl bg-surface-2 p-4 text-sm text-text-muted"><LoaderCircle className="animate-spin text-primary" size={17} />Memuat evidence FDA untuk {drugName}…</div>
  if (!sections.length) return <div className="rounded-2xl border border-warning/30 bg-warning/5 p-4 text-sm text-text-muted"><AlertTriangle className="mb-2 text-warning" size={18} />Label FDA ini tidak memiliki seksi sumber yang sesuai untuk bagian monografi ini. Pilih label atau bagian lain.</div>

  return <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><BookOpenText className="text-primary" size={20} /><p className="font-bold text-text">Evidence FDA terikat · {drugName}</p></div><Badge variant="outline">{sections.length} seksi sumber</Badge></div><p className="text-sm leading-relaxed text-text-muted">Teks ini adalah bahan pembanding internal yang sama untuk Editor dan Reviewer. Tidak diterbitkan langsung.</p>{sections.map((section) => <details key={section.section_id} className="rounded-xl border border-border bg-surface p-4"><summary className="cursor-pointer font-bold text-text">{sourceTitle(section)}</summary><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-text-muted">{section.source_text || 'Teks sumber tidak tersedia.'}</p><p className="mt-3 text-xs text-text-muted">FDA field: {section.section_type} · {section.source_character_count.toLocaleString('id-ID')} karakter</p></details>)}</section>
}
