import { z } from 'zod'

const participantId = z.string().uuid('Peserta tidak valid.')

export const createDiscussionSchema = z.object({
  subject: z.string().trim().min(4, 'Subjek minimal 4 karakter.').max(160, 'Subjek maksimal 160 karakter.'),
  participantIds: z.array(participantId).min(1, 'Pilih minimal satu penerima.').max(20, 'Maksimal 20 penerima.').refine(
    (ids) => new Set(ids).size === ids.length,
    'Peserta tidak boleh duplikat.',
  ),
  message: z.string().trim().min(2, 'Pesan minimal 2 karakter.').max(5000, 'Pesan maksimal 5.000 karakter.'),
})

export const discussionMessageSchema = z.object({
  message: z.string().trim().min(1, 'Pesan tidak boleh kosong.').max(5000, 'Pesan maksimal 5.000 karakter.'),
})

export const discussionStatusSchema = z.object({
  status: z.enum(['open', 'resolved']),
})

export const discussionIdSchema = z.string().uuid('Percakapan tidak valid.')
