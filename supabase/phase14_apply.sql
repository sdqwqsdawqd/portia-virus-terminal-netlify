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
  current_question_index integer not null default 0 check (current_question_index between 0 and 100000),
  last_seen_at timestamptz,
  lease_expires_at timestamptz,
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
alter table public.portia_promo_attempts add column if not exists current_question_index integer not null default 0 check (current_question_index between 0 and 100000);
alter table public.portia_promo_attempts add column if not exists last_seen_at timestamptz;
alter table public.portia_promo_attempts add column if not exists lease_expires_at timestamptz;

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
  answer_nonce text check (answer_nonce is null or length(answer_nonce) between 16 and 80),
  reviewer_correct boolean,
  submitted_at timestamptz not null default now(),
  graded_at timestamptz,
  unique (attempt_id, question_id)
);
alter table public.portia_promo_answers add column if not exists answer_nonce text check (answer_nonce is null or length(answer_nonce) between 16 and 80);
create unique index if not exists portia_promo_answer_nonce on public.portia_promo_answers (attempt_id, answer_nonce) where answer_nonce is not null;

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
end; $$;

create or replace function public.portia_promo_resolve_device(p_token_hash text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare bound_nickname text;
begin
  if length(p_token_hash) not between 32 and 128 then raise exception 'invalid-device-token'; end if;
  select nickname_key into bound_nickname from public.portia_promo_device_bindings
    where token_hash = p_token_hash and reset_at is null;
  return bound_nickname;
end; $$;

create or replace function public.portia_promo_reset_device(p_nickname_key text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  if not public.portia_is_owner() then raise exception 'forbidden'; end if;
  if length(trim(p_nickname_key)) not between 1 and 64 then raise exception 'invalid-nickname'; end if;
  update public.portia_promo_device_bindings set reset_at = now()
    where nickname_key = lower(trim(p_nickname_key)) and reset_at is null;
  insert into public.portia_promo_audit_events (nickname_key, actor_id, event_type)
  values (lower(trim(p_nickname_key)), auth.uid(), 'device-reset');
  return found;
end; $$;

create or replace function public.portia_promo_reviewer_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare ordinary_rows jsonb; qualification_rows jsonb;
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'requestId', r.id, 'nickname', r.nickname, 'nicknameKey', r.nickname_key,
    'titleId', r.title_id, 'targetTitleId', r.target_title_id, 'status', r.status,
    'claimed', r.reviewer_id is not null, 'assignedToMe', r.reviewer_id = auth.uid(), 'createdAt', r.created_at, 'updatedAt', r.updated_at
  ) order by r.created_at), '[]'::jsonb) into ordinary_rows
  from public.portia_promo_requests r;
  select coalesce(jsonb_agg(jsonb_build_object(
    'requestId', q.id, 'nickname', q.nickname, 'nicknameKey', q.nickname_key,
    'titleId', q.title_id, 'targetTitleId', q.transition_id, 'status', q.status,
    'claimed', q.reviewer_id is not null, 'assignedToMe', q.reviewer_id = auth.uid(), 'createdAt', q.created_at, 'updatedAt', q.updated_at,
    'attemptId', a.id, 'attemptStatus', a.status, 'deadlineAt', a.deadline_at, 'retakeAt', a.retake_at, 'technicalFailure', a.technical_failure,
    'answers', coalesce((select jsonb_agg(jsonb_build_object(
      'answerId', ans.id, 'questionId', aq.id, 'questionText', aq.snapshot_text, 'questionType', aq.question_type,
      'options', aq.snapshot_options, 'answerKey', aq.answer_key, 'answer', ans.answer, 'correct', ans.reviewer_correct
    ) order by aq.sort_order) from public.portia_promo_attempt_questions aq
      left join public.portia_promo_answers ans on ans.question_id = aq.id and ans.attempt_id = a.id
      where aq.attempt_id = a.id and ans.id is not null), '[]'::jsonb)
  ) order by q.created_at), '[]'::jsonb) into qualification_rows
  from public.portia_promo_qualification_requests q
  left join public.portia_promo_attempts a on a.request_id = q.id;
  return jsonb_build_object('ordinary', ordinary_rows, 'qualification', qualification_rows, 'serverNow', now());
end; $$;

