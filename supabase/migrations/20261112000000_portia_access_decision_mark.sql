-- Forward-only: expose the decided request's server-owned nickname key to compute a fresh roster mark.
-- The frozen Phase 21 and Phase 22 migrations are unchanged.
revoke all on function public.portia_access_decide(uuid, text, smallint) from public, anon, authenticated;

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
  return jsonb_build_object('code', 'approved', 'personId', person_uuid, 'level', new_level, 'nicknameKey', req.nickname_key);
end; $$;

grant execute on function public.portia_access_decide(uuid, text, smallint) to authenticated;
grant execute on function public.portia_access_decide(uuid, text, smallint) to service_role;
