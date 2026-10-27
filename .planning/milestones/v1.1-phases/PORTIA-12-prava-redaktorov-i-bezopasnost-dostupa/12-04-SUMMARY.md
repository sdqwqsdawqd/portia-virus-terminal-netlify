---
phase: PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa
plan: 04
subsystem: sql-owner-apply
tags: [security, sql, rls, confirmed-email, tab-permissions, photo-check]
requires:
  - "12-03 (isLocalMediaPath rule, mirrored by the SQL photo_url CHECK)"
provides:
  - "supabase/phase12_apply.sql: one owner file, STEP 0-4 (dashboard setting, preflight, guarded apply, validate, check, rollback)"
  - "supabase/portia_setup.sql: fresh-install end state of phase 12 in one run"
affects: [12-01 (confirmed-email gate in code), 12-05, 12-06, 12-07, 12-08 (owner runs the file)]
tech-stack:
  added: []
  patterns: [guard-first SQL (abort before any tightening), NOT VALID constraint then separate VALIDATE, column-level UPDATE grant]
key-files:
  created:
    - supabase/phase12_apply.sql
  modified:
    - supabase/portia_setup.sql
    - lib/portia-sql.test.ts
    - .planning/PROJECT.md
key-decisions:
  - "STEP 2 aborts by itself when the owner email is not confirmed; unconfirmed editors do not abort it"
  - "photo_url CHECK is added NOT VALID in STEP 2 and validated only in STEP 2b, so old bad rows cannot abort the apply"
  - "Only the owner changes closed_tabs/granted_tabs (column-level UPDATE grant plus owner-only policy)"
  - "portia_content and storage policies are left unchanged (D-11); the risk is accepted and recorded as T-12-14 in PROJECT.md Known Limitations"
owner_confirmed: true
status: complete
commits: 2
plan_head_before: 32605554b9c3562e30e69c4dba2b0b6ad6319599
plan_head_after: 41513ef1ca97b419decd2a62535dd8b6c810b663
requirements-completed: [SEC-02, CONT-09, PERM-01, PERM-02, PERM-04]
actuals:
  tokens: 9400
  tasks: 3
  commits: 2
completed: 2026-10-26
---

# Phase 12 Plan 04: owner SQL apply file and setup parity Summary

The owner gets one SQL file with a read-only preflight, a guarded apply, a validate step, an after-check and a rollback, and a fresh install reaches the same end state in a single run of `portia_setup.sql`.

## What was built

- `supabase/phase12_apply.sql` (317 lines): STEP 0 note about dashboard «Confirm email», STEP 1 read-only preflight (owner and every editor with `has_account` and `confirmed`, plus photo_url rows that break the new rule), STEP 2 apply inside begin/commit with the owner-confirmed guard first, STEP 2b `VALIDATE CONSTRAINT` for the photo CHECK, STEP 3 after-check, STEP 4 rollback inside begin/commit.
- After STEP 2: `portia_is_owner` and `portia_can_edit` are true only for a confirmed email with no owner exception; `portia_editors` has `closed_tabs` and `granted_tabs` (`text[] not null default '{}'`); employee profile and manual employee writes require `portia_can_edit_tab('employees')`.
- `supabase/portia_setup.sql`: the same end state for a fresh install, with a guard so a re-run cannot lock out a confirmed or account-less owner.
- `lib/portia-sql.test.ts`: 142 added lines of text-level checks on both SQL files (order of guard vs. tightening, NOT VALID before VALIDATE, no change to `portia_content` or storage policies, setup parity).
- `.planning/PROJECT.md`: Known Limitations entry for the T-12-14 risk (any approved editor can write a closed `portia_content` section straight through Supabase).

## Task 3: owner preflight (checkpoint:human-action, resolved)

The owner ran STEP 1 (a) in Supabase project `wqiyghssdulzsbshjtur` and returned (emails shortened to first letter + domain):

| role   | email        | has_account | confirmed |
| ------ | ------------ | ----------- | --------- |
| owner  | q…@gmail.com | true        | true      |
| editor | d…@gmail.com | true        | true      |
| editor | o…@gmail.com | true        | true      |

- Owner row confirmed = true, so the lockout gate is open: `owner_confirmed: true` (also in the frontmatter).
- Unconfirmed editors: 0, no decision needed.
- STEP 1 (b), the bad-photo row count: pending, re-checked in 12-08 step B.
- Whether dashboard «Confirm email» is switched on: pending, re-checked in 12-08 step B.

## Incident (no code change)

The owner first ran the preflight queries in a different, empty Supabase project. Result: `function public.portia_owner_email() does not exist`, then empty catalog results. After switching to project `wqiyghssdulzsbshjtur`, query (a) worked. No SQL was applied anywhere. Note for 12-08: the owner instructions must tell the owner to confirm the project ID `wqiyghssdulzsbshjtur` in the dashboard URL before running STEP 2.

## Verification

- Commits 783a903 and 41513ef exist on design/stage-1-desktop; `git rev-list --count` from the ledger base gives 2.
- SQL text tests in `lib/portia-sql.test.ts` cover both files (run in the task commits).
- The SQL itself was NOT executed against a database by the executor; the owner applies it in 12-08.

## Deviations from Plan

**1. [Rule 1 - Bug] Setup guard for fresh installs**
- **Issue:** on a fresh install `portia_owner_email()` and related functions do not exist yet, so a plain guard call fails.
- **Fix:** the setup guard uses `to_regprocedure` and a dynamic `execute`; carries a `shortcut:` comment with the limit.
- **Files modified:** supabase/portia_setup.sql
- **Commit:** 41513ef

**2. [Plan detail] STEP 3 is one combined query**
- STEP 3 is a single `check_name / expected / actual` query plus a separate owner-row query, instead of many small ones, so the owner reads one table.
- **Files modified:** supabase/phase12_apply.sql
- **Commit:** 783a903

**3. [Rule 2 - Missing coverage] Regex parity test**
- Added a test comparing the SQL photo regex with `isLocalMediaPath` on 13 samples, so the SQL CHECK cannot drift from the 12-03 rule.
- **Files modified:** lib/portia-sql.test.ts
- **Commit:** 783a903

**4. [Ordering] Setup-parity tests landed in Task 2's commit**
- The tests for `portia_setup.sql` were committed together with the setup file (41513ef), not as a separate step.

## Auth gates

Task 3 was a `checkpoint:human-action` (owner runs a SQL query in the Supabase dashboard). It is normal flow, not a deviation; resolved as described above.

## Known Stubs

None.

## Threat Flags

None. T-12-14 (editor writes a closed `portia_content` section directly) is accepted and recorded in PROJECT.md Known Limitations.

## Self-Check: PASSED

- supabase/phase12_apply.sql, supabase/portia_setup.sql, lib/portia-sql.test.ts exist; PROJECT.md Known Limitations carries the D-11 risk entry (in Russian, without the literal id T-12-14).
- Commits 783a903 and 41513ef are on design/stage-1-desktop.