create or replace function public.portia_promo_approve_assignment(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  update public.portia_promo_assignments a set status = 'approved', approved_at = now(), updated_at = now()
  from public.portia_promo_requests r
  where r.id = p_request_id and a.request_id = r.id and a.status = 'active'
    and r.status = 'assigned' and r.reviewer_id = auth.uid() and a.reviewer_id = auth.uid();
  if found then
    update public.portia_promo_requests set status = 'awaiting-sheet-change', updated_at = now() where id = p_request_id;
  end if;
  return found;
end; $$;

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
  bucket_exists boolean;
begin
  if length(p_bucket_key) not between 1 and 160 or length(p_ip_bucket) > 128 then
    raise exception 'invalid-attempt-bucket';
  end if;
  select failures, blocked_until, true into current_failures, until_at, bucket_exists
    from public.portia_promo_attempt_buckets where bucket_key = p_bucket_key for update;
  if p_success then
    insert into public.portia_promo_attempt_buckets (bucket_key, ip_bucket, failures, blocked_until)
    values (p_bucket_key, p_ip_bucket, 0, null)
    on conflict (bucket_key) do update set failures = 0, blocked_until = null, ip_bucket = excluded.ip_bucket, updated_at = now();
    return null;
  end if;
  if bucket_exists and until_at is not null and until_at > now() then return until_at; end if;
  current_failures := least(coalesce(current_failures, 0) + 1, 1000);
  until_at := now() + case
    when current_failures = 1 then interval '5 minutes'
    when current_failures = 2 then interval '15 minutes'
    else interval '60 minutes'
  end;
  insert into public.portia_promo_attempt_buckets (bucket_key, ip_bucket, failures, blocked_until)
  values (p_bucket_key, p_ip_bucket, current_failures, until_at)
  on conflict (bucket_key) do update set
    failures = excluded.failures, blocked_until = excluded.blocked_until,
    ip_bucket = excluded.ip_bucket, updated_at = now();
  return until_at;
end; $$;

drop function if exists public.portia_promo_submit_request(text, text, text, text, text, text, text);
create or replace function public.portia_promo_submit_request(
  p_kind text,
  p_nickname text,
  p_nickname_key text,
  p_title_id text,
  p_target_id text,
  p_token_hash text,
  p_risk_bucket text default '',
  p_bucket_key text default '',
  p_ip_bucket text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  request_id uuid;
  normalized_key text := lower(trim(p_nickname_key));
  bound_by_token text;
  token_by_nickname text;
  current_failures integer := 0;
  until_at timestamptz;
begin
  if length(normalized_key) not between 1 and 64
    or length(p_token_hash) not between 32 and 128
    or length(p_risk_bucket) > 128
    or length(p_bucket_key) not between 1 and 160
    or length(p_ip_bucket) > 128 then
    raise exception 'invalid-device-binding';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('promo:bucket:' || p_bucket_key, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('promo:nickname:' || normalized_key, 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('promo:token:' || p_token_hash, 0));

  insert into public.portia_promo_attempt_buckets (bucket_key, ip_bucket)
  values (p_bucket_key, p_ip_bucket)
  on conflict (bucket_key) do nothing;
  select failures, blocked_until into current_failures, until_at
    from public.portia_promo_attempt_buckets
    where bucket_key = p_bucket_key
    for update;
  if until_at is not null and until_at > now() then
    return jsonb_build_object('code', 'throttled', 'blockedUntil', until_at);
  end if;

  select nickname_key into bound_by_token
    from public.portia_promo_device_bindings
    where token_hash = p_token_hash and reset_at is null
    for update;
  select token_hash into token_by_nickname
    from public.portia_promo_device_bindings
    where nickname_key = normalized_key and reset_at is null
    for update;
  if (bound_by_token is not null and bound_by_token <> normalized_key)
    or (token_by_nickname is not null and token_by_nickname <> p_token_hash) then
    current_failures := least(coalesce(current_failures, 0) + 1, 1000);
    until_at := now() + case
      when current_failures = 1 then interval '5 minutes'
      when current_failures = 2 then interval '15 minutes'
      else interval '60 minutes'
    end;
    update public.portia_promo_attempt_buckets
      set failures = current_failures, blocked_until = until_at,
          ip_bucket = p_ip_bucket, updated_at = now()
      where bucket_key = p_bucket_key;
    return jsonb_build_object('code', 'device-denied', 'blockedUntil', until_at);
  end if;

  delete from public.portia_promo_device_bindings
    where reset_at is not null and (nickname_key = normalized_key or token_hash = p_token_hash);
  insert into public.portia_promo_device_bindings (nickname_key, token_hash, risk_bucket)
  values (normalized_key, p_token_hash, p_risk_bucket)
  on conflict (nickname_key) do update set
    token_hash = excluded.token_hash, risk_bucket = excluded.risk_bucket,
    bound_at = now(), reset_at = null;

  if (p_kind = 'ordinary' and exists (
      select 1 from public.portia_promo_requests
      where nickname_key = normalized_key and status in ('pending', 'claimed', 'assigned', 'awaiting-sheet-change')
    )) or (p_kind = 'qualification' and exists (
      select 1 from public.portia_promo_qualification_requests
      where nickname_key = normalized_key and status in ('pending', 'claimed', 'approved', 'testing', 'grading')
    )) then
    return jsonb_build_object('code', 'active-request');
  end if;

  if p_kind = 'ordinary' then
    insert into public.portia_promo_requests (nickname, nickname_key, title_id, target_title_id)
    values (left(trim(p_nickname), 64), normalized_key, p_title_id, p_target_id)
    returning id into request_id;
  elsif p_kind = 'qualification' then
    insert into public.portia_promo_qualification_requests (nickname, nickname_key, title_id, transition_id)
    values (left(trim(p_nickname), 64), normalized_key, p_title_id, p_target_id)
    returning id into request_id;
  else raise exception 'invalid-request-kind'; end if;
  update public.portia_promo_attempt_buckets
    set failures = 0, blocked_until = null, ip_bucket = p_ip_bucket, updated_at = now()
    where bucket_key = p_bucket_key;
  return jsonb_build_object('code', 'created', 'requestId', request_id);
end; $$;

create or replace function public.portia_promo_public_status(
  p_nickname_key text,
  p_title_id text,
  p_token_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_key text := lower(trim(p_nickname_key));
  binding_state text := 'unbound';
  ordinary_state jsonb;
  qualification_state jsonb;
  recent_results jsonb;
  qualification_passed boolean := false;
  awaiting_title text;
begin
  if length(normalized_key) not between 1 and 64 or length(p_title_id) not between 1 and 48
    or (p_token_hash is not null and length(p_token_hash) not between 32 and 128) then
    raise exception 'invalid-public-status';
  end if;
  if exists (select 1 from public.portia_promo_device_bindings where nickname_key = normalized_key and reset_at is null) then
    binding_state := case when p_token_hash is not null and exists (
      select 1 from public.portia_promo_device_bindings
      where nickname_key = normalized_key and token_hash = p_token_hash and reset_at is null
    ) then 'allowed' else 'denied' end;
  elsif p_token_hash is not null and exists (
    select 1 from public.portia_promo_device_bindings where token_hash = p_token_hash and reset_at is null
  ) then binding_state := 'denied';
  end if;
  if binding_state = 'denied' then return jsonb_build_object('binding', binding_state); end if;

  select jsonb_build_object(
      'status', r.status,
      'targetTitleId', r.target_title_id,
      'tasks', case when r.status = 'assigned' then coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', ai.id,
          'text', ai.snapshot_text,
          'sortOrder', ai.sort_order
        ) order by ai.sort_order)
        from public.portia_promo_assignments assignment
        join public.portia_promo_assignment_items ai on ai.assignment_id = assignment.id
        where assignment.request_id = r.id
      ), '[]'::jsonb) else '[]'::jsonb end
    ),
    case when r.status = 'awaiting-sheet-change' then r.title_id else null end
    into ordinary_state, awaiting_title
    from public.portia_promo_requests r
    where r.nickname_key = normalized_key
    order by r.created_at desc limit 1;
  select jsonb_build_object(
      'status', q.status,
      'targetTitleId', q.transition_id,
      'attemptId', a.id,
      'availableAt', a.retake_at,
      'percent', a.final_percent
    ) into qualification_state
    from public.portia_promo_qualification_requests q
    left join public.portia_promo_attempts a on a.request_id = q.id
    where q.nickname_key = normalized_key
    order by q.created_at desc limit 1;
  select exists (
    select 1 from public.portia_promo_results r
    where r.nickname_key = normalized_key and r.result_kind = 'qualification' and r.outcome = 'passed'
      and r.compact ->> 'titleId' = p_title_id
  ) into qualification_passed;
  select coalesce(jsonb_agg(jsonb_build_object(
    'kind', history.result_kind, 'outcome', history.outcome, 'createdAt', history.created_at
  ) order by history.created_at desc), '[]'::jsonb) into recent_results
  from (
    select result_kind, outcome, created_at from public.portia_promo_results
    where nickname_key = normalized_key order by created_at desc, id desc limit 3
  ) history;
  return jsonb_build_object(
    'binding', binding_state,
    'ordinary', ordinary_state,
    'qualification', qualification_state,
    'qualificationPassed', qualification_passed,
    'awaitingTitleId', awaiting_title,
    'results', recent_results
  );
