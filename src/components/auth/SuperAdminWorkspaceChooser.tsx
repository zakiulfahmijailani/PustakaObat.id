'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FilePenLine, Loader2, ShieldCheck, Stethoscope } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'

const workspaces = [
  { key: 'editor', title: 'Editor', description: 'Susun, rapikan, dan kirim draf untuk ditinjau.', icon: FilePenLine },
  { key: 'reviewer', title: 'Reviewer', description: 'Periksa ketepatan informasi dan beri keputusan review.', icon: Stethoscope },
  { key: 'admin', title: 'Admin', description: 'Kelola pengguna, data, audit, dan pengaturan platform.', icon: ShieldCheck },
] as const

export function SuperAdminWorkspaceChooser() {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(workspace: typeof workspaces[number]['key']) {
    setPending(workspace); setError(null)
    try {
      const response = await fetch('/api/auth/workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspace }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Pilihan ruang kerja tidak dapat disimpan.')
      router.push(result.redirectTo)
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Terjadi kesalahan.')
      setPending(null)
    }
  }

  return <div className="grid w-full gap-5 md:grid-cols-3">{workspaces.map((workspace) => <Card key={workspace.key} className="border-none bg-surface/80 shadow-xl backdrop-blur"><CardContent className="flex h-full flex-col p-7">
    <div className="mb-6 w-fit rounded-2xl bg-primary/10 p-4 text-primary"><workspace.icon size={28} /></div>
    <h2 className="font-serif text-2xl text-text">{workspace.title}</h2>
    <p className="mt-2 flex-1 text-sm leading-relaxed text-text-muted">{workspace.description}</p>
    <Button className="mt-7" disabled={Boolean(pending)} onClick={() => choose(workspace.key)}>{pending === workspace.key ? <Loader2 className="animate-spin" size={17} /> : null}Masuk sebagai {workspace.title}</Button>
  </CardContent></Card>)}{error && <p className="md:col-span-3 rounded-2xl bg-error/10 p-4 text-sm text-error">{error}</p>}</div>
}
