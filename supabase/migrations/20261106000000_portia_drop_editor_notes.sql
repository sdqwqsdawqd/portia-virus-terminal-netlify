-- PORTIA: drop the private editor notes store (Phase 20, plan 20-33). Forward-only.
--
-- Why: the owner removed editor notes from the product on 2026-11-06. The editor no longer reads or writes notes and the
-- /api/content/notes route is gone, so public.portia_editor_notes has no caller. 20261104000100 created it; that migration
-- stays in history because it was applied on the isolated staging project.
--
-- What it drops: the table public.portia_editor_notes. Its three policies, grants, primary key, check constraints and its
-- foreign key to auth.users go with it.
-- Nothing else depends on it: no view, function, trigger or foreign key refers to the table. public.portia_can_edit_tab is
-- kept: other policies use it.
-- Idempotent: safe to re-run (drop ... if exists). On a database where 20261104000100 was never applied it does nothing.
-- Data: the stored notes are deleted with the table. They were private editor notes only, never part of public content.
-- Production: applied by the owner only.

drop table if exists public.portia_editor_notes;
