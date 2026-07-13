export const AWARE_CATEGORIES = ['Access', 'Watch', 'Reserve', 'Not recommended'] as const
export const WHO_VERIFICATION_STATUSES = ['pending', 'verified', 'rejected', 'needs_revision'] as const
export const WHO_PAGE_SIZE = 24

export const WHO_BPOM_DISCLAIMER =
  'Informasi ini berasal dari data WHO dan tidak menunjukkan status registrasi BPOM atau ketersediaan obat di Indonesia.'

export const VERIFICATION_LABELS = {
  pending: 'Menunggu tinjauan apoteker',
  verified: 'Diverifikasi apoteker Apoteq',
  rejected: 'Ditolak',
  needs_revision: 'Perlu perbaikan',
} as const

export const AWARE_DESCRIPTIONS = {
  Access: 'Antibiotik pilihan utama untuk sejumlah infeksi umum menurut klasifikasi WHO AWaRe.',
  Watch: 'Antibiotik yang perlu dipantau dan digunakan secara hati-hati untuk menjaga efektivitasnya.',
  Reserve: 'Antibiotik cadangan untuk infeksi tertentu ketika pilihan lain tidak memadai.',
  'Not recommended': 'Kombinasi antibiotik yang tidak direkomendasikan dalam klasifikasi WHO AWaRe.',
} as const
