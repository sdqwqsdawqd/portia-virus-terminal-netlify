-- PORTIA access foundation (Phase 21, D-01..D-10). Forward-only; no begin/commit (the CLI owns the transaction);
-- idempotent statements.
--
-- People, nick requests and the decision journal behind site access. Tables are closed to every API role (RLS on,
-- no policies, every privilege revoked); anon and authenticated reach them only through SECURITY DEFINER functions
-- pinned to search_path ''. Levels are 1..5; editors and the owner are level 5 without a person row (D-03).
--
-- Request cleanup policy (Phase 21): no automatic deletion and no new scheduled job. Stale pending requests wait for an
-- editor's decision (Phase 22 queue) and the 200-pending cap bounds that queue; journal rows are never deleted.
--
-- Site-closure flag (ACC-09, D-05, D-08): row 'main' of portia_access_settings. It is OFF after apply; turning it ON on
-- production is an owner step in Phase 25. Toggles are not journaled (D-07, owner choice 2б); the row keeps the last
-- change (updated_at, updated_by).
--
-- Server-signed submit (RLS21-01, owner decision of 2026-11-09). portia_access_submit_request is executable with the public
-- key, so it only trusts a request that the site server signed: HMAC-SHA256 over origin, nickname, token hash, IP bucket
-- and issue time, checked against the secret in the closed table portia_access_secrets, with a few minutes of tolerance.
-- With no secret stored the function refuses every request (fail closed). This migration carries NO secret value.
-- OWNER STEP at apply time (isolated test project first, production by the owner only), run as the database owner after the
-- migration and before the site accepts requests, with the same random value (32+ characters) that the server holds in
-- PORTIA_ACCESS_SUBMIT_SECRET. Check that the value has 32+ characters BEFORE you run the insert: a shorter value would
-- trip the check constraint, and Postgres prints the failing row, secret included, in the DETAIL of the error and in its
-- logs (RLS21-13). The guarded form below stores nothing for a short value instead of raising:
--   insert into public.portia_access_secrets (name, secret)
--     select 'submit', v from (select '<random value>'::text as v) t where length(v) >= 32
--     on conflict (name) do update set secret = excluded.secret, updated_at = now();
-- Expect INSERT 0 1 (1 row); INSERT 0 0 means the value was shorter than 32 characters and nothing was stored.
-- Rotating the secret is the same statement plus the new server value; requests signed with the old one are refused.
-- The Phase 23 route must log every `unauthorized` reply as an alert: a missing secret and a bad signature look the same.
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
-- RLS21-01: the global per-minute rate counts the newest rows.
create index if not exists portia_access_requests_created_recent
  on public.portia_access_requests (created_at desc);

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

-- e2. Shared secret that the site server uses to sign access requests (RLS21-01). One row, name 'submit', inserted by the
-- owner at apply time (see the header); never by this migration. Read only inside portia_access_submit_request.
create table if not exists public.portia_access_secrets (
  name text primary key,
  secret text not null,
  updated_at timestamptz not null default now(),
  constraint portia_access_secrets_name_check check (name in ('submit')),
  constraint portia_access_secrets_secret_check check (length(secret) >= 32)
);

-- f. Closed to every API role: RPC only.
alter table public.portia_access_people enable row level security;
alter table public.portia_access_requests enable row level security;
alter table public.portia_access_journal enable row level security;
alter table public.portia_access_secrets enable row level security;

revoke all on table public.portia_access_people from public, anon, authenticated;
revoke all on table public.portia_access_requests from public, anon, authenticated;
revoke all on table public.portia_access_journal from public, anon, authenticated;
revoke all on table public.portia_access_secrets from public, anon, authenticated;
-- The default privileges of the platform would hand the privileged API role every right on a new table: take them away,
-- nothing but the definer function (running as the table owner) and the owner reads the secret.
revoke all on table public.portia_access_secrets from service_role;
grant all on table public.portia_access_people to service_role;
grant all on table public.portia_access_requests to service_role;
-- The journal is append-only (D-07, RLS21-03): the privileged role may read and append, never truncate, update or delete.
grant select, insert on table public.portia_access_journal to service_role;

-- Default privileges would otherwise give anon/authenticated rights on the identity sequence (see 20261101000100).
revoke all on sequence public.portia_access_journal_id_seq from public, anon, authenticated;
-- RLS21-10: usage and select only. UPDATE would allow setval, and a rolled-back sequence makes every journal insert fail on the key.
revoke all on sequence public.portia_access_journal_id_seq from service_role;
grant usage, select on sequence public.portia_access_journal_id_seq to service_role;

