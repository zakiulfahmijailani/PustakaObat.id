-- Adds the editorial workspace role and a dedicated super-admin role.
-- Super-admin workspace selection is held in an HttpOnly application cookie;
-- the database role remains immutable during a session.

alter type public.user_role add value if not exists 'editor';
alter type public.user_role add value if not exists 'super_admin';

comment on type public.user_role is
  'Staff roles: editor prepares language and structure; reviewer verifies clinical information; admin operates the platform; super_admin may choose a workspace.';
