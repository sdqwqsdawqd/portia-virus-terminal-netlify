-- Phase 22 «Пользователи» tab: read RPCs; journal retention D-07 is added later in this file.
-- Forward-only; idempotent statements.
--
-- Not applied anywhere by the agent. Apply order: 20261104000000_portia_rename_virus_classes.sql,
-- 20261104000100_portia_editor_notes.sql, 20261106000000_portia_drop_editor_notes.sql,
-- 20261109000000_portia_access_foundation.sql, then this file. Postgres/RLS execution is BLOCKED until an
-- isolated staging run; production is applied by the owner only.

-- a. Pending requests for the editor «Пользователи» tab (USR-01, USR-09).
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
  pending_total_all integer;
  pending_total integer;
  pending_rows jsonb;
begin
  if not public.portia_can_edit_tab('users') then raise exception 'forbidden'; end if;
  row_limit := least(greatest(coalesce(p_limit, 50), 0), 50);
  query_text := lower(coalesce(p_query, ''));

  select count(*)::integer
    into pending_total_all
    from public.portia_access_requests r
    where r.status = 'pending';

  if query_text collate "C" !~ '^[a-z0-9_]{0,20}$' then
    pending_total := 0;
    pending_rows := '[]'::jsonb;
  else
    select count(*)::integer
      into pending_total
      from public.portia_access_requests r
      where r.status = 'pending'
        and (query_text = '' or pg_catalog.strpos(r.nickname_key, query_text) > 0);

    select coalesce(jsonb_agg(jsonb_build_object(
      'id', rows.id,
      'nickname', rows.nickname,
      'nicknameKey', rows.nickname_key,
      'origin', rows.origin,
      'createdAt', rows.created_at
    ) order by rows.created_at asc, rows.id asc), '[]'::jsonb)
      into pending_rows
      from (
        select r.id, r.nickname, r.nickname_key, r.origin, r.created_at
          from public.portia_access_requests r
          where r.status = 'pending'
            and (query_text = '' or pg_catalog.strpos(r.nickname_key, query_text) > 0)
          order by r.created_at asc, r.id asc
          limit row_limit
      ) rows;
  end if;

  return jsonb_build_object(
    'callerIsOwner', public.portia_is_owner(),
    'pendingTotalAll', pending_total_all,
    'serverNow', now(),
    'pending', jsonb_build_object('total', pending_total, 'rows', pending_rows)
  );
end; $$;

revoke all on function public.portia_access_list(text, integer) from public, anon, authenticated;
grant execute on function public.portia_access_list(text, integer) to authenticated;
grant execute on function public.portia_access_list(text, integer) to service_role;
