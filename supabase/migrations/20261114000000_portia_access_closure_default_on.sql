-- PORTIA access closure ON by default (Phase 23, plan 23-10; owner decision of 2026-11-14, 3a; gap G-PORTIA-23-4).
-- Forward-only; no begin/commit (the CLI owns the transaction); idempotent statements.
--
-- This overrides "closure OFF after apply" (Phase 21 D-05 / Phase 23 D-01): after the access migrations are applied the site
-- is closed until the owner opens it. 20261109000000_portia_access_foundation.sql stays frozen; this file changes the
-- default, the row 'main' and the missing-row fallback on top of it. Only the owner changes the flag, as before:
-- portia_access_set_closure is not touched here.
--
-- The owner's choice is kept: a row changed through portia_access_set_closure carries updated_by, so a re-run never
-- switches it back. Toggles are not journaled (Phase 21 D-07); updated_at records the change made by this file.
-- Grants of portia_access_closure_enabled() are restated unchanged. Tables, set_closure, submit, the journal and the
-- policies are not touched.
--
-- Not applied anywhere by the agent (D-72). The apply order and the owner's checks are in
-- .planning/phases/PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii/23-MIGRATION-APPLY.md (written by 23-11).
-- This file runs after 20261113000000_portia_access_promotion.sql.

alter table public.portia_access_settings alter column closure_enabled set default true;

insert into public.portia_access_settings (id, closure_enabled) values ('main', true)
  on conflict (id) do nothing;

update public.portia_access_settings
  set closure_enabled = true, updated_at = now()
  where id = 'main' and updated_by is null and closure_enabled is distinct from true;

create or replace function public.portia_access_closure_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.closure_enabled from public.portia_access_settings s where s.id = 'main'), true);
$$;

revoke all on function public.portia_access_closure_enabled() from public, anon, authenticated;
grant execute on function public.portia_access_closure_enabled() to anon, authenticated;
grant execute on function public.portia_access_closure_enabled() to service_role;

notify pgrst, 'reload schema';
