'use client'

import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function MedicineCatalogError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="container px-4 pb-24 pt-10">
      <div className="rounded-[2rem] border border-error/20 bg-error/5 p-12 text-center">
        <AlertTriangle className="mx-auto mb-5 text-error" size={40} />
        <h1 className="text-3xl font-serif text-text">Katalog tidak dapat dimuat</h1>
        <p className="mx-auto mt-3 max-w-lg text-text-muted">Terjadi gangguan saat membaca data WHO. Silakan coba lagi.</p>
        <Button className="mt-6" onClick={reset}>Coba lagi</Button>
      </div>
    </div>
  )
}
