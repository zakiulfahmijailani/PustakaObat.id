-- Apoteq Neon authentication and reviewer approval workflow.
-- Idempotent: safe to re-run after a partially completed deployment.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_enum e ON e.enumtypid = t.oid
    WHERE t.typname = 'user_role' AND e.enumlabel = 'reviewer'
  ) THEN
    ALTER TYPE public.user_role RENAME VALUE 'pharmacist' TO 'reviewer';
  END IF;
END
$$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS institution text,
  ADD COLUMN IF NOT EXISTS sipa_number text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS professional_license_number text,
  ADD COLUMN IF NOT EXISTS account_status text,
  ADD COLUMN IF NOT EXISTS approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_reason text,
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

UPDATE public.profiles
SET role = 'reviewer'::public.user_role
WHERE role::text IN ('pharmacist', 'verifier');

UPDATE public.profiles
SET account_status = CASE WHEN is_active THEN 'active' ELSE 'pending_review' END
WHERE account_status IS NULL;

-- Legacy seed accounts predate the Neon approval workflow and may use
-- documented demonstration passwords. They must be explicitly reactivated by
-- reviewer approval or admin bootstrap before the new auth flow is deployed.
UPDATE public.profiles
SET account_status = 'suspended',
    is_active = false,
    rejected_reason = 'Legacy account requires credential rotation before Neon auth launch'
WHERE account_status = 'active'
  AND approved_at IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'reviewer'::public.user_role,
  ALTER COLUMN is_active SET DEFAULT false,
  ALTER COLUMN account_status SET DEFAULT 'pending_review',
  ALTER COLUMN account_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_account_status_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_account_status_check
      CHECK (account_status IN (
        'pending_review', 'needs_revision', 'active', 'rejected', 'suspended'
      ));
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_lower_key
  ON public.profiles (lower(email));

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'token'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'sessions' AND column_name = 'token_hash'
  ) THEN
    ALTER TABLE public.sessions RENAME COLUMN token TO token_hash;
  END IF;
END
$$;

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS revoked_at timestamptz;

CREATE INDEX IF NOT EXISTS sessions_active_lookup_idx
  ON public.sessions (token_hash, expires_at)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS sessions_user_id_idx
  ON public.sessions (user_id);

CREATE TABLE IF NOT EXISTS public.reviewer_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  institution text NOT NULL,
  professional_license_number text NOT NULL,
  sipa_number text,
  phone text,
  license_document_path text,
  application_status text NOT NULL DEFAULT 'pending',
  review_note text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reviewer_applications_status_check CHECK (
    application_status IN ('pending', 'approved', 'rejected', 'needs_revision', 'withdrawn')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS reviewer_applications_open_profile_key
  ON public.reviewer_applications (profile_id)
  WHERE application_status IN ('pending', 'needs_revision');

CREATE INDEX IF NOT EXISTS reviewer_applications_status_idx
  ON public.reviewer_applications (application_status, submitted_at DESC);

CREATE TABLE IF NOT EXISTS public.auth_login_attempts (
  id bigserial PRIMARY KEY,
  email_key text NOT NULL,
  ip_address text,
  succeeded boolean NOT NULL DEFAULT false,
  attempted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_login_attempts_lookup_idx
  ON public.auth_login_attempts (email_key, attempted_at DESC);

CREATE INDEX IF NOT EXISTS auth_login_attempts_ip_idx
  ON public.auth_login_attempts (ip_address, attempted_at DESC);

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_set_updated_at ON public.profiles;
CREATE TRIGGER profiles_set_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS reviewer_applications_set_updated_at ON public.reviewer_applications;
CREATE TRIGGER reviewer_applications_set_updated_at
BEFORE UPDATE ON public.reviewer_applications
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

COMMENT ON COLUMN public.sessions.token_hash IS
  'SHA-256 hash of the opaque session token. The raw token exists only in the HttpOnly cookie.';
COMMENT ON TABLE public.reviewer_applications IS
  'Professional reviewer applications. Approval is required before reviewer dashboard access.';
