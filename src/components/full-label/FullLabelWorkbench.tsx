'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, BookOpenText, ChevronDown, Clipboard, FileText, LoaderCircle, Search, ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

interface FullLabelSection {
  section_id: string
  section_type: string
  section_title_en: string | null
  section_title_id: string | null
  source_text: string | null
  source_character_count: number
  source_language: string | null
  translation_status: string | null
  section_group: string | null
}

interface FullLabelResponse {
  label: {
    label_id: string
    spl_document_id: string | null
    spl_set_id: string | null
    effective_time: string | null
    display_names: string[]
    ingredient_count: number
    ingredient_fingerprint: string
    is_human_label: boolean
    editorial_status: string
    public_status: string
    publication_eligible: boolean
    sections: FullLabelSection[]
  }
}

const SECTION_TITLES: Record<string, string> = {
  active_ingredient: 'Bahan aktif',
  adverse_reactions: 'Efek samping',
  boxed_warning: 'Peringatan kotak',
  clinical_pharmacology: 'Farmakologi klinis',
  contraindications: 'Kontraindikasi',
  dosage_and_administration: 'Dosis dan cara pemberian',
  drug_interactions: 'Interaksi obat',
  indications_and_usage: 'Indikasi dan penggunaan',
  mechanism_of_action: 'Mekanisme kerja',
  pharmacokinetics: 'Farmakokinetik',
  pregnancy: 'Kehamilan',
  storage_and_handling: 'Penyimpanan dan penanganan',
  use_in_specific_populations: 'Penggunaan pada populasi khusus',
  warnings: 'Peringatan',
  warnings_and_cautions: 'Peringatan dan kehati-hatian',
}

function displayDate(value: string | null) {
  if (!value || !/^\d{8}$/.test(value)) return 'Tidak tercantum'
  return `${value.slice(6, 8)}/${value.slice(4, 6)}/${value.slice(0, 4)}`
}

function titleFor(section: FullLabelSection) {
  return SECTION_TITLES[section.section_type]
    || section.section_title_id
    || section.section_title_en
    || section.section_type.replaceAll('_', ' ')
}

