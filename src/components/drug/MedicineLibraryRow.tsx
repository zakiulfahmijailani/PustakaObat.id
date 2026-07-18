import Link from 'next/link'
import { ArrowUpRight, BadgeCheck, BookOpenText, Globe2, ShieldQuestion } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { displayMedicineName, type PublicMonographSummary, type PublicWhoMedicine } from '@/lib/who/queries'

const awareVariants = {
  Access: 'success',
  Watch: 'warning',
  Reserve: 'destructive',
  'Not recommended': 'destructive',
} as const

export function MonographLibraryRow({ drug }: { drug: PublicMonographSummary }) {
  return (
    <article className="group relative border-b border-border px-2 py-5 transition-colors last:border-b-0 hover:bg-primary/[0.035] focus-within:bg-primary/[0.035] md:px-3">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BookOpenText size={21} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/obat/${drug.slug}`} className="before:absolute before:inset-0 font-serif text-xl font-semibold capitalize text-text decoration-1 underline-offset-4 hover:text-primary hover:underline">
              {drug.display_name}
            </Link>
            <Badge variant="success"><BadgeCheck className="mr-1" size={12} /> Diverifikasi apoteker</Badge>
          </div>
          <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-text-muted">
            {drug.summary || 'Monografi obat berbahasa Indonesia yang telah melalui peninjauan editorial.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-text-muted">
            {drug.drug_class && <span>{drug.drug_class}</span>}
            {drug.dosage_form && <><span aria-hidden="true">·</span><span>{drug.dosage_form}</span></>}
          </div>
        </div>
        <ArrowUpRight className="pointer-events-none mt-2 shrink-0 text-primary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" size={19} aria-hidden="true" />
      </div>
    </article>
  )
}

export function WhoLibraryRow({ medicine }: { medicine: PublicWhoMedicine }) {
  return (
    <article className="group relative border-b border-border px-2 py-5 transition-colors last:border-b-0 hover:bg-primary/[0.035] focus-within:bg-primary/[0.035] md:px-3">
      <div className="flex items-start gap-4">
        <div className="mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-text-muted ring-1 ring-border">
          <Globe2 size={21} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/obat/${medicine.slug}`} className="before:absolute before:inset-0 font-serif text-xl font-semibold text-text decoration-1 underline-offset-4 hover:text-primary hover:underline">
              {displayMedicineName(medicine)}
            </Link>
            {medicine.verification_status === 'verified' ? (
              <Badge variant="success"><BadgeCheck className="mr-1" size={12} /> Ditinjau apoteker</Badge>
            ) : (
              <Badge variant="secondary"><ShieldQuestion className="mr-1" size={12} /> Profil sumber WHO</Badge>
            )}
            {medicine.has_indonesian_draft && <Badge variant="warning">Monografi sedang ditinjau</Badge>}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
            {medicine.has_indonesian_draft
              ? 'Monografi Bahasa Indonesia sedang ditinjau apoteker. Profil WHO tetap tersedia sebagai katalog sumber.'
              : 'Metadata WHO tersedia. Monografi klinis Bahasa Indonesia belum diterbitkan untuk obat ini.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {medicine.is_who_eeml && <Badge>WHO Essential Medicine</Badge>}
            {medicine.aware_category && <Badge variant={awareVariants[medicine.aware_category]}>AWaRe · {medicine.aware_category}</Badge>}
            {medicine.is_not_on_eml && <Badge variant="outline">Tidak tercantum di EML</Badge>}
          </div>
        </div>
        <ArrowUpRight className="pointer-events-none mt-2 shrink-0 text-primary transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" size={19} aria-hidden="true" />
      </div>
    </article>
  )
}
