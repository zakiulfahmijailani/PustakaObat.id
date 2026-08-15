-- Reviewer professional profile, private CV, Terms acceptance, and pilot cleanup.

alter table public.reviewer_applications
  add column if not exists work_experience text,
  add column if not exists awards text,
  add column if not exists publications text,
  add column if not exists linkedin_url text,
  add column if not exists instagram_url text,
  add column if not exists youtube_url text,
  add column if not exists cv_file_name text,
  add column if not exists cv_mime_type text,
  add column if not exists cv_file_size integer,
  add column if not exists cv_file_data bytea,
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz;

update public.monograph_staging_drugs
set is_pilot = false, updated_at = now()
where normalized_name = 'amoxicillin' and is_pilot = true;

comment on column public.reviewer_applications.cv_file_data is
  'Private reviewer CV PDF, maximum 5 MB. Never selected by public queries.';
comment on column public.reviewer_applications.terms_version is
  'Terms version accepted when the reviewer application was submitted.';
