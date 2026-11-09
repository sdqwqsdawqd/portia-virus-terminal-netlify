---
phase: PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal
plan: 04
subsystem: database
tags: [supabase, security-definer, site-closure-flag, expected-authz, migration-replay, offline-contract-tests]

requires:
  - phase: PORTIA-21 plan 01
    provides: access tables, submit/resolve/decide RPCs, store wrappers, pinned migration
  - phase: PORTIA-21 plan 03
    provides: decision rules, append-only journal, owner-only cooldown clear
provides:
  - owner-only site-closure flag (row 'main' of portia_access_settings, OFF by default) with last-change metadata
  - portia_access_closure_enabled (anon/authenticated read) and portia_access_set_closure (owner-required)
  - isClosureEnabled / setClosure store wrappers
  - expected-authz matrix and its offline test covering every migration in order (24 effective tables, effective functions)
  - role decisions for 12 portia_access_* functions and 4 RPC-only portia_access_* tables
  - migrations-wide search_path and revoke-before-grant checks
affects: [21-05, 21-07, PORTIA-23, PORTIA-25]

requirements-completed: [ACC-09, USR-05]

actuals:
  tokens: 40000
  tasks: 2
  commits: 3
plan_head_before: 7e6e54bbe075a0027466989d14d57e9103c4673d
plan_head_after: 096d0de4891f2adf765a178c892c6660b2aa44bb

tech-stack:
  added: []
  patterns:
    - "single-row settings table pinned by a check constraint (id = 'main'), RPC only, upsert with updated_at/updated_by"
    - "authz test replays all migrations in order (create/drop/grant/revoke) and judges the matrix against the final state"
    - "matrix.migrations acknowledges every migration file; a new migration cannot land unnoticed"

key-files:
  created:
    - lib/access-closure.test.ts
  modified:
    - supabase/migrations/20261109000000_portia_access_foundation.sql
    - lib/access-store.ts
    - lib/portia-canonical-parity.test.ts
    - lib/access-foundation.test.ts
    - lib/access-decisions.test.ts
    - lib/phase16-expected-authz.test.ts
    - tests/e2e/fixtures/data/expected-authz.json
    - lib/portia-staging-live.test.ts
    - lib/portia-sql.test.ts

key-decisions:
  - "Function grants are replayed per signature (name plus argument types), not per name, so overloads cannot mask each other"
  - "Matrix cell sources point at lines of the access migration; moving those lines (21-05 edits the same file) means regenerating the cells with the same rule"
  - "Flag toggles stay out of the people journal: no new journal event type, the row keeps only the last change (D-07 owner choice 2b, D-08)"

patterns-established:
  - "Every Phase 21 plan that adds a portia_* function or table adds its matrix entries in the same change, and the replay test fails otherwise"

coverage:
  - id: D1
    description: "ACC-09 / D-05: the flag is row 'main', created OFF, only the owner changes it; editor, outsider and anon are refused"
    requirement: ACC-09
    verification:
      - kind: unit
        ref: "lib/access-closure.test.ts#T-21-19 / D-05 set_closure: owner-only first statement, null is invalid, upsert with last-change metadata"
        status: pass
      - kind: unit
        ref: "lib/access-closure.test.ts#ACC-09 / D-05 the flag is row 'main' of portia_access_settings, created OFF and never flipped by a re-run"
        status: pass
    human_judgment: true
    rationale: "Offline SQL text and stub-client checks only; Postgres/RLS execution is BLOCKED until an isolated staging run (21-07)"
  - id: D2
    description: "ACC-09: requests are collected whether the flag is OFF or ON, and no product code reads the flag"
    requirement: ACC-09
    verification:
      - kind: unit
        ref: "lib/access-closure.test.ts#ACC-09 requests are collected whether the flag is OFF or ON: submit never reads the flag"
        status: pass
      - kind: unit
        ref: "lib/access-closure.test.ts#ACC-09 the site behaves as before: no product code reads the flag in Phase 21"
        status: pass
    human_judgment: false
  - id: D3
    description: "D-08 / D-07: last-change metadata on the row; toggles not journaled"
    verification:
      - kind: unit
        ref: "lib/access-closure.test.ts#D-08 / D-07 flag toggles carry updated_at and updated_by and are NOT written to the people journal"
        status: pass
    human_judgment: false
  - id: D4
    description: "USR-05 parity / T-21-22: matrix covers every effective function and table of all migrations, cells agree with effective grants, new migrations must be acknowledged"
    requirement: USR-05
    verification:
      - kind: unit
        ref: "lib/phase16-expected-authz.test.ts#function set in the matrix equals the effective create or replace function public.portia_* of all migrations"
        status: pass
      - kind: unit
        ref: "lib/phase16-expected-authz.test.ts#function cells agree with the effective grant/revoke state of all migrations"
        status: pass
      - kind: unit
        ref: "lib/phase16-expected-authz.test.ts#matrix header lists the six roles, the supported placeholders and every migration file"
        status: pass
    human_judgment: true
    rationale: "Cells are derived from SQL text, not from observed behaviour; the live role run is BLOCKED until an isolated staging run"
  - id: D5
    description: "RPC-only access tables and inert live probes; migrations-wide search_path and revoke-before-grant"
    verification:
      - kind: unit
        ref: "lib/phase16-expected-authz.test.ts#RPC-only tables (portia_promo_*, portia_access_*): RLS on, every privilege revoked, no grant and no policy, so every role gets 42501"
        status: pass
      - kind: unit
        ref: "lib/phase16-expected-authz.test.ts#Phase 21 access functions are inert in a live run: they create no rows and every nickname probe is invalid"
        status: pass
      - kind: unit
        ref: "lib/portia-sql.test.ts#every function created after the baseline is revoked from public, anon and authenticated before any grant"
        status: pass
    human_judgment: false

