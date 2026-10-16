-- 0002_auth_and_audit.sql
-- Profiles, Audit Logs (Append-Only), and Business Settings.

-- 1. Profiles
create type user_role as enum ('owner', 'staff', 'developer');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'staff',
  is_active boolean not null default true,
  full_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table profiles enable row level security;
create policy profiles_self_read on profiles for select using (auth.uid() = id);

-- 2. Audit Logs (Strictly Append-Only)
create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references profiles(id),
  actor_role user_role,
  action text not null,
  entity text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);

-- Revoke UPDATE and DELETE from ALL roles (including service role)
revoke update, delete on table audit_logs from authenticated, anon, service_role;

-- Append-only trigger backup
create or replace function forbid_audit_change() returns trigger language plpgsql as $$
begin
  raise exception 'audit_logs is append-only. Updates and deletes are forbidden.' using errcode = '42501';
end $$;

create trigger audit_logs_immutable before update or delete on audit_logs
for each row execute function forbid_audit_change();

alter table audit_logs enable row level security;
create policy audit_logs_owner_read on audit_logs for select using (
  exists (select 1 from profiles where id = auth.uid() and role in ('owner', 'developer'))
);

-- 3. Business Settings
create table business_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references profiles(id),
  updated_at timestamptz not null default now()
);

alter table business_settings enable row level security;
create policy business_settings_public_read on business_settings for select using (true);
