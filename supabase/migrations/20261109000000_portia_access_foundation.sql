-- PORTIA access foundation (Phase 21, D-01..D-10). Forward-only; no begin/commit (the CLI owns the transaction);
-- idempotent statements.
--
-- People, nick requests and the decision journal behind site access. Tables are closed to every API role (RLS on,
-- no policies, every privilege revoked); anon and authenticated reach them only through SECURITY DEFINER functions
-- pinned to search_path ''. Levels are 1..5; editors and the owner are level 5 without a person row (D-03).
--
-- Not applied anywhere by the agent. Apply order: 20261104000000_portia_rename_virus_classes.sql,
-- 20261104000100_portia_editor_notes.sql, 20261106000000_portia_drop_editor_notes.sql, then this file.
-- Postgres/RLS execution is BLOCKED until an isolated staging run; production is applied by the owner only.

-- a. One nickname rule (D-01 / ACC-04). The regex literal equals NICKNAME_PATTERN in lib/nickname.ts.
create or replace function public.portia_access_nickname_key(p_nickname text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when (p_nickname collate "C") ~ '^[A-Za-z0-9_]{3,20}$' then lower(p_nickname collate "C")
    else null
  end;
$$;

revoke all on function public.portia_access_nickname_key(text) from public, anon, authenticated;
grant execute on function public.portia_access_nickname_key(text) to service_role;

-- b. Editors and the owner always resolve to level 5; no person row is read (D-03 / LVL-01).
create or replace function public.portia_access_caller_level()
returns smallint
language sql
stable
security definer
set search_path = ''
as $$
  select case when public.portia_can_edit() then 5::smallint else null end;
$$;

revoke all on function public.portia_access_caller_level() from public, anon, authenticated;
grant execute on function public.portia_access_caller_level() to service_role;

-- c. People who may enter the site.
create table if not exists public.portia_access_people (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  nickname_key text not null,
  origin text not null,
  level smallint not null,
  status text not null default 'active',
  account_id uuid null,
  approved_at timestamptz not null default now(),
  approved_by uuid not null,
  updated_at timestamptz not null default now(),
  updated_by uuid not null,
  constraint portia_access_people_nickname_check check (public.portia_access_nickname_key(nickname) is not null),
  constraint portia_access_people_nickname_key_check check (nickname_key = public.portia_access_nickname_key(nickname)),
  constraint portia_access_people_nickname_key_unique unique (nickname_key),
  constraint portia_access_people_origin_check check (origin in ('sheet', 'outside')),
  constraint portia_access_people_level_check check (level between 1 and 5),
  constraint portia_access_people_status_check check (status in ('active', 'revoked')),
  constraint portia_access_people_account_unique unique (account_id)
);

-- d. Access requests, one row per device request.
create table if not exists public.portia_access_requests (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  nickname_key text not null,
  origin text not null,
  token_hash text not null,
  ip_bucket text not null,
  requested_by uuid null,
  person_id uuid null,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  decided_at timestamptz null,
  decided_by uuid null,
  cooldown_cleared_at timestamptz null,
  cooldown_cleared_by uuid null,
  constraint portia_access_requests_nickname_check check (public.portia_access_nickname_key(nickname) is not null),
  constraint portia_access_requests_nickname_key_check check (nickname_key = public.portia_access_nickname_key(nickname)),
  constraint portia_access_requests_origin_check check (origin in ('sheet', 'outside')),
  constraint portia_access_requests_token_hash_check check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint portia_access_requests_ip_bucket_check check (ip_bucket ~ '^[0-9a-f]{32}$'),
  constraint portia_access_requests_person_id_fkey foreign key (person_id) references public.portia_access_people (id),
  constraint portia_access_requests_status_check check (status in ('pending', 'approved', 'rejected', 'revoked')),
  constraint portia_access_requests_decided_check check ((status = 'pending') = (decided_at is null)),
  constraint portia_access_requests_person_check check (status in ('pending', 'rejected') or person_id is not null)
);

-- D-06: at most one pending request per nick; one live request per device.
create unique index if not exists portia_access_one_pending_per_nickname
  on public.portia_access_requests (nickname_key) where status = 'pending';
create unique index if not exists portia_access_one_active_request_per_device
  on public.portia_access_requests (token_hash) where status in ('pending', 'approved');
create index if not exists portia_access_requests_nickname_recent
  on public.portia_access_requests (nickname_key, created_at desc);
create index if not exists portia_access_requests_ip_recent
  on public.portia_access_requests (ip_bucket, created_at desc);
create index if not exists portia_access_requests_token_recent
  on public.portia_access_requests (token_hash, created_at desc);

-- e. Decision journal (D-07): decisions about people only, kept forever. No foreign key to auth.users or to requests:
-- the journal outlives accounts and request rows.
create table if not exists public.portia_access_journal (
  id bigint generated always as identity primary key,
  event_type text not null,
  actor_id uuid not null,
  nickname_key text not null,
  person_id uuid null,
  request_id uuid null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint portia_access_journal_event_type_check check (event_type in ('approve', 'reject', 'level-change', 'revoke', 'cooldown-clear')),
  constraint portia_access_journal_nickname_key_check check (public.portia_access_nickname_key(nickname_key) = nickname_key),
  constraint portia_access_journal_person_id_fkey foreign key (person_id) references public.portia_access_people (id),
  constraint portia_access_journal_details_check check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 4096)
);