end; $$;

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
end; $$;

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
end; $$;

create or replace function public.portia_promo_reject_request(p_kind text, p_request_id uuid, p_internal_note text default '')
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  nickname_key_value text;
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  if length(p_internal_note) > 2000 then raise exception 'note-too-long'; end if;
  if p_kind = 'ordinary' then
    select nickname_key into nickname_key_value from public.portia_promo_requests
      where id = p_request_id and status in ('claimed', 'assigned') and reviewer_id = auth.uid() for update;
    if nickname_key_value is null then return false; end if;
  elsif p_kind = 'qualification' then
    select nickname_key into nickname_key_value from public.portia_promo_qualification_requests
      where id = p_request_id and status in ('claimed', 'approved', 'testing', 'grading') and reviewer_id = auth.uid() for update;
    if nickname_key_value is null then return false; end if;
  else return false; end if;
  insert into public.portia_promo_results (nickname_key, result_kind, outcome, compact)
    values (nickname_key_value, p_kind, 'rejected', jsonb_build_object('requestId', p_request_id));
  insert into public.portia_promo_audit_events (nickname_key, actor_id, event_type, details)
    values (nickname_key_value, auth.uid(), 'request-rejected', jsonb_build_object('kind', p_kind, 'requestId', p_request_id, 'note', p_internal_note));
  if p_kind = 'ordinary' then delete from public.portia_promo_requests where id = p_request_id;
  else delete from public.portia_promo_qualification_requests where id = p_request_id; end if;
  delete from public.portia_promo_results where id in (
    select id from (
      select id, row_number() over (partition by nickname_key order by created_at desc, id desc) as history_order
      from public.portia_promo_results where nickname_key = nickname_key_value
    ) ranked where history_order > 3
  );
  return true;
end; $$;

