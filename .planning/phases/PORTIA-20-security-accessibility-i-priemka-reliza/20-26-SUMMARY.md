---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 26
subsystem: security-matrix
tags: [security-matrix, route-coverage, migration-coverage, freshness, stab-prom-05, gap-closure]
requires: []
provides:
  - 20-SECURITY-MATRIX.md at commit b88669f - 12 routes, 5 migrations, covered-file list, out-of-plan commits, findings SEC20-18..SEC20-25
  - routeCoverageProblems, migrationCoverageProblems, matrixFreshnessProblems in lib/security-matrix.test.ts (git-backed, fail-closed, with rejecting fixtures)
  - six "97d7abb" tests in lib/portia-promotion-reviewer.test.ts (preview refusal, route preview/confirm source, static SQL read, version bump)
affects: [20-27, 20-28, 20-29, 20-30, 20-31, 20-13, 20-15]
actuals:
  tokens: 21000
  tasks: 3
  commits: 4
plan_head_before: 42de5a48de2bccb5b5bb10c634f2d8162258ee8e
plan_head_after: d818e7800a0e548686204713e51020aedd832a4a
tech-stack:
  added: []
  patterns: [matrix coverage checked against git ls-files, matrix freshness checked against git diff of a listed path set, static SQL read pinned by regex tests labelled "static SQL read"]
key-files:
  created: []
  modified:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-SECURITY-MATRIX.md
    - lib/security-matrix.test.ts
    - lib/portia-promotion-reviewer.test.ts
key-decisions:
  - "97d7abb is intentional and has no bypass: the route was NOT changed. Evidence is listed under Accomplishments (Task 2)."
  - "Matrix commit is b88669fb7d92dbf22d66ac6d7bb9a1b011195956 (HEAD after Task 2). Later plans that touch any path in the matrix section Охват файлов make lib/security-matrix.test.ts fail with stale matrix until the matrix is reviewed and the commit is updated."
  - "Notes-store MEDIUM-4 is a medium in the release ledger (SEC20-18); LOW-1..3 are SEC20-19..21 recorded. No severity was lowered. No high finding exists."
  - "Production apply of 20261104000000 and 20261104000100 is ОЖИДАЕТ ВЛАДЕЛЬЦА in the matrix (a test asserts the production cell never contains PASS). Live notes RLS is BLOCKED (OWNER/ENV); staging confirm with a short bank is BLOCKED (ENV)."
requirements-completed: []  # plan requirements: STAB-SEC-05, STAB-EDIT-04, STAB-CLASS-03. Left open on purpose: 20-31 changes STAB-SEC-05 status by this plan's test; the owner-gated production applies keep STAB-EDIT-04 and STAB-CLASS-03 open.
duration: ~32 min
completed: 2026-11-04
status: complete
coverage:
  - id: D1
    description: "Matrix route table has exactly one row for each of the 12 tracked app/api routes, including /api/content/notes; a missing or unknown row fails"
    requirement: STAB-SEC-05
    verification:
      - kind: unit
        ref: "lib/security-matrix.test.ts :: route coverage (real matrix, git failure, three fixtures)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Matrix migration table has exactly the 5 tracked migrations; freshness check fails with stale matrix when a covered file changed after the verified commit"
    requirement: STAB-SEC-05
    verification:
      - kind: unit
        ref: "lib/security-matrix.test.ts :: migration coverage, matrix freshness (real matrix + fixtures: changed file, not an ancestor, missing commit, empty coverage)"
        status: pass
    human_judgment: false
  - id: D3
    description: "97d7abb keeps STAB-PROM-05 at code and static-SQL level: insufficient pool gives no preview, confirm needs a current-version token and active items, SQL compares counts"
    requirement: STAB-PROM-05
    verification:
      - kind: unit
        ref: "lib/portia-promotion-reviewer.test.ts :: six tests named 97d7abb (25 pass, 0 fail)"
        status: pass
    human_judgment: true
    rationale: "Static SQL read is not a Postgres PASS; a live confirm with a short bank on staging is BLOCKED (ENV) and needs the owner."
  - id: D4
    description: "New findings recorded with severity and status; every new medium is in the release ledger"
    requirement: STAB-SEC-05
    verification:
      - kind: unit
        ref: "lib/security-matrix.test.ts :: the real matrix is non-empty, structurally valid; D-09; D-12 (45 matrix-file tests pass)"
        status: pass
    human_judgment: false
