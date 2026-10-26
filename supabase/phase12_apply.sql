-- Фаза 12 (права редакторов и безопасность доступа): один файл для владельца, шаги по порядку.
-- Запускать в Supabase Dashboard -> SQL Editor. Редактор показывает результат только последнего запроса,
-- поэтому каждый запрос из STEP 1 и STEP 3 выделяйте и запускайте по отдельности.
--
-- Порядок:
--   сейчас, до обновления сайта: STEP 0 и STEP 1 (только чтение, ничего не меняют);
--   потом, в плане 12-08: STEP 2, затем STEP 2b (если в STEP 1 (b) не было строк), затем STEP 3;
--   STEP 4 нужен только для отката.
-- Сайт работает и до STEP 2, и после него: старый код вызывает только portia_can_edit и portia_is_owner.
--
-- Что делает STEP 2: требует подтверждённую почту (в базе, не только в коде), добавляет редакторам списки
-- закрытых вкладок, закрывает таблицы сотрудников по вкладке «Сотрудники», вводит правило локальных фото.

-- STEP 0 (не SQL, в панели Supabase)
-- Authentication -> Sign In / Providers -> Email -> «Confirm email» должно быть ВКЛЮЧЕНО.
-- Если выключено, любой может зарегистрировать чужую почту (SEC-02). Включите и продолжайте.

-- STEP 1 PREFLIGHT (только чтение, безопасно в любой момент)
-- (a) Владелец и редакторы: есть ли аккаунт и подтверждена ли почта. Строка владельца должна быть confirmed = true.
select 'owner' as role, o.email, (u.id is not null) as has_account, (u.email_confirmed_at is not null) as confirmed
from (select public.portia_owner_email() as email) o
left join auth.users u on lower(u.email) = o.email
union all
select 'editor', e.email, (u.id is not null), (u.email_confirmed_at is not null)
from public.portia_editors e
left join auth.users u on lower(u.email) = e.email
order by 1 desc, 2;

-- (b) Фото сотрудников, которые не проходят новое правило (то же выражение, что в проверке STEP 2, с отрицанием).
-- Должно вернуть 0 строк до STEP 2b.
select employee_id, photo_url
from public.portia_employee_profiles
where not (photo_url = '' or photo_url like 'https://%' or photo_url ~ '^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$');

-- STEP 2 APPLY
-- Любая ошибка внутри означает, что ничего не применено: посмотрите STEP 3.
begin;

-- Защита: без подтверждённой почты владельца ничего не меняем (иначе владелец сам себя заблокирует).
do $$
begin
  if not exists (
    select 1 from auth.users
    where lower(email) = public.portia_owner_email() and email_confirmed_at is not null
  ) then
    raise exception 'PORTIA: почта владельца не подтверждена, ничего не применено';
  end if;
end $$;

-- closed_tabs: закрытые обычные вкладки (пусто = все открыты). granted_tabs: выданные доверенные вкладки (пусто = ни одной).
-- Значения по умолчанию оставляют всем уже существующим редакторам все обычные вкладки открытыми.
alter table public.portia_editors
  add column if not exists closed_tabs text[] not null default '{}',
  add column if not exists granted_tabs text[] not null default '{}';

create or replace function public.portia_email_confirmed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from auth.users where id = auth.uid() and email_confirmed_at is not null);
$$;

create or replace function public.portia_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = public.portia_owner_email()
    and public.portia_email_confirmed();
$$;

