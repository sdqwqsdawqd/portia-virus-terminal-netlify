-- PHASE 14 — Promotion application
-- OWNER-RUN ONLY. Record this migration now; apply it only at the Plan 14-09 manual gate.
--
-- Preflight: this script expects the owner/access helpers from the base PORTIA schema.
-- When an authenticated JWT is present, portia_is_owner() must confirm the caller.
begin;

do $phase14_preflight$
begin
  if to_regprocedure('public.portia_is_owner()') is null
    or to_regprocedure('public.portia_has_tab_grant(text)') is null then
    raise exception 'Phase 14 requires the PORTIA owner/access helpers';
  end if;
  if auth.uid() is not null and not public.portia_is_owner() then
    raise exception 'Phase 14 must be applied by the PORTIA owner';
  end if;
end
$phase14_preflight$;

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

create or replace function public.portia_promo_bind_device(
  p_nickname_key text,
  p_token_hash text,
  p_risk_bucket text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  binding_id uuid;
begin
  if length(trim(p_nickname_key)) not between 1 and 64
    or length(p_token_hash) not between 32 and 128
    or length(p_risk_bucket) > 128 then
    raise exception 'invalid-device-binding';
  end if;
  select id into binding_id from public.portia_promo_device_bindings
    where token_hash = p_token_hash and reset_at is null;
  if binding_id is not null then
    if not exists (
      select 1 from public.portia_promo_device_bindings
      where id = binding_id and nickname_key = lower(trim(p_nickname_key))
    ) then raise exception 'device-bound'; end if;
    return binding_id;
  end if;
  if exists (
    select 1 from public.portia_promo_device_bindings
    where nickname_key = lower(trim(p_nickname_key)) and reset_at is null
  ) then raise exception 'nickname-bound'; end if;
  insert into public.portia_promo_device_bindings (nickname_key, token_hash, risk_bucket)
  values (lower(trim(p_nickname_key)), p_token_hash, p_risk_bucket)
  returning id into binding_id;
  return binding_id;
end $$;

create or replace function public.portia_promo_reset_device(p_nickname_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.portia_is_owner() then raise exception 'forbidden'; end if;
  update public.portia_promo_device_bindings set reset_at = now()
    where nickname_key = lower(trim(p_nickname_key)) and reset_at is null;
  insert into public.portia_promo_audit_events (nickname_key, actor_id, event_type)
  values (lower(trim(p_nickname_key)), auth.uid(), 'device-reset');
  return found;
end $$;

create or replace function public.portia_promo_register_attempt(
  p_bucket_key text,
  p_ip_bucket text,
  p_success boolean default false
)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_failures integer;
  until_at timestamptz;
begin
  if length(p_bucket_key) not between 1 and 160 or length(p_ip_bucket) > 128 then
    raise exception 'invalid-attempt-bucket';
  end if;
  insert into public.portia_promo_attempt_buckets (bucket_key, ip_bucket, failures, blocked_until)
  values (p_bucket_key, p_ip_bucket, case when p_success then 0 else 1 end, null)
  on conflict (bucket_key) do update set
    failures = case when p_success then 0 else least(public.portia_promo_attempt_buckets.failures + 1, 1000) end,
    ip_bucket = excluded.ip_bucket,
    updated_at = now()
  returning failures into current_failures;
  if not p_success then
    until_at := now() + case
      when current_failures <= 1 then interval '5 minutes'
      when current_failures = 2 then interval '15 minutes'
      else interval '60 minutes'
    end;
    update public.portia_promo_attempt_buckets
      set blocked_until = greatest(coalesce(blocked_until, '-infinity'::timestamptz), until_at)
      where bucket_key = p_bucket_key
      returning blocked_until into until_at;
  else
    update public.portia_promo_attempt_buckets set blocked_until = null where bucket_key = p_bucket_key;
    until_at := null;
  end if;
  return until_at;
end $$;

create or replace function public.portia_promo_submit_request(
  p_kind text,
  p_nickname text,
  p_nickname_key text,
  p_title_id text,
  p_target_id text,
  p_token_hash text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id uuid;
begin
  if not exists (
    select 1 from public.portia_promo_device_bindings
    where nickname_key = lower(trim(p_nickname_key)) and token_hash = p_token_hash and reset_at is null
  ) then raise exception 'device-denied'; end if;
  if p_kind = 'ordinary' then
    insert into public.portia_promo_requests (nickname, nickname_key, title_id, target_title_id)
    values (left(trim(p_nickname), 64), lower(trim(p_nickname_key)), p_title_id, p_target_id)
    returning id into request_id;
  elsif p_kind = 'qualification' then
    insert into public.portia_promo_qualification_requests (nickname, nickname_key, title_id, transition_id)
    values (left(trim(p_nickname), 64), lower(trim(p_nickname_key)), p_title_id, p_target_id)
    returning id into request_id;
  else raise exception 'invalid-request-kind'; end if;
  return request_id;
end $$;

create or replace function public.portia_promo_claim_request(p_kind text, p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  if p_kind = 'ordinary' then
    update public.portia_promo_requests set status = 'claimed', reviewer_id = auth.uid(), updated_at = now()
      where id = p_request_id and status = 'pending' and reviewer_id is null;
  elsif p_kind = 'qualification' then
    update public.portia_promo_qualification_requests set status = 'claimed', reviewer_id = auth.uid(), updated_at = now()
      where id = p_request_id and status = 'pending' and reviewer_id is null;
  else return false; end if;
  return found;
end $$;

create or replace function public.portia_promo_release_request(p_kind text, p_request_id uuid, p_force boolean default false)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  if p_force and not public.portia_is_owner() then raise exception 'owner-required'; end if;
  if p_kind = 'ordinary' then
    update public.portia_promo_requests set status = 'pending', reviewer_id = null, updated_at = now()
      where id = p_request_id and status = 'claimed' and (reviewer_id = auth.uid() or p_force);
  elsif p_kind = 'qualification' then
    update public.portia_promo_qualification_requests set status = 'pending', reviewer_id = null, updated_at = now()
      where id = p_request_id and status = 'claimed' and (reviewer_id = auth.uid() or p_force);
  else return false; end if;
  return found;
end $$;

create or replace function public.portia_promo_reject_request(p_kind text, p_request_id uuid, p_internal_note text default '')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  if length(p_internal_note) > 2000 then raise exception 'note-too-long'; end if;
  if p_kind = 'ordinary' then
    update public.portia_promo_requests set status = 'rejected', internal_note = p_internal_note, updated_at = now()
      where id = p_request_id and status = 'claimed' and reviewer_id = auth.uid();
  elsif p_kind = 'qualification' then
    update public.portia_promo_qualification_requests set status = 'rejected', internal_note = p_internal_note, updated_at = now()
      where id = p_request_id and status = 'claimed' and reviewer_id = auth.uid();
  else return false; end if;
  return found;
end $$;

create or replace function public.portia_promo_confirm_assignment(p_request_id uuid, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_assignment_id uuid;
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'invalid-assignment';
  end if;
  insert into public.portia_promo_assignments (request_id, reviewer_id)
  select id, auth.uid() from public.portia_promo_requests
    where id = p_request_id and status = 'claimed' and reviewer_id = auth.uid()
  returning id into created_assignment_id;
  if created_assignment_id is null then return null; end if;
  insert into public.portia_promo_assignment_items (assignment_id, source_item_id, snapshot_text, sort_order)
  select created_assignment_id, item.source_item_id, item.snapshot_text, item.sort_order
  from jsonb_to_recordset(p_items) as item(source_item_id uuid, snapshot_text text, sort_order integer)
  where length(item.snapshot_text) between 1 and 4000;
  if (select count(*) from public.portia_promo_assignment_items ai where ai.assignment_id = created_assignment_id) <> jsonb_array_length(p_items) then
    raise exception 'invalid-assignment-items';
  end if;
  update public.portia_promo_requests set status = 'assigned', updated_at = now() where id = p_request_id;
  return created_assignment_id;
end $$;

create or replace function public.portia_promo_confirm_test(p_request_id uuid, p_questions jsonb, p_client_mode text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_attempt_id uuid;
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  if p_client_mode not in ('desktop', 'phone') or jsonb_typeof(p_questions) <> 'array'
    or jsonb_array_length(p_questions) not between 1 and 100 then raise exception 'invalid-test'; end if;
  insert into public.portia_promo_attempts (request_id, reviewer_id, client_mode)
  select id, auth.uid(), p_client_mode from public.portia_promo_qualification_requests
    where id = p_request_id and status = 'claimed' and reviewer_id = auth.uid()
  returning id into created_attempt_id;
  if created_attempt_id is null then return null; end if;
  insert into public.portia_promo_attempt_questions (
    attempt_id, source_question_id, question_type, snapshot_text, snapshot_options, answer_key, sort_order
  )
  select created_attempt_id, q.source_question_id, q.question_type, q.snapshot_text,
    coalesce(q.snapshot_options, '[]'::jsonb), q.answer_key, q.sort_order
  from jsonb_to_recordset(p_questions) as q(
    source_question_id uuid, question_type text, snapshot_text text,
    snapshot_options jsonb, answer_key jsonb, sort_order integer
  )
  where q.question_type in ('single', 'multiple', 'free-text') and length(q.snapshot_text) between 1 and 4000;
  if (select count(*) from public.portia_promo_attempt_questions aq where aq.attempt_id = created_attempt_id) <> jsonb_array_length(p_questions) then
    raise exception 'invalid-test-questions';
  end if;
  update public.portia_promo_qualification_requests set status = 'approved', updated_at = now() where id = p_request_id;
  return created_attempt_id;
end $$;

create or replace function public.portia_promo_start_test(p_attempt_id uuid, p_token_hash text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare deadline timestamptz;
begin
  update public.portia_promo_attempts a set
    status = 'active', started_at = now(), deadline_at = now() + interval '15 minutes', updated_at = now()
  from public.portia_promo_qualification_requests r
  where a.id = p_attempt_id and a.request_id = r.id and a.status = 'prepared'
    and exists (select 1 from public.portia_promo_device_bindings b where b.nickname_key = r.nickname_key and b.token_hash = p_token_hash and b.reset_at is null)
  returning a.deadline_at into deadline;
  return deadline;
end $$;

create or replace function public.portia_promo_answer_question(p_attempt_id uuid, p_question_id uuid, p_answer jsonb, p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare expected_order integer;
begin
  select count(*) into expected_order from public.portia_promo_answers where attempt_id = p_attempt_id;
  insert into public.portia_promo_answers (attempt_id, question_id, answer)
  select a.id, q.id, p_answer
  from public.portia_promo_attempts a
  join public.portia_promo_qualification_requests r on r.id = a.request_id
  join public.portia_promo_attempt_questions q on q.attempt_id = a.id
  where a.id = p_attempt_id and q.id = p_question_id and q.sort_order = expected_order
    and a.status = 'active' and now() < a.deadline_at
    and exists (select 1 from public.portia_promo_device_bindings b where b.nickname_key = r.nickname_key and b.token_hash = p_token_hash and b.reset_at is null)
  on conflict (attempt_id, question_id) do nothing;
  return found;
end $$;

create or replace function public.portia_promo_fail_attempt(p_attempt_id uuid, p_reason text, p_token_hash text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.portia_promo_attempts a set status = 'failed', technical_failure = left(p_reason, 64), updated_at = now()
  from public.portia_promo_qualification_requests r
  where a.id = p_attempt_id and a.request_id = r.id and a.status = 'active'
    and exists (select 1 from public.portia_promo_device_bindings b where b.nickname_key = r.nickname_key and b.token_hash = p_token_hash and b.reset_at is null);
  return found or exists (select 1 from public.portia_promo_attempts where id = p_attempt_id and status = 'failed');
end $$;

create or replace function public.portia_promo_grade_answer(p_answer_id uuid, p_correct boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  update public.portia_promo_answers ans set reviewer_correct = p_correct, graded_at = now()
  from public.portia_promo_attempts a
  where ans.id = p_answer_id and ans.attempt_id = a.id and a.reviewer_id = auth.uid()
    and a.status in ('active', 'grading', 'failed');
  return found;
end $$;

create or replace function public.portia_promo_finalize_attempt(
  p_attempt_id uuid,
  p_passed boolean,
  p_percent integer default null,
  p_retake_days integer default 2
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  if p_percent is not null and p_percent not between 0 and 100 then raise exception 'invalid-percent'; end if;
  if p_retake_days not between 0 and 365 then raise exception 'invalid-retake'; end if;
  update public.portia_promo_attempts set
    status = case when p_passed then 'passed' else 'failed' end,
    final_percent = p_percent,
    retake_at = case when p_passed then null else now() + make_interval(days => p_retake_days) end,
    updated_at = now()
  where id = p_attempt_id and reviewer_id = auth.uid() and status in ('active', 'grading', 'failed');
  if found then
    update public.portia_promo_qualification_requests r set
      status = case when p_passed then 'passed' else 'failed' end, updated_at = now()
    from public.portia_promo_attempts a where a.id = p_attempt_id and r.id = a.request_id;
  end if;
  return found;
end $$;

create or replace function public.portia_promo_override_failure(p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  update public.portia_promo_attempts set status = 'grading', failure_overridden_at = now(), updated_at = now()
    where id = p_attempt_id and status = 'failed' and technical_failure is not null;
  return found;
end $$;

create or replace function public.portia_promo_release_retake(p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  update public.portia_promo_attempts set retake_at = now(), retake_released_at = now(), updated_at = now()
    where id = p_attempt_id and status = 'failed' and retake_at > now();
  return found;
end $$;

create or replace function public.portia_promo_close(p_kind text, p_request_id uuid, p_outcome text, p_compact jsonb default '{}'::jsonb)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare key_value text;
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  if pg_column_size(p_compact) > 16384 then raise exception 'result-too-large'; end if;
  if p_kind = 'ordinary' then
    select nickname_key into key_value from public.portia_promo_requests
      where id = p_request_id and reviewer_id = auth.uid() for update;
    if key_value is null then return false; end if;
    insert into public.portia_promo_results (nickname_key, result_kind, outcome, compact)
      values (key_value, 'ordinary', p_outcome, p_compact);
    delete from public.portia_promo_requests where id = p_request_id;
  elsif p_kind = 'qualification' then
    select nickname_key into key_value from public.portia_promo_qualification_requests
      where id = p_request_id and reviewer_id = auth.uid() for update;
    if key_value is null then return false; end if;
    insert into public.portia_promo_results (nickname_key, result_kind, outcome, compact)
      values (key_value, 'qualification', p_outcome, p_compact);
    delete from public.portia_promo_qualification_requests where id = p_request_id;
  else return false; end if;
  delete from public.portia_promo_results where id in (
    select id from (
      select id, row_number() over (partition by nickname_key order by created_at desc, id desc) as history_order
      from public.portia_promo_results where nickname_key = key_value
    ) ranked where history_order > 3
  );
  return true;
end $$;

create or replace function public.portia_promo_cleanup()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare removed integer := 0; affected integer;
begin
  delete from public.portia_promo_requests
    where status in ('pending', 'rejected') and updated_at < now() - interval '3 days';
  get diagnostics affected = row_count; removed := removed + affected;
  delete from public.portia_promo_qualification_requests
    where status in ('pending', 'rejected', 'failed') and updated_at < now() - interval '3 days';
  get diagnostics affected = row_count; removed := removed + affected;
  delete from public.portia_promo_attempt_buckets where updated_at < now() - interval '3 days';
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  return removed;
end $$;

revoke all on function public.portia_promo_bind_device(text, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_reset_device(text) from public, anon, authenticated;
revoke all on function public.portia_promo_register_attempt(text, text, boolean) from public, anon, authenticated;
revoke all on function public.portia_promo_submit_request(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_claim_request(text, uuid) from public, anon, authenticated;
revoke all on function public.portia_promo_release_request(text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.portia_promo_reject_request(text, uuid, text) from public, anon, authenticated;
revoke all on function public.portia_promo_confirm_assignment(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.portia_promo_confirm_test(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.portia_promo_start_test(uuid, text) from public, anon, authenticated;
revoke all on function public.portia_promo_answer_question(uuid, uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.portia_promo_fail_attempt(uuid, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_grade_answer(uuid, boolean) from public, anon, authenticated;
revoke all on function public.portia_promo_finalize_attempt(uuid, boolean, integer, integer) from public, anon, authenticated;
revoke all on function public.portia_promo_override_failure(uuid) from public, anon, authenticated;
revoke all on function public.portia_promo_release_retake(uuid) from public, anon, authenticated;
revoke all on function public.portia_promo_close(text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.portia_promo_cleanup() from public, anon, authenticated;

grant execute on function public.portia_promo_bind_device(text, text, text) to anon, authenticated;
grant execute on function public.portia_promo_register_attempt(text, text, boolean) to anon, authenticated;
grant execute on function public.portia_promo_submit_request(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.portia_promo_start_test(uuid, text) to anon, authenticated;
grant execute on function public.portia_promo_answer_question(uuid, uuid, jsonb, text) to anon, authenticated;
grant execute on function public.portia_promo_fail_attempt(uuid, text, text) to anon, authenticated;
grant execute on function public.portia_promo_reset_device(text) to authenticated;
grant execute on function public.portia_promo_claim_request(text, uuid) to authenticated;
grant execute on function public.portia_promo_release_request(text, uuid, boolean) to authenticated;
grant execute on function public.portia_promo_reject_request(text, uuid, text) to authenticated;
grant execute on function public.portia_promo_confirm_assignment(uuid, jsonb) to authenticated;
grant execute on function public.portia_promo_confirm_test(uuid, jsonb, text) to authenticated;
grant execute on function public.portia_promo_grade_answer(uuid, boolean) to authenticated;
grant execute on function public.portia_promo_finalize_attempt(uuid, boolean, integer, integer) to authenticated;
grant execute on function public.portia_promo_override_failure(uuid) to authenticated;
grant execute on function public.portia_promo_release_retake(uuid) to authenticated;
grant execute on function public.portia_promo_close(text, uuid, text, jsonb) to authenticated;

create extension if not exists pg_cron;
do $$
declare existing_job bigint;
begin
  for existing_job in select jobid from cron.job where jobname = 'portia-promo-cleanup' loop
    perform cron.unschedule(existing_job);
  end loop;
  perform cron.schedule('portia-promo-cleanup', '17 3 * * *', 'select public.portia_promo_cleanup()');
end $$;



-- POST-APPLY ASSERTIONS
do $phase14_assert$
declare
  missing_object text;
begin
  foreach missing_object in array array[
    'portia_promo_device_bindings',
    'portia_promo_attempt_buckets',
    'portia_promo_task_banks',
    'portia_promo_task_items',
    'portia_promo_requests',
    'portia_promo_assignments',
    'portia_promo_assignment_items',
    'portia_promo_qualification_banks',
    'portia_promo_qualification_questions',
    'portia_promo_qualification_options',
    'portia_promo_qualification_requests',
    'portia_promo_attempts',
    'portia_promo_attempt_questions',
    'portia_promo_answers',
    'portia_promo_results',
    'portia_promo_audit_events'
  ] loop
    if to_regclass('public.' || missing_object) is null then
      raise exception 'Phase 14 missing table: %', missing_object;
    end if;
  end loop;

  if to_regprocedure('public.portia_promo_claim_request(text,uuid)') is null
    or to_regprocedure('public.portia_promo_cleanup()') is null then
    raise exception 'Phase 14 RPC verification failed';
  end if;

  if not exists (
    select 1 from cron.job where jobname = 'portia-promo-cleanup'
  ) then
    raise exception 'Phase 14 cleanup schedule verification failed';
  end if;
end
$phase14_assert$;

notify pgrst, 'reload schema';
commit;

-- ROLLBACK GUIDANCE
-- 1. Disable the named cron job first: select cron.unschedule(jobid) from cron.job
--    where jobname = 'portia-promo-cleanup'.
-- 2. Revoke Phase 14 RPC execution before removing functions or tables.
-- 3. Export compact results/audit rows if retention is required.
-- 4. Drop Phase 14 functions, then tables in reverse foreign-key order.
-- Do not use an automatic destructive rollback: owner review is required.

