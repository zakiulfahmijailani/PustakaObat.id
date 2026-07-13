export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          role: 'pharmacist' | 'verifier' | 'admin'
          sipa_number: string | null
          institution: string | null
          is_active: boolean
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          role?: 'pharmacist' | 'verifier' | 'admin'
          sipa_number?: string | null
          institution?: string | null
          is_active?: boolean
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          role?: 'pharmacist' | 'verifier' | 'admin'
          sipa_number?: string | null
          institution?: string | null
          is_active?: boolean
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      drug_categories: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          created_at?: string
        }
      }
      drugs: {
        Row: {
          id: string
          name: string
          brand_names: string[]
          slug: string
          category_id: string | null
          drug_class: string | null
          summary: string | null
          status: 'draft' | 'review' | 'published' | 'archived'
          submitted_by: string | null
          verified_by: string | null
          published_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          brand_names?: string[]
          slug: string
          category_id?: string | null
          drug_class?: string | null
          summary?: string | null
          status?: 'draft' | 'review' | 'published' | 'archived'
          submitted_by?: string | null
          verified_by?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          brand_names?: string[]
          slug?: string
          category_id?: string | null
          drug_class?: string | null
          summary?: string | null
          status?: 'draft' | 'review' | 'published' | 'archived'
          submitted_by?: string | null
          verified_by?: string | null
          published_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      drug_monograph_sections: {
        Row: {
          id: string
          drug_id: string
          section_type:
            | 'indication'
            | 'contraindication'
            | 'dosage'
            | 'side_effects'
            | 'drug_interactions'
            | 'mechanism'
            | 'pharmacokinetics'
            | 'storage'
            | 'warnings'
            | 'pregnancy_category'
            | 'references'
          content: string
          version: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          drug_id: string
          section_type:
            | 'indication'
            | 'contraindication'
            | 'dosage'
            | 'side_effects'
            | 'drug_interactions'
            | 'mechanism'
            | 'pharmacokinetics'
            | 'storage'
            | 'warnings'
            | 'pregnancy_category'
            | 'references'
          content: string
          version?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          drug_id?: string
          section_type?:
            | 'indication'
            | 'contraindication'
            | 'dosage'
            | 'side_effects'
            | 'drug_interactions'
            | 'mechanism'
            | 'pharmacokinetics'
            | 'storage'
            | 'warnings'
            | 'pregnancy_category'
            | 'references'
          content?: string
          version?: number
          created_at?: string
          updated_at?: string
        }
      }
      public_questions: {
        Row: {
          id: string
          question_text: string
          asker_name: string | null
          asker_email: string | null
          drug_id: string | null
          status: 'pending' | 'answered' | 'closed'
          answered_by: string | null
          answer_text: string | null
          answered_at: string | null
          is_published: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          question_text: string
          asker_name?: string | null
          asker_email?: string | null
          drug_id?: string | null
          status?: 'pending' | 'answered' | 'closed'
          answered_by?: string | null
          answer_text?: string | null
          answered_at?: string | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          question_text?: string
          asker_name?: string | null
          asker_email?: string | null
          drug_id?: string | null
          status?: 'pending' | 'answered' | 'closed'
          answered_by?: string | null
          answer_text?: string | null
          answered_at?: string | null
          is_published?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          user_id: string | null
          action: string
          resource_type: string | null
          resource_id: string | null
          metadata: Json
          ip_address: string | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          action: string
          resource_type?: string | null
          resource_id?: string | null
          metadata?: Json
          ip_address?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          action?: string
          resource_type?: string | null
          resource_id?: string | null
          metadata?: Json
          ip_address?: string | null
          created_at?: string
        }
      }
      who_medicines: {
        Row: {
          id: string
          source_key: string
          external_id: string | null
          medicine_name: string
          editorial_name: string | null
          normalized_name: string
          slug: string
          source_name: 'WHO'
          source_version: string
          official_source_url: string | null
          is_who_eeml: boolean
          aware_category: 'Access' | 'Watch' | 'Reserve' | 'Not recommended' | null
          is_monitoring_only: boolean
          is_not_on_eml: boolean
          data_status: 'WHO_ONLY' | 'WHO_AND_AWARE' | 'AWARE_ONLY'
          import_status: string
          source_retrieved_at: string | null
          source_generated_at: string
          source_payload: Json
          payload_checksum: string
          last_import_checksum: string
          publication_status: 'published' | 'hidden'
          verification_status: 'pending' | 'verified' | 'rejected' | 'needs_revision'
          is_active: boolean
          reviewed_by: string | null
          reviewed_at: string | null
          manually_edited_at: string | null
          drug_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          source_key: string
          external_id?: string | null
          medicine_name: string
          editorial_name?: string | null
          normalized_name: string
          slug: string
          source_name?: 'WHO'
          source_version: string
          official_source_url?: string | null
          is_who_eeml?: boolean
          aware_category?: 'Access' | 'Watch' | 'Reserve' | 'Not recommended' | null
          is_monitoring_only?: boolean
          is_not_on_eml?: boolean
          data_status: 'WHO_ONLY' | 'WHO_AND_AWARE' | 'AWARE_ONLY'
          import_status?: string
          source_retrieved_at?: string | null
          source_generated_at: string
          source_payload?: Json
          payload_checksum: string
          last_import_checksum: string
          publication_status?: 'published' | 'hidden'
          verification_status?: 'pending' | 'verified' | 'rejected' | 'needs_revision'
          is_active?: boolean
          reviewed_by?: string | null
          reviewed_at?: string | null
          manually_edited_at?: string | null
          drug_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          source_key?: string
          external_id?: string | null
          medicine_name?: string
          editorial_name?: string | null
          normalized_name?: string
          slug?: string
          source_name?: 'WHO'
          source_version?: string
          official_source_url?: string | null
          is_who_eeml?: boolean
          aware_category?: 'Access' | 'Watch' | 'Reserve' | 'Not recommended' | null
          is_monitoring_only?: boolean
          is_not_on_eml?: boolean
          data_status?: 'WHO_ONLY' | 'WHO_AND_AWARE' | 'AWARE_ONLY'
          import_status?: string
          source_retrieved_at?: string | null
          source_generated_at?: string
          source_payload?: Json
          payload_checksum?: string
          last_import_checksum?: string
          publication_status?: 'published' | 'hidden'
          verification_status?: 'pending' | 'verified' | 'rejected' | 'needs_revision'
          is_active?: boolean
          reviewed_by?: string | null
          reviewed_at?: string | null
          manually_edited_at?: string | null
          drug_id?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      who_medicine_verifications: {
        Row: {
          id: string
          medicine_id: string
          previous_status: 'pending' | 'verified' | 'rejected' | 'needs_revision'
          status: 'verified' | 'rejected' | 'needs_revision'
          note: string | null
          verified_by: string
          created_at: string
        }
        Insert: {
          id?: string
          medicine_id: string
          previous_status: 'pending' | 'verified' | 'rejected' | 'needs_revision'
          status: 'verified' | 'rejected' | 'needs_revision'
          note?: string | null
          verified_by: string
          created_at?: string
        }
        Update: {
          id?: string
          medicine_id?: string
          previous_status?: 'pending' | 'verified' | 'rejected' | 'needs_revision'
          status?: 'verified' | 'rejected' | 'needs_revision'
          note?: string | null
          verified_by?: string
          created_at?: string
        }
      }
      who_import_runs: {
        Row: {
          id: string
          source_name: 'WHO'
          source_version: string
          source_file: string
          manifest_hash: string
          dataset_checksum: string
          schema_version: string
          record_count: number
          inserted_count: number
          updated_count: number
          skipped_count: number
          failed_count: number
          status: 'completed' | 'failed'
          started_at: string
          completed_at: string
          error_message: string | null
          imported_at: string
        }
        Insert: {
          id?: string
          source_name?: 'WHO'
          source_version: string
          source_file: string
          manifest_hash: string
          dataset_checksum: string
          schema_version: string
          record_count: number
          inserted_count?: number
          updated_count?: number
          skipped_count?: number
          failed_count?: number
          status: 'completed' | 'failed'
          started_at: string
          completed_at?: string
          error_message?: string | null
          imported_at?: string
        }
        Update: {
          id?: string
          source_name?: 'WHO'
          source_version?: string
          source_file?: string
          manifest_hash?: string
          dataset_checksum?: string
          schema_version?: string
          record_count?: number
          inserted_count?: number
          updated_count?: number
          skipped_count?: number
          failed_count?: number
          status?: 'completed' | 'failed'
          started_at?: string
          completed_at?: string
          error_message?: string | null
          imported_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_role: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      is_active_user: {
        Args: Record<PropertyKey, never>
        Returns: boolean
      }
      has_role: {
        Args: {
          _roles: string[]
        }
        Returns: boolean
      }
      import_who_catalog: {
        Args: {
          _dataset_checksum: string
          _manifest_hash: string
          _schema_version: string
          _source_version: string
          _source_file: string
          _generated_at: string
          _started_at: string
          _skipped_count: number
          _failed_count: number
          _records: Json
        }
        Returns: Json
      }
      review_who_medicine: {
        Args: {
          _record_id: string
          _decision: 'verified' | 'rejected' | 'needs_revision'
          _note?: string | null
        }
        Returns: Database['public']['Tables']['who_medicines']['Row']
      }
      admin_update_who_medicine: {
        Args: {
          _record_id: string
          _editorial_name: string
          _publication_status: 'published' | 'hidden'
          _is_active: boolean
        }
        Returns: Database['public']['Tables']['who_medicines']['Row']
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}
