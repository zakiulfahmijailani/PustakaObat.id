import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, ArrowUpRight, BadgeCheck, CalendarDays, CircleAlert, FileCheck2, Globe2, Info, Pill, ShieldCheck, ShieldQuestion } from 'lucide-react'
import { PrintMonographButton } from '@/components/drug/PrintMonographButton'
import { Badge } from '@/components/ui/Badge'
import { AWARE_DESCRIPTIONS, VERIFICATION_LABELS, WHO_BPOM_DISCLAIMER } from '@/lib/who/constants'
import { displayMedicineName, getPublicLocalDrugBySlug, getPublicWhoMedicineBySlug } from '@/lib/who/queries'

export const dynamic = 'force-dynamic'

const sectionLabels: Record<string, string> = {
  indication: 'Indikasi dan kegunaan',
  dosage: 'Dosis dan cara pemberian',
  side_effects: 'Efek samping',
  contraindication: 'Kontraindikasi',
  drug_interactions: 'Interaksi obat',
  warnings: 'Peringatan dan perhatian',
  pregnancy_category: 'Kehamilan dan menyusui',
  pregnancy: 'Kehamilan dan menyusui',
  specific_populations: 'Anak, lansia, dan populasi khusus',
  mechanism: 'Mekanisme kerja',
  mechanism_of_action: 'Mekanisme kerja',
  clinical_pharmacology: 'Farmakologi klinis',
  pharmacokinetics: 'Farmakokinetik',
  how_supplied: 'Bentuk dan kekuatan sediaan',
  storage: 'Penyimpanan dan penanganan',
  references: 'Referensi',
}

const dateFormatter = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

function formatDate(value: string | null | undefined) {
  return value ? dateFormatter.format(new Date(value)) : null
}

