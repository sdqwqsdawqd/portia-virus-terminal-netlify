-- НЕ ПРИМЕНЯТЬ БЕЗ АВАРИИ
-- Только если сломалось чтение через сервер; сначала опубликовать предыдущий деплой Netlify; применяет владелец через psql одной транзакцией.
--
-- Phase 25 emergency restore (D-08). This is NOT a migration: it lives outside supabase/migrations/ on purpose, so `db push`
-- never applies it and the migration hash test does not see it. The agent never applies it.
-- It undoes the data-table half of 20261115000100_portia_closure_contract.sql: it gives the anonymous role the select grant
-- and the public read policies of portia_content, portia_employee_profiles and portia_manual_employees back (text identical
-- to the baseline). Use it only together with a rollback of the site code to the previous deploy: the old code reads the
-- tables directly, the new code reads through portia_content_read / portia_employees_read.
-- No begin/commit here: open the transaction in psql (begin; \i this file; commit;) and check before commit.
-- The media listing is NOT restored by default: the site does not need it and a public file link works without it.

-- Content

grant select on table public.portia_content to anon;

drop policy if exists "Editors can read PORTIA content" on public.portia_content;
drop policy if exists "Public can read PORTIA content" on public.portia_content;
create policy "Public can read PORTIA content"
on public.portia_content for select
to anon, authenticated
using (true);

-- Employee profiles

grant select on table public.portia_employee_profiles to anon;

drop policy if exists "Editors can read PORTIA employee profiles" on public.portia_employee_profiles;
drop policy if exists "Public can read PORTIA employee profiles" on public.portia_employee_profiles;
create policy "Public can read PORTIA employee profiles"
on public.portia_employee_profiles for select
to anon, authenticated
using (true);

-- Manual employees

grant select on table public.portia_manual_employees to anon;

drop policy if exists "Editors can read PORTIA manual employees" on public.portia_manual_employees;
drop policy if exists "Public can read PORTIA manual employees" on public.portia_manual_employees;
create policy "Public can read PORTIA manual employees"
on public.portia_manual_employees for select
to anon, authenticated
using (true);

-- Media listing, commented out on purpose (D-11): uncomment only if the owner decides the public listing is needed again.
-- drop policy if exists "Editors can read PORTIA media" on storage.objects;
-- drop policy if exists "Public can read PORTIA media" on storage.objects;
-- create policy "Public can read PORTIA media"
-- on storage.objects for select
-- to anon, authenticated
-- using (bucket_id = 'portia-media');

notify pgrst, 'reload schema';