-- g. A visitor asks for access. Requests are collected whether the site is open or closed.
-- RLS21-09: create or replace with a new signature adds an overload. The unsigned round 1 signature must not survive next
-- to the signed one (it stays callable with the public key on any database that ever ran it): drop it first.
drop function if exists public.portia_access_submit_request(text, text, text, text);
create or replace function public.portia_access_submit_request(p_nickname text, p_origin text, p_token_hash text, p_ip_bucket text, p_issued_at bigint, p_signature text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  normalized_key text := public.portia_access_nickname_key(p_nickname);
  now_epoch bigint := floor(extract(epoch from now()))::bigint;
  signing_secret text;
  expected_signature text;
  device_key text;
  device_status text;
  recent_by_nickname integer;
  recent_by_bucket integer;
  pending_total integer;
  new_last_minute integer;
  pause_decided_at timestamptz;
  pause_is_own boolean;
begin
  if normalized_key is null
    or p_origin is null or p_origin not in ('sheet', 'outside')
    or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_ip_bucket is null or p_ip_bucket !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('code', 'invalid');
  end if;

  -- RLS21-01: only a request that the site server signed gets past this point. Nothing below runs, no lock is taken and
  -- no request row is read for an unsigned caller. The nickname is validated above, so the pipe separator cannot be forged.
  -- A missing, short or malformed secret, signature or time leaves expected_signature or the comparison null/different:
  -- every such case ends in the same neutral refusal (fail closed).
  select s.secret into signing_secret
    from public.portia_access_secrets s
    where s.name = 'submit';
  expected_signature := encode(extensions.hmac(
    'access-submit-v1|' || p_origin || '|' || p_nickname || '|' || p_token_hash || '|' || p_ip_bucket || '|' || p_issued_at::text,
    signing_secret, 'sha256'), 'hex');
  if signing_secret is null or length(signing_secret) < 32
    or p_issued_at is null or p_signature is null or p_signature !~ '^[0-9a-f]{64}$'
    or p_issued_at < now_epoch - 300 or p_issued_at > now_epoch + 60
    or extensions.digest(p_signature, 'sha256') is distinct from extensions.digest(expected_signature, 'sha256') then
    return jsonb_build_object('code', 'unauthorized');
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

  -- D-06 caps, exact under the global queue lock: 3 per nick and 10 per IP bucket in 24 hours, 200 pending in total.
  -- Only rows of this table are counted; Promotion attempt buckets are a separate namespace and are never touched.
  select count(*) into recent_by_nickname from public.portia_access_requests r
    where r.nickname_key = normalized_key and r.created_at > now() - interval '24 hours';
  select count(*) into recent_by_bucket from public.portia_access_requests r
    where r.ip_bucket = p_ip_bucket and r.created_at > now() - interval '24 hours';
  select count(*) into pending_total from public.portia_access_requests r
    where r.status = 'pending';
  -- RLS21-01: a global ceiling on new requests per minute, counted under the same queue lock.
  select count(*) into new_last_minute from public.portia_access_requests r
    where r.created_at > now() - interval '1 minute';
  if recent_by_nickname >= 3 or recent_by_bucket >= 10 or pending_total >= 200 or new_last_minute >= 20 then
    return jsonb_build_object('code', 'throttled');
  end if;

  -- Another device already waits for this nick: say nothing about who or why (ACC-05 groundwork).
  if exists (
    select 1 from public.portia_access_requests r
    where r.nickname_key = normalized_key and r.status = 'pending'
  ) then
    return jsonb_build_object('code', 'unavailable');
  end if;

  -- D-06 pause: the latest uncleared rejection or revocation of this nick decided within the last hour. Only the device
  -- that owns that request is told (with retryAt); any other device gets the neutral reply.
  select r.decided_at, (r.token_hash = p_token_hash) into pause_decided_at, pause_is_own
    from public.portia_access_requests r
    where r.nickname_key = normalized_key
      and r.status in ('rejected', 'revoked')
      and r.cooldown_cleared_at is null
      and r.decided_at > now() - interval '1 hour'
    order by (r.token_hash = p_token_hash) desc, r.decided_at desc
    limit 1;
  if found then
    if pause_is_own then
      return jsonb_build_object('code', 'cooldown', 'retryAt', pause_decided_at + interval '1 hour');
    end if;
    return jsonb_build_object('code', 'unavailable');
  end if;

  insert into public.portia_access_requests (nickname, nickname_key, origin, token_hash, ip_bucket, requested_by)
  values (p_nickname, normalized_key, p_origin, p_token_hash, p_ip_bucket, auth.uid());
  return jsonb_build_object('code', 'created');
end; $$;

revoke all on function public.portia_access_submit_request(text, text, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.portia_access_submit_request(text, text, text, text, bigint, text) to anon, authenticated;
grant execute on function public.portia_access_submit_request(text, text, text, text, bigint, text) to service_role;

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

-- h2. Who may not be decided about (D-02 / USR-05). Called only from the definer functions below, which run as the
-- owner role, so this helper is not security definer and no API role can execute it.
-- "Self" is defined by account link: the request was filed by the caller's account, or the person is linked to the
-- caller's account, or the nick key equals such a person. A nickname filed from a signed-out browser carries no link and
-- cannot be recognised as the caller's own: accepted residual risk, mitigated by the journal and by revocation; the
-- owner acknowledges it in plan 21-07. Rows linked to the owner's confirmed-email account are owner-protected.
-- The account link is not proof of nickname ownership (RLS21-04): a signed-in stranger can file a request for any nick, so
-- the link only widens "self" (fail safe) and is replaced, not kept, when a revoked person is approved again.
create or replace function public.portia_access_target_guard(p_nickname_key text, p_requested_by uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_requested_by is not null and p_requested_by = auth.uid() then
    raise exception 'self-decision';
  end if;
  if exists (
    select 1 from public.portia_access_people p
    where p.nickname_key = p_nickname_key and p.account_id is not null and p.account_id = auth.uid()
  ) then
    raise exception 'self-decision';
  end if;
  if not public.portia_is_owner() and exists (
    select 1 from auth.users u
    where lower(u.email) = public.portia_owner_email()
      and (
        u.id = p_requested_by
        or u.id in (select p.account_id from public.portia_access_people p where p.nickname_key = p_nickname_key)
      )
  ) then
    raise exception 'owner-protected';
  end if;
end; $$;

revoke all on function public.portia_access_target_guard(text, uuid) from public, anon, authenticated;
grant execute on function public.portia_access_target_guard(text, uuid) to service_role;

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

  perform public.portia_access_target_guard(req.nickname_key, req.requested_by);

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

  -- RLS21-04: the account link comes from THIS request only. A link held by a different nickname blocks it (one account,
  -- one person); the link of this nickname's own row does not, because re-approval replaces it (D-09 fresh start).
  select case
    when req.requested_by is not null
      and not exists (
        select 1 from public.portia_access_people p
        where p.account_id = req.requested_by and p.nickname_key <> req.nickname_key
      )
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
    if new_level > caller_level then raise exception 'level-above-own'; end if;
    if not person_exists then
      insert into public.portia_access_people (nickname, nickname_key, origin, level, status, account_id, approved_by, updated_by)
      values (req.nickname, req.nickname_key, req.origin, new_level, 'active', account_for_person, auth.uid(), auth.uid())
      returning id into person_uuid;
    else
      -- D-09: a revoked person starts again at the fresh default; the old level stays only in the journal.
      previous_level := person.level;
      update public.portia_access_people
        set status = 'active', level = new_level, origin = req.origin, nickname = req.nickname,
            account_id = account_for_person,
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

-- j. An editor changes the level of an active person (D-02 optimistic: the caller sends the level it saw).
create or replace function public.portia_access_set_level(p_person_id uuid, p_level smallint, p_expected_level smallint)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_level smallint;
  person public.portia_access_people%rowtype;
begin
  if not public.portia_can_edit_tab('users') then raise exception 'forbidden'; end if;
  caller_level := public.portia_access_caller_level();
  if caller_level is null then raise exception 'forbidden'; end if;

  select * into person from public.portia_access_people where id = p_person_id;
  if not found then return jsonb_build_object('code', 'not-found'); end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('access:nickname:' || person.nickname_key, 0));
  select * into person from public.portia_access_people where id = p_person_id for update;
  if not found then return jsonb_build_object('code', 'not-found'); end if;
  if person.status <> 'active' then return jsonb_build_object('code', 'not-active'); end if;

  perform public.portia_access_target_guard(person.nickname_key, null);

  if p_level is null or p_level not between 1 and 5 then raise exception 'invalid-level'; end if;
  if p_level > caller_level then raise exception 'level-above-own'; end if;

  if p_expected_level is distinct from person.level then
    return jsonb_build_object('code', 'stale', 'level', person.level);
  end if;
  if p_level = person.level then
    return jsonb_build_object('code', 'unchanged', 'level', person.level);
  end if;

  update public.portia_access_people
    set level = p_level, updated_at = now(), updated_by = auth.uid()
    where id = person.id;
  insert into public.portia_access_journal (event_type, actor_id, nickname_key, person_id, details)
  values ('level-change', auth.uid(), person.nickname_key, person.id, jsonb_build_object('from', person.level, 'to', p_level));
  return jsonb_build_object('code', 'updated', 'level', p_level);
end; $$;

revoke all on function public.portia_access_set_level(uuid, smallint, smallint) from public, anon, authenticated;
grant execute on function public.portia_access_set_level(uuid, smallint, smallint) to authenticated;
grant execute on function public.portia_access_set_level(uuid, smallint, smallint) to service_role;

-- k. An editor revokes a person: the person and all of their approved device requests end together (D-02). The decided_at
-- of the revoked requests starts the 1-hour pause (D-06). Pending requests of the same nick stay for an editor to decide.
create or replace function public.portia_access_revoke(p_person_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_level smallint;
  person public.portia_access_people%rowtype;
begin
  if not public.portia_can_edit_tab('users') then raise exception 'forbidden'; end if;
  caller_level := public.portia_access_caller_level();
  if caller_level is null then raise exception 'forbidden'; end if;

  select * into person from public.portia_access_people where id = p_person_id;
  if not found then return jsonb_build_object('code', 'not-found'); end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('access:nickname:' || person.nickname_key, 0));
  select * into person from public.portia_access_people where id = p_person_id for update;
  if not found then return jsonb_build_object('code', 'not-found'); end if;
  if person.status = 'revoked' then return jsonb_build_object('code', 'already-revoked'); end if;

  perform public.portia_access_target_guard(person.nickname_key, null);

  update public.portia_access_people
    set status = 'revoked', updated_at = now(), updated_by = auth.uid()
    where id = person.id;
  update public.portia_access_requests
    set status = 'revoked', decided_at = now(), decided_by = auth.uid()
    where person_id = person.id and status = 'approved';
  insert into public.portia_access_journal (event_type, actor_id, nickname_key, person_id, details)
  values ('revoke', auth.uid(), person.nickname_key, person.id, jsonb_build_object('level', person.level));
  return jsonb_build_object('code', 'revoked');
end; $$;

revoke all on function public.portia_access_revoke(uuid) from public, anon, authenticated;
grant execute on function public.portia_access_revoke(uuid) to authenticated;
grant execute on function public.portia_access_revoke(uuid) to service_role;

-- l. The journal is append-only (D-07): history is kept forever. Per-run staging cleanup cannot delete journal rows; the
-- teardown (supabase/teardown/portia_teardown.sql) drops portia_* tables and functions dynamically and needs no change.
create or replace function public.portia_access_journal_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'journal-append-only';
end; $$;

revoke all on function public.portia_access_journal_append_only() from public, anon, authenticated;
grant execute on function public.portia_access_journal_append_only() to service_role;

drop trigger if exists portia_access_journal_append_only on public.portia_access_journal;
create trigger portia_access_journal_append_only before update or delete on public.portia_access_journal for each row execute function public.portia_access_journal_append_only();

-- RLS21-03: a row trigger does not fire for TRUNCATE, so a statement trigger closes that path for every role, including
-- the table owner. The privileged role also has no TRUNCATE privilege on the journal (section f).
drop trigger if exists portia_access_journal_no_truncate on public.portia_access_journal;
create trigger portia_access_journal_no_truncate before truncate on public.portia_access_journal for each statement execute function public.portia_access_journal_append_only();

-- m. The owner clears the 1-hour pause of a nick (D-06 choice 1b). Owner only; journaled once when something was cleared.
create or replace function public.portia_access_clear_cooldown(p_nickname_key text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  cleared_count integer;
  person_uuid uuid;
begin
  if not public.portia_is_owner() then raise exception 'owner-required'; end if;
  if p_nickname_key is null or public.portia_access_nickname_key(p_nickname_key) is distinct from p_nickname_key then
    return jsonb_build_object('code', 'invalid');
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('access:nickname:' || p_nickname_key, 0));
  update public.portia_access_requests
    set cooldown_cleared_at = now(), cooldown_cleared_by = auth.uid()
    where nickname_key = p_nickname_key
      and status in ('rejected', 'revoked')
      and cooldown_cleared_at is null
      and decided_at > now() - interval '1 hour';
  get diagnostics cleared_count = row_count;
  if cleared_count = 0 then return jsonb_build_object('code', 'no-cooldown'); end if;

  select p.id into person_uuid from public.portia_access_people p where p.nickname_key = p_nickname_key;
  insert into public.portia_access_journal (event_type, actor_id, nickname_key, person_id, details)
  values ('cooldown-clear', auth.uid(), p_nickname_key, person_uuid, jsonb_build_object('count', cleared_count));
  return jsonb_build_object('code', 'cleared');
end; $$;

revoke all on function public.portia_access_clear_cooldown(text) from public, anon, authenticated;
grant execute on function public.portia_access_clear_cooldown(text) to authenticated;
grant execute on function public.portia_access_clear_cooldown(text) to service_role;

-- n. Site-closure flag (ACC-09, D-05, D-08): one row 'main', OFF after apply. Only the owner changes it. The row keeps
-- the last change (updated_at, updated_by); toggles are not journaled (D-07, owner choice 2б). Nothing reads the flag in
-- Phase 21 and submit never does, so requests are collected whether it is OFF or ON.
create table if not exists public.portia_access_settings (
  id text primary key,
  closure_enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  constraint portia_access_settings_id_check check (id = 'main')
);

alter table public.portia_access_settings enable row level security;

revoke all on table public.portia_access_settings from public, anon, authenticated;
grant all on table public.portia_access_settings to service_role;

-- Re-running never flips an existing value.
insert into public.portia_access_settings (id, closure_enabled) values ('main', false)
  on conflict (id) do nothing;

-- The open/closed state is observable by any visitor anyway, so anon and authenticated may read this one boolean.
create or replace function public.portia_access_closure_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.closure_enabled from public.portia_access_settings s where s.id = 'main'), false);
$$;

