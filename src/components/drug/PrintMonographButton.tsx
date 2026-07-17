'use client'

import { Download } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export function PrintMonographButton() {
  return (
    <Button type="button" variant="outline" onClick={() => window.print()} className="print-hide rounded-xl border-2 border-text px-5 text-text">
      <Download size={17} /> Simpan sebagai PDF
    </Button>
  )
}
