-- Run this in Supabase Dashboard -> SQL Editor. It is safe to run again after code updates.
-- The owner email is set in exactly one place: portia_owner_email() below.
-- The whole file is one transaction: an error anywhere applies nothing.

begin;

-- Re-running this file must never lock the owner out: the email rule below needs a confirmed owner email.
-- A fresh project has no owner account yet (and no portia_owner_email() yet), so the guard passes.
-- shortcut: on a project that never ran this file the guard cannot see the owner; upgrade by creating portia_owner_email() before it.
do $$
declare
  owner_email text;
begin
  if to_regprocedure('public.portia_owner_email()') is not null then
    execute 'select public.portia_owner_email()' into owner_email;
    if exists (select 1 from auth.users where lower(email) = owner_email and email_confirmed_at is null) then
      raise exception 'PORTIA: owner email is not confirmed, nothing was applied (Dashboard -> Authentication -> Users)';
    end if;
  end if;
end $$;

create table if not exists public.portia_content (
  id text primary key,
  payload jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.portia_editors (
  email text primary key check (email = lower(email)),
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- closed_tabs: regular tabs closed for the editor (empty = all open). granted_tabs: trusted tabs granted (empty = none).
alter table public.portia_editors
  add column if not exists closed_tabs text[] not null default '{}',
  add column if not exists granted_tabs text[] not null default '{}';

-- Editor-written personnel fields. The roster itself comes from Google Sheets.
create table if not exists public.portia_employee_profiles (
  employee_id text primary key,
  biography text not null default '' check (length(biography) <= 20000),
  photo_url text not null default '',
  knowledge_rating integer not null default 1 check (knowledge_rating between 1 and 10),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

-- Last known nickname: finds the profile while Roblox is unreachable.
alter table public.portia_employee_profiles add column if not exists nickname text not null default '' check (length(nickname) <= 64);

-- Editor ratings beyond knowledge (phase 03.2). Empty (null) means not rated yet; the site shows «—».
alter table public.portia_employee_profiles
  add column if not exists paws_rating integer check (paws_rating between 1 and 10),
  add column if not exists bio_rating integer check (bio_rating between 1 and 10),
  add column if not exists s_rating integer check (s_rating between 1 and 10),
  add column if not exists activity_rating integer check (activity_rating between 1 and 10),
  add column if not exists overall_rating integer check (overall_rating between 1 and 10),
  add column if not exists tests_rating integer check (tests_rating between 1 and 10);

-- Photo rule: https:// or a local path with one leading slash (the same rule as isLocalMediaPath in lib/media-url.ts).
-- The old unnamed check is found by its definition in pg_constraint; its name is never guessed.
do $$
declare
  old_check record;
begin
  for old_check in
    select conname from pg_constraint
    where conrelid = 'public.portia_employee_profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%photo_url%'
      and conname <> 'portia_employee_profiles_photo_url_local'
  loop
    execute format('alter table public.portia_employee_profiles drop constraint %I', old_check.conname);
  end loop;
end $$;

alter table public.portia_employee_profiles drop constraint if exists portia_employee_profiles_photo_url_local;
alter table public.portia_employee_profiles add constraint portia_employee_profiles_photo_url_local
  check (photo_url = '' or photo_url like 'https://%' or photo_url ~ '^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$') not valid;

-- Validate only when no row breaks the rule. A project with bad rows waits for STEP 2b of phase12_apply.sql.
do $$
begin
  if not exists (
    select 1 from public.portia_employee_profiles
    where not (photo_url = '' or photo_url like 'https://%' or photo_url ~ '^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$')
  ) then
    alter table public.portia_employee_profiles validate constraint portia_employee_profiles_photo_url_local;
  end if;
end $$;

-- PostgREST picks up the new columns without a restart.
notify pgrst, 'reload schema';

-- Not granted to anon/authenticated, so the email cannot be read through the API.
create or replace function public.portia_owner_email()
returns text
language sql
immutable
set search_path = ''
as $$
  select 'qloxzick@gmail.com'::text;
$$;

create or replace function public.portia_email_confirmed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null);
$$;

create or replace function public.portia_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = public.portia_owner_email()
    and public.portia_email_confirmed();
$$;

create or replace function public.portia_can_edit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.portia_email_confirmed() and (
    public.portia_is_owner() or exists (
      select 1 from public.portia_editors
      where email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
$$;

create or replace function public.portia_can_edit_tab(tab_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select tab_id is not null and (
    public.portia_is_owner() or (
      public.portia_can_edit() and exists (
        select 1 from public.portia_editors
        where email = lower(coalesce(auth.jwt() ->> 'email', '')) and not (tab_id = any(closed_tabs))
      )
    )
  );
$$;

-- Not used by phase 12 itself: a trusted tab needs no new SQL later.
create or replace function public.portia_has_tab_grant(tab_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select tab_id is not null and (
    public.portia_is_owner() or (
      public.portia_can_edit() and exists (
        select 1 from public.portia_editors
        where email = lower(coalesce(auth.jwt() ->> 'email', '')) and tab_id = any(granted_tabs)
      )
    )
  );
$$;

create or replace function public.portia_editor_is_approved(candidate_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    lower(trim(candidate_email)) = public.portia_owner_email()
    or exists (
      select 1 from public.portia_editors
      where email = lower(trim(candidate_email))
    );
$$;

revoke all on function public.portia_owner_email() from public, anon, authenticated;
revoke all on function public.portia_is_owner() from public, anon;
revoke all on function public.portia_can_edit() from public, anon;
revoke all on function public.portia_email_confirmed() from public, anon;
revoke all on function public.portia_can_edit_tab(text) from public, anon;
revoke all on function public.portia_has_tab_grant(text) from public, anon;
revoke all on function public.portia_editor_is_approved(text) from public;
grant execute on function public.portia_is_owner() to authenticated;
grant execute on function public.portia_can_edit() to authenticated;
grant execute on function public.portia_email_confirmed() to authenticated;
grant execute on function public.portia_can_edit_tab(text) to authenticated;
grant execute on function public.portia_has_tab_grant(text) to authenticated;
-- Needed before sign-up, so anonymous visitors may call it.
grant execute on function public.portia_editor_is_approved(text) to anon, authenticated;

-- Editors

alter table public.portia_editors enable row level security;
revoke all on table public.portia_editors from anon, authenticated;
grant select, insert, delete on table public.portia_editors to authenticated;
-- Only the owner changes the tab lists: a column-level grant plus the owner-only policy below.
grant update (closed_tabs, granted_tabs) on table public.portia_editors to authenticated;

drop policy if exists "Editors can see their access" on public.portia_editors;
create policy "Editors can see their access"
on public.portia_editors for select
to authenticated
using (email = lower((select auth.jwt() ->> 'email')) or (select public.portia_is_owner()));

drop policy if exists "Owner can grant editor access" on public.portia_editors;
create policy "Owner can grant editor access"
on public.portia_editors for insert
to authenticated
with check ((select public.portia_is_owner()));

drop policy if exists "Owner can revoke editor access" on public.portia_editors;
create policy "Owner can revoke editor access"
on public.portia_editors for delete
to authenticated
using ((select public.portia_is_owner()));

drop policy if exists "Owner can change editor tabs" on public.portia_editors;
create policy "Owner can change editor tabs"
on public.portia_editors for update
to authenticated
using ((select public.portia_is_owner()))
with check ((select public.portia_is_owner()));

-- Content

alter table public.portia_content enable row level security;
revoke all on table public.portia_content from anon, authenticated;
grant select on table public.portia_content to anon, authenticated;
grant insert, update on table public.portia_content to authenticated;

drop policy if exists "Public can read PORTIA content" on public.portia_content;
create policy "Public can read PORTIA content"
on public.portia_content for select
to anon, authenticated
using (true);

drop policy if exists "Owner can create PORTIA content" on public.portia_content;
drop policy if exists "Editors can create PORTIA content" on public.portia_content;
create policy "Editors can create PORTIA content"
on public.portia_content for insert
to authenticated
with check ((select public.portia_can_edit()));

drop policy if exists "Owner can update PORTIA content" on public.portia_content;
drop policy if exists "Editors can update PORTIA content" on public.portia_content;
create policy "Editors can update PORTIA content"
on public.portia_content for update
to authenticated
using ((select public.portia_can_edit()))
with check ((select public.portia_can_edit()));

-- Employee profiles

alter table public.portia_employee_profiles enable row level security;
revoke all on table public.portia_employee_profiles from anon, authenticated;
grant select on table public.portia_employee_profiles to anon, authenticated;
grant insert, update on table public.portia_employee_profiles to authenticated;

drop policy if exists "Public can read PORTIA employee profiles" on public.portia_employee_profiles;
create policy "Public can read PORTIA employee profiles"
on public.portia_employee_profiles for select
to anon, authenticated
using (true);

drop policy if exists "Editors can create PORTIA employee profiles" on public.portia_employee_profiles;
create policy "Editors can create PORTIA employee profiles"
on public.portia_employee_profiles for insert
to authenticated
with check ((select public.portia_can_edit_tab('employees')));

drop policy if exists "Editors can update PORTIA employee profiles" on public.portia_employee_profiles;
create policy "Editors can update PORTIA employee profiles"
on public.portia_employee_profiles for update
to authenticated
using ((select public.portia_can_edit_tab('employees')))
with check ((select public.portia_can_edit_tab('employees')));

-- Manual employees

-- Employees added by editors outside the Google Sheet (phase 03.3). The roster lists them after the sheet staff;
-- the sheet wins when the same Roblox account is in both. Photo, ratings and biography stay in
-- portia_employee_profiles under the same employee_id, so removing a manual employee keeps them.
create table if not exists public.portia_manual_employees (
  employee_id text primary key check (employee_id ~ '^roblox-[0-9]+$'),
  nickname text not null check (length(nickname) between 3 and 20),
  title text not null default '' check (length(title) <= 64),
  rank text not null default '' check (length(rank) <= 64),
  callsign text not null default '' check (length(callsign) <= 64),
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

alter table public.portia_manual_employees enable row level security;
revoke all on table public.portia_manual_employees from anon, authenticated;
grant select on table public.portia_manual_employees to anon, authenticated;
grant insert, delete on table public.portia_manual_employees to authenticated;

drop policy if exists "Public can read PORTIA manual employees" on public.portia_manual_employees;
create policy "Public can read PORTIA manual employees"
on public.portia_manual_employees for select
to anon, authenticated
using (true);

drop policy if exists "Editors can add PORTIA manual employees" on public.portia_manual_employees;
create policy "Editors can add PORTIA manual employees"
on public.portia_manual_employees for insert
to authenticated
with check ((select public.portia_can_edit_tab('employees')));

drop policy if exists "Editors can remove PORTIA manual employees" on public.portia_manual_employees;
create policy "Editors can remove PORTIA manual employees"
on public.portia_manual_employees for delete
to authenticated
using ((select public.portia_can_edit_tab('employees')));

-- Editors change title, rank and callsign of a manual employee; the id and nickname stay fixed.
grant update (title, rank, callsign) on table public.portia_manual_employees to authenticated;

drop policy if exists "Editors can edit PORTIA manual employees" on public.portia_manual_employees;
create policy "Editors can edit PORTIA manual employees"
on public.portia_manual_employees for update
to authenticated
using ((select public.portia_can_edit_tab('employees')))
with check ((select public.portia_can_edit_tab('employees')));

-- PostgREST picks up the new table without a restart.
notify pgrst, 'reload schema';

-- Media

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portia-media',
  'portia-media',
  true,
  4194304,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read PORTIA media" on storage.objects;
create policy "Public can read PORTIA media"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'portia-media');

drop policy if exists "Owner can upload PORTIA media" on storage.objects;
drop policy if exists "Editors can upload PORTIA media" on storage.objects;
create policy "Editors can upload PORTIA media"
on storage.objects for insert
to authenticated
with check (bucket_id = 'portia-media' and (select public.portia_can_edit()));

drop policy if exists "Owner can update PORTIA media" on storage.objects;
drop policy if exists "Editors can update PORTIA media" on storage.objects;
create policy "Editors can update PORTIA media"
on storage.objects for update
to authenticated
using (bucket_id = 'portia-media' and (select public.portia_can_edit()))
with check (bucket_id = 'portia-media' and (select public.portia_can_edit()));

drop policy if exists "Owner can delete PORTIA media" on storage.objects;
drop policy if exists "Editors can delete PORTIA media" on storage.objects;
create policy "Editors can delete PORTIA media"
on storage.objects for delete
to authenticated
using (bucket_id = 'portia-media' and (select public.portia_can_edit()));

commit;