duration: 45min
completed: 2026-11-09
status: complete
---

# Phase 21 Plan 04: Closure flag and authz matrix Summary

**Owner-only site-closure flag (row 'main', OFF by default, last change kept, not journaled) plus an expected-authz test that replays all seven migrations and a matrix with role decisions for all 12 access functions and 4 RPC-only access tables**

## Performance

- **Duration:** about 45 min
- **Completed:** 2026-11-09
- **Tasks:** 2 (Task 1 TDD, RED then GREEN; Task 2 single commit)
- **Files:** 1 created, 9 modified

## Accomplishments

- Migration: table `portia_access_settings` (`id = 'main'` by check constraint, `closure_enabled` default false, `updated_at`, `updated_by`; RLS on, all rights revoked from public/anon/authenticated, no policy), the insert of `('main', false) on conflict (id) do nothing`, `portia_access_closure_enabled()` (stable, definer, `coalesce(..., false)`, anon + authenticated) and `portia_access_set_closure(boolean)` (first statement `owner-required`, null gives `invalid`, upsert with `updated_at = now()` and `updated_by = auth.uid()`, reply `updated` with `enabled` and `updatedAt`; authenticated only). Neither function touches the journal, and `submit` never reads the flag. Header comment records: OFF after apply, ON on production is an owner step in Phase 25, toggles not journaled.
- Store: `accessRpc.closureEnabled`, `accessRpc.setClosure`, `isClosureEnabled` (bare boolean reply, anything else is `unexpected-reply`), `setClosure` (`p_enabled`; `owner-required` surfaces as `AccessStoreError`).
- `lib/phase16-expected-authz.test.ts` now reads every file in `supabase/migrations`, replays create/drop/grant/revoke in version order and compares the matrix with the final state. A created-then-dropped table (`portia_editor_notes`) is absent; effective tables are 24. Sources may point at any migration file line and are read from that file. New checks: `matrix.migrations` equals the sorted file list, grant/revoke statements never refer to an unknown object (orphans), RPC-only rule for 16 promo plus 4 access tables, access probes are inert.
- `expected-authz.json`: `migrations` list (7 files), 12 function entries (kinds: visitor, users-editor, owner-only, internal) and 4 table entries, all cells sourced at exact migration lines. Existing entries (including `portia_promo_register_attempt`), storage and api sections are unchanged (compared with commit b6e5e3d and HEAD).
- `lib/portia-staging-live.test.ts`: `keyOf` treats `portia_access_*` like `portia_promo_*` (static change only). `lib/portia-sql.test.ts`: all migrations checked for no `set search_path = public`, and every post-baseline function is revoked from public, anon and authenticated before any grant.

## Task Commits

1. **Task 1: closure flag (TDD)**
   - RED - `fcfe8f4` (test)
   - GREEN - `ed7059a` (feat)
2. **Task 2: authz parity across all migrations** - `096d0de` (test)

REFACTOR was not needed. STATE.md and ROADMAP.md are left to the orchestrator.

## TDD Evidence (Task 1)

- **RED:** `node --experimental-strip-types --test lib/access-closure.test.ts` exited non-zero with `# tests 9 / # pass 2 / # fail 7`. SQL-contract tests failed because the table and both functions were absent; wrapper tests failed with `Error: not implemented` from throwing stubs (needed so the import and tsc resolve). The two passing tests (submit never reads the flag; no product code reads the flag) hold trivially before the feature. Semantic assessment: failures are for the intended reason (behaviour absent), not import, syntax or fixture faults. The classifier `gsd_run check tdd-red-evidence` was not run (plan type is `execute`).
- **GREEN:** 55/55 across access-closure, access-requests, access-decisions, access-foundation and portia-canonical-parity.

