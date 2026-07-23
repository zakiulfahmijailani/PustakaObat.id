export interface StagingDrugConcept {
  drug_key: string
  preferred_name: string
  normalized_name: string
  slug: string
  seed_type: 'ingredient' | 'combination'
  ingredient_parts: string[]
  ingredient_count: number
  rxcui: string | null
  rxnorm_name: string | null
  rxnorm_tty: string | null
  identity_status: 'validated' | 'provisional'
  section_names: string[]
  formulations: string[]
  indication_names: string[]
  aware_category: string | null
  coverage: Record<string, string>
  core_editorial_candidate: boolean
  is_pilot: boolean
  editorial_status: 'staging'
  public_status: 'hidden'
  publication_eligible: false
  bpom_status: 'BPOM_PENDING'
  pipeline_version: string
  source_url: string | null
  evidence_count?: number
  source_count?: number
  covered_section_count?: number
}

export interface StagingEvidence {
  evidence_id: string
  drug_key: string
  section_type: string
  source_name: string
  source_document_id: string
  source_section: string
  source_text: string
  source_version: string | null
  ingredient_match_status: string
  product_specific: boolean
  license_status: string
  retrieved_at: string | null
  review_status: 'unreviewed'
  publication_eligible: false
}

export interface StagingSourceDocument {
  source_document_key: string
  drug_key: string
  source_name: string
  source_document_id: string
  source_url: string | null
  validation_status: string
  usage_scope: string
  retrieved_at: string | null
}

export interface EditorialDraft {
  id: string
  drug_key: string
  section_type: string
  content_indonesian: string
  status: 'draft' | 'submitted' | 'changes_requested' | 'pharmacist_approved'
  version: number
  authored_by: string
  submitted_at: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  reviewer_note: string | null
  source_label_id: string | null
  source_section_types: string[]
  source_label_effective_time: string | null
  source_binding_method: string | null
  source_bound_at: string | null
  publication_eligible: false
  created_at: string
  updated_at: string
}

/** A hidden AI candidate that a staff member may turn into an editable draft. */
export interface IndonesianCandidateDraft {
  drug_key: string
  section_type: string
  title_indonesian: string
  content_indonesian: string
  safety_notes: string
  automatic_qc_issues: unknown[]
  generation_method: string
}

export interface EditorialEvent {
  id: string
  draft_id: string | null
  drug_key: string
  actor_id: string
  action: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface MonographPublication {
  id: string
  drug_key: string
  drug_id: string
  published_by: string
  published_at: string
  published_section_count: number
}
