import { BookOpenText, Cross, Pill } from 'lucide-react'

export function MedicineHeroArt() {
  return (
    <div className="relative mx-auto aspect-[4/3] w-full max-w-[360px]" aria-hidden="true">
      <div className="absolute inset-[7%] rounded-full bg-primary/10" />
      <div className="absolute left-[15%] top-[23%] flex h-20 w-40 -rotate-[28deg] overflow-hidden rounded-full border-[3px] border-primary bg-white shadow-sm dark:bg-surface">
        <span className="w-1/2" />
        <span className="w-1/2 bg-primary" />
      </div>
      <div className="absolute bottom-[15%] right-[13%] flex h-20 w-20 items-center justify-center rounded-full border-[3px] border-primary bg-surface text-primary shadow-sm">
        <Cross size={35} strokeWidth={2} />
      </div>
      <BookOpenText className="absolute bottom-[8%] left-[15%] text-primary/60" size={48} strokeWidth={1.5} />
      <Pill className="absolute right-[14%] top-[10%] text-primary/50" size={34} strokeWidth={1.6} />
    </div>
  )
}