## Verification

- Full unit suite (Node 22.13.1, `node --experimental-strip-types --test lib/*.test.ts`): 1779 tests, 1774 pass, 2 fail, 3 skipped. The 2 failures are the documented red window in `lib/security-matrix.test.ts` ("migration coverage..." and "matrix freshness..."), closed by 21-07. No other failure.
- `node node_modules/typescript/bin/tsc --noEmit` clean. `eslint . --ignore-pattern dist --ignore-pattern .next`: 0 errors (17 pre-existing warnings in untracked visual-candidate files).
- Plan acceptance node checks: migration contains `values ('main', false)` and the `set_closure` signature (exit 0); matrix has 12 access functions and 4 access tables ("12 4", exit 0); `portia_promo_register_attempt` entry equals the one at b6e5e3d (exit 0).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Function-name lists and anon-grant list in earlier tests**
- **Found during:** Task 1 GREEN
- **Issue:** `lib/access-foundation.test.ts` pins the exact list of `portia_access_*` functions, and `lib/access-decisions.test.ts` pins the exact list of functions granted to anon (submit, resolve). The two new functions, one of them readable by anon on purpose, made both fail.
- **Fix:** added `portia_access_closure_enabled` and `portia_access_set_closure` to the first list; added `portia_access_closure_enabled` to the anon list and renamed that test to say so. Neither file was in the plan's `files_modified` (same situation as in 21-03).
- **Files modified:** lib/access-foundation.test.ts, lib/access-decisions.test.ts
- **Commit:** ed7059a

**2. Matrix source lines, not formatting, were the plan's hook for "1-space JSON"**
- The plan says the matrix uses 1-space indentation; the file actually uses 2 spaces. A parse and stringify round trip of the unchanged file reproduces it byte for byte, so the new entries were added through a throw-away generator in the session scratchpad (not in the repo) and no existing entry was reformatted (patience diff: 930 insertions, 2 deletions, the deletions being the changed `generated_from` and the note list comma).

Otherwise the plan was executed as written.

## Issues Encountered

- The project guard blocks the privileged-role keyword in Bash commands; the SQL was added with the Edit tool.
- First draft of the "no product code reads the flag" test matched `setClosureNotice` in `components/portia-editor.tsx` (substring of `setClosure`); fixed with word boundaries.
- Known red window as before: only the two `lib/security-matrix.test.ts` subtests fail until 21-07.

## Notes for the next plans

- The matrix cell sources for the access functions and tables are line numbers of `20261109000000_portia_access_foundation.sql`. 21-05 edits that migration (register_attempt revoke and fingerprint): any edit above a referenced line shifts it, and the replay test then fails on the stale cell (grant/revoke, `'forbidden'`, `'owner-required'` line rules). Regenerate or hand-adjust those cells in the same change. If 21-05 appends below the last referenced line (the end of the file), nothing shifts.
- `lib/portia-staging-live.test.ts` line 305 compares the golden fingerprint keys with the matrix function keys at live-run time; fingerprint coverage of the access functions belongs to 21-05/21-07.
- Migration hash re-pinned in `lib/portia-canonical-parity.test.ts` (`520f3ff2...`); 21-05 must re-pin again.

## Accepted Risks / Owner Acknowledgement

- T-21-20: the open/closed state is readable by any visitor (one boolean, no metadata). T-21-21: who flipped the flag is not journaled (owner choice 2b); the row keeps the last `updated_by` and `updated_at`; revisit in Phase 25 if the owner wants an audit.

## Known Stubs

None. (Throwing store stubs existed only inside the RED commit `fcfe8f4`; the GREEN commit replaced them.)

## Threat Flags

None - the new surface (anon read of one boolean, owner-only write RPC, RPC-only settings table) is the surface described in the plan's threat model (T-21-19..T-21-22).

## User Setup Required

None. The migration is not applied anywhere. Postgres/RLS execution evidence (owner-only refusal for an editor, anon 42501, default OFF after apply) and the live role run of the new matrix cells stay BLOCKED until an isolated staging run (21-07); nothing here is recorded as a pass for runtime behaviour.

## Self-Check: PASSED

- Files exist: lib/access-closure.test.ts, lib/access-store.ts, lib/phase16-expected-authz.test.ts, tests/e2e/fixtures/data/expected-authz.json, lib/portia-sql.test.ts, lib/portia-staging-live.test.ts, supabase/migrations/20261109000000_portia_access_foundation.sql.
- Commits exist: fcfe8f4, ed7059a, 096d0de (ancestors of HEAD).
- Verification: relevant test files green, tsc clean, eslint 0 errors, full suite only the 2 expected failures.

---
*Phase: PORTIA-21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal*
*Completed: 2026-11-09*
