import React from 'react'
import Link from 'next/link'
import { Pill, CheckCircle2, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Drug } from '@/types'

interface DrugCardProps {
  drug: Drug & {
    drug_categories: { name: string } | null
    verifier: { full_name: string } | null
  }
}

export const DrugCard = ({ drug }: DrugCardProps) => {
  return (
    <Link href={`/obat/${drug.slug}`} className="group">
      <Card className="h-full border border-border/60 hover:border-primary/40 bg-surface/40 hover:bg-white backdrop-blur-sm transition-all duration-300">
        <CardContent className="p-6 flex flex-col h-full">
          <div className="flex justify-between items-start mb-4">
            <div className="w-12 h-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <Pill size={24} />
            </div>
            {drug.status === 'published' && (
              <Badge variant="success" className="bg-success/5 border-success/10 text-xs uppercase font-bold py-1">
                <CheckCircle2 size={12} className="mr-1" />
                Diverifikasi
              </Badge>
            )}
          </div>

          <div className="space-y-4 flex-grow">
            <div>
              <h3 className="text-xl font-bold font-serif text-text group-hover:text-primary transition-colors leading-tight mb-1">
                {drug.name}
              </h3>
              <p className="text-xs font-bold text-primary uppercase tracking-tighter">
                {drug.drug_class || 'Golongan Obat'}
              </p>
            </div>

            <p className="text-sm text-text-muted line-clamp-3 leading-relaxed">
              {drug.summary || 'Informasi monografi obat lengkap mengenai indikasi, dosis, dan efek samping.'}
            </p>
          </div>

          <div className="mt-8 pt-4 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs font-bold text-text-muted uppercase tracking-wider">
              {drug.drug_categories?.name || 'Umum'}
            </span>
            <div className="flex items-center gap-1 text-primary font-bold text-xs group-hover:translate-x-1 transition-transform">
              DETAIL <ChevronRight size={14} />
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
