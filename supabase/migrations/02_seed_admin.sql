-- =========================================================
-- apoteq - 02_seed_admin.sql
-- Seed initial admin, pharmacist, and verifier users
-- =========================================================
-- Passwords hashed with bcrypt (cost factor 12) via bcryptjs
-- admin@apoteq.id      → AdminApoteq2025!
-- apoteker@apoteq.id   → Apoteker2025!
-- verifikator@apoteq.id → Verifikasi2025!
-- =========================================================

-- 1. Insert into auth.users (Supabase auth schema)
INSERT INTO auth.users (
  id,
  instance_id,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  aud,
  role,
  created_at,
  updated_at,
  confirmation_token,
  recovery_token
) VALUES
  (
    'a0000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'admin@apoteq.id',
    '$2b$12$sjaZh0OKTvO3z1uxOcLIxODvkl09Xdoq84vPu8jyYjGBrigvwSZsm',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Admin Apoteq"}',
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    ''
  ),
  (
    'a0000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'apoteker@apoteq.id',
    '$2b$12$VQdxklrGDEdS8o4UM5mV3.a9H9m2w7ET.LH7mALVKWXhO1/YipdBq',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Apoteker Apoteq"}',
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    ''
  ),
  (
    'a0000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'verifikator@apoteq.id',
    '$2b$12$.oxGv881YnOMPpRU8bRMMOVoo2Cwfb5vPm7JF4kmms4.3PR/Qnuoy',
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"full_name":"Verifikator Apoteq"}',
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    ''
  )
ON CONFLICT (id) DO NOTHING;

-- 2. Insert into public.profiles
INSERT INTO public.profiles (id, full_name, role, is_active)
VALUES
  ('a0000000-0000-0000-0000-000000000001', 'Admin Apoteq',      'admin',      true),
  ('a0000000-0000-0000-0000-000000000002', 'Apoteker Apoteq',   'pharmacist', true),
  ('a0000000-0000-0000-0000-000000000003', 'Verifikator Apoteq', 'verifier',  true)
ON CONFLICT (id) DO NOTHING;
