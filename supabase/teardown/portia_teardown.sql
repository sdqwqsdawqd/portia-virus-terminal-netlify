-- ISOLATED TEST PROJECT ONLY. Never run directly and never against production.
-- Run only through `scripts/phase16-staging.mjs teardown` after its target guard (plan 16-11).
-- Fail-closed: aborts unless the session set portia.teardown_ok = 'yes' (set_config, same session).
-- Only the guarded wrapper may set it; never set it by hand or paste this file into a SQL Editor.
-- Removes PORTIA objects only: public.portia_* tables/functions, PORTIA storage policies,
-- the portia-promo-cleanup cron job, pg_cron (only if no other job exists) and PORTIA journal rows.
-- The portia-media bucket is removed by the wrapper through the Storage API, not here.
-- No cascade anywhere: a leftover dependency must fail loudly instead of dropping foreign objects.
begin;

do $$
begin
  if coalesce(current_setting('portia.teardown_ok', true), '') <> 'yes' then
    raise exception 'portia_teardown refused: portia.teardown_ok is not set (run via the guarded wrapper only)';
  end if;
end $$;

do $$
begin
  if to_regclass('cron.job') is not null then
    perform cron.unschedule(jobid) from cron.job where jobname = 'portia-promo-cleanup';
  end if;
end $$;

drop policy if exists "Public can read PORTIA media" on storage.objects;
drop policy if exists "Owner can upload PORTIA media" on storage.objects;
drop policy if exists "Editors can upload PORTIA media" on storage.objects;
drop policy if exists "Owner can update PORTIA media" on storage.objects;
drop policy if exists "Editors can update PORTIA media" on storage.objects;
drop policy if exists "Owner can delete PORTIA media" on storage.objects;
drop policy if exists "Editors can delete PORTIA media" on storage.objects;

do $$
declare
  tables text;
  fn record;
begin
  -- One statement: PORTIA-only foreign keys resolve together, so no cascade is needed.
  -- Tables go first: their policies and defaults reference the functions dropped below.
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ')
    into tables
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname like 'portia\_%';
  if tables is not null then
    execute 'drop table ' || tables;
  end if;

  -- Identity arguments drop legacy signatures (L0, phase12) as well as current ones.
  for fn in
    select n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'portia\_%'
  loop
    execute format('drop function %I.%I(%s)', fn.nspname, fn.proname, fn.args);
  end loop;
end $$;

do $$
begin
  if to_regclass('cron.job') is not null
     and not exists (select 1 from cron.job where jobname is distinct from 'portia-promo-cleanup') then
    drop extension if exists pg_cron;
  end if;
end $$;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where left(name, 7) = 'portia_';
  end if;
end $$;

commit;
