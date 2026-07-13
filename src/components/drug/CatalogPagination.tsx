import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { WHO_PAGE_SIZE } from '@/lib/who/constants'

interface CatalogPaginationProps {
  page: number
  count: number
  pathname: string
  params: Record<string, string | undefined>
}

export function CatalogPagination({ page, count, pathname, params }: CatalogPaginationProps) {
  const pages = Math.max(1, Math.ceil(count / WHO_PAGE_SIZE))
  if (pages <= 1) return null

  const hrefFor = (target: number) => {
    const search = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => value && search.set(key, value))
    search.set('page', String(target))
    return `${pathname}?${search.toString()}`
  }

  return (
    <nav aria-label="Paginasi katalog obat" className="flex items-center justify-center gap-4 pt-8">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="flex min-h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-bold hover:border-primary hover:text-primary">
          <ChevronLeft size={17} /> Sebelumnya
        </Link>
      ) : <span />}
      <span className="text-sm text-text-muted">Halaman <strong className="text-text">{page}</strong> dari {pages}</span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className="flex min-h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-bold hover:border-primary hover:text-primary">
          Berikutnya <ChevronRight size={17} />
        </Link>
      ) : <span />}
    </nav>
  )
}
