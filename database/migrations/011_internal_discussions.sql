-- Private staff discussions for admins, reviewers, editors, and super admins.
-- Public questions remain as legacy data, but are no longer exposed by the app.

create table if not exists public.internal_discussions (
  id uuid primary key default gen_random_uuid(),
  subject text not null,
  status text not null default 'open',
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_discussions_subject_length check (char_length(subject) between 4 and 160),
  constraint internal_discussions_status_check check (status in ('open', 'resolved'))
);

create table if not exists public.internal_discussion_participants (
  discussion_id uuid not null references public.internal_discussions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete restrict,
  joined_at timestamptz not null default now(),
  primary key (discussion_id, profile_id)
);

create table if not exists public.internal_discussion_messages (
  id uuid primary key default gen_random_uuid(),
  discussion_id uuid not null references public.internal_discussions(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete restrict,
  body text not null,
  created_at timestamptz not null default now(),
  constraint internal_discussion_messages_body_length check (char_length(body) between 1 and 5000)
);

drop trigger if exists internal_discussions_set_updated_at on public.internal_discussions;
create trigger internal_discussions_set_updated_at
before update on public.internal_discussions
for each row execute function public.set_updated_at();

create index if not exists internal_discussions_updated_idx
  on public.internal_discussions(updated_at desc);
create index if not exists internal_discussion_participants_profile_idx
  on public.internal_discussion_participants(profile_id, discussion_id);
create index if not exists internal_discussion_messages_discussion_idx
  on public.internal_discussion_messages(discussion_id, created_at);

comment on table public.internal_discussions is
  'Private staff-only discussion threads. Access is enforced by server-side participant checks.';
comment on table public.internal_discussion_participants is
  'Profiles allowed to read and reply to a private discussion.';
comment on table public.internal_discussion_messages is
  'Messages exchanged inside a private staff discussion.';
