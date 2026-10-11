-- Run this once in Supabase Dashboard -> SQL Editor.
-- Replace the email below before running if your owner email is different.

create table if not exists public.portia_content (
  id text primary key,
  payload jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

create table if not exists public.portia_editors (
  email text primary key check (email = lower(email)),
  granted_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.portia_editors enable row level security;

revoke all on table public.portia_editors from anon, authenticated;
grant select, insert, delete on table public.portia_editors to authenticated;

drop policy if exists "Editors can see their access" on public.portia_editors;
create policy "Editors can see their access"
on public.portia_editors for select
to authenticated
using (
  lower(email) = lower((select auth.jwt() ->> 'email'))
  or lower((select auth.jwt() ->> 'email')) = 'qloxzick@gmail.com'
);

drop policy if exists "Owner can grant editor access" on public.portia_editors;
create policy "Owner can grant editor access"
on public.portia_editors for insert
to authenticated
with check (lower((select auth.jwt() ->> 'email')) = 'qloxzick@gmail.com');

drop policy if exists "Owner can revoke editor access" on public.portia_editors;
create policy "Owner can revoke editor access"
on public.portia_editors for delete
to authenticated
using (lower((select auth.jwt() ->> 'email')) = 'qloxzick@gmail.com');

create or replace function public.portia_editor_is_approved(candidate_email text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    lower(trim(candidate_email)) = 'qloxzick@gmail.com'
    or exists (
      select 1 from public.portia_editors
      where email = lower(trim(candidate_email))
    );
$$;

revoke all on function public.portia_editor_is_approved(text) from public;
grant execute on function public.portia_editor_is_approved(text) to anon, authenticated;

alter table public.portia_content enable row level security;

revoke all on table public.portia_content from anon, authenticated;
grant select on table public.portia_content to anon, authenticated;
grant insert, update on table public.portia_content to authenticated;

drop policy if exists "Public can read PORTIA content" on public.portia_content;
create policy "Public can read PORTIA content"
on public.portia_content for select
to anon, authenticated
using (true);

drop policy if exists "Owner can create PORTIA content" on public.portia_content;
drop policy if exists "Editors can create PORTIA content" on public.portia_content;
create policy "Editors can create PORTIA content"
on public.portia_content for insert
to authenticated
with check (
  lower((select auth.jwt() ->> 'email')) = 'qloxzick@gmail.com'
  or exists (
    select 1 from public.portia_editors
    where email = lower((select auth.jwt() ->> 'email'))
  )
);

drop policy if exists "Owner can update PORTIA content" on public.portia_content;
drop policy if exists "Editors can update PORTIA content" on public.portia_content;
create policy "Editors can update PORTIA content"
on public.portia_content for update
to authenticated
using (
  lower((select auth.jwt() ->> 'email')) = 'qloxzick@gmail.com'
  or exists (
    select 1 from public.portia_editors
    where email = lower((select auth.jwt() ->> 'email'))
  )
)
with check (
  lower((select auth.jwt() ->> 'email')) = 'qloxzick@gmail.com'
  or exists (
    select 1 from public.portia_editors
    where email = lower((select auth.jwt() ->> 'email'))
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'portia-media',
  'portia-media',
  true,
  4194304,
  array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can read PORTIA media" on storage.objects;
create policy "Public can read PORTIA media"
on storage.objects for select
to anon, authenticated
using (bucket_id = 'portia-media');

drop policy if exists "Owner can upload PORTIA media" on storage.objects;
drop policy if exists "Editors can upload PORTIA media" on storage.objects;
create policy "Editors can upload PORTIA media"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'portia-media'
  and (
    lower((select auth.jwt() ->> 'email')) = 'qloxzick@gmail.com'
    or exists (
      select 1 from public.portia_editors
      where email = lower((select auth.jwt() ->> 'email'))
    )
  )
);

drop policy if exists "Owner can update PORTIA media" on storage.objects;
drop policy if exists "Editors can update PORTIA media" on storage.objects;
create policy "Editors can update PORTIA media"
on storage.objects for update
to authenticated
using (
  bucket_id = 'portia-media'
  and (
    lower((select auth.jwt() ->> 'email')) = 'qloxzick@gmail.com'
    or exists (select 1 from public.portia_editors where email = lower((select auth.jwt() ->> 'email')))
  )
)
with check (
  bucket_id = 'portia-media'
  and (
    lower((select auth.jwt() ->> 'email')) = 'qloxzick@gmail.com'
    or exists (select 1 from public.portia_editors where email = lower((select auth.jwt() ->> 'email')))
  )
);

drop policy if exists "Owner can delete PORTIA media" on storage.objects;
drop policy if exists "Editors can delete PORTIA media" on storage.objects;
create policy "Editors can delete PORTIA media"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'portia-media'
  and (
    lower((select auth.jwt() ->> 'email')) = 'qloxzick@gmail.com'
    or exists (select 1 from public.portia_editors where email = lower((select auth.jwt() ->> 'email')))
  )
);
