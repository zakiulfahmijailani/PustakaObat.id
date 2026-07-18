import { Skeleton } from '@/components/ui/Skeleton'

export function PublicPageSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="container px-4 pb-24 pt-6" role="status" aria-live="polite" aria-label="Memuat halaman">
      <span className="sr-only">Konten sedang dimuat…</span>
      <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
        <div className="space-y-4">
          <Skeleton className="h-7 w-44 rounded-full" />
          <Skeleton className="h-12 w-full max-w-2xl rounded-xl md:h-16" />
          <Skeleton className="h-6 w-4/5 max-w-xl" />
          <Skeleton className="h-16 w-full max-w-2xl rounded-2xl" />
        </div>
        {!compact && <Skeleton className="hidden h-64 rounded-3xl lg:block" />}
      </div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)}
      </div>
      <div className="mt-10 space-y-3">
        {Array.from({ length: compact ? 3 : 6 }, (_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}
      </div>
    </div>
  )
}

export function WorkspacePageSkeleton() {
  return (
    <div className="space-y-8" role="status" aria-live="polite" aria-label="Memuat ruang kerja">
      <span className="sr-only">Ruang kerja sedang dimuat…</span>
      <div className="space-y-3"><Skeleton className="h-4 w-32" /><Skeleton className="h-12 w-full max-w-xl" /><Skeleton className="h-5 w-full max-w-2xl" /></div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-36 rounded-3xl" />)}</div>
      <div className="grid gap-5 md:grid-cols-2">{Array.from({ length: 2 }, (_, index) => <Skeleton key={index} className="h-56 rounded-3xl" />)}</div>
    </div>
  )
}
