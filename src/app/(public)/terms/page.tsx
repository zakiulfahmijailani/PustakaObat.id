import { CURRENT_TERMS_VERSION, TERMS_SECTIONS } from '@/lib/legal/terms'

export const metadata = { title: 'Terms & Conditions · PustakaObat.id' }

export default function TermsPage() {
  return <div className="container max-w-4xl py-16 md:py-24">
    <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Versi {CURRENT_TERMS_VERSION}</p>
    <h1 className="mt-3 font-serif text-4xl text-text md:text-6xl">Terms & Conditions</h1>
    <p className="mt-5 max-w-3xl leading-8 text-text-muted">Ketentuan awal penggunaan PustakaObat.id. Naskah ini perlu ditinjau kembali ketika dokumen legal final dari pemilik produk tersedia.</p>
    <div className="mt-10 space-y-6">
      {TERMS_SECTIONS.map((section, index) => <section key={section.title} className="rounded-3xl border border-border bg-surface p-6 md:p-8">
        <h2 className="font-serif text-2xl text-text">{index + 1}. {section.title}</h2>
        <p className="mt-3 leading-8 text-text-muted">{section.body}</p>
      </section>)}
    </div>
  </div>
}