export function FullLabelWorkbench({ labelId, backHref }: { labelId: string; backHref: string }) {
  const [data, setData] = useState<FullLabelResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    setData(null)
    setError(null)

    fetch(`/api/full-label/labels/${encodeURIComponent(labelId)}/sections?preview=1`, {
      cache: 'no-store',
      signal: controller.signal,
    })
      .then(async (response) => {
        const body = await response.json() as FullLabelResponse & { error?: string; detail?: string }
        if (!response.ok || !body.label) throw new Error(body.detail || body.error || 'Label tidak dapat dimuat.')
        setData(body)
      })
      .catch((requestError: unknown) => {
        if ((requestError as Error).name !== 'AbortError') {
          setError(requestError instanceof Error ? requestError.message : 'Label tidak dapat dimuat.')
        }
      })

    return () => controller.abort()
  }, [labelId])

  const sections = useMemo(() => {
    if (!data) return []
    const needle = query.trim().toLocaleLowerCase('id-ID')
    if (!needle) return data.label.sections
    return data.label.sections.filter((section) =>
      `${titleFor(section)} ${section.source_text || ''}`.toLocaleLowerCase('id-ID').includes(needle),
    )
  }, [data, query])

  const copyLabelId = async () => {
    await navigator.clipboard.writeText(labelId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  if (error) {
    return <div className="space-y-6"><Link href={backHref} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"><ArrowLeft size={17} />Kembali</Link><Card className="border-error/30 bg-error/5"><CardContent className="p-8"><AlertTriangle className="text-error" size={28} /><h1 className="mt-5 text-3xl font-serif text-text">Label belum dapat dimuat</h1><p className="mt-3 max-w-2xl leading-relaxed text-text-muted">{error}</p><p className="mt-4 text-sm text-text-muted">Coba muat ulang halaman. Bila masalah berlanjut, laporkan Label ID ini kepada admin.</p></CardContent></Card></div>
  }

  if (!data) {
    return <div className="flex min-h-80 items-center justify-center"><div className="flex items-center gap-3 text-text-muted"><LoaderCircle className="animate-spin text-primary" size={22} />Memuat label FDA lengkap…</div></div>
  }

  const { label } = data
  const productName = label.display_names[1] || label.display_names[0] || 'Label FDA'

  return <div className="space-y-7 pb-12">
    <Link href={backHref} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"><ArrowLeft size={17} />Kembali ke workbench</Link>

    <section className="overflow-hidden rounded-[2rem] border border-primary/20 bg-surface shadow-sm">
      <div className="border-b border-primary/10 bg-primary/5 p-6 md:p-9">
        <div className="flex flex-wrap gap-2"><Badge variant="warning"><AlertTriangle className="mr-1" size={13} />Sumber mentah · belum ditinjau</Badge><Badge variant="outline"><BookOpenText className="mr-1" size={13} />openFDA label</Badge><Badge variant="destructive">Tidak untuk publik</Badge></div>
        <p className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-primary">Dokumen label produk</p>
        <h1 className="mt-2 max-w-5xl text-3xl font-serif leading-tight text-text md:text-5xl">{productName}</h1>
        <p className="mt-4 max-w-4xl text-sm leading-relaxed text-text-muted">Label lengkap dari sumber FDA. Gunakan sebagai bahan verifikasi dan penyusunan draf editorial—bukan sebagai teks yang langsung diterbitkan.</p>
      </div>

      <div className="grid gap-5 p-6 md:grid-cols-4 md:p-8">
        <div><p className="text-xs font-bold uppercase tracking-wider text-text-muted">Efektif</p><p className="mt-1 font-semibold text-text">{displayDate(label.effective_time)}</p></div>
        <div><p className="text-xs font-bold uppercase tracking-wider text-text-muted">Bahan aktif</p><p className="mt-1 font-semibold text-text">{label.ingredient_count} komponen</p></div>
        <div><p className="text-xs font-bold uppercase tracking-wider text-text-muted">Bagian tersedia</p><p className="mt-1 font-semibold text-text">{label.sections.length} bagian</p></div>
        <div><p className="text-xs font-bold uppercase tracking-wider text-text-muted">Status</p><p className="mt-1 font-semibold text-warning">source only</p></div>
      </div>
    </section>

    <section className="rounded-3xl border border-warning/35 bg-warning/5 p-5 text-sm leading-relaxed text-text-muted"><div className="flex gap-3"><ShieldCheck className="mt-0.5 shrink-0 text-warning" size={20} /><p><strong className="text-text">Belum terverifikasi dan belum diterjemahkan.</strong> Semua isi di bawah berasal dari label FDA berbahasa Inggris. Pertimbangkan variasi produk, bentuk sediaan, rute, dan tanggal label sebelum membuat keputusan editorial atau klinis.</p></div></section>

    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <div className="space-y-4">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h2 className="text-3xl font-serif text-text">Bagian label</h2><p className="mt-1 text-sm text-text-muted">Klik bagian untuk membaca teks sumber lengkap.</p></div><label className="relative block w-full sm:max-w-sm"><Search className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-text-muted" size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari dalam label…" className="h-11 w-full rounded-full border border-border bg-surface py-2 pl-11 pr-4 text-sm text-text outline-none transition focus:border-primary" /></label></div>

        {sections.length ? sections.map((section, index) => <details key={section.section_id} open={index === 0 && !query} className="group rounded-3xl border border-border bg-surface shadow-sm"><summary className="flex min-h-16 list-none items-center justify-between gap-4 px-5 py-4 md:px-7"><div><p className="text-lg font-bold text-text">{titleFor(section)}</p><p className="mt-1 text-xs uppercase tracking-wider text-text-muted">{section.section_group?.replaceAll('_', ' ') || 'label section'} · English source</p></div><ChevronDown className="shrink-0 text-primary transition group-open:rotate-180" size={21} /></summary><div className="border-t border-border px-5 py-6 md:px-7"><p className="whitespace-pre-wrap break-words text-[0.95rem] leading-8 text-text">{section.source_text || 'Teks sumber tidak tersedia untuk bagian ini.'}</p><div className="mt-6 flex flex-wrap gap-2 text-xs"><Badge variant="outline">{section.source_character_count.toLocaleString('id-ID')} karakter</Badge><Badge variant="outline">{section.translation_status === 'untranslated' ? 'Belum diterjemahkan' : section.translation_status || 'Status tidak diketahui'}</Badge></div></div></details>) : <Card><CardContent className="p-8 text-center text-text-muted">Tidak ada bagian yang cocok dengan pencarian ini.</CardContent></Card>}
      </div>

      <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
        <Card><CardContent className="p-6"><FileText className="text-primary" size={24} /><h2 className="mt-4 font-serif text-xl text-text">Identitas dokumen</h2><dl className="mt-4 space-y-4 text-sm"><div><dt className="text-text-muted">Kandungan</dt><dd className="mt-1 break-words font-medium text-text">{label.ingredient_fingerprint || 'Tidak tercantum'}</dd></div><div><dt className="text-text-muted">SPL set ID</dt><dd className="mt-1 break-all font-mono text-xs text-text">{label.spl_set_id || '—'}</dd></div><div><dt className="text-text-muted">Label ID</dt><dd className="mt-1 break-all font-mono text-xs text-text-muted">{label.label_id}</dd></div></dl><Button type="button" variant="outline" size="sm" className="mt-5 w-full" onClick={copyLabelId}><Clipboard size={16} />{copied ? 'Label ID tersalin' : 'Salin Label ID'}</Button></CardContent></Card>
      </aside>
    </section>
  </div>
}
