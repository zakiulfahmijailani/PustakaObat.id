export interface EditorActionCounts {
  new_section_count: number
  draft_section_count: number
  revision_section_count: number
}

export function describeEditorAction(counts: EditorActionCounts) {
  if (counts.revision_section_count > 0) return {
    label: `${counts.revision_section_count} bagian perlu diperbaiki`,
    instruction: 'Buka catatan Reviewer, perbaiki draf, lalu kirim kembali.',
    action: 'Perbaiki sekarang',
    kind: 'revision' as const,
  }
  if (counts.draft_section_count > 0) return {
    label: `${counts.draft_section_count} draf belum dikirim`,
    instruction: 'Lanjutkan pemeriksaan draf dan kirim ke Reviewer.',
    action: 'Lanjutkan draf',
    kind: 'draft' as const,
  }
  return {
    label: `${counts.new_section_count} bagian siap dimulai`,
    instruction: 'Pilih bagian, periksa terjemahan FDA lengkap, lalu simpan draf pertama.',
    action: 'Mulai menyusun',
    kind: 'new' as const,
  }
}

export function resolveInitialSection(requested: string | undefined, available: string[]) {
  return requested && available.includes(requested) ? requested : (available[0] || '')
}
