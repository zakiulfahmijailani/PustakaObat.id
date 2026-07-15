import { z } from 'zod'

export const reviewerOnboardingSchema = z.object({
  fullName: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter').max(150),
  institution: z.string().trim().min(3, 'Nama institusi minimal 3 karakter').max(200),
  professionalLicenseNumber: z.string().trim().min(4, 'Nomor identitas profesi wajib diisi').max(100),
  sipaNumber: z.string().trim().max(100).optional().default(''),
  phone: z.string().trim().max(30).optional().default(''),
})

export const reviewerApplicationUpdateSchema = z.object({
  institution: z.string().trim().min(3, 'Nama institusi minimal 3 karakter').max(200),
  professionalLicenseNumber: z.string().trim().min(4, 'Nomor identitas profesi wajib diisi').max(100),
  sipaNumber: z.string().trim().max(100).optional().default(''),
  phone: z.string().trim().max(30).optional().default(''),
})

export const adminUserActionSchema = z.object({
  profileId: z.string().uuid(),
  action: z.enum(['approve', 'reject', 'needs_revision', 'suspend', 'reactivate']),
  note: z.string().trim().max(2000).optional().default(''),
}).superRefine((value, context) => {
  if (['reject', 'needs_revision', 'suspend'].includes(value.action) && !value.note) {
    context.addIssue({ code: 'custom', path: ['note'], message: 'Catatan wajib diisi untuk tindakan ini.' })
  }
})
