-- PORTIA: private editor notes store (Phase 20, D-41 / D-47). Forward-only.
--
-- Why: editor section notes (D-41) must never reach the public JSON or visitors' devices (D-47). public.portia_content is
-- publicly readable (policy "Public can read PORTIA content", select for anon), so notes cannot live in its payload. They get
-- their own table that anon cannot touch, and that an editor can touch only for the tabs open to that editor.
--
-- What it creates: one table public.portia_editor_notes, one row per editor tab that carries notes ('guide', 'broadcasts',
-- 'search'); notes is a JSON object { "<section or card id>": "<note text>" }; revision is the compare-and-set counter the
-- /api/content/notes route uses (same idea as portia_content.revision).
-- Access: row level security on; anon and authenticated lose every right first, then authenticated gets select, insert and a
-- column-limited update (the tab key cannot be rewritten); service_role gets full rights, as in 20261101000100. The three
-- policies (select, insert, update) apply to authenticated only and require (select public.portia_can_edit_tab(tab)), so the
-- owner and an editor whose tab is open pass, an editor with the tab closed and a visitor do not. No delete right and no policy
-- for delete. No functions, no changes to other tables, no data changes.
-- Idempotent: safe to re-run (create ... if not exists, drop policy if exists, grants are repeatable).
-- Production: applied by the owner only.

create table if not exists public.portia_editor_notes (
  tab text primary key check (tab in ('guide', 'broadcasts', 'search')),
  notes jsonb not null default '{}'::jsonb check (jsonb_typeof(notes) = 'object'),
  revision integer not null default 1 check (revision >= 1),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

alter table public.portia_editor_notes enable row level security;
revoke all on table public.portia_editor_notes from anon, authenticated;
grant select, insert on table public.portia_editor_notes to authenticated;
grant update (notes, revision, updated_at, updated_by) on table public.portia_editor_notes to authenticated;
grant all on table public.portia_editor_notes to service_role;

drop policy if exists "Editors can read their tab notes" on public.portia_editor_notes;
create policy "Editors can read their tab notes"
on public.portia_editor_notes for select
to authenticated
using ((select public.portia_can_edit_tab(tab)));

drop policy if exists "Editors can create their tab notes" on public.portia_editor_notes;
create policy "Editors can create their tab notes"
on public.portia_editor_notes for insert
to authenticated
with check (
  (select public.portia_can_edit_tab(tab))
  and (updated_by is null or updated_by = (select auth.uid()))
);

drop policy if exists "Editors can update their tab notes" on public.portia_editor_notes;
create policy "Editors can update their tab notes"
on public.portia_editor_notes for update
to authenticated
using ((select public.portia_can_edit_tab(tab)))
with check (
  (select public.portia_can_edit_tab(tab))
  and (updated_by is null or updated_by = (select auth.uid()))
);
