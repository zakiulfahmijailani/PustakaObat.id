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
  indonesian_draft: string | null
  translation_status: string | null
  translation_quality_flags_json: string
}

interface ResponseBody {
  label?: {
    effective_time: string | null
    translation_overlay_state?: 'available' | 'not_imported' | 'unavailable'
    sections: LabelSection[]
  }
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
  const [translationOverlayState, setTranslationOverlayState] = useState<'available' | 'not_imported' | 'unavailable'>('not_imported')
  const sectionTypeKey = sectionTypes.join('|')

  useEffect(() => {
    const controller = new AbortController()
    setSections([])
    setError(null)
    setLoaded(false)
    setTranslationOverlayState('not_imported')
    onAvailabilityChange?.(false)
    const typeQuery = sectionTypeKey.split('|').filter(Boolean).map((type) => `sectionType=${encodeURIComponent(type)}`).join('&')

    fetch(`/api/full-label/labels/${encodeURIComponent(labelId)}/sections?preview=1&${typeQuery}`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json() as ResponseBody
        if (!response.ok || !body.label) throw new Error(body.detail || body.error || 'Evidence FDA tidak dapat dimuat.')
        setSections(body.label.sections)
        setTranslationOverlayState(body.label.translation_overlay_state || 'not_imported')
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

  return <section className="space-y-3 rounded-2xl border border-primary/20 bg-primary/5 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><BookOpenText className="text-primary" size={20} /><p className="font-bold text-text">Evidence FDA terikat · {drugName}</p></div><Badge variant="outline">{sections.length} seksi sumber</Badge></div><p className="text-sm leading-relaxed text-text-muted">Teks ini adalah bahan pembanding internal yang sama untuk Editor dan Reviewer. Tidak diterbitkan langsung. {translationOverlayState === 'available' ? 'Draf Indonesia AI ditampilkan sebagai pembanding dan wajib direview apoteker.' : translationOverlayState === 'unavailable' ? 'Draf Indonesia privat sedang tidak dapat dimuat.' : ''}</p>{sections.map((section) => <details key={section.section_id} className="rounded-xl border border-border bg-surface p-4"><summary className="cursor-pointer font-bold text-text">{sourceTitle(section)}</summary><div className="mt-3 space-y-4"><div><p className="text-xs font-bold uppercase tracking-wider text-text-muted">Sumber Inggris</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-text-muted">{section.source_text || 'Teks sumber tidak tersedia.'}</p></div>{section.indonesian_draft && <div className="rounded-xl border border-primary/20 bg-primary/5 p-4"><p className="text-xs font-bold uppercase tracking-wider text-primary">Draf Indonesia AI · perlu review apoteker</p><p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-text">{section.indonesian_draft}</p></div>}<div className="flex flex-wrap gap-2 text-xs text-text-muted"><span>FDA field: {section.section_type} · {section.source_character_count.toLocaleString('id-ID')} karakter</span>{section.translation_status === 'AI_TRANSLATED_UNREVIEWED' && <Badge variant="warning">AI translated · unreviewed</Badge>}{section.translation_quality_flags_json !== '[]' && <Badge variant="warning">Perlu cek QC otomatis</Badge>}</div></div></details>)}</section>
}
