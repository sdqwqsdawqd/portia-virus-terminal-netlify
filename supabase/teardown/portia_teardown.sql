-- ISOLATED TEST PROJECT ONLY. Never run directly and never against production.
-- Run only through `scripts/phase16-staging.mjs teardown` after its target guard (plan 16-11).
-- Removes PORTIA objects only: public.portia_* tables/functions, PORTIA storage policies,
-- the portia-promo-cleanup cron job, pg_cron and PORTIA rows of the migration journal.
-- The portia-media bucket is removed by the wrapper through the Storage API, not here.
begin;

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
  obj record;
begin
  for obj in
    select c.oid::regclass as target
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and c.relname like 'portia\_%'
  loop
    execute format('drop table if exists %s cascade', obj.target);
  end loop;

  -- oid::regprocedure drops legacy signatures (L0, phase12) as well as current ones.
  for obj in
    select p.oid::regprocedure as target
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'portia\_%'
  loop
    execute format('drop function if exists %s cascade', obj.target);
  end loop;
end $$;

drop extension if exists pg_cron;

do $$
begin
  if to_regclass('supabase_migrations.schema_migrations') is not null then
    delete from supabase_migrations.schema_migrations where name like 'portia\_%';
  end if;
end $$;

commit;