create or replace function public.portia_can_edit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.portia_email_confirmed() and (
    public.portia_is_owner() or exists (
      select 1 from public.portia_editors
      where email = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
$$;

create or replace function public.portia_can_edit_tab(tab_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select tab_id is not null and (
    public.portia_is_owner() or (
      public.portia_can_edit() and exists (
        select 1 from public.portia_editors
        where email = lower(coalesce(auth.jwt() ->> 'email', '')) and not (tab_id = any(closed_tabs))
      )
    )
  );
$$;

-- Пока не используется: нужна, чтобы доверенной вкладке не требовался новый SQL.
create or replace function public.portia_has_tab_grant(tab_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select tab_id is not null and (
    public.portia_is_owner() or (
      public.portia_can_edit() and exists (
        select 1 from public.portia_editors
        where email = lower(coalesce(auth.jwt() ->> 'email', '')) and tab_id = any(granted_tabs)
      )
    )
  );
$$;

revoke all on function public.portia_email_confirmed() from public, anon;
revoke all on function public.portia_can_edit_tab(text) from public, anon;
revoke all on function public.portia_has_tab_grant(text) from public, anon;
grant execute on function public.portia_email_confirmed() to authenticated;
grant execute on function public.portia_can_edit_tab(text) to authenticated;
grant execute on function public.portia_has_tab_grant(text) to authenticated;

-- Списки вкладок меняет только владелец: право на два столбца и политика только для владельца.
grant update (closed_tabs, granted_tabs) on table public.portia_editors to authenticated;

drop policy if exists "Owner can change editor tabs" on public.portia_editors;
create policy "Owner can change editor tabs"
on public.portia_editors for update
to authenticated
using ((select public.portia_is_owner()))
with check ((select public.portia_is_owner()));

-- Таблицы сотрудников: запись требует открытой вкладки «Сотрудники».
drop policy if exists "Editors can create PORTIA employee profiles" on public.portia_employee_profiles;
create policy "Editors can create PORTIA employee profiles"
on public.portia_employee_profiles for insert
to authenticated
with check ((select public.portia_can_edit_tab('employees')));

drop policy if exists "Editors can update PORTIA employee profiles" on public.portia_employee_profiles;
create policy "Editors can update PORTIA employee profiles"
on public.portia_employee_profiles for update
to authenticated
using ((select public.portia_can_edit_tab('employees')))
with check ((select public.portia_can_edit_tab('employees')));

drop policy if exists "Editors can add PORTIA manual employees" on public.portia_manual_employees;
create policy "Editors can add PORTIA manual employees"
on public.portia_manual_employees for insert
to authenticated
with check ((select public.portia_can_edit_tab('employees')));

drop policy if exists "Editors can remove PORTIA manual employees" on public.portia_manual_employees;
create policy "Editors can remove PORTIA manual employees"
on public.portia_manual_employees for delete
to authenticated
using ((select public.portia_can_edit_tab('employees')));

drop policy if exists "Editors can edit PORTIA manual employees" on public.portia_manual_employees;
create policy "Editors can edit PORTIA manual employees"
on public.portia_manual_employees for update
to authenticated
using ((select public.portia_can_edit_tab('employees')))
with check ((select public.portia_can_edit_tab('employees')));

-- Правило фото: https:// или локальный путь с одним слэшем в начале (то же правило, что isLocalMediaPath в lib/media-url.ts).
-- Старую безымянную проверку ищем по определению в pg_constraint, имя не угадываем.
do $$
declare
  old_check record;
begin
  for old_check in
    select conname from pg_constraint
    where conrelid = 'public.portia_employee_profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%photo_url%'
      and conname <> 'portia_employee_profiles_photo_url_local'
  loop
    execute format('alter table public.portia_employee_profiles drop constraint %I', old_check.conname);
  end loop;
end $$;

alter table public.portia_employee_profiles drop constraint if exists portia_employee_profiles_photo_url_local;
-- NOT VALID: уже лежащие строки не проверяются (их проверит STEP 2b), но каждая новая вставка и правка проверяется.
alter table public.portia_employee_profiles add constraint portia_employee_profiles_photo_url_local
  check (photo_url = '' or photo_url like 'https://%' or photo_url ~ '^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$') not valid;

notify pgrst, 'reload schema';
commit;
-- Таблица контента и политики хранилища здесь намеренно не тронуты: разделы проверяет сервер сайта, загрузки остаются за portia_can_edit().

-- STEP 2b (только если STEP 1 (b) вернул 0 строк)
-- Проверяет старые строки по новому правилу. Запись в таблицу не блокирует.
alter table public.portia_employee_profiles validate constraint portia_employee_profiles_photo_url_local;

-- STEP 3 CHECK AFTER (только чтение)
-- Запрос 1: все строки должны совпасть, ожидаемое в колонке expected. Строка photo constraint validated равна false до STEP 2b.
select 'columns closed_tabs+granted_tabs' as check_name, '2' as expected,
  (select count(*)::text from information_schema.columns
    where table_schema = 'public' and table_name = 'portia_editors' and column_name in ('closed_tabs', 'granted_tabs')) as actual
union all
select 'functions (4)', '4',
  (select count(*)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('portia_email_confirmed', 'portia_can_edit_tab', 'portia_has_tab_grant', 'portia_is_owner'))
union all
select 'policy Owner can change editor tabs', '1',
  (select count(*)::text from pg_policies
    where schemaname = 'public' and tablename = 'portia_editors' and policyname = 'Owner can change editor tabs')
union all
select 'photo constraint validated', 'true',
  (select convalidated::text from pg_constraint
    where conrelid = 'public.portia_employee_profiles'::regclass and conname = 'portia_employee_profiles_photo_url_local')
union all
select 'must_be_false_1', 'false', ('//x/a.png' ~ '^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$')::text
union all
select 'must_be_false_2', 'false', ('/\x/a.png' ~ '^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$')::text
union all
select 'must_be_false_3', 'false', (E'/\t/x' ~ '^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$')::text
union all
select 'must_be_true_1', 'true', ('/a/b.png' ~ '^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$')::text
union all
select 'must_be_true_2', 'true', ('/' ~ '^/([^/\\[:cntrl:]][^[:cntrl:]]*)?$')::text;

-- Запрос 2: владелец снова (должно быть confirmed = true).
select 'owner' as role, o.email, (u.id is not null) as has_account, (u.email_confirmed_at is not null) as confirmed
from (select public.portia_owner_email() as email) o
left join auth.users u on lower(u.email) = o.email;

-- Потом войдите на сайт как владелец и как редактор и сохраните что-нибудь один раз (план 12-08).

-- STEP 4 ROLLBACK (только если что-то пошло не так)
-- Если владелец не может войти: Dashboard -> Authentication -> Users -> владелец -> подтвердите почту,
-- или запустите этот шаг. Подтвердить почту владельца можно и запросом (панель работает мимо правил доступа):
-- update auth.users set email_confirmed_at = now() where lower(email) = public.portia_owner_email() and email_confirmed_at is null;
-- Остаются на месте: столбцы closed_tabs и granted_tabs, право update на них, политика "Owner can change editor tabs"
-- и три новые функции. Они не мешают, а сайт и дальше сам следит за вкладками.
-- Чтобы вернуть «все вкладки открыты» целиком, раскомментируйте две строки ниже:
-- alter table public.portia_editors drop column if exists closed_tabs;
-- alter table public.portia_editors drop column if exists granted_tabs;
begin;

-- Тела до фазы 12 (portia_setup.sql, строки 52-73).
create or replace function public.portia_is_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) = public.portia_owner_email();
$$;

create or replace function public.portia_can_edit()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.portia_is_owner() or exists (
    select 1 from public.portia_editors
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop policy if exists "Editors can create PORTIA employee profiles" on public.portia_employee_profiles;
create policy "Editors can create PORTIA employee profiles"
on public.portia_employee_profiles for insert
to authenticated
with check ((select public.portia_can_edit()));

drop policy if exists "Editors can update PORTIA employee profiles" on public.portia_employee_profiles;
create policy "Editors can update PORTIA employee profiles"
on public.portia_employee_profiles for update
to authenticated
using ((select public.portia_can_edit()))
with check ((select public.portia_can_edit()));

drop policy if exists "Editors can add PORTIA manual employees" on public.portia_manual_employees;
create policy "Editors can add PORTIA manual employees"
on public.portia_manual_employees for insert
to authenticated
with check ((select public.portia_can_edit()));

drop policy if exists "Editors can remove PORTIA manual employees" on public.portia_manual_employees;
create policy "Editors can remove PORTIA manual employees"
on public.portia_manual_employees for delete
to authenticated
using ((select public.portia_can_edit()));

drop policy if exists "Editors can edit PORTIA manual employees" on public.portia_manual_employees;
create policy "Editors can edit PORTIA manual employees"
on public.portia_manual_employees for update
to authenticated
using ((select public.portia_can_edit()))
with check ((select public.portia_can_edit()));

-- Старое правило фото (без защиты от //host), NOT VALID, чтобы не упасть на уже лежащих строках.
alter table public.portia_employee_profiles drop constraint if exists portia_employee_profiles_photo_url_local;
alter table public.portia_employee_profiles drop constraint if exists portia_employee_profiles_photo_url_check;
alter table public.portia_employee_profiles add constraint portia_employee_profiles_photo_url_check
  check (photo_url = '' or photo_url like 'https://%' or photo_url like '/%') not valid;

notify pgrst, 'reload schema';
commit;
