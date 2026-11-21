-- Quick 261118: the owner may decide a request or a person row filed with their own nickname. Forward-only, idempotent.
-- APPLIED NOWHERE by the agent. The owner applies it by hand on an isolated test branch first, then production
-- (ОЖИДАЕТ ВЛАДЕЛЬЦА). Without it nothing breaks: the owner's own request simply stays undecidable, as before.
--
-- Why: the self guard («Свою заявку решить нельзя») also caught the owner, and the owner guard keeps every other editor
-- away from a row linked to the owner. A request the owner filed for their own nick could therefore be decided by nobody
-- and stayed pending for ever (owner report 2026-11-18). An editor who is not the owner keeps both guards unchanged.
--
-- 1. portia_access_target_guard: the two self-decision checks skip the owner (owner-protected already did).
-- 2. portia_access_list: self_guard is false for the owner, so canDecide / canSetLevel / canRevoke match the guard.

create or replace function public.portia_access_target_guard(p_nickname_key text, p_requested_by uuid)
returns void
language plpgsql
stable
set search_path = ''
as $$
begin
  -- 2026-11-18: the owner decides every row, their own included; nobody else could ever decide it.
  if not public.portia_is_owner() and p_requested_by is not null and p_requested_by = auth.uid() then
    raise exception 'self-decision';
  end if;
  if not public.portia_is_owner() and exists (
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

create or replace function public.portia_access_list(p_query text, p_limit integer)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  row_limit integer;
  query_text text;
  caller_is_owner boolean;
  pending_total_all integer;
  pending_total integer;
  pending_rows jsonb;
  people_total integer;
  people_rows jsonb;
  closed_total integer;
  closed_rows jsonb;
begin
  if not public.portia_can_edit_tab('users') then raise exception 'forbidden'; end if;
  row_limit := least(greatest(coalesce(p_limit, 50), 0), 50);
  query_text := coalesce(p_query, '');
  caller_is_owner := public.portia_is_owner();

  select count(*)::integer into pending_total_all
  from public.portia_access_requests r where r.status = 'pending';

  if pg_catalog.octet_length(query_text) > 20 or query_text collate "C" !~ '^[A-Za-z0-9_]{0,20}$' then
    pending_total := 0; pending_rows := '[]'::jsonb;
    people_total := 0; people_rows := '[]'::jsonb;
    closed_total := 0; closed_rows := '[]'::jsonb;
  else
    query_text := pg_catalog.lower(query_text);
    select count(*)::integer into pending_total
    from public.portia_access_requests r
    where r.status = 'pending'
      and (query_text = '' or pg_catalog.strpos(r.nickname_key, query_text) > 0);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', rows.id, 'nickname', rows.nickname, 'nicknameKey', rows.nickname_key,
      'origin', rows.origin, 'createdAt', rows.created_at, 'existingLevel', rows.existing_level,
      'canDecide', not rows.self_guard and not rows.owner_guard,
      'reason', case when rows.self_guard then 'self' when rows.owner_guard then 'owner' else null end
    ) order by rows.created_at asc, rows.id asc), '[]'::jsonb) into pending_rows
    from (
      select r.id, r.nickname, r.nickname_key, r.origin, r.created_at,
        active_person.level as existing_level,
        (not caller_is_owner and ((r.requested_by is not null and r.requested_by = auth.uid()) or exists (
          select 1 from public.portia_access_people self_person
          where self_person.nickname_key = r.nickname_key
            and self_person.status in ('active', 'revoked')
            and self_person.account_id = auth.uid()
        ))) as self_guard,
        (not caller_is_owner and exists (
          select 1 from auth.users owner_user
          where pg_catalog.lower(owner_user.email) = public.portia_owner_email()
            and (r.requested_by = owner_user.id or exists (
              select 1 from public.portia_access_people owner_person
              where owner_person.nickname_key = r.nickname_key
                and owner_person.status in ('active', 'revoked')
                and owner_person.account_id = owner_user.id
            ))
        )) as owner_guard
      from public.portia_access_requests r
      left join lateral (
        select p.level from public.portia_access_people p
        where p.nickname_key = r.nickname_key and p.status = 'active'
        order by p.id limit 1
      ) active_person on true
      where r.status = 'pending'
        and (query_text = '' or pg_catalog.strpos(r.nickname_key, query_text) > 0)
      order by r.created_at asc, r.id asc limit row_limit
    ) rows;

    select count(*)::integer into people_total
    from public.portia_access_people p
    where p.status = 'active'
      and (query_text = '' or pg_catalog.strpos(p.nickname_key, query_text) > 0);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', rows.id, 'nickname', rows.nickname, 'nicknameKey', rows.nickname_key,
      'origin', rows.origin, 'level', rows.level, 'approvedAt', rows.approved_at,
      'canSetLevel', not rows.self_guard and not rows.owner_guard,
      'canRevoke', not rows.self_guard and not rows.owner_guard,
      'reason', case when rows.self_guard then 'self' when rows.owner_guard then 'owner' else null end,
      'lastEvent', rows.last_event
    ) order by rows.level desc, rows.nickname_key asc), '[]'::jsonb) into people_rows
    from (
      select p.id, p.nickname, p.nickname_key, p.origin, p.level, p.approved_at,
        (not caller_is_owner and coalesce(p.account_id = auth.uid(), false)) as self_guard,
        (not caller_is_owner and exists (
          select 1 from auth.users owner_user
          where pg_catalog.lower(owner_user.email) = public.portia_owner_email()
            and p.account_id = owner_user.id
        )) as owner_guard,
        case when last_event.event_type is null then null else jsonb_build_object(
          'type', last_event.event_type, 'at', last_event.created_at,
          'actor', case when public.portia_is_owner() then actor_user.email
            else public.portia_access_mask_email(actor_user.email) end
        ) end as last_event
      from public.portia_access_people p
      left join lateral (
        select j.event_type, j.created_at, j.actor_id
        from public.portia_access_journal j
        where j.nickname_key = p.nickname_key order by j.id desc limit 1
      ) last_event on true
      left join auth.users actor_user on actor_user.id = last_event.actor_id
      where p.status = 'active'
        and (query_text = '' or pg_catalog.strpos(p.nickname_key, query_text) > 0)
      order by p.level desc, p.nickname_key asc limit row_limit
    ) rows;

    with newest_closed as (
      select distinct on (r.nickname_key)
        r.id, r.nickname, r.nickname_key, r.status, r.decided_at, r.cooldown_cleared_at
      from public.portia_access_requests r
      where r.status in ('rejected', 'revoked') and r.decided_at is not null
        and not exists (
          select 1 from public.portia_access_people active_person
          where active_person.nickname_key = r.nickname_key and active_person.status = 'active'
        )
      order by r.nickname_key, r.decided_at desc, r.id desc
    )
    select count(*)::integer into closed_total from newest_closed c
    where query_text = '' or pg_catalog.strpos(c.nickname_key, query_text) > 0;

    select coalesce(jsonb_agg(jsonb_build_object(
      'nickname', rows.nickname, 'nicknameKey', rows.nickname_key, 'status', rows.status,
      'decidedAt', rows.decided_at, 'retryAt', rows.retry_at, 'lastEvent', rows.last_event
    ) order by rows.decided_at desc, rows.id desc), '[]'::jsonb) into closed_rows
    from (
      select c.id, c.nickname, c.nickname_key, c.status, c.decided_at,
        case when c.cooldown_cleared_at is null and c.decided_at > now() - interval '1 hour'
          then c.decided_at + interval '1 hour' else null end as retry_at,
        case when last_event.event_type is null then null else jsonb_build_object(
          'type', last_event.event_type, 'at', last_event.created_at,
          'actor', case when public.portia_is_owner() then actor_user.email
            else public.portia_access_mask_email(actor_user.email) end
        ) end as last_event
      from (
        select distinct on (r.nickname_key)
          r.id, r.nickname, r.nickname_key, r.status, r.decided_at, r.cooldown_cleared_at
        from public.portia_access_requests r
        where r.status in ('rejected', 'revoked') and r.decided_at is not null
          and not exists (
            select 1 from public.portia_access_people active_person
            where active_person.nickname_key = r.nickname_key and active_person.status = 'active'
          )
        order by r.nickname_key, r.decided_at desc, r.id desc
      ) c
      left join lateral (
        select j.event_type, j.created_at, j.actor_id
        from public.portia_access_journal j
        where j.nickname_key = c.nickname_key order by j.id desc limit 1
      ) last_event on true
      left join auth.users actor_user on actor_user.id = last_event.actor_id
      where query_text = '' or pg_catalog.strpos(c.nickname_key, query_text) > 0
      order by c.decided_at desc, c.id desc limit row_limit
    ) rows;
  end if;

  return jsonb_build_object(
    'callerIsOwner', caller_is_owner, 'pendingTotalAll', pending_total_all, 'serverNow', now(),
    'pending', jsonb_build_object('total', pending_total, 'rows', pending_rows),
    'people', jsonb_build_object('total', people_total, 'rows', people_rows),
    'closed', jsonb_build_object('total', closed_total, 'rows', closed_rows)
  );
end; $$;

revoke all on function public.portia_access_list(text, integer) from public, anon, authenticated;
grant execute on function public.portia_access_list(text, integer) to authenticated;
grant execute on function public.portia_access_list(text, integer) to service_role;
