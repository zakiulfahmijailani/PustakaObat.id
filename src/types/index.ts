export * from './database'

import { Database } from './database'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type Drug = Database['public']['Tables']['drugs']['Row']
export type DrugCategory = Database['public']['Tables']['drug_categories']['Row']
export type DrugMonographSection = Database['public']['Tables']['drug_monograph_sections']['Row']
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']
export type WhoMedicine = Database['public']['Tables']['who_medicines']['Row']
export type WhoMedicineVerification = Database['public']['Tables']['who_medicine_verifications']['Row']
export type WhoImportRun = Database['public']['Tables']['who_import_runs']['Row']

export type UserRole = Profile['role']
export type DrugStatus = Drug['status']
export type SectionType = DrugMonographSection['section_type']