revoke all on function public.portia_access_closure_enabled() from public, anon, authenticated;
grant execute on function public.portia_access_closure_enabled() to anon, authenticated;
grant execute on function public.portia_access_closure_enabled() to service_role;

-- Only the owner flips the flag. Turning it ON on production is an owner step in Phase 25.
create or replace function public.portia_access_set_closure(p_enabled boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  stored_enabled boolean;
  stored_at timestamptz;
begin
  if not public.portia_is_owner() then raise exception 'owner-required'; end if;
  if p_enabled is null then return jsonb_build_object('code', 'invalid'); end if;

  insert into public.portia_access_settings (id, closure_enabled, updated_at, updated_by)
  values ('main', p_enabled, now(), auth.uid())
  on conflict (id) do update
    set closure_enabled = excluded.closure_enabled, updated_at = now(), updated_by = auth.uid()
  returning closure_enabled, updated_at into stored_enabled, stored_at;
  return jsonb_build_object('code', 'updated', 'enabled', stored_enabled, 'updatedAt', stored_at);
end; $$;

revoke all on function public.portia_access_set_closure(boolean) from public, anon, authenticated;
grant execute on function public.portia_access_set_closure(boolean) to authenticated;
grant execute on function public.portia_access_set_closure(boolean) to service_role;

-- o. SEC-06: portia_promo_register_attempt has no caller. portia_promo_submit_request (definer) does its bucket logic
-- inline and never calls it, and no product code does either, yet the baseline left it executable by anon and
-- authenticated (bucket poisoning, lock-out of promotion participants). Only the privileged API role keeps EXECUTE. The
-- function itself is not redefined. Rollback: a forward migration that re-grants execute to anon, authenticated.
revoke all on function public.portia_promo_register_attempt(text, text, boolean) from public, anon, authenticated;
grant execute on function public.portia_promo_register_attempt(text, text, boolean) to service_role;

-- p. RLS21-02: portia_promo_bind_device has no caller either (the API never calls it; portia_promo_submit_request inserts
-- the device binding itself) and the baseline left it executable by anon and authenticated: anyone could bind an arbitrary
-- token to a participant's nickname, which denies that participant (device-denied, bucket lock) until an owner reset, and
-- 'nickname-bound' was an existence oracle. D-10 (Promotion unchanged except the register_attempt revoke) was extended by
-- the owner on 2026-11-09 to cover this revoke. The function itself is not redefined. Rollback: a forward migration that
-- re-grants execute to anon, authenticated.
revoke all on function public.portia_promo_bind_device(text, text, text) from public, anon, authenticated;
grant execute on function public.portia_promo_bind_device(text, text, text) to service_role;