create or replace function public.portia_promo_delete_request(p_kind text, p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  nickname_key_value text;
  assignment_ids uuid[] := '{}'::uuid[];
  attempt_ids uuid[] := '{}'::uuid[];
begin
  if not public.portia_has_tab_grant('promo') or not public.portia_is_owner() then raise exception 'owner-required'; end if;
  if p_kind = 'ordinary' then
    select nickname_key into nickname_key_value from public.portia_promo_requests where id = p_request_id for update;
    if nickname_key_value is null then return false; end if;
    select coalesce(array_agg(id), '{}'::uuid[]) into assignment_ids from public.portia_promo_assignments where request_id = p_request_id;
  elsif p_kind = 'qualification' then
    select nickname_key into nickname_key_value from public.portia_promo_qualification_requests where id = p_request_id for update;
    if nickname_key_value is null then return false; end if;
    select coalesce(array_agg(id), '{}'::uuid[]) into attempt_ids from public.portia_promo_attempts where request_id = p_request_id;
  else return false; end if;
  delete from public.portia_promo_results result
    where result.compact ->> 'requestId' = p_request_id::text
      or exists (select 1 from unnest(assignment_ids) assignment_id where result.compact ->> 'assignmentId' = assignment_id::text)
      or exists (select 1 from unnest(attempt_ids) attempt_id where result.compact ->> 'attemptId' = attempt_id::text);
  insert into public.portia_promo_audit_events (nickname_key, actor_id, event_type, details)
    values (nickname_key_value, auth.uid(), 'request-deleted', jsonb_build_object('kind', p_kind, 'requestId', p_request_id));
  if p_kind = 'ordinary' then delete from public.portia_promo_requests where id = p_request_id;
  else delete from public.portia_promo_qualification_requests where id = p_request_id; end if;
  return true;
end; $$;

create or replace function public.portia_promo_confirm_assignment(p_request_id uuid, p_bank_id uuid, p_bank_version text, p_items jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_assignment_id uuid;
  request_target text;
  required_count_value integer;
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'invalid-assignment';
  end if;
  select target_title_id into request_target from public.portia_promo_requests
    where id = p_request_id and status = 'claimed' and reviewer_id = auth.uid() for update;
  if request_target is null then return null; end if;
  select b.required_count into required_count_value from public.portia_promo_task_banks b
    where b.id = p_bank_id and b.target_title_id = request_target
      and md5(b.updated_at::text || coalesce((select max(i.updated_at)::text from public.portia_promo_task_items i where i.bank_id = b.id), '')) = p_bank_version
    for update;
  if required_count_value is null or jsonb_array_length(p_items) <> required_count_value then raise exception 'stale-or-mismatched-bank'; end if;
  insert into public.portia_promo_assignments (request_id, reviewer_id) values (p_request_id, auth.uid()) returning id into created_assignment_id;
  insert into public.portia_promo_assignment_items (assignment_id, source_item_id, snapshot_text, sort_order)
  select created_assignment_id, item.source_item_id, source.task_text, item.sort_order
  from jsonb_to_recordset(p_items) as item(source_item_id uuid, sort_order integer)
  join public.portia_promo_task_items source on source.id = item.source_item_id and source.bank_id = p_bank_id and source.active
  join public.portia_promo_task_banks bank on bank.id = source.bank_id and bank.target_title_id = request_target
  where item.sort_order between 0 and 49;
  if (select count(*) from public.portia_promo_assignment_items ai where ai.assignment_id = created_assignment_id) <> jsonb_array_length(p_items) then
    raise exception 'invalid-assignment-items';
  end if;
  update public.portia_promo_requests set status = 'assigned', updated_at = now() where id = p_request_id;
  return created_assignment_id;
end; $$;

drop function if exists public.portia_promo_confirm_test(uuid, uuid, text, jsonb, text);
create or replace function public.portia_promo_confirm_test(p_request_id uuid, p_bank_id uuid, p_bank_version text, p_questions jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  created_attempt_id uuid;
  request_transition text;
  quota_total integer;
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_questions) <> 'array'
    or jsonb_array_length(p_questions) not between 1 and 100 then raise exception 'invalid-test'; end if;
  select transition_id into request_transition from public.portia_promo_qualification_requests
    where id = p_request_id and status = 'claimed' and reviewer_id = auth.uid() for update;
  if request_transition is null then return null; end if;
  select b.single_count + b.multiple_count + b.free_text_count into quota_total
    from public.portia_promo_qualification_banks b
    where b.id = p_bank_id and b.transition_id = request_transition
      and md5(b.updated_at::text || coalesce((select max(q.updated_at)::text from public.portia_promo_qualification_questions q where q.bank_id = b.id), '')) = p_bank_version
    for update;
  if quota_total is null or jsonb_array_length(p_questions) <> quota_total then raise exception 'stale-or-mismatched-bank'; end if;
  insert into public.portia_promo_attempts (request_id, reviewer_id, status)
    values (p_request_id, auth.uid(), 'prepared')
    returning id into created_attempt_id;
  insert into public.portia_promo_attempt_questions (
    attempt_id, source_question_id, question_type, snapshot_text, snapshot_options, answer_key, sort_order
  )
  select created_attempt_id, item.source_question_id, source.question_type, source.question_text,
    coalesce((select jsonb_agg(o.option_text order by o.sort_order) from public.portia_promo_qualification_options o where o.question_id = source.id), '[]'::jsonb),
    source.answer_key, item.sort_order
  from jsonb_to_recordset(p_questions) as item(source_question_id uuid, sort_order integer)
  join public.portia_promo_qualification_questions source on source.id = item.source_question_id and source.bank_id = p_bank_id and source.active
  join public.portia_promo_qualification_banks bank on bank.id = source.bank_id and bank.transition_id = request_transition
  where item.sort_order between 0 and 99;
  if (select count(*) from public.portia_promo_attempt_questions aq where aq.attempt_id = created_attempt_id) <> jsonb_array_length(p_questions) then
    raise exception 'invalid-test-questions';
  end if;
  update public.portia_promo_qualification_requests set status = 'testing', updated_at = now() where id = p_request_id;
  return created_attempt_id;
end; $$;

create or replace function public.portia_promo_expire_stale_attempt(p_attempt_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare changed boolean := false;
begin
  update public.portia_promo_attempts
    set status = 'failed', technical_failure = coalesce(technical_failure, 'timeout'), updated_at = now()
    where id = p_attempt_id and status = 'active' and deadline_at <= now();
  changed := found;
  if exists (
    select 1 from public.portia_promo_attempts
    where id = p_attempt_id and status = 'active' and lease_expires_at <= now()
  ) then
    update public.portia_promo_attempts
      set status = 'failed', technical_failure = coalesce(technical_failure, 'connection-lost'), updated_at = now()
      where id = p_attempt_id and status = 'active' and lease_expires_at <= now();
    changed := changed or found;
  end if;
  if changed then
    update public.portia_promo_qualification_requests r
      set status = 'failed', updated_at = now()
      from public.portia_promo_attempts a
      where a.id = p_attempt_id and a.request_id = r.id and r.status in ('testing', 'grading');
  end if;
  return changed;
end; $$;

create or replace function public.portia_promo_heartbeat_test(p_attempt_id uuid, p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare lease_until timestamptz;
begin
  perform public.portia_promo_expire_stale_attempt(p_attempt_id);
  update public.portia_promo_attempts a
    set last_seen_at = now(), lease_expires_at = now() + interval '45 seconds', updated_at = now()
  from public.portia_promo_qualification_requests r
  where a.id = p_attempt_id and a.request_id = r.id and a.status = 'active'
    and a.deadline_at > now()
    and exists (
      select 1 from public.portia_promo_device_bindings b
      where b.nickname_key = r.nickname_key and b.token_hash = p_token_hash and b.reset_at is null
    )
  returning a.lease_expires_at into lease_until;
  if lease_until is null then return jsonb_build_object('code', 'inactive'); end if;
  return jsonb_build_object('code', 'active', 'leaseExpiresAt', lease_until);
end; $$;

drop function if exists public.portia_promo_start_test(uuid, text);
create or replace function public.portia_promo_start_test(p_attempt_id uuid, p_token_hash text, p_client_mode text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare deadline timestamptz;
begin
  if p_client_mode not in ('desktop', 'phone') then return null; end if;
  perform public.portia_promo_expire_stale_attempt(p_attempt_id);
  update public.portia_promo_attempts a set
    status = 'active', started_at = now(), deadline_at = now() + interval '15 minutes',
    client_mode = p_client_mode, last_seen_at = now(), lease_expires_at = now() + interval '45 seconds', updated_at = now()
  from public.portia_promo_qualification_requests r
  where a.id = p_attempt_id and a.request_id = r.id and a.status = 'prepared'
    and exists (select 1 from public.portia_promo_device_bindings b where b.nickname_key = r.nickname_key and b.token_hash = p_token_hash and b.reset_at is null)
  returning a.deadline_at into deadline;
  if deadline is null then select a.deadline_at into deadline from public.portia_promo_attempts a
    join public.portia_promo_qualification_requests r on r.id = a.request_id
    where a.id = p_attempt_id and a.status = 'active' and a.client_mode = p_client_mode and exists (
      select 1 from public.portia_promo_device_bindings b where b.nickname_key = r.nickname_key and b.token_hash = p_token_hash and b.reset_at is null
    ); end if;
  return deadline;
end; $$;

create or replace function public.portia_promo_current_test(p_attempt_id uuid, p_token_hash text, p_client_mode text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare result jsonb; answer_count integer; question_count integer;
begin
  if p_client_mode not in ('desktop', 'phone') then return null; end if;
  perform public.portia_promo_expire_stale_attempt(p_attempt_id);
  if not exists (
    select 1 from public.portia_promo_attempts a
    join public.portia_promo_qualification_requests r on r.id = a.request_id
    join public.portia_promo_device_bindings b on b.nickname_key = r.nickname_key
    where a.id = p_attempt_id and a.client_mode = p_client_mode
      and b.token_hash = p_token_hash and b.reset_at is null
  ) then return null; end if;
  select current_question_index into answer_count from public.portia_promo_attempts where id = p_attempt_id;
  select count(*) into question_count from public.portia_promo_attempt_questions where attempt_id = p_attempt_id;
  if answer_count = question_count and question_count > 0 then
    update public.portia_promo_attempts set status = 'grading', updated_at = now() where id = p_attempt_id and status = 'active';
    update public.portia_promo_qualification_requests r set status = 'grading', updated_at = now()
      from public.portia_promo_attempts a where a.id = p_attempt_id and a.request_id = r.id and a.status = 'grading';
  end if;
  select jsonb_build_object(
    'attemptId', a.id, 'nickname', r.nickname, 'titleId', r.title_id,
    'status', case when a.status in ('failed','passed') then a.status when a.status = 'grading' then 'submitted' else a.status end,
    'clientMode', a.client_mode, 'deadlineAt', a.deadline_at,
    'terminalReason', case when a.technical_failure is null then null when a.technical_failure = 'timeout' then 'timeout' else 'technical' end,
    'result', case when a.status in ('passed','failed') and a.technical_failure is null then a.status else null end,
    'percent', a.final_percent,
    'question', case when a.status = 'active' then (
      select jsonb_build_object('id', q.id, 'type', q.question_type, 'text', q.snapshot_text,
        'options', q.snapshot_options, 'index', q.sort_order, 'total', question_count)
      from public.portia_promo_attempt_questions q where q.attempt_id = a.id and q.sort_order = answer_count limit 1
    ) else null end
  ) into result
  from public.portia_promo_attempts a join public.portia_promo_qualification_requests r on r.id = a.request_id
  where a.id = p_attempt_id;
  return result;
end; $$;

drop function if exists public.portia_promo_answer_question(uuid, uuid, jsonb, text, text);
create or replace function public.portia_promo_answer_question(p_attempt_id uuid, p_question_id uuid, p_expected_question_index integer, p_answer jsonb, p_nonce text, p_token_hash text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  expected_order integer;
  saved_answer uuid;
begin
  perform public.portia_promo_expire_stale_attempt(p_attempt_id);
  if length(p_nonce) not between 16 and 80 or p_expected_question_index < 0 then
    return jsonb_build_object('code', 'invalid');
  end if;
  select a.current_question_index into expected_order
    from public.portia_promo_attempts a
    where a.id = p_attempt_id
    for update;
  if expected_order is null then return jsonb_build_object('code', 'not-found'); end if;
  if exists (select 1 from public.portia_promo_answers where attempt_id = p_attempt_id and answer_nonce = p_nonce) then
    return jsonb_build_object('code', 'accepted', 'idempotent', true, 'questionIndex', expected_order);
  end if;
  if expected_order <> p_expected_question_index then
    return jsonb_build_object('code', 'conflict', 'questionIndex', expected_order);
  end if;
  insert into public.portia_promo_answers (attempt_id, question_id, answer, answer_nonce)
  select a.id, q.id, p_answer, p_nonce
  from public.portia_promo_attempts a
  join public.portia_promo_qualification_requests r on r.id = a.request_id
  join public.portia_promo_attempt_questions q on q.attempt_id = a.id
  where a.id = p_attempt_id and q.id = p_question_id and q.sort_order = p_expected_question_index
    and a.status = 'active' and now() < a.deadline_at
    and exists (select 1 from public.portia_promo_device_bindings b where b.nickname_key = r.nickname_key and b.token_hash = p_token_hash and b.reset_at is null)
  on conflict do nothing
  returning id into saved_answer;
  if saved_answer is null then
    return jsonb_build_object('code', 'conflict', 'questionIndex', expected_order);
  end if;
  update public.portia_promo_attempts
    set current_question_index = current_question_index + 1, updated_at = now()
    where id = p_attempt_id and current_question_index = p_expected_question_index;
  if not found then
    return jsonb_build_object('code', 'conflict', 'questionIndex', expected_order);
  end if;
  return jsonb_build_object('code', 'accepted', 'idempotent', false, 'questionIndex', expected_order + 1);
end; $$;

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
end; $$;

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
end; $$;

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
    insert into public.portia_promo_results (nickname_key, result_kind, outcome, compact)
    select r.nickname_key, 'qualification', case when p_passed then 'passed' else 'failed' end,
      jsonb_build_object('attemptId', a.id, 'titleId', r.title_id, 'percent', p_percent)
    from public.portia_promo_attempts a join public.portia_promo_qualification_requests r on r.id = a.request_id
    where a.id = p_attempt_id and not exists (
      select 1 from public.portia_promo_results result where result.compact ->> 'attemptId' = p_attempt_id::text
    );
  end if;
  return found;
end; $$;

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
end; $$;

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
end; $$;

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
end; $$;

create or replace function public.portia_promo_cleanup()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Workflow rows require a fresh sheet validation and explicit reviewer/owner deletion.
  -- The scheduled job only prunes non-workflow operational data.
  delete from public.portia_promo_attempt_buckets where updated_at < now() - interval '3 days';
  delete from cron.job_run_details where end_time < now() - interval '7 days';
  return 0;
end; $$;

create or replace function public.portia_promo_bank_state()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare task_rows jsonb; qualification_rows jsonb;
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'targetTitleId', b.target_title_id, 'requiredCount', b.required_count,
    'version', md5(b.updated_at::text || coalesce((select max(i.updated_at)::text from public.portia_promo_task_items i where i.bank_id = b.id), '')),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', i.id, 'text', i.task_text, 'active', i.active, 'sortOrder', i.sort_order, 'updatedAt', i.updated_at
    ) order by i.sort_order, i.id) from public.portia_promo_task_items i where i.bank_id = b.id), '[]'::jsonb)
  ) order by b.target_title_id), '[]'::jsonb) into task_rows from public.portia_promo_task_banks b;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'transitionId', b.transition_id,
    'quotas', jsonb_build_object('single', b.single_count, 'multiple', b.multiple_count, 'freeText', b.free_text_count),
    'version', md5(b.updated_at::text || coalesce((select max(q.updated_at)::text from public.portia_promo_qualification_questions q where q.bank_id = b.id), '')),
    'items', coalesce((select jsonb_agg(jsonb_build_object(
      'id', q.id, 'text', q.question_text, 'type', q.question_type, 'active', q.active,
      'sortOrder', q.sort_order, 'updatedAt', q.updated_at, 'answerKey', q.answer_key,
      'options', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'text', o.option_text, 'sortOrder', o.sort_order
      ) order by o.sort_order) from public.portia_promo_qualification_options o where o.question_id = q.id), '[]'::jsonb)
    ) order by q.sort_order, q.id) from public.portia_promo_qualification_questions q where q.bank_id = b.id), '[]'::jsonb)
  ) order by b.transition_id), '[]'::jsonb) into qualification_rows from public.portia_promo_qualification_banks b;
  return jsonb_build_object('taskBanks', task_rows, 'qualificationBanks', qualification_rows, 'serverNow', now());
