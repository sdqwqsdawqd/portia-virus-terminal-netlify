-- PORTIA explicit grants (Phase 16, D9). Forward-only; the baseline migration is frozen.
--
-- Why: Supabase changed default privileges for new objects on 2026-10-30, so a project built only from
-- migrations must not depend on them. Calibration on a fresh isolated project (16-FINGERPRINT-CALIBRATION.md)
-- also showed the sequence portia_promo_audit_events_id_seq inherited SELECT/UPDATE/USAGE for anon and
-- authenticated from default privileges, while the baseline only revokes table privileges.
--
-- 1. The privileged API role (the one behind the admin key) gets explicit rights on PORTIA tables, sequences
--    and functions: parity with the legacy default privileges of production, needed by the live fixtures
--    harness and by portia_promo_cleanup (the cron job and live cleanup run through it).
-- 2. PORTIA sequences lose every right of public, anon and authenticated (least privilege: only
--    SECURITY DEFINER functions and the admin role insert into the audit table).
-- Nothing is granted to anon or authenticated beyond the baseline. Idempotent: safe to re-run.

do $$
declare
  obj record;
begin
  for obj in
    select c.relname, c.relkind
    from pg_class c
    where c.relnamespace = 'public'::regnamespace
      and c.relname like 'portia\_%'
      and c.relkind in ('r', 'S')
    order by c.relname
  loop
    if obj.relkind = 'r' then
      execute format('grant all on table public.%I to service_role', obj.relname);
    else
      execute format('grant all on sequence public.%I to service_role', obj.relname);
      execute format('revoke all on sequence public.%I from public, anon, authenticated', obj.relname);
    end if;
  end loop;

  for obj in
    select 'public.' || quote_ident(p.proname) || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig
    from pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname like 'portia\_%'
      and p.prokind = 'f'
    order by p.proname
  loop
    execute format('grant execute on function %s to service_role', obj.sig);
  end loop;
end
$$;
