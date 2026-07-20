'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Clock3, Search, X } from 'lucide-react'

const POPULAR_SEARCHES = ['amoxicillin', 'paracetamol', 'metformin']
const STORAGE_KEY = 'pustakaobat-recent-searches'

export function MedicineSearchForm({
  defaultValue = '',
  aware,
  essential,
  className,
  prominent = false,
}: {
  defaultValue?: string
  aware?: string
  essential?: string
  className?: string
  prominent?: boolean
}) {
  const inputId = useId()
  const [query, setQuery] = useState(defaultValue)
  const [recent, setRecent] = useState<string[]>([])

  useEffect(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '[]')
      if (Array.isArray(saved)) setRecent(saved.filter((value): value is string => typeof value === 'string').slice(0, 3))
    } catch {
      setRecent([])
    }
  }, [])

  const rememberSearch = () => {
    const value = query.trim()
    if (!value) return
    const next = [value, ...recent.filter((item) => item.toLowerCase() !== value.toLowerCase())].slice(0, 3)
    setRecent(next)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  const clearRecent = () => {
    setRecent([])
    window.localStorage.removeItem(STORAGE_KEY)
  }

  return (
    <div className={className}>
      <form
        action="/obat"
        method="get"
        onSubmit={rememberSearch}
        role="search"
        className="flex w-full items-center overflow-hidden rounded-2xl border-2 border-text bg-surface p-1.5 shadow-[0_4px_0_var(--color-text)] transition-[border-color,box-shadow] duration-200 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10"
      >
        <label htmlFor={inputId} className="sr-only">Cari nama obat</label>
        <Search className="ml-3 shrink-0 text-primary" size={21} aria-hidden="true" />
        <input
          id={inputId}
          name="q"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          list={`${inputId}-suggestions`}
          autoComplete="off"
          placeholder={prominent ? 'Ketik nama obat, mis. parasetamol atau amoksisilin...' : 'Cari nama generik atau nama dagang'}
          className="min-w-0 flex-1 bg-transparent px-5 py-3 text-base outline-none placeholder:text-text-muted/75"
        />
        <datalist id={`${inputId}-suggestions`}>
          {[...recent, ...POPULAR_SEARCHES].map((item) => <option key={item} value={item} />)}
        </datalist>
        {aware && <input type="hidden" name="aware" value={aware} />}
        {essential && <input type="hidden" name="essential" value={essential} />}
        <button type="submit" className="inline-flex min-h-12 shrink-0 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-white transition-colors hover:bg-primary-hover sm:px-6">
          Cari <ArrowRight size={17} aria-hidden="true" />
        </button>
      </form>

      <div className="mt-3 flex min-h-7 flex-wrap items-center gap-x-3 gap-y-2 text-sm text-text-muted">
        {recent.length > 0 ? (
          <>
            <span className="inline-flex items-center gap-1.5"><Clock3 size={15} aria-hidden="true" /> Terakhir:</span>
            {recent.map((item) => <Link key={item} href={`/obat?q=${encodeURIComponent(item)}`} className="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">{item}</Link>)}
            <button type="button" onClick={clearRecent} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-text-muted hover:bg-surface-2 hover:text-text" aria-label="Hapus riwayat pencarian"><X size={15} /> Hapus</button>
          </>
        ) : (
          <>
            <span>Coba:</span>
            {POPULAR_SEARCHES.map((item) => <Link key={item} href={`/obat?q=${item}`} className="font-semibold text-primary underline decoration-primary/30 underline-offset-4 hover:decoration-primary">{item}</Link>)}
          </>
        )}
      </div>
    </div>
  )
}
