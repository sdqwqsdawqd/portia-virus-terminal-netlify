-- Phase 25 expand: server-signed reads. Additive: the anonymous table read is removed by 20261115000100 after the code that
-- uses these functions is deployed (D-06). Nothing here changes an existing object, and portia_access_closure_enabled is
-- not touched.
--
-- Who may read through these functions:
--   * an editor (portia_can_edit() is true) with the session of the caller, no signature needed;
--   * the site server, which signs "<scope>-read-v1|<issued_at>" with the shared secret that already lives in
--     public.portia_access_secrets under the name 'submit' (the same secret that signs access requests, RLS21-01).
-- The message labels differ from 'access-submit-v1|', so a signature made for a request never opens a read and the
-- other way round. The time window is the one of portia_access_submit_request: 300 seconds back, 60 seconds ahead.
-- Everyone else gets the neutral {"code":"unauthorized"} and no data (fail closed). lib/server-read.test.ts pins the labels,
-- the window and the grants below to the TypeScript side.

-- a. The content row. The caller still applies the Phase 24 redaction (contentBodyFor); this function only replaces the
-- direct read of the table.
create or replace function public.portia_content_read(p_issued_at bigint, p_signature text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  now_epoch bigint := floor(extract(epoch from now()))::bigint;
  signing_secret text;
  expected_signature text;
  stored record;
begin
  if not public.portia_can_edit() then
    select s.secret into signing_secret
      from public.portia_access_secrets s
      where s.name = 'submit';
    expected_signature := encode(extensions.hmac('content-read-v1|' || coalesce(p_issued_at::text, ''), signing_secret, 'sha256'), 'hex');
    if signing_secret is null or length(signing_secret) < 32
      or p_issued_at is null or p_signature is null or p_signature !~ '^[0-9a-f]{64}$'
      or p_issued_at < now_epoch - 300 or p_issued_at > now_epoch + 60
      or extensions.digest(p_signature, 'sha256') is distinct from extensions.digest(expected_signature, 'sha256') then
      return jsonb_build_object('code', 'unauthorized');
    end if;
  end if;

  select c.payload, c.revision, c.updated_at into stored
    from public.portia_content c
    where c.id = 'main';
  if not found then
    return jsonb_build_object('code', 'ok', 'row', null);
  end if;
  return jsonb_build_object('code', 'ok', 'row', jsonb_build_object('payload', stored.payload, 'revision', stored.revision, 'updated_at', stored.updated_at));
end; $$;

revoke all on function public.portia_content_read(bigint, text) from public, anon, authenticated;
grant execute on function public.portia_content_read(bigint, text) to anon, authenticated;
grant execute on function public.portia_content_read(bigint, text) to service_role;

-- b. The employee roster: profiles without the editor id (updated_by) and the manually added employees, in one answer.
create or replace function public.portia_employees_read(p_issued_at bigint, p_signature text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  now_epoch bigint := floor(extract(epoch from now()))::bigint;
  signing_secret text;
  expected_signature text;
  profile_rows jsonb;
  manual_rows jsonb;
begin
  if not public.portia_can_edit() then
    select s.secret into signing_secret
      from public.portia_access_secrets s
      where s.name = 'submit';
    expected_signature := encode(extensions.hmac('employees-read-v1|' || coalesce(p_issued_at::text, ''), signing_secret, 'sha256'), 'hex');
    if signing_secret is null or length(signing_secret) < 32
      or p_issued_at is null or p_signature is null or p_signature !~ '^[0-9a-f]{64}$'
      or p_issued_at < now_epoch - 300 or p_issued_at > now_epoch + 60
      or extensions.digest(p_signature, 'sha256') is distinct from extensions.digest(expected_signature, 'sha256') then
      return jsonb_build_object('code', 'unauthorized');
    end if;
  end if;

  select coalesce(jsonb_agg(to_jsonb(p) - 'updated_by'), '[]'::jsonb) into profile_rows
    from public.portia_employee_profiles p;
  select coalesce(jsonb_agg(jsonb_build_object('employee_id', m.employee_id, 'nickname', m.nickname, 'title', m.title, 'rank', m.rank, 'callsign', m.callsign) order by m.created_at), '[]'::jsonb) into manual_rows
    from public.portia_manual_employees m;
  return jsonb_build_object('code', 'ok', 'profiles', profile_rows, 'manual', manual_rows);
end; $$;

revoke all on function public.portia_employees_read(bigint, text) from public, anon, authenticated;
grant execute on function public.portia_employees_read(bigint, text) to anon, authenticated;
grant execute on function public.portia_employees_read(bigint, text) to service_role;

notify pgrst, 'reload schema';
