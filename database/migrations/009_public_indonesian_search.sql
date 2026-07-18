-- Public, non-clinical projection of Indonesian names and search aliases.
-- This intentionally contains no draft content, evidence, provenance, or
-- review notes. It is safe for the public catalogue to query.

create table if not exists public.drug_search_localizations (
  drug_key text primary key,
  canonical_name text not null,
  preferred_name_indonesian text not null,
  has_monograph_under_review boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (length(trim(preferred_name_indonesian)) > 0)
);

create index if not exists drug_search_localizations_canonical_name_idx
  on public.drug_search_localizations(canonical_name);

create table if not exists public.drug_search_aliases (
  id bigint generated always as identity primary key,
  drug_key text not null references public.drug_search_localizations(drug_key) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  language_code text not null,
  alias_type text not null,
  priority integer not null default 50,
  unique (drug_key, normalized_alias, language_code),
  check (length(trim(alias)) > 0)
);

create index if not exists drug_search_aliases_lookup_idx
  on public.drug_search_aliases(normalized_alias, language_code);

create or replace function public.refresh_indonesian_public_search_index()
returns void
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  insert into public.drug_search_localizations (
    drug_key, canonical_name, preferred_name_indonesian, has_monograph_under_review
  )
  select
    n.drug_key,
    trim(regexp_replace(lower(s.normalized_name), '[^a-z0-9]+', ' ', 'g')),
    n.preferred_name_indonesian,
    exists (
      select 1
      from public.monograph_staging_indonesian_drafts d
      where d.drug_key = n.drug_key and d.review_status = 'draft_ai'
    )
  from public.monograph_staging_indonesian_names n
  join public.monograph_staging_drugs s on s.drug_key = n.drug_key
  on conflict (drug_key) do update set
    canonical_name = excluded.canonical_name,
    preferred_name_indonesian = excluded.preferred_name_indonesian,
    has_monograph_under_review = excluded.has_monograph_under_review,
    updated_at = now();

  insert into public.drug_search_aliases (
    drug_key, alias, normalized_alias, language_code, alias_type, priority
  )
  select drug_key, alias, normalized_alias, language_code, alias_type, priority
  from public.monograph_staging_indonesian_aliases
  on conflict (drug_key, normalized_alias, language_code) do update set
    alias = excluded.alias,
    alias_type = excluded.alias_type,
    priority = excluded.priority;
end;
$$;

select public.refresh_indonesian_public_search_index();

