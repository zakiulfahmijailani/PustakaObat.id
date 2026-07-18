'use client'

import { FormEvent, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  Loader2,
  LockKeyhole,
  MessageSquare,
  Plus,
  Search,
  Send,
  UserRound,
  Users,
  X,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent } from '@/components/ui/Card'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import type { StaffRole } from '@/lib/auth/constants'
import type { DiscussionDetails, DiscussionSummary, StaffRecipient } from '@/lib/discussions/types'

const roleLabels: Record<StaffRole, string> = {
  admin: 'Admin',
  reviewer: 'Reviewer',
  editor: 'Editor',
  super_admin: 'Super Admin',
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(new Date(value))
}

function shortDate(value: string) {
  return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(value))
}

export function InternalDiscussionWorkspace({
  discussions,
  recipients,
  selectedDiscussion,
  viewer,
  basePath,
}: {
  discussions: DiscussionSummary[]
  recipients: StaffRecipient[]
  selectedDiscussion: DiscussionDetails | null
  viewer: { id: string; fullName: string; role: StaffRole | 'pharmacist' | 'verifier' }
  basePath: string
}) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [showComposer, setShowComposer] = useState(false)
  const [subject, setSubject] = useState('')
  const [firstMessage, setFirstMessage] = useState('')
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([])
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filteredDiscussions = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return discussions
    return discussions.filter((discussion) =>
      discussion.subject.toLowerCase().includes(normalized)
      || discussion.lastMessage.toLowerCase().includes(normalized)
      || discussion.participants.some((participant) => participant.fullName.toLowerCase().includes(normalized)),
    )
  }, [discussions, query])

  function toggleRecipient(id: string) {
    setSelectedRecipients((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function createDiscussion(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/discussions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, participantIds: selectedRecipients, message: firstMessage }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Percakapan tidak dapat dibuat.')
      setShowComposer(false)
      setSubject('')
      setFirstMessage('')
      setSelectedRecipients([])
      router.push(`${basePath}?thread=${result.discussionId}`)
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Percakapan tidak dapat dibuat.')
    } finally {
      setBusy(false)
    }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault()
    if (!selectedDiscussion) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/discussions/${selectedDiscussion.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: reply }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Pesan tidak dapat dikirim.')
      setReply('')
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Pesan tidak dapat dikirim.')
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(status: 'open' | 'resolved') {
    if (!selectedDiscussion) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/discussions/${selectedDiscussion.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Status tidak dapat diubah.')
      router.refresh()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Status tidak dapat diubah.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-7">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-primary">
            <LockKeyhole size={15} aria-hidden="true" /> Ruang staf privat
          </div>
          <h1 className="font-serif text-3xl text-text md:text-4xl">Diskusi Internal</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text-muted">
            Koordinasi privat antara Admin, Reviewer, Editor, dan Super Admin. Percakapan tidak tampil di halaman publik.
          </p>
        </div>
        <Button onClick={() => { setShowComposer(true); setError(null) }} className="min-h-12 rounded-full px-6">
          <Plus size={18} /> Percakapan baru
        </Button>
      </header>

      {error && <div role="alert" className="rounded-2xl border border-error/20 bg-error/10 p-4 text-sm text-error">{error}</div>}

      <div className="grid min-h-[640px] overflow-hidden rounded-[2rem] border border-border bg-surface shadow-sm lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className={`${selectedDiscussion ? 'hidden lg:flex' : 'flex'} min-h-0 flex-col border-r border-border bg-surface-2/35`} aria-label="Daftar percakapan">
          <div className="border-b border-border p-5">
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-border bg-surface px-4 focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/10">
              <Search size={17} className="text-text-muted" aria-hidden="true" />
              <span className="sr-only">Cari percakapan</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari diskusi atau peserta" className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none" />
            </label>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {filteredDiscussions.length > 0 ? filteredDiscussions.map((discussion) => (
              <Link
                key={discussion.id}
                href={`${basePath}?thread=${discussion.id}`}
                className={`mb-2 block rounded-2xl border p-4 transition-colors ${selectedDiscussion?.id === discussion.id ? 'border-primary/20 bg-primary/10' : 'border-transparent hover:border-border hover:bg-surface'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="line-clamp-2 font-semibold leading-5 text-text">{discussion.subject}</h2>
                  <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${discussion.status === 'open' ? 'bg-success' : 'bg-text-muted/40'}`} aria-label={discussion.status === 'open' ? 'Aktif' : 'Selesai'} />
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-text-muted">{discussion.lastMessage}</p>
                <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-text-muted">
                  <span>{discussion.participants.length} peserta · {discussion.messageCount} pesan</span>
                  <time dateTime={discussion.updatedAt}>{shortDate(discussion.updatedAt)}</time>
                </div>
              </Link>
            )) : (
              <div className="px-5 py-16 text-center">
                <MessageSquare className="mx-auto mb-4 text-text-muted/40" size={38} />
                <p className="font-semibold text-text">Belum ada percakapan</p>
                <p className="mt-1 text-xs leading-5 text-text-muted">Mulai diskusi privat dengan anggota tim.</p>
              </div>
            )}
          </div>
        </aside>

        <section className={`${selectedDiscussion ? 'flex' : 'hidden lg:flex'} min-w-0 flex-col`} aria-label="Isi percakapan">
          {selectedDiscussion ? (
            <>
              <div className="border-b border-border px-5 py-5 md:px-7">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link href={basePath} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-primary lg:hidden"><ChevronLeft size={15} /> Daftar diskusi</Link>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="font-serif text-2xl text-text">{selectedDiscussion.subject}</h2>
                      <Badge variant={selectedDiscussion.status === 'open' ? 'success' : 'secondary'}>
                        {selectedDiscussion.status === 'open' ? 'AKTIF' : 'SELESAI'}
                      </Badge>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedDiscussion.participants.map((participant) => (
                        <span key={participant.id} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-3 py-1 text-xs text-text-muted">
                          <UserRound size={12} /> {participant.fullName} · {roleLabels[participant.role]}
                        </span>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy}
                    onClick={() => changeStatus(selectedDiscussion.status === 'open' ? 'resolved' : 'open')}
                    className="shrink-0 rounded-full"
                  >
                    {selectedDiscussion.status === 'open' ? <CheckCircle2 size={16} /> : <CircleDot size={16} />}
                    <span className="hidden sm:inline">{selectedDiscussion.status === 'open' ? 'Tandai selesai' : 'Buka kembali'}</span>
                  </Button>
                </div>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto bg-background/55 p-5 md:p-7">
                {selectedDiscussion.messages.map((message) => {
                  const own = message.senderId === viewer.id
                  return (
                    <article key={message.id} className={`flex ${own ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[88%] md:max-w-[75%] ${own ? 'text-right' : ''}`}>
                        <div className={`mb-1.5 flex items-center gap-2 text-xs text-text-muted ${own ? 'justify-end' : ''}`}>
                          <strong className="text-text">{message.senderName}</strong>
                          <span>{roleLabels[message.senderRole]}</span>
                        </div>
                        <div className={`whitespace-pre-wrap rounded-3xl px-5 py-4 text-left text-sm leading-6 ${own ? 'rounded-br-md bg-primary text-white' : 'rounded-bl-md border border-border bg-surface text-text'}`}>
                          {message.body}
                        </div>
                        <time dateTime={message.createdAt} className="mt-1.5 block text-[11px] text-text-muted">{formatDate(message.createdAt)}</time>
                      </div>
                    </article>
                  )
                })}
              </div>

              <form onSubmit={sendReply} className="border-t border-border bg-surface p-4 md:p-5">
                <div className="flex items-end gap-3">
                  <label className="min-w-0 flex-1">
                    <span className="sr-only">Tulis balasan</span>
                    <Textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder={selectedDiscussion.status === 'resolved' ? 'Buka kembali percakapan untuk membalas.' : 'Tulis balasan untuk peserta diskusi...'}
                      disabled={busy || selectedDiscussion.status === 'resolved'}
                      maxLength={5000}
                      className="min-h-12 resize-none rounded-2xl"
                    />
                  </label>
                  <Button type="submit" size="icon" disabled={busy || !reply.trim() || selectedDiscussion.status === 'resolved'} className="h-12 w-12 shrink-0 rounded-full" aria-label="Kirim balasan">
                    {busy ? <Loader2 className="animate-spin" size={18} /> : <Send size={18} />}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center px-8 text-center">
              <div className="mb-5 rounded-3xl bg-primary/10 p-6 text-primary"><Users size={42} /></div>
              <h2 className="font-serif text-2xl text-text">Ruang koordinasi tim</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-text-muted">Pilih percakapan atau mulai diskusi baru dengan staf yang relevan.</p>
            </div>
          )}
        </section>
      </div>

      {showComposer && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-text/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-discussion-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setShowComposer(false) }}>
          <Card className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border-none shadow-2xl">
            <CardContent className="p-6 md:p-8">
              <div className="mb-7 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Percakapan privat</p>
                  <h2 id="new-discussion-title" className="mt-1 font-serif text-2xl text-text">Mulai diskusi internal</h2>
                </div>
                <button type="button" onClick={() => setShowComposer(false)} disabled={busy} className="rounded-full p-2 text-text-muted hover:bg-surface-2" aria-label="Tutup"><X size={20} /></button>
              </div>
              <form onSubmit={createDiscussion} className="space-y-6">
                <Input label="Subjek diskusi" value={subject} onChange={(event) => setSubject(event.target.value)} minLength={4} maxLength={160} required placeholder="Contoh: Konfirmasi dosis vankomisin pada data batch" />
                <fieldset>
                  <legend className="mb-3 text-sm font-bold text-text">Pilih penerima</legend>
                  <div className="grid max-h-56 gap-2 overflow-y-auto rounded-2xl border border-border p-3 sm:grid-cols-2">
                    {recipients.map((recipient) => (
                      <label key={recipient.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${selectedRecipients.includes(recipient.id) ? 'border-primary/30 bg-primary/5' : 'border-transparent hover:bg-surface-2'}`}>
                        <input type="checkbox" checked={selectedRecipients.includes(recipient.id)} onChange={() => toggleRecipient(recipient.id)} className="mt-1 accent-primary" />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-text">{recipient.fullName}</span>
                          <span className="block truncate text-xs text-text-muted">{roleLabels[recipient.role]} · {recipient.email}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  {recipients.length === 0 && <p className="mt-2 text-sm text-warning">Belum ada staf aktif lain yang dapat dipilih.</p>}
                </fieldset>
                <Textarea label="Pesan pertama" value={firstMessage} onChange={(event) => setFirstMessage(event.target.value)} minLength={2} maxLength={5000} required placeholder="Tuliskan konteks, pertanyaan, atau keputusan yang perlu dibahas..." className="min-h-36 rounded-2xl" />
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <Button type="button" variant="outline" onClick={() => setShowComposer(false)} disabled={busy}>Batal</Button>
                  <Button type="submit" disabled={busy || selectedRecipients.length === 0 || subject.trim().length < 4 || firstMessage.trim().length < 2}>
                    {busy ? <Loader2 className="animate-spin" size={17} /> : <Send size={17} />} Buat percakapan
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