create index if not exists portia_access_journal_by_nickname
  on public.portia_access_journal (nickname_key, id desc);
create index if not exists portia_access_journal_by_person
  on public.portia_access_journal (person_id, id desc);

-- f. Closed to every API role: RPC only.
alter table public.portia_access_people enable row level security;
alter table public.portia_access_requests enable row level security;
alter table public.portia_access_journal enable row level security;

revoke all on table public.portia_access_people from public, anon, authenticated;
revoke all on table public.portia_access_requests from public, anon, authenticated;
revoke all on table public.portia_access_journal from public, anon, authenticated;
grant all on table public.portia_access_people to service_role;
grant all on table public.portia_access_requests to service_role;
grant all on table public.portia_access_journal to service_role;

-- Default privileges would otherwise give anon/authenticated rights on the identity sequence (see 20261101000100).
revoke all on sequence public.portia_access_journal_id_seq from public, anon, authenticated;
grant all on sequence public.portia_access_journal_id_seq to service_role;

-- g. A visitor asks for access. Requests are collected whether the site is open or closed.
create or replace function public.portia_access_submit_request(p_nickname text, p_origin text, p_token_hash text, p_ip_bucket text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  normalized_key text := public.portia_access_nickname_key(p_nickname);
  device_key text;
  device_status text;
begin
  if normalized_key is null
    or p_origin is null or p_origin not in ('sheet', 'outside')
    or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_ip_bucket is null or p_ip_bucket !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('code', 'invalid');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('access:queue', 0));
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('access:nickname:' || normalized_key, 0));

  select r.nickname_key, r.status into device_key, device_status
    from public.portia_access_requests r
    where r.token_hash = p_token_hash and r.status in ('pending', 'approved')
    limit 1;
  if device_key is not null then
    if device_key <> normalized_key then return jsonb_build_object('code', 'device-busy'); end if;
    if device_status = 'pending' then return jsonb_build_object('code', 'pending'); end if;
    return jsonb_build_object('code', 'approved');
  end if;

  -- Another device already waits for this nick: say nothing about who or why (ACC-05 groundwork).
  if exists (
    select 1 from public.portia_access_requests r
    where r.nickname_key = normalized_key and r.status = 'pending'
  ) then
    return jsonb_build_object('code', 'unavailable');
  end if;

  insert into public.portia_access_requests (nickname, nickname_key, origin, token_hash, ip_bucket, requested_by)
  values (p_nickname, normalized_key, p_origin, p_token_hash, p_ip_bucket, auth.uid());
  return jsonb_build_object('code', 'created');
end; $$;

revoke all on function public.portia_access_submit_request(text, text, text, text) from public, anon, authenticated;
grant execute on function public.portia_access_submit_request(text, text, text, text) to anon, authenticated;
grant execute on function public.portia_access_submit_request(text, text, text, text) to service_role;

