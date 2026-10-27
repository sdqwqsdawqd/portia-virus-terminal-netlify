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

-- Promotion application (Phase 14). Google Sheet remains the authority for current title;
-- these tables store only workflow state, immutable snapshots and compact history.

create table if not exists public.portia_promo_device_bindings (
  id uuid primary key default gen_random_uuid(),
  nickname_key text not null unique check (length(nickname_key) between 1 and 64),
  token_hash text not null unique check (length(token_hash) between 32 and 128),
  risk_bucket text not null default '' check (length(risk_bucket) <= 128),
  bound_at timestamptz not null default now(),
  reset_at timestamptz
);

create table if not exists public.portia_promo_attempt_buckets (
  bucket_key text primary key check (length(bucket_key) between 1 and 160),
  ip_bucket text not null default '' check (length(ip_bucket) <= 128),
  failures integer not null default 0 check (failures between 0 and 1000),
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.portia_promo_task_banks (
  id uuid primary key default gen_random_uuid(),
  target_title_id text not null unique check (length(target_title_id) between 1 and 48),
  required_count integer not null default 1 check (required_count between 1 and 50),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portia_promo_task_items (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.portia_promo_task_banks(id) on delete cascade,
  task_text text not null check (length(task_text) between 1 and 4000),
  active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portia_promo_requests (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (length(nickname) between 1 and 64),
  nickname_key text not null check (length(nickname_key) between 1 and 64),
  title_id text not null check (length(title_id) between 1 and 48),
  target_title_id text not null check (length(target_title_id) between 1 and 48),
  status text not null default 'pending' check (status in ('pending', 'claimed', 'assigned', 'awaiting-sheet-change', 'rejected', 'closed')),
  reviewer_id uuid references auth.users(id),
  internal_note text not null default '' check (length(internal_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists portia_promo_one_active_request
  on public.portia_promo_requests (nickname_key)
  where status in ('pending', 'claimed', 'assigned', 'awaiting-sheet-change');

create table if not exists public.portia_promo_assignments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.portia_promo_requests(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  status text not null default 'active' check (status in ('active', 'approved', 'closed')),
  issued_at timestamptz not null default now(),
  approved_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.portia_promo_assignment_items (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.portia_promo_assignments(id) on delete cascade,
  source_item_id uuid references public.portia_promo_task_items(id) on delete set null,
  snapshot_text text not null check (length(snapshot_text) between 1 and 4000),
  sort_order integer not null check (sort_order between 0 and 100000),
  unique (assignment_id, sort_order)
);

create table if not exists public.portia_promo_qualification_banks (
  id uuid primary key default gen_random_uuid(),
  transition_id text not null unique check (length(transition_id) between 1 and 48),
  single_count integer not null default 0 check (single_count between 0 and 100),
  multiple_count integer not null default 0 check (multiple_count between 0 and 100),
  free_text_count integer not null default 0 check (free_text_count between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portia_promo_qualification_questions (
  id uuid primary key default gen_random_uuid(),
  bank_id uuid not null references public.portia_promo_qualification_banks(id) on delete cascade,
  question_type text not null check (question_type in ('single', 'multiple', 'free-text')),
  question_text text not null check (length(question_text) between 1 and 4000),
  answer_key jsonb not null default '{}'::jsonb check (pg_column_size(answer_key) <= 16384),
  active boolean not null default true,
  sort_order integer not null default 0 check (sort_order between 0 and 100000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portia_promo_qualification_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.portia_promo_qualification_questions(id) on delete cascade,
  option_text text not null check (length(option_text) between 1 and 1000),
  is_correct boolean not null default false,
  sort_order integer not null check (sort_order between 0 and 100000),
  unique (question_id, sort_order)
);

create table if not exists public.portia_promo_qualification_requests (
  id uuid primary key default gen_random_uuid(),
  nickname text not null check (length(nickname) between 1 and 64),
  nickname_key text not null check (length(nickname_key) between 1 and 64),
  title_id text not null check (length(title_id) between 1 and 48),
  transition_id text not null check (length(transition_id) between 1 and 48),
  status text not null default 'pending' check (status in ('pending', 'claimed', 'approved', 'testing', 'grading', 'passed', 'failed', 'rejected', 'closed')),
  reviewer_id uuid references auth.users(id),
  internal_note text not null default '' check (length(internal_note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists portia_promo_one_active_qualification_request
  on public.portia_promo_qualification_requests (nickname_key)
  where status in ('pending', 'claimed', 'approved', 'testing', 'grading');

create table if not exists public.portia_promo_attempts (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.portia_promo_qualification_requests(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id),
  status text not null default 'prepared' check (status in ('prepared', 'active', 'grading', 'passed', 'failed', 'closed')),
  client_mode text not null default 'desktop' check (client_mode in ('desktop', 'phone')),
  started_at timestamptz,
  deadline_at timestamptz,
  technical_failure text check (technical_failure is null or length(technical_failure) <= 64),
  failure_overridden_at timestamptz,
  retake_at timestamptz,
  retake_released_at timestamptz,
  final_percent integer check (final_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.portia_promo_attempt_questions (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.portia_promo_attempts(id) on delete cascade,
  source_question_id uuid references public.portia_promo_qualification_questions(id) on delete set null,
  question_type text not null check (question_type in ('single', 'multiple', 'free-text')),
  snapshot_text text not null check (length(snapshot_text) between 1 and 4000),
  snapshot_options jsonb not null default '[]'::jsonb check (pg_column_size(snapshot_options) <= 32768),
  answer_key jsonb not null check (pg_column_size(answer_key) <= 16384),
  sort_order integer not null check (sort_order between 0 and 100000),
  unique (attempt_id, sort_order)
);

create table if not exists public.portia_promo_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.portia_promo_attempts(id) on delete cascade,
  question_id uuid not null references public.portia_promo_attempt_questions(id) on delete cascade,
  answer jsonb not null check (pg_column_size(answer) <= 32768),
  reviewer_correct boolean,
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  unique (attempt_id, question_id)
);

create table if not exists public.portia_promo_results (
  id uuid primary key default gen_random_uuid(),
  nickname_key text not null check (length(nickname_key) between 1 and 64),
  result_kind text not null check (result_kind in ('ordinary', 'qualification')),
  outcome text not null check (outcome in ('approved', 'passed', 'failed', 'rejected', 'technical-failure', 'retake-released')),
  compact jsonb not null default '{}'::jsonb check (pg_column_size(compact) <= 16384),
  created_at timestamptz not null default now()
);

create index if not exists portia_promo_results_history
  on public.portia_promo_results (nickname_key, created_at desc);

create table if not exists public.portia_promo_audit_events (
  id bigint generated always as identity primary key,
  nickname_key text check (nickname_key is null or length(nickname_key) between 1 and 64),
  actor_id uuid references auth.users(id),
  event_type text not null check (length(event_type) between 1 and 80),
  details jsonb not null default '{}'::jsonb check (pg_column_size(details) <= 16384),
  created_at timestamptz not null default now()
);

alter table public.portia_promo_device_bindings enable row level security;
alter table public.portia_promo_attempt_buckets enable row level security;
alter table public.portia_promo_requests enable row level security;
alter table public.portia_promo_task_banks enable row level security;
alter table public.portia_promo_task_items enable row level security;
alter table public.portia_promo_assignments enable row level security;
alter table public.portia_promo_assignment_items enable row level security;
alter table public.portia_promo_qualification_requests enable row level security;
alter table public.portia_promo_qualification_banks enable row level security;
alter table public.portia_promo_qualification_questions enable row level security;
alter table public.portia_promo_qualification_options enable row level security;
alter table public.portia_promo_attempts enable row level security;
alter table public.portia_promo_attempt_questions enable row level security;
alter table public.portia_promo_answers enable row level security;
alter table public.portia_promo_results enable row level security;
alter table public.portia_promo_audit_events enable row level security;

revoke all on table public.portia_promo_device_bindings from public, anon, authenticated;
revoke all on table public.portia_promo_attempt_buckets from public, anon, authenticated;
revoke all on table public.portia_promo_requests from public, anon, authenticated;
revoke all on table public.portia_promo_task_banks from public, anon, authenticated;
revoke all on table public.portia_promo_task_items from public, anon, authenticated;
revoke all on table public.portia_promo_assignments from public, anon, authenticated;
revoke all on table public.portia_promo_assignment_items from public, anon, authenticated;
revoke all on table public.portia_promo_qualification_requests from public, anon, authenticated;
revoke all on table public.portia_promo_qualification_banks from public, anon, authenticated;
revoke all on table public.portia_promo_qualification_questions from public, anon, authenticated;
revoke all on table public.portia_promo_qualification_options from public, anon, authenticated;
revoke all on table public.portia_promo_attempts from public, anon, authenticated;
revoke all on table public.portia_promo_attempt_questions from public, anon, authenticated;
revoke all on table public.portia_promo_answers from public, anon, authenticated;
revoke all on table public.portia_promo_results from public, anon, authenticated;
revoke all on table public.portia_promo_audit_events from public, anon, authenticated;

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