end; $$;

create or replace function public.portia_promo_bank_command(p_action text, p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  result_id uuid;
  bank_id_value uuid;
  question_value jsonb;
  question_type_value text;
  option_row record;
  answer_value jsonb;
begin
  if not public.portia_has_tab_grant('promo') then raise exception 'forbidden'; end if;
  if pg_column_size(p_payload) > 65536 then raise exception 'payload-too-large'; end if;

  if p_action = 'save-task-bank' then
    if (p_payload ->> 'targetTitleId') not in ('trainee','laboratory-assistant','researcher','assistant','scientist','virologist-specialist','expert-virologist')
      or (p_payload ->> 'requiredCount')::integer not between 1 and 50 then raise exception 'invalid-bank'; end if;
    insert into public.portia_promo_task_banks (target_title_id, required_count)
    values (p_payload ->> 'targetTitleId', (p_payload ->> 'requiredCount')::integer)
    on conflict (target_title_id) do update set required_count = excluded.required_count, updated_at = now()
    returning id into result_id;

  elsif p_action = 'save-task-item' then
    bank_id_value := (p_payload ->> 'bankId')::uuid;
    if not exists (select 1 from public.portia_promo_task_banks b where b.id = bank_id_value and b.target_title_id in ('trainee','laboratory-assistant','researcher','assistant','scientist','virologist-specialist','expert-virologist'))
      or length(trim(p_payload ->> 'text')) not between 1 and 4000
      or (p_payload ->> 'sortOrder')::integer not between 0 and 10000 then raise exception 'invalid-item'; end if;
    if nullif(p_payload ->> 'itemId', '') is null then
      insert into public.portia_promo_task_items (bank_id, task_text, active, sort_order)
      values (bank_id_value, trim(p_payload ->> 'text'), coalesce((p_payload ->> 'active')::boolean, true), coalesce((p_payload ->> 'sortOrder')::integer, 0))
      returning id into result_id;
    else
      update public.portia_promo_task_items set task_text = trim(p_payload ->> 'text'),
        active = coalesce((p_payload ->> 'active')::boolean, active),
        sort_order = coalesce((p_payload ->> 'sortOrder')::integer, sort_order), updated_at = now()
      where id = (p_payload ->> 'itemId')::uuid and bank_id = bank_id_value returning id into result_id;
    end if;
    update public.portia_promo_task_banks set updated_at = now() where id = bank_id_value;

  elsif p_action = 'delete-task-item' then
    if not exists (select 1 from public.portia_promo_task_banks b where b.id = (p_payload ->> 'bankId')::uuid and b.target_title_id in ('trainee','laboratory-assistant','researcher','assistant','scientist','virologist-specialist','expert-virologist')) then raise exception 'invalid-bank'; end if;
    delete from public.portia_promo_task_items where id = (p_payload ->> 'itemId')::uuid
      and bank_id = (p_payload ->> 'bankId')::uuid returning id, bank_id into result_id, bank_id_value;
    update public.portia_promo_task_banks set updated_at = now() where id = bank_id_value;

  elsif p_action = 'save-qualification-bank' then
    if (p_payload ->> 'transitionId') not in ('laboratory-assistant','assistant','virologist-specialist')
      or (p_payload #>> '{quotas,single}')::integer not between 0 and 100
      or (p_payload #>> '{quotas,multiple}')::integer not between 0 and 100
      or (p_payload #>> '{quotas,freeText}')::integer not between 0 and 100
      or ((p_payload #>> '{quotas,single}')::integer + (p_payload #>> '{quotas,multiple}')::integer + (p_payload #>> '{quotas,freeText}')::integer) not between 1 and 100
      then raise exception 'invalid-bank'; end if;
    insert into public.portia_promo_qualification_banks (transition_id, single_count, multiple_count, free_text_count)
    values (
      p_payload ->> 'transitionId',
      coalesce((p_payload #>> '{quotas,single}')::integer, 0),
      coalesce((p_payload #>> '{quotas,multiple}')::integer, 0),
      coalesce((p_payload #>> '{quotas,freeText}')::integer, 0)
    )
    on conflict (transition_id) do update set
      single_count = excluded.single_count, multiple_count = excluded.multiple_count,
      free_text_count = excluded.free_text_count, updated_at = now()
    returning id into result_id;

  elsif p_action = 'save-question' then
    bank_id_value := (p_payload ->> 'bankId')::uuid;
    question_value := p_payload -> 'question';
    question_type_value := question_value ->> 'type';
    answer_value := question_value -> 'answer';
    if not exists (select 1 from public.portia_promo_qualification_banks b where b.id = bank_id_value and b.transition_id in ('laboratory-assistant','assistant','virologist-specialist'))
      or question_type_value not in ('single', 'multiple', 'free-text')
      or length(trim(question_value ->> 'text')) not between 1 and 4000
      or (p_payload ->> 'sortOrder')::integer not between 0 and 10000 then raise exception 'invalid-question'; end if;
    if nullif(p_payload ->> 'questionId', '') is null then
      insert into public.portia_promo_qualification_questions (bank_id, question_type, question_text, answer_key, active, sort_order)
      values (bank_id_value, question_type_value, trim(question_value ->> 'text'), answer_value,
        coalesce((p_payload ->> 'active')::boolean, true), coalesce((p_payload ->> 'sortOrder')::integer, 0))
      returning id into result_id;
    else
      update public.portia_promo_qualification_questions set question_type = question_type_value,
        question_text = trim(question_value ->> 'text'), answer_key = answer_value,
        active = coalesce((p_payload ->> 'active')::boolean, active),
        sort_order = coalesce((p_payload ->> 'sortOrder')::integer, sort_order), updated_at = now()
      where id = (p_payload ->> 'questionId')::uuid and bank_id = bank_id_value returning id into result_id;
      delete from public.portia_promo_qualification_options where question_id = result_id;
    end if;
    if question_type_value <> 'free-text' then
      for option_row in
        select value #>> '{}' as option_text, ordinality - 1 as option_index
        from jsonb_array_elements(question_value -> 'options') with ordinality
      loop
        insert into public.portia_promo_qualification_options (question_id, option_text, is_correct, sort_order)
        values (
          result_id, option_row.option_text,
          case when question_type_value = 'single' then (answer_value #>> '{}')::integer = option_row.option_index
            else answer_value @> to_jsonb(array[option_row.option_index]) end,
          option_row.option_index
        );
      end loop;
    end if;
    update public.portia_promo_qualification_banks set updated_at = now() where id = bank_id_value;

  elsif p_action = 'delete-question' then
    if not exists (select 1 from public.portia_promo_qualification_banks b where b.id = (p_payload ->> 'bankId')::uuid and b.transition_id in ('laboratory-assistant','assistant','virologist-specialist')) then raise exception 'invalid-bank'; end if;
    delete from public.portia_promo_qualification_questions where id = (p_payload ->> 'questionId')::uuid
      and bank_id = (p_payload ->> 'bankId')::uuid returning id, bank_id into result_id, bank_id_value;
    update public.portia_promo_qualification_banks set updated_at = now() where id = bank_id_value;
  else
    raise exception 'invalid-bank-command';
  end if;
  if result_id is null then raise exception 'bank-item-not-found'; end if;
  return result_id;
end; $$;


revoke all on function public.portia_promo_bind_device(text, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_resolve_device(text) from public, anon, authenticated;
revoke all on function public.portia_promo_reset_device(text) from public, anon, authenticated;
revoke all on function public.portia_promo_reviewer_state() from public, anon, authenticated;
revoke all on function public.portia_promo_approve_assignment(uuid) from public, anon, authenticated;
revoke all on function public.portia_promo_bank_state() from public, anon, authenticated;
revoke all on function public.portia_promo_bank_command(text, jsonb) from public, anon, authenticated;
revoke all on function public.portia_promo_register_attempt(text, text, boolean) from public, anon, authenticated;
revoke all on function public.portia_promo_submit_request(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_public_status(text, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_claim_request(text, uuid) from public, anon, authenticated;
revoke all on function public.portia_promo_release_request(text, uuid, boolean) from public, anon, authenticated;
revoke all on function public.portia_promo_reject_request(text, uuid, text) from public, anon, authenticated;
revoke all on function public.portia_promo_delete_request(text, uuid) from public, anon, authenticated;
revoke all on function public.portia_promo_confirm_assignment(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.portia_promo_confirm_test(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.portia_promo_start_test(uuid, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_expire_stale_attempt(uuid) from public, anon, authenticated;
revoke all on function public.portia_promo_heartbeat_test(uuid, text) from public, anon, authenticated;
revoke all on function public.portia_promo_current_test(uuid, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_answer_question(uuid, uuid, integer, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_fail_attempt(uuid, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_grade_answer(uuid, boolean) from public, anon, authenticated;
revoke all on function public.portia_promo_finalize_attempt(uuid, boolean, integer, integer) from public, anon, authenticated;
revoke all on function public.portia_promo_override_failure(uuid) from public, anon, authenticated;
revoke all on function public.portia_promo_release_retake(uuid) from public, anon, authenticated;
revoke all on function public.portia_promo_close(text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.portia_promo_cleanup() from public, anon, authenticated;

grant execute on function public.portia_promo_bind_device(text, text, text) to anon, authenticated;
grant execute on function public.portia_promo_resolve_device(text) to anon, authenticated;
grant execute on function public.portia_promo_register_attempt(text, text, boolean) to anon, authenticated;
grant execute on function public.portia_promo_submit_request(text, text, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.portia_promo_public_status(text, text, text) to anon, authenticated;
grant execute on function public.portia_promo_start_test(uuid, text, text) to anon, authenticated;
grant execute on function public.portia_promo_heartbeat_test(uuid, text) to anon, authenticated;
grant execute on function public.portia_promo_current_test(uuid, text, text) to anon, authenticated;
grant execute on function public.portia_promo_answer_question(uuid, uuid, integer, jsonb, text, text) to anon, authenticated;
grant execute on function public.portia_promo_fail_attempt(uuid, text, text) to anon, authenticated;
grant execute on function public.portia_promo_reset_device(text) to authenticated;
grant execute on function public.portia_promo_reviewer_state() to authenticated;
grant execute on function public.portia_promo_approve_assignment(uuid) to authenticated;
grant execute on function public.portia_promo_bank_state() to authenticated;
grant execute on function public.portia_promo_bank_command(text, jsonb) to authenticated;
grant execute on function public.portia_promo_claim_request(text, uuid) to authenticated;
grant execute on function public.portia_promo_release_request(text, uuid, boolean) to authenticated;
grant execute on function public.portia_promo_reject_request(text, uuid, text) to authenticated;
grant execute on function public.portia_promo_delete_request(text, uuid) to authenticated;
grant execute on function public.portia_promo_confirm_assignment(uuid, uuid, text, jsonb) to authenticated;
grant execute on function public.portia_promo_confirm_test(uuid, uuid, text, jsonb) to authenticated;
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
end; $$;



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
    or to_regprocedure('public.portia_promo_delete_request(text,uuid)') is null
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
