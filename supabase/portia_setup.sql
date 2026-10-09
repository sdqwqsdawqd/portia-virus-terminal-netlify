-- Run this once in Supabase Dashboard -> SQL Editor.
-- Replace the email below before running if your owner email is different.

create table if not exists public.portia_content (
  id text primary key,
  payload jsonb not null,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

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
create policy "Owner can create PORTIA content"
on public.portia_content for insert
to authenticated
with check ((select auth.jwt() ->> 'email') = 'qloxzick@gmail.com');

drop policy if exists "Owner can update PORTIA content" on public.portia_content;
create policy "Owner can update PORTIA content"
on public.portia_content for update
to authenticated
using ((select auth.jwt() ->> 'email') = 'qloxzick@gmail.com')
with check ((select auth.jwt() ->> 'email') = 'qloxzick@gmail.com');
