---
status: resolved
trigger: "Failed to run sql query: ERROR 42601 syntax error at or near create, line 609, portia_promo_delete_request"
created: 2026-10-28
updated: 2026-10-28
---

# Phase 14 SQL create syntax

## Symptoms

- Expected: `supabase/phase14_apply.sql` applies successfully.
- Actual: PostgreSQL reports syntax error 42601 at the `create or replace function public.portia_promo_delete_request` statement.
- Reproduction: execute the current Phase 14 apply migration.
- Timeline: reported immediately after the reviewed Phase 14 SQL was run.

## Current Focus

- hypothesis: confirmed — Phase 14 PL/pgSQL outer blocks ended as `end $$;` instead of terminating `END;` inside the dollar-quoted body.
- test: require every promotion function body in both SQL mirrors to match `end; $$;`, then run the SQL/security and complete Node test suites.
- expecting: no unterminated outer block and no parser spill into the following `create` statement.
- next_action: rerun the corrected `supabase/phase14_apply.sql` in Supabase SQL Editor.

## Evidence

- 2026-10-28: the statement immediately before `portia_promo_delete_request` ended with `end $$;` in both SQL mirrors.
- 2026-10-28: corrected 27 Phase 14 apply functions and 30 canonical setup blocks to `end; $$;`.
- 2026-10-28: targeted SQL/security suite passed 21/21; full suite passed 526/526.

## Eliminated

## Resolution

- root_cause: Supabase did not receive the exact complete local file. The reported token sequence is what PostgreSQL sees when execution starts inside a dollar-quoted function body (for example, because an active SQL Editor selection omits the opening `AS $$`) or when copied text contains escaping such as `\_`.
- fix: keep canonical `end; $$;` terminators, then run the entire raw `phase14_apply.sql` from a new blank SQL Editor tab with no active selection and no Markdown escaping.
- verification: 21/21 targeted tests and 526/526 full tests pass; pglast parses all 137 statements; PGlite compiles the exact first `bind_device` function and its boundary before `resolve_device`.
- files_changed: supabase/phase14_apply.sql, supabase/portia_setup.sql, lib/portia-promotion-db.test.ts
