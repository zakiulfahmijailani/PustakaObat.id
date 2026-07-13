import Link from 'next/link'
import { ArrowUpRight, BadgeCheck, Globe2, ShieldQuestion } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Card, CardContent } from '@/components/ui/Card'
import { displayMedicineName } from '@/lib/who/queries'
import type { WhoMedicine } from '@/types'

const awareVariants = {
  Access: 'success',
  Watch: 'warning',
  Reserve: 'destructive',
  'Not recommended': 'destructive',
} as const

export function WhoMedicineCard({ medicine }: { medicine: WhoMedicine }) {
  return (
    <Card className="group h-full overflow-hidden rounded-3xl border-border bg-surface transition-all hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
      <CardContent className="flex h-full flex-col gap-6 p-7">
        <div className="flex items-start justify-between gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Globe2 size={23} aria-hidden="true" />
          </div>
          <Badge variant={medicine.verification_status === 'verified' ? 'success' : 'secondary'}>
            {medicine.verification_status === 'verified' ? (
              <><BadgeCheck className="mr-1" size={13} /> Terverifikasi</>
            ) : (
              <><ShieldQuestion className="mr-1" size={13} /> Belum ditinjau</>
            )}
          </Badge>
        </div>

        <div className="flex-1 space-y-3">
          <h2 className="text-2xl font-serif leading-tight text-text group-hover:text-primary">
            {displayMedicineName(medicine)}
          </h2>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-text-muted">Sumber data: WHO</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {medicine.is_who_eeml && <Badge>WHO Essential Medicine</Badge>}
          {medicine.aware_category && (
            <Badge variant={awareVariants[medicine.aware_category]}>AWaRe · {medicine.aware_category}</Badge>
          )}
          {medicine.is_not_on_eml && <Badge variant="outline">Tidak tercantum di EML</Badge>}
        </div>

        <Link
          href={`/obat/${medicine.slug}`}
          className="flex min-h-11 items-center justify-between border-t border-border pt-5 text-sm font-bold text-primary"
        >
          Lihat informasi WHO
          <ArrowUpRight size={18} className="transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
        </Link>
      </CardContent>
    </Card>
  )
}
