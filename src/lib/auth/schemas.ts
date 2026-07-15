import { z } from 'zod'

const password = z.string()
  .min(10, 'Password minimal 10 karakter')
  .max(128, 'Password maksimal 128 karakter')
  .regex(/[a-z]/, 'Password harus memiliki huruf kecil')
  .regex(/[A-Z]/, 'Password harus memiliki huruf besar')
  .regex(/[0-9]/, 'Password harus memiliki angka')

export const loginSchema = z.object({
  email: z.string().trim().email('Email tidak valid').max(254),
  password: z.string().min(1, 'Password wajib diisi').max(128),
})

export const reviewerRegistrationSchema = z.object({
  fullName: z.string().trim().min(3, 'Nama lengkap minimal 3 karakter').max(150),
  email: z.string().trim().email('Email tidak valid').max(254),
  password,
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
