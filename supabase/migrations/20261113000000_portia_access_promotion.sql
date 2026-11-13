-- Phase 23: bind Promotion participation to an approved access request on this device.
-- Forward only. The existing Promotion tables and reviewer flows remain intact.

create or replace function public.portia_access_resolve(p_token_hash text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare req record; person record; retry_at timestamptz;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('state', 'none'); end if;
  select r.status, r.nickname, r.origin, r.person_id, r.decided_at, r.cooldown_cleared_at into req
    from public.portia_access_requests r where r.token_hash = p_token_hash
    order by (r.status in ('pending', 'approved')) desc, r.created_at desc limit 1;
  if not found then return jsonb_build_object('state', 'none'); end if;
  if req.status = 'pending' then return jsonb_build_object('state', 'pending', 'nickname', req.nickname); end if;
  if req.status = 'approved' then
    select p.nickname, p.level, p.status into person from public.portia_access_people p where p.id = req.person_id;
    if found and person.status = 'active' then
      return jsonb_build_object('state', 'approved', 'nickname', person.nickname, 'level', person.level, 'origin', req.origin);
    end if;
    return jsonb_build_object('state', 'revoked', 'nickname', req.nickname, 'retryAt', null);
  end if;
  if req.cooldown_cleared_at is null and req.decided_at > now() - interval '1 hour' then retry_at := req.decided_at + interval '1 hour'; end if;
  return jsonb_build_object('state', req.status, 'nickname', req.nickname, 'retryAt', retry_at);
end; $$;

-- The authenticated editor sees only a request submitted by this account with this token.
-- A guest request with the same nickname has requested_by IS NULL and cannot be adopted.
create or replace function public.portia_access_editor_request_status(p_token_hash text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare req record; person record; retry_at timestamptz;
begin
  if auth.uid() is null or not public.portia_can_edit() then return jsonb_build_object('state', 'none'); end if;
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('state', 'none'); end if;
  select r.status, r.nickname, r.origin, r.person_id, r.decided_at, r.cooldown_cleared_at into req
    from public.portia_access_requests r
    where r.token_hash = p_token_hash and r.requested_by = auth.uid() and r.origin = 'sheet'
    order by (r.status in ('pending', 'approved')) desc, r.created_at desc limit 1;
  if not found then return jsonb_build_object('state', 'none'); end if;
  if req.status = 'pending' then return jsonb_build_object('state', 'pending', 'nickname', req.nickname); end if;
  if req.status = 'approved' then
    select p.nickname, p.level, p.status into person from public.portia_access_people p where p.id = req.person_id;
    if found and person.status = 'active' then
      return jsonb_build_object('state', 'approved', 'nickname', person.nickname, 'level', person.level, 'origin', req.origin);
    end if;
    return jsonb_build_object('state', 'revoked', 'nickname', req.nickname, 'retryAt', null);
  end if;
  if req.cooldown_cleared_at is null and req.decided_at > now() - interval '1 hour' then retry_at := req.decided_at + interval '1 hour'; end if;
  return jsonb_build_object('state', req.status, 'nickname', req.nickname, 'retryAt', retry_at);
end; $$;
revoke all on function public.portia_access_editor_request_status(text) from public, anon, authenticated;
grant execute on function public.portia_access_editor_request_status(text) to authenticated;
grant execute on function public.portia_access_editor_request_status(text) to service_role;

-- Internal identity proof. FOR SHARE keeps approval and person active for the
-- remainder of a mutating caller's transaction. No nickname is accepted here.
create or replace function public.portia_promo_participant_key(p_access_hash text)
returns text language plpgsql volatile security definer set search_path = '' as $$
declare result_key text;
begin
  if p_access_hash is null or p_access_hash !~ '^[0-9a-f]{64}$' then return null; end if;
  select r.nickname_key into result_key
    from public.portia_access_requests r
    join public.portia_access_people p on p.id = r.person_id and p.nickname_key = r.nickname_key
    where r.token_hash = p_access_hash and r.status = 'approved' and r.origin = 'sheet' and p.status = 'active'
      and ((auth.uid() is null and r.requested_by is null)
        or (auth.uid() is not null and public.portia_can_edit() and r.requested_by = auth.uid()))
    order by r.decided_at desc, r.id desc limit 1 for share of r, p;
  return result_key;
end; $$;
revoke all on function public.portia_promo_participant_key(text) from public, anon, authenticated;

create or replace function public.portia_promo_secure_status(p_access_hash text, p_title_id text, p_token_hash text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare person_key text;
begin
  person_key := public.portia_promo_participant_key(p_access_hash);
  if person_key is null then return jsonb_build_object('code', 'access-required'); end if;
  return public.portia_promo_public_status(person_key, p_title_id, p_token_hash);
end; $$;
revoke all on function public.portia_promo_secure_status(text, text, text) from public, anon, authenticated;
grant execute on function public.portia_promo_secure_status(text, text, text) to anon, authenticated;

create or replace function public.portia_promo_secure_submit(
  p_access_hash text, p_kind text, p_title_id text, p_target_id text,
  p_token_hash text, p_risk_bucket text, p_bucket_key text, p_ip_bucket text,
  p_issued_at bigint, p_signature text
) returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare person_key text; person_name text; signing_secret text; expected_signature text;
  now_epoch bigint := floor(extract(epoch from now()))::bigint;
begin
  if p_access_hash is null or p_access_hash !~ '^[0-9a-f]{64}$'
    or p_kind is null or p_kind not in ('ordinary', 'qualification')
    or p_title_id is null or p_title_id !~ '^[a-z0-9-]{1,48}$'
    or p_target_id is null or p_target_id !~ '^[a-z0-9-]{1,48}$'
    or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_risk_bucket is null or p_risk_bucket !~ '^[0-9a-f]{32}$'
    or p_bucket_key is null or p_bucket_key !~ '^[0-9a-f]{64}$'
    or p_ip_bucket is null or p_ip_bucket !~ '^[0-9a-f]{32}$' then
    return jsonb_build_object('code', 'invalid');
  end if;
  select s.secret into signing_secret from public.portia_access_secrets s where s.name = 'submit';
  expected_signature := encode(extensions.hmac(
    'promo-submit-v1|' || p_access_hash || '|' || p_kind || '|' || p_title_id || '|' || p_target_id || '|'
      || p_token_hash || '|' || p_risk_bucket || '|' || p_bucket_key || '|' || p_ip_bucket || '|' || p_issued_at::text,
    signing_secret, 'sha256'), 'hex');
  if signing_secret is null or length(signing_secret) < 32 or p_issued_at is null
    or p_signature is null or p_signature !~ '^[0-9a-f]{64}$'
    or p_issued_at < now_epoch - 300 or p_issued_at > now_epoch + 60
    or extensions.digest(p_signature, 'sha256') is distinct from extensions.digest(expected_signature, 'sha256') then
    return jsonb_build_object('code', 'unauthorized');
  end if;
  person_key := public.portia_promo_participant_key(p_access_hash);
  if person_key is null then return jsonb_build_object('code', 'access-required'); end if;
  select p.nickname into person_name from public.portia_access_people p
    where p.nickname_key = person_key and p.status = 'active' for share;
  if person_name is null then return jsonb_build_object('code', 'access-required'); end if;
  return public.portia_promo_submit_request(p_kind, person_name, person_key, p_title_id, p_target_id,
    p_token_hash, p_risk_bucket, p_bucket_key, p_ip_bucket);
end; $$;
revoke all on function public.portia_promo_secure_submit(text, text, text, text, text, text, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.portia_promo_secure_submit(text, text, text, text, text, text, text, text, bigint, text) to anon, authenticated;

-- Internal attempt proof, called before every test operation. The old Promotion
-- binding is still checked inside the underlying function as a conflict guard.
create or replace function public.portia_promo_secure_attempt(p_access_hash text, p_attempt_id uuid)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare person_key text; attempt_key text;
begin
  person_key := public.portia_promo_participant_key(p_access_hash);
  if person_key is null then return false; end if;
  select q.nickname_key into attempt_key from public.portia_promo_attempts a
    join public.portia_promo_qualification_requests q on q.id = a.request_id
    where a.id = p_attempt_id for share of a, q;
  return attempt_key is not null and attempt_key = person_key;
end; $$;
revoke all on function public.portia_promo_secure_attempt(text, uuid) from public, anon, authenticated;

-- A site-server proof is issued only after a fresh roster/title check. Direct
-- callers cannot continue a removed participant's attempt by invoking RPCs.
create or replace function public.portia_promo_test_proof_valid(
  p_access_hash text, p_attempt_id uuid, p_token_hash text, p_action text, p_issued_at bigint, p_signature text
) returns boolean language plpgsql volatile security definer set search_path = '' as $$
declare signing_secret text; expected_signature text; now_epoch bigint := floor(extract(epoch from now()))::bigint;
begin
  if p_access_hash is null or p_access_hash !~ '^[0-9a-f]{64}$' or p_attempt_id is null
    or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
    or p_action is null or p_action not in ('start', 'current', 'heartbeat', 'answer', 'fail')
    or p_issued_at is null or p_issued_at < now_epoch - 300 or p_issued_at > now_epoch + 60
    or p_signature is null or p_signature !~ '^[0-9a-f]{64}$' then return false; end if;
  select s.secret into signing_secret from public.portia_access_secrets s where s.name = 'submit';
  if signing_secret is null or length(signing_secret) < 32 then return false; end if;
  expected_signature := encode(extensions.hmac(
    'promo-test-v1|' || p_access_hash || '|' || p_attempt_id::text || '|' || p_token_hash || '|' || p_action || '|' || p_issued_at::text,
    signing_secret, 'sha256'), 'hex');
  return extensions.digest(p_signature, 'sha256') = extensions.digest(expected_signature, 'sha256');
end; $$;
revoke all on function public.portia_promo_test_proof_valid(text, uuid, text, text, bigint, text) from public, anon, authenticated;

create or replace function public.portia_promo_secure_start_test(p_access_hash text, p_attempt_id uuid, p_token_hash text, p_client_mode text, p_issued_at bigint, p_signature text)
returns timestamptz language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.portia_promo_test_proof_valid(p_access_hash, p_attempt_id, p_token_hash, 'start', p_issued_at, p_signature) then return null; end if;
  if not public.portia_promo_secure_attempt(p_access_hash, p_attempt_id) then return null; end if;
  return public.portia_promo_start_test(p_attempt_id, p_token_hash, p_client_mode);
end; $$;
create or replace function public.portia_promo_secure_current_test(p_access_hash text, p_attempt_id uuid, p_token_hash text, p_client_mode text, p_issued_at bigint, p_signature text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.portia_promo_test_proof_valid(p_access_hash, p_attempt_id, p_token_hash, 'current', p_issued_at, p_signature) then return null; end if;
  if not public.portia_promo_secure_attempt(p_access_hash, p_attempt_id) then return null; end if;
  return public.portia_promo_current_test(p_attempt_id, p_token_hash, p_client_mode);
end; $$;
create or replace function public.portia_promo_secure_heartbeat_test(p_access_hash text, p_attempt_id uuid, p_token_hash text, p_issued_at bigint, p_signature text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.portia_promo_test_proof_valid(p_access_hash, p_attempt_id, p_token_hash, 'heartbeat', p_issued_at, p_signature) then return jsonb_build_object('code', 'inactive'); end if;
  if not public.portia_promo_secure_attempt(p_access_hash, p_attempt_id) then return jsonb_build_object('code', 'inactive'); end if;
  return public.portia_promo_heartbeat_test(p_attempt_id, p_token_hash);
end; $$;
create or replace function public.portia_promo_secure_answer_question(p_access_hash text, p_attempt_id uuid, p_question_id uuid, p_expected_question_index integer, p_answer jsonb, p_nonce text, p_token_hash text, p_issued_at bigint, p_signature text)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.portia_promo_test_proof_valid(p_access_hash, p_attempt_id, p_token_hash, 'answer', p_issued_at, p_signature) then return jsonb_build_object('code', 'not-found'); end if;
  if not public.portia_promo_secure_attempt(p_access_hash, p_attempt_id) then return jsonb_build_object('code', 'not-found'); end if;
  return public.portia_promo_answer_question(p_attempt_id, p_question_id, p_expected_question_index, p_answer, p_nonce, p_token_hash);
end; $$;
create or replace function public.portia_promo_secure_fail_attempt(p_access_hash text, p_attempt_id uuid, p_reason text, p_token_hash text, p_issued_at bigint, p_signature text)
returns boolean language plpgsql volatile security definer set search_path = '' as $$
begin
  if not public.portia_promo_test_proof_valid(p_access_hash, p_attempt_id, p_token_hash, 'fail', p_issued_at, p_signature) then return false; end if;
  if not public.portia_promo_secure_attempt(p_access_hash, p_attempt_id) then return false; end if;
  return public.portia_promo_fail_attempt(p_attempt_id, p_reason, p_token_hash);
end; $$;

revoke all on function public.portia_promo_secure_start_test(text, uuid, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.portia_promo_secure_current_test(text, uuid, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.portia_promo_secure_heartbeat_test(text, uuid, text, bigint, text) from public, anon, authenticated;
revoke all on function public.portia_promo_secure_answer_question(text, uuid, uuid, integer, jsonb, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.portia_promo_secure_fail_attempt(text, uuid, text, text, bigint, text) from public, anon, authenticated;
grant execute on function public.portia_promo_secure_start_test(text, uuid, text, text, bigint, text) to anon, authenticated;
grant execute on function public.portia_promo_secure_current_test(text, uuid, text, text, bigint, text) to anon, authenticated;
grant execute on function public.portia_promo_secure_heartbeat_test(text, uuid, text, bigint, text) to anon, authenticated;
grant execute on function public.portia_promo_secure_answer_question(text, uuid, uuid, integer, jsonb, text, text, bigint, text) to anon, authenticated;
grant execute on function public.portia_promo_secure_fail_attempt(text, uuid, text, text, bigint, text) to anon, authenticated;

-- Publicly callable legacy functions took a nickname or a Promotion-only token.
-- They remain for trusted internal calls but cannot be invoked by API roles.
revoke all on function public.portia_promo_bind_device(text, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_resolve_device(text) from public, anon, authenticated;
revoke all on function public.portia_promo_register_attempt(text, text, boolean) from public, anon, authenticated;
revoke all on function public.portia_promo_submit_request(text, text, text, text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_public_status(text, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_start_test(uuid, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_current_test(uuid, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_heartbeat_test(uuid, text) from public, anon, authenticated;
revoke all on function public.portia_promo_answer_question(uuid, uuid, integer, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.portia_promo_fail_attempt(uuid, text, text) from public, anon, authenticated;
