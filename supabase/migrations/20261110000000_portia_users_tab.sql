-- Phase 22 «Пользователи» tab: read RPCs; journal retention D-07 is added later in this file.
-- Forward-only; idempotent statements.
--
-- Not applied anywhere by the agent. Apply order: 20261104000000_portia_rename_virus_classes.sql,
-- 20261104000100_portia_editor_notes.sql, 20261106000000_portia_drop_editor_notes.sql,
-- 20261109000000_portia_access_foundation.sql, then this file. Postgres/RLS execution is BLOCKED until an
-- isolated staging run; production is applied by the owner only.

-- a. Internal masking helper for decision actors (D-05).
create or replace function public.portia_access_mask_email(p_email text)
returns text
language sql
immutable
set search_path = ''
as $$
  with parts as (
    select
      pg_catalog.split_part(p_email, '@', 1) as local,
      pg_catalog.substr(p_email, pg_catalog.strpos(p_email, '@') + 1) as domain
  )
  select case
    when p_email is null or pg_catalog.strpos(p_email, '@') = 0 then null
    when pg_catalog.length(parts.local) <= 2
      then pg_catalog.left(parts.local, 1) || '•••@' || parts.domain
    else pg_catalog.left(parts.local, 1) || '•••' || pg_catalog.right(parts.local, 1) || '@' || parts.domain
  end
  from parts;
$$;

revoke all on function public.portia_access_mask_email(text) from public, anon, authenticated;
grant execute on function public.portia_access_mask_email(text) to service_role;

-- b. Full read model for the editor «Пользователи» tab (USR-01, USR-02, USR-06, USR-09).
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
  query_text := lower(coalesce(p_query, ''));
  caller_is_owner := public.portia_is_owner();

  select count(*)::integer into pending_total_all
  from public.portia_access_requests r where r.status = 'pending';

  if query_text collate "C" !~ '^[a-z0-9_]{0,20}$' then
    pending_total := 0; pending_rows := '[]'::jsonb;
    people_total := 0; people_rows := '[]'::jsonb;
    closed_total := 0; closed_rows := '[]'::jsonb;
  else
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
        ((r.requested_by is not null and r.requested_by = auth.uid()) or exists (
          select 1 from public.portia_access_people self_person
          where self_person.nickname_key = r.nickname_key
            and self_person.status in ('active', 'revoked')
            and self_person.account_id = auth.uid()
        )) as self_guard,
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
        p.account_id = auth.uid() as self_guard,
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

-- c. Last five journal entries for one nickname. The RPC owns masking and detail-key whitelisting so a direct caller
-- cannot recover another editor's full email or the raw details object.
create or replace function public.portia_access_history(p_nickname_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  history_rows jsonb;
begin
  if not public.portia_can_edit_tab('users') then raise exception 'forbidden'; end if;
  if p_nickname_key is null or public.portia_access_nickname_key(p_nickname_key) is distinct from p_nickname_key then
    return jsonb_build_object('entries', '[]'::jsonb);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'type', rows.event_type,
    'at', rows.created_at,
    'actor', case when public.portia_is_owner() then rows.actor_email
      else public.portia_access_mask_email(rows.actor_email) end,
    'details', jsonb_strip_nulls(jsonb_build_object(
      'level', rows.details -> 'level',
      'from', rows.details -> 'from',
      'to', rows.details -> 'to',
      'origin', rows.details -> 'origin',
      'deviceAdded', rows.details -> 'deviceAdded',
      'previousLevel', rows.details -> 'previousLevel',
      'count', rows.details -> 'count'
    ))
  ) order by rows.id desc), '[]'::jsonb) into history_rows
  from (
    select j.id, j.event_type, j.created_at, j.details, actor_user.email as actor_email
    from public.portia_access_journal j
    left join auth.users actor_user on actor_user.id = j.actor_id
    where j.nickname_key = p_nickname_key
    order by j.id desc
    limit 5
  ) rows;

  return jsonb_build_object('entries', history_rows);
end; $$;

revoke all on function public.portia_access_history(text) from public, anon, authenticated;
grant execute on function public.portia_access_history(text) to authenticated;
grant execute on function public.portia_access_history(text) to service_role;

-- d. D-07 bounded retention (owner decision 2026-11-09). This becomes one-way after apply: rows older than the
-- newest 20 for a nickname cannot be restored. The table owner can still disable triggers (residual RLS21-03).
create or replace function public.portia_access_journal_append_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  cutoff_id bigint;
begin
  if tg_op = 'DELETE' then
    select j.id into cutoff_id
    from public.portia_access_journal j
    where j.nickname_key = old.nickname_key
    order by j.id desc
    offset 19 limit 1;
    if cutoff_id is not null and old.id < cutoff_id then
      return old;
    end if;
  end if;
  raise exception 'journal-append-only';
end; $$;

revoke all on function public.portia_access_journal_append_only() from public, anon, authenticated;
grant execute on function public.portia_access_journal_append_only() to service_role;

create or replace function public.portia_access_journal_prune()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.portia_access_journal j
  where j.nickname_key = new.nickname_key
    and j.id < (
      select boundary.id
      from public.portia_access_journal boundary
      where boundary.nickname_key = new.nickname_key
      order by boundary.id desc
      offset 19 limit 1
    );
  return null;
end; $$;

revoke all on function public.portia_access_journal_prune() from public, anon, authenticated;
grant execute on function public.portia_access_journal_prune() to service_role;

drop trigger if exists portia_access_journal_prune on public.portia_access_journal;
create trigger portia_access_journal_prune after insert on public.portia_access_journal for each row execute function public.portia_access_journal_prune();