---

# Phase 20 Plan 26: Security matrix at current HEAD and the 97d7abb investigation Summary

**The security matrix now describes the shipped tree (12 routes, 5 migrations, 8 new findings) and a git-backed test fails on any unlisted route, migration or changed covered file; the removed save-time pool check in 97d7abb was proven not to open a way to confirm an insufficient bank, so the bank route is untouched.**

## Performance

- **Duration:** ~32 min
- **Tasks:** 3 of 3 (Task 1 tracer)
- **Files:** 3 modified, 0 created

## Accomplishments

- **Task 1 (tracer).** Precondition held: `git ls-files app/api` prints 12 `route.ts` paths, exit 0. Added section «Маршруты API (охват)» to the matrix (method list, rights check, no-store, findings, last commit per route; `/api/content/notes` included) and `routeCoverageProblems` against `git ls-files app/api`. A failing git throws instead of returning an empty list. Tests: the real matrix, a git failure, a complete fixture, a fixture without the notes row (rejected with `missing route row: app/api/content/notes/route.ts`), an unknown row, a duplicate row. Tracer verify passed end to end before expansion (commit b7079c0).
- **Task 2 (97d7abb).** The change deleted the 409 `insufficient-pool` on `save-task-bank` and `save-qualification-bank` (quick 261104-lkn: allow saving counts before the pool is filled). Result: **the change is intentional, no bypass found; `app/api/promotion/banks/route.ts` was not modified.** Evidence, all pinned by six tests named `97d7abb`:
  1. `selectTaskPreview` and `selectQualificationPreview` throw `insufficient-pool` when the active pool (per type for qualification) is short; hand-picked sets cannot pad it (wrong length, inactive row, duplicate are refused).
  2. The route maps the throw to 409 "Недостаточно активных элементов." and creates the preview token only after the pool-checked selection.
  3. Confirm calls `verifyPreviewToken` with the current `bank.version`, requires every id to be an active item of that bank (else 409 `stale-preview`) and passes `p_bank_version` to the RPC.
  4. Static SQL read: `portia_promo_confirm_assignment` compares `jsonb_array_length(p_items)` with `required_count`, `portia_promo_confirm_test` compares `jsonb_array_length(p_questions)` with the quota sum, both match the version `md5(updated_at, max(item.updated_at))` and join only active items of the bank, and both re-count inserted rows.
  5. Static SQL read: `save-task-bank`, `save-qualification-bank`, item save and delete all set `updated_at = now()`, which changes the version; a token built for count 2 stops verifying at count 3 (tested with the real token functions). The version expression in `portia_promo_bank_state` equals the one the confirm functions check.
  6. The two legacy confirm overloads that could skip bank and version checks are dropped by `20261101000200` (production postflight, Phase 16).
  The existing test "bank route settles commands only with an authoritative state…" passes unchanged. The new tests were green at once because they describe existing behavior (evidence, not a RED/GREEN cycle; no `test()` commit separate from GREEN exists because no GREEN code was needed). One note outside 97d7abb, recorded in SEC20-23: a reviewer with the promo tab can call the confirm RPC directly without the route; count and version checks stay in SQL, but duplicate ids are, by static reading, filtered only by the route (commit b88669f).
- **Task 3.** The matrix header now names commit `b88669fb7d92dbf22d66ac6d7bb9a1b011195956`. Added: «Миграции (охват)» (5 rows with purpose, RLS/grants, reviewer, staging, production), «Охват файлов» (13 paths), «Изменения вне планов после f25b885» (97d7abb, 2f54ba9, 23c1c85, 7e5e17a). Findings SEC20-18 (notes table schema drift, medium, release-ledger), SEC20-19..21 (notes LOW-1..3, low), SEC20-22 (class migration U+0301/NBSP, low), SEC20-23 (97d7abb, info), SEC20-24 (assistant GIF preload leaks visitor IP to third-party hosts, low), SEC20-25 (section key rights T-20-31, info, PASS-local by `lib/editor-outline.test.ts`). SEC20-18 is in «Релизный реестр (D-09)». «Не доказано» gained live notes RLS (BLOCKED OWNER/ENV), staging confirm with a short bank (BLOCKED ENV) and the class-migration staging limitation. `migrationCoverageProblems` and `matrixFreshnessProblems` (commit exists, ancestor of HEAD, `git diff --name-only <commit> HEAD -- <covered paths>` empty) were added with rejecting fixtures; the production cells of the two 20261104 migrations are asserted to be «ОЖИДАЕТ ВЛАДЕЛЬЦА» and never PASS. `node scripts/phase20-audit-check.mjs --verify` printed «dependency audit evidence verified» (lockfile unchanged, no `--capture` needed) (commit d818e78).