-- h. A device reads back only its own state (D-06: 1-hour pause after a rejection or revocation).
create or replace function public.portia_access_resolve(p_token_hash text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  req record;
  person record;
  retry_at timestamptz;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('state', 'none');
  end if;

  select r.status, r.nickname, r.person_id, r.decided_at, r.cooldown_cleared_at into req
    from public.portia_access_requests r
    where r.token_hash = p_token_hash
    order by (r.status in ('pending', 'approved')) desc, r.created_at desc
    limit 1;
  if not found then
    return jsonb_build_object('state', 'none');
  end if;

  if req.status = 'pending' then
    return jsonb_build_object('state', 'pending', 'nickname', req.nickname);
  end if;

  if req.status = 'approved' then
    select p.nickname, p.level, p.status into person
      from public.portia_access_people p
      where p.id = req.person_id;
    if found and person.status = 'active' then
      return jsonb_build_object('state', 'approved', 'nickname', person.nickname, 'level', person.level);
    end if;
    return jsonb_build_object('state', 'revoked', 'nickname', req.nickname, 'retryAt', null);
  end if;

  if req.cooldown_cleared_at is null and req.decided_at > now() - interval '1 hour' then
    retry_at := req.decided_at + interval '1 hour';
  end if;
  return jsonb_build_object('state', req.status, 'nickname', req.nickname, 'retryAt', retry_at);
end; $$;

revoke all on function public.portia_access_resolve(text) from public, anon, authenticated;
grant execute on function public.portia_access_resolve(text) to anon, authenticated;
grant execute on function public.portia_access_resolve(text) to service_role;

-- i. An editor decides a pending request (D-02 conditional transition, D-04 / D-09 defaults, D-07 journal).
create or replace function public.portia_access_decide(p_request_id uuid, p_decision text, p_level smallint default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_level smallint;
  req public.portia_access_requests%rowtype;
  person public.portia_access_people%rowtype;
  person_exists boolean;
  person_uuid uuid;
  new_level smallint;
  previous_level smallint;
  device_added boolean := false;
  account_for_person uuid;
begin
  if not public.portia_can_edit_tab('users') then raise exception 'forbidden'; end if;
  caller_level := public.portia_access_caller_level();
  if caller_level is null then raise exception 'forbidden'; end if;
  if p_decision is null or p_decision not in ('approve', 'reject') then raise exception 'invalid-decision'; end if;

  select * into req from public.portia_access_requests where id = p_request_id;
  if not found then return jsonb_build_object('code', 'not-found'); end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('access:nickname:' || req.nickname_key, 0));
  select * into req from public.portia_access_requests where id = p_request_id for update;
  if not found then return jsonb_build_object('code', 'not-found'); end if;
  if req.status <> 'pending' then
    return jsonb_build_object('code', 'already-decided', 'status', req.status);
  end if;

  if p_decision = 'reject' then
    update public.portia_access_requests
      set status = 'rejected', decided_at = now(), decided_by = auth.uid()
      where id = req.id and status = 'pending';
    insert into public.portia_access_journal (event_type, actor_id, nickname_key, request_id, details)
    values ('reject', auth.uid(), req.nickname_key, req.id, jsonb_build_object('origin', req.origin));
    return jsonb_build_object('code', 'rejected');
  end if;

  select * into person from public.portia_access_people where nickname_key = req.nickname_key for update;
  person_exists := found;

  select case
    when req.requested_by is not null
      and not exists (select 1 from public.portia_access_people p where p.account_id = req.requested_by)
    then req.requested_by
  end into account_for_person;

  if person_exists and person.status = 'active' then
    -- A further device of an approved person: the level stays, changes go through a separate call.
    if p_level is not null and p_level <> person.level then raise exception 'level-change-separate'; end if;
    new_level := person.level;
    person_uuid := person.id;
    device_added := true;
  else
    new_level := coalesce(p_level, case when req.origin = 'sheet' then 2 else 1 end)::smallint;
    if new_level not between 1 and 5 then raise exception 'invalid-level'; end if;
    if not person_exists then
      insert into public.portia_access_people (nickname, nickname_key, origin, level, status, account_id, approved_by, updated_by)
      values (req.nickname, req.nickname_key, req.origin, new_level, 'active', account_for_person, auth.uid(), auth.uid())
      returning id into person_uuid;
    else
      -- D-09: a revoked person starts again at the fresh default; the old level stays only in the journal.
      previous_level := person.level;
      update public.portia_access_people
        set status = 'active', level = new_level, origin = req.origin, nickname = req.nickname,
            account_id = coalesce(person.account_id, account_for_person),
            approved_at = now(), approved_by = auth.uid(), updated_at = now(), updated_by = auth.uid()
        where id = person.id;
      person_uuid := person.id;
    end if;
  end if;

  update public.portia_access_requests
    set status = 'approved', person_id = person_uuid, decided_at = now(), decided_by = auth.uid()
    where id = req.id and status = 'pending';
  insert into public.portia_access_journal (event_type, actor_id, nickname_key, person_id, request_id, details)
  values (
    'approve', auth.uid(), req.nickname_key, person_uuid, req.id,
    jsonb_build_object('level', new_level, 'origin', req.origin, 'deviceAdded', device_added)
      || case when previous_level is not null then jsonb_build_object('previousLevel', previous_level) else '{}'::jsonb end
  );
  return jsonb_build_object('code', 'approved', 'personId', person_uuid, 'level', new_level);
end; $$;

revoke all on function public.portia_access_decide(uuid, text, smallint) from public, anon, authenticated;
grant execute on function public.portia_access_decide(uuid, text, smallint) to authenticated;
grant execute on function public.portia_access_decide(uuid, text, smallint) to service_role;
