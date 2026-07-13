import { Skeleton } from '@/components/ui/Skeleton'

export default function MedicineCatalogLoading() {
  return (
    <div className="container space-y-10 px-4 pb-24 pt-10" aria-label="Memuat katalog obat WHO">
      <div className="space-y-4 border-b border-border pb-10"><Skeleton className="h-6 w-44" /><Skeleton className="h-14 max-w-3xl" /><Skeleton className="h-6 max-w-2xl" /></div>
      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <Skeleton key={index} className="h-72 rounded-3xl" />)}</div>
    </div>
  )
}