## Task Commits

1. Task 1: `b7079c0` test(20-26): route coverage
2. Task 2: `b88669f` test(20-26): 97d7abb keeps STAB-PROM-05
3. Task 3: `d818e78` docs(20-26): security matrix at current HEAD
4. Not mine: `1b2a4e5` docs(20-25): record owner acceptance of waiver PW-07 landed between my Task 1 and Task 2; it is counted in `commits: 4` because the count is measured from the ledger.

## Acceptance Criteria

- `grep -c "app/api/content/notes/route.ts"` on the matrix: 1 or more (PASS, was 0).
- `grep -c "route coverage" lib/security-matrix.test.ts`: 8 (PASS, was 0).
- `grep -c "97d7abb" lib/portia-promotion-reviewer.test.ts`: 9 (PASS, was 0).
- SEC20 finding rows: 25 (PASS, needed 21; was 17).
- `20261104000100_portia_editor_notes.sql` in the matrix: 3; `97d7abb`: 5 (PASS).
- Production cells of both 20261104 migrations contain «ОЖИДАЕТ ВЛАДЕЛЬЦА» (PASS, asserted by a test).
- Fixture «covered file changed after verified commit» is rejected with `stale matrix: <file> changed since <commit>` (PASS).

## Verification

- `node --experimental-strip-types --test lib/security-matrix.test.ts lib/portia-promotion-reviewer.test.ts`: 70 tests, 0 fail.
- `node scripts/phase20-audit-check.mjs --verify`: «dependency audit evidence verified», exit 0.
- `npm.cmd test`: 1354 tests, 1350 pass, 0 fail, 4 skipped (the skips existed before this plan).
- `npm.cmd exec tsc -- --noEmit`: exit 0, no output.

## Deviations from Plan

None - plan executed exactly as written. The route was left unchanged because no bypass was found (the plan's own "no bypass" branch).

## Issues Encountered

- A first attempt to append tests through a shell heredoc failed on quoting; the tests were written to a scratchpad file and appended. No effect on the repository.
- `lib/security-matrix.test.ts` now fails with `stale matrix` after any later change to a path listed in «Охват файлов». Plans 20-27..20-31 that touch those paths must update the matrix and its commit in the same plan.

## Known Stubs

None.

## Threat Flags

None. No new network endpoint, auth path or schema was introduced by this plan.

## Authentication Gates

None.

## Owner-gated and BLOCKED items (not passes)

- Production apply of `20261104000000_portia_rename_virus_classes.sql` and `20261104000100_portia_editor_notes.sql`: ОЖИДАЕТ ВЛАДЕЛЬЦА.
- Live RLS of `portia_editor_notes`: BLOCKED (OWNER/ENV), the migration is not applied anywhere.
- Staging confirm with an insufficient bank: BLOCKED (ENV); only code, tests and static SQL read.
- STAB-SEC-05, STAB-EDIT-04, STAB-CLASS-03 were not marked complete here (20-31 sets STAB-SEC-05 by the test result; the other two depend on owner applies).

## Next Phase Readiness

Ready for 20-27. Any later plan that changes `app/api`, `supabase/migrations`, `proxy.ts`, `next.config.ts`, `lib/supabase`, `lib/editor-access.ts`, `lib/editor-notes.ts`, `lib/editor-outline.ts`, `lib/portia-device-binding.ts`, `lib/portia-promotion-api.ts`, `lib/portia-promotion-reviewer.ts`, `lib/image-upload.ts` or `app/owner-login/actions.ts` must refresh the matrix commit.

## Self-Check: PASSED

Files found: this SUMMARY, lib/security-matrix.test.ts, lib/portia-promotion-reviewer.test.ts, 20-SECURITY-MATRIX.md. Commits found as ancestors of HEAD: b7079c0, b88669f, d818e78. app/api/promotion/banks/route.ts is not in the diff since the plan start.
