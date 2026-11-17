-- Phase 25 contract: removes the anonymous read of content and employees and the media listing.
-- Apply ONLY after the server-read code is deployed and checked (D-06); the DO block below refuses to run otherwise.
-- Rollback: supabase/emergency/20261115000200_portia_emergency_restore_anon_read.sql together with the previous deploy (D-08).
-- Forward-only; no begin/commit (the owner runs it through psql, one file at a time); safe to run again.
--
-- Runs after 20261115000000_portia_server_read_expand.sql. Editor write policies, grants of authenticated and the bucket
-- itself (public, 4 MiB, image types, one-year cache) are not touched (D-12). The editor read policies are kept because an
-- editor still reads the tables through the session, and Storage copy needs select on storage.objects.

do $$
begin
  if to_regprocedure('public.portia_content_read(bigint, text)') is null
    or to_regprocedure('public.portia_employees_read(bigint, text)') is null then
    raise exception 'PORTIA: the server-read functions are missing, nothing was changed';
  end if;
  if not exists (select 1 from public.portia_access_secrets where name = 'submit' and length(secret) >= 32) then
    raise exception 'PORTIA: the submit secret is missing, nothing was changed';
  end if;
end; $$;

-- Content

revoke select on table public.portia_content from anon;

drop policy if exists "Public can read PORTIA content" on public.portia_content;
drop policy if exists "Editors can read PORTIA content" on public.portia_content;
create policy "Editors can read PORTIA content"
on public.portia_content for select
to authenticated
using ((select public.portia_can_edit()));

-- Employee profiles

revoke select on table public.portia_employee_profiles from anon;

drop policy if exists "Public can read PORTIA employee profiles" on public.portia_employee_profiles;
drop policy if exists "Editors can read PORTIA employee profiles" on public.portia_employee_profiles;
create policy "Editors can read PORTIA employee profiles"
on public.portia_employee_profiles for select
to authenticated
using ((select public.portia_can_edit()));

-- Manual employees

revoke select on table public.portia_manual_employees from anon;

drop policy if exists "Public can read PORTIA manual employees" on public.portia_manual_employees;
drop policy if exists "Editors can read PORTIA manual employees" on public.portia_manual_employees;
create policy "Editors can read PORTIA manual employees"
on public.portia_manual_employees for select
to authenticated
using ((select public.portia_can_edit()));

-- Media: no listing for the public. The bucket stays public, so an exact file link keeps working without a select policy.

drop policy if exists "Public can read PORTIA media" on storage.objects;
drop policy if exists "Editors can read PORTIA media" on storage.objects;
create policy "Editors can read PORTIA media"
on storage.objects for select
to authenticated
using (bucket_id = 'portia-media' and (select public.portia_can_edit()));

notify pgrst, 'reload schema';