export default async function DrugDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const [localDrug, whoResult] = await Promise.all([
    getPublicLocalDrugBySlug(slug),
    getPublicWhoMedicineBySlug(slug),
  ])
  const medicine = whoResult.medicine

  if (!localDrug && !medicine) notFound()

  if (localDrug) {
    const reviewedAt = formatDate(localDrug.reviewed_at || localDrug.published_at || localDrug.updated_at)
    return (
      <div className="print-container container max-w-5xl px-4 pb-28">
        <Link href="/obat" className="print-hide mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"><ArrowLeft size={17} /> Kembali ke pustaka</Link>

        <header className="rounded-xl border border-border border-l-[6px] border-l-primary bg-surface px-6 py-7 md:px-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">Monografi Obat · PustakaObat.id</p>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-5">
            <div>
              <h1 className="font-serif text-4xl font-bold capitalize leading-tight text-text md:text-5xl">{localDrug.display_name}</h1>
              {localDrug.name !== localDrug.display_name && <p className="mt-1 text-sm text-text-muted">Nama produk: {localDrug.name}</p>}
            </div>
            <Badge variant="success" className="border border-success/30 px-3 py-1"><BadgeCheck className="mr-1" size={13} /> Terverifikasi apoteker</Badge>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {localDrug.drug_class && <Badge>{localDrug.drug_class}</Badge>}
            {localDrug.dosage_form && <Badge variant="outline">{localDrug.dosage_form}</Badge>}
            {localDrug.strength && <Badge variant="outline">{localDrug.strength}</Badge>}
            {medicine?.is_who_eeml && <Badge variant="success">WHO Essential Medicine</Badge>}
            {medicine?.aware_category && <Badge variant="warning">AWaRe · {medicine.aware_category}</Badge>}
          </div>

          {localDrug.brand_names.length > 0 && <p className="mt-4 text-sm text-text-muted"><strong className="text-text">Nama dagang:</strong> {localDrug.brand_names.join(', ')}</p>}

          <div className="mt-5 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-primary">
            <BadgeCheck className="mr-2 inline" size={16} />
            {localDrug.reviewer_name ? <>Diverifikasi oleh <strong>{localDrug.reviewer_name}</strong>{localDrug.reviewer_license ? ` (${localDrug.reviewer_license})` : ''}{reviewedAt ? ` pada ${reviewedAt}` : ''}.</> : <>Diterbitkan melalui alur editorial dan verifikasi PustakaObat.id{reviewedAt ? ` pada ${reviewedAt}` : ''}.</>}
          </div>

          <div className="mt-5"><PrintMonographButton /></div>
        </header>

        {localDrug.summary && (
          <section className="mt-5 rounded-xl border border-warning/30 bg-warning/5 p-5">
            <div className="flex gap-3"><Info className="mt-0.5 shrink-0 text-warning" size={21} /><div><h2 className="font-bold text-text">Ringkasan penggunaan</h2><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{localDrug.summary}</p></div></div>
          </section>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[220px_1fr] lg:items-start">
          <aside className="print-hide rounded-xl border border-border bg-surface p-5 lg:sticky lg:top-28">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-text-muted">Daftar isi</p>
            <nav className="mt-4 flex flex-col gap-1.5" aria-label="Daftar isi monografi">
              {localDrug.sections.map((section, index) => (
                <a key={section.id} href={`#${section.section_type}`} className="rounded-lg px-2 py-2 text-sm text-text-muted hover:bg-primary/5 hover:text-primary"><span className="mr-2 font-mono text-xs text-primary">{String(index + 1).padStart(2, '0')}</span>{sectionLabels[section.section_type] || section.section_type}</a>
              ))}
              <a href="#sumber" className="rounded-lg px-2 py-2 text-sm text-text-muted hover:bg-primary/5 hover:text-primary"><span className="mr-2 font-mono text-xs text-primary">{String(localDrug.sections.length + 1).padStart(2, '0')}</span>Sumber dan versi</a>
            </nav>
          </aside>

          <main>
            {localDrug.sections.length > 0 ? localDrug.sections.map((section, index) => (
              <section id={section.section_type} key={section.id} className="print-break-inside-avoid mb-4 overflow-hidden rounded-xl border border-border bg-surface scroll-mt-28">
                <div className="flex items-center gap-3 border-b border-border bg-surface-2 px-5 py-3">
                  <span className="font-mono text-xs font-semibold text-primary">{String(index + 1).padStart(2, '0')}</span>
                  <h2 className="flex-1 font-serif text-xl font-semibold text-text">{sectionLabels[section.section_type] || section.section_type}</h2>
                  <Badge variant="success" className="text-[10px]">Bahasa Indonesia</Badge>
                </div>
                <div className="px-5 py-5"><p className="whitespace-pre-wrap text-[15px] leading-7 text-text/90">{section.content}</p></div>
              </section>
            )) : (
              <section className="rounded-xl border border-dashed border-border p-8 text-center text-text-muted">Bagian monografi belum tersedia.</section>
            )}

            <section id="sumber" className="mt-5 rounded-xl border border-border border-l-[6px] border-l-text bg-surface p-6 scroll-mt-28">
              <div className="flex gap-3"><FileCheck2 className="mt-0.5 shrink-0 text-primary" size={22} /><div className="min-w-0"><h2 className="font-serif text-xl font-semibold text-text">Sumber &amp; versi dokumen</h2><p className="mt-2 text-sm leading-relaxed text-text-muted">Konten yang tampil adalah versi monografi yang telah diterbitkan PustakaObat.id. Setiap pembaruan wajib melewati peninjauan kembali sebelum tampil kepada publik.</p>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[160px_1fr]"><dt className="font-semibold text-text">Pembaruan terakhir</dt><dd className="text-text-muted">{formatDate(localDrug.updated_at)}</dd>{localDrug.bpom_reg_number && <><dt className="font-semibold text-text">Nomor registrasi BPOM</dt><dd className="text-text-muted">{localDrug.bpom_reg_number}</dd></>}{localDrug.atc_code && <><dt className="font-semibold text-text">Kode ATC</dt><dd className="text-text-muted">{localDrug.atc_code}</dd></>}</dl>
                {localDrug.sources.length > 0 && <div className="mt-5"><p className="font-semibold text-text">Dokumen sumber</p><ul className="mt-2 space-y-1.5 text-sm text-text-muted">{localDrug.sources.map((source) => <li key={`${source.source_name}-${source.source_document_id}`}>{source.source_url ? <a href={source.source_url} target="_blank" rel="noreferrer" className="font-medium text-primary underline underline-offset-4">{source.source_name} · {source.source_document_id}</a> : <span>{source.source_name} · {source.source_document_id}</span>}</li>)}</ul></div>}
                {medicine?.official_source_url && <a href={medicine.official_source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-primary">Buka sumber WHO <ArrowUpRight size={16} /></a>}
              </div></div>
            </section>
          </main>
        </div>

        <aside className="mt-6 rounded-xl border border-warning/30 bg-warning/5 p-5">
          <div className="flex gap-3"><CircleAlert className="mt-0.5 shrink-0 text-warning" size={22} /><div><h2 className="font-bold text-text">Informasi kesehatan</h2><p className="mt-1 text-sm leading-relaxed text-text-muted">Informasi ini untuk edukasi dan tidak menggantikan konsultasi dokter atau apoteker. Jangan memulai, menghentikan, atau mengubah dosis obat tanpa arahan tenaga kesehatan.</p></div></div>
        </aside>
      </div>
    )
  }

  const displayName = displayMedicineName(medicine!)
  return (
    <div className="print-container container max-w-5xl px-4 pb-28">
      <Link href="/obat" className="print-hide mb-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary"><ArrowLeft size={17} /> Kembali ke pustaka</Link>

      <header className="rounded-xl border border-border border-l-[6px] border-l-primary bg-surface px-6 py-7 md:px-8">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">Profil Obat · Sumber WHO</p>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-5">
          <div><h1 className="font-serif text-4xl font-bold leading-tight text-text md:text-5xl">{displayName}</h1>{displayName !== medicine!.medicine_name && <p className="mt-1 text-sm text-text-muted">Nama sumber WHO: {medicine!.medicine_name}</p>}</div>
          {medicine!.verification_status === 'verified' ? <Badge variant="success" className="border border-success/30 px-3 py-1"><BadgeCheck className="mr-1" size={13} /> Ditinjau apoteker</Badge> : <Badge variant="secondary" className="border border-border px-3 py-1"><ShieldQuestion className="mr-1" size={13} /> Profil sumber WHO</Badge>}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          {medicine!.is_who_eeml && <Badge>WHO Essential Medicine</Badge>}
          {medicine!.aware_category && <Badge variant="warning">AWaRe · {medicine!.aware_category}</Badge>}
          {medicine!.is_not_on_eml && <Badge variant="outline">Tidak tercantum di EML</Badge>}
        </div>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-text-muted">Halaman ini memuat identitas dan klasifikasi obat dari WHO. Monografi klinis Bahasa Indonesia belum diterbitkan untuk obat ini.</p>
        <div className="mt-5"><PrintMonographButton /></div>
      </header>

      <section className="mt-5 rounded-xl border border-warning/30 bg-warning/5 p-5">
        <div className="flex gap-3"><CircleAlert className="mt-0.5 shrink-0 text-warning" size={22} /><div><h2 className="font-bold text-text">{medicine!.has_indonesian_draft ? 'Monografi Bahasa Indonesia sedang ditinjau apoteker' : 'Informasi klinis sedang disiapkan'}</h2><p className="mt-1 text-sm leading-relaxed text-text-muted">{medicine!.has_indonesian_draft ? 'Kandidat konten tersedia di ruang kerja editorial, tetapi belum ditampilkan karena belum melalui peninjauan apoteker. Dosis, indikasi, interaksi, kontraindikasi, dan penggunaan pada kehamilan belum tersedia sebagai monografi terverifikasi.' : 'Dosis, indikasi, interaksi, kontraindikasi, dan penggunaan pada kehamilan belum tersedia sebagai monografi terverifikasi.'} Jangan gunakan profil sumber ini sebagai panduan terapi.</p></div></div>
      </section>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center gap-3"><ShieldCheck className="text-primary" size={23} /><h2 className="font-serif text-xl font-semibold text-text">Status WHO</h2></div>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-text-muted">Essential Medicines List</p>
          <p className="mt-2 leading-relaxed text-text">{medicine!.is_who_eeml ? 'Tercantum dalam WHO Electronic Essential Medicines List.' : medicine!.is_not_on_eml ? 'Tidak tercantum dalam WHO Essential Medicines List.' : 'Status EML tidak dinyatakan dalam snapshot ini.'}</p>
          {medicine!.is_monitoring_only && <Badge variant="outline" className="mt-4">Dicantumkan untuk monitoring</Badge>}
        </section>
        <section className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center gap-3"><Pill className="text-primary" size={23} /><h2 className="font-serif text-xl font-semibold text-text">Klasifikasi antibiotik AWaRe</h2></div>
          {medicine!.aware_category ? <><Badge className="mt-4">{medicine!.aware_category}</Badge><p className="mt-3 leading-relaxed text-text-muted">{AWARE_DESCRIPTIONS[medicine!.aware_category]}</p></> : <p className="mt-4 text-text-muted">Tidak ada klasifikasi AWaRe pada snapshot WHO ini.</p>}
        </section>
      </div>

      <section className="mt-5 rounded-xl border border-border border-l-[6px] border-l-text bg-surface p-6">
        <div className="flex gap-3"><Globe2 className="mt-0.5 shrink-0 text-primary" size={22} /><div><h2 className="font-serif text-xl font-semibold text-text">Sumber resmi</h2><p className="mt-2 text-sm leading-relaxed text-text-muted">{WHO_BPOM_DISCLAIMER}</p>{medicine!.official_source_url && <a href={medicine!.official_source_url} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-primary">Buka halaman WHO <ArrowUpRight size={17} /></a>}</div></div>
      </section>

      <div className="mt-6 flex flex-wrap gap-6 border-t border-border pt-5 text-sm text-text-muted">
        <span className="flex items-center gap-2"><ShieldQuestion size={17} /> {VERIFICATION_LABELS[medicine!.verification_status]}</span>
        <span className="flex items-center gap-2"><CalendarDays size={17} /> Diperbarui {formatDate(medicine!.updated_at)}</span>
      </div>

      <aside className="mt-6 rounded-xl border border-primary/25 bg-primary/5 p-5">
        <div className="flex gap-3"><Info className="mt-0.5 shrink-0 text-primary" size={22} /><div><h2 className="font-bold text-text">Batas penggunaan informasi</h2><p className="mt-1 text-sm leading-relaxed text-text-muted">Informasi ini untuk edukasi dan tidak menggantikan konsultasi dokter atau apoteker.</p></div></div>
      </aside>
    </div>
  )
}
