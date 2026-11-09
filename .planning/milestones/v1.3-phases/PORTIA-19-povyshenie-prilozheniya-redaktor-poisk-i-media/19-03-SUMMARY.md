---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 03
subsystem: testing
tags: [acceptance, staging, promotion, roster, supabase, wrapper]
requires:
  - phase: 16
    provides: guarded staging wrapper (resolveStagingTarget, redact, StagingError) and the live harness (createRun, purge)
  - phase: 19-01
    provides: owner verdicts (item 1 = A, item 2 = A) in 19-OWNER-DECISIONS.md
provides:
  - stagingRosterPath / loadStagingRoster (temporary roster visible only to an isolated-project app)
  - acceptance-seed | acceptance-shift | acceptance-residual | acceptance-teardown subcommands of the Phase 16 wrapper
  - purgeRun / residualOf exports in the staging harness
  - manifest schema portia-acceptance-run-v1
affects: [19-06 live seed and owner acceptance, 19-07 concurrency]
status: complete
actuals:
  tokens: 17000
  tasks: 3
  commits: 4
plan_head_before: c567ee6613751f417c0c56622e59010b8771fc9c
plan_head_after: 64495c8f9103df4a5143743bf249192545dda126
tech-stack:
  added: []
  patterns:
    - "Env-guarded second data source: the guard is a pure function of an env object, repeated from the e2e target guard because production code must not import test support"
    - "Acceptance functions take an already resolved target plus injected deps (createClient, fs, tmpdir, out/err), same style as phase16-staging.mjs"
key-files:
  created:
    - lib/portia-promotion-staging-roster.ts
    - lib/portia-promotion-staging-roster.test.ts
    - scripts/phase19-acceptance.mjs
    - lib/phase19-acceptance.test.ts
  modified:
    - lib/portia-promotion-sheet.ts
    - scripts/phase16-staging.mjs
    - tests/e2e/fixtures/staging-harness.ts
key-decisions:
  - "Guard for the staging roster: variable set, CONTEXT != production, host exactly <20-char ref>.supabase.co, ref in the isolated list, non-empty production list that does not contain the ref; anything else returns null and the live Google Sheet is used."
  - "A missing roster file is unavailable/network and a broken one is invalid-source; the live table is never a fallback while the guard holds."
  - "Run window = rows with created_at/updated_at >= manifest.createdAt on the isolated project; banks are also tracked by id. cleanup records the keys of the buckets it ages, because aging moves them out of the window."
  - "Requirements STAB-PROM-01/13/15 are NOT marked complete: this plan only builds tooling; the live proof is 19-06 and the concurrency proof is 19-07."
requirements-completed: []
coverage:
  - id: D1
    description: "stagingRosterPath returns a path only on an isolated, non-production project (13 cases incl. the 7 required)"
    requirement: STAB-PROM-01
    verification:
      - kind: unit
        ref: "lib/portia-promotion-staging-roster.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "loadPromotionRoster / loadPromotionAccessRoster read only roster.json when the guard holds (no fetch); invalid and missing file mapped as specified"
    requirement: STAB-PROM-01
    verification:
      - kind: unit
        ref: "lib/portia-promotion-staging-roster.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "acceptance-seed makes a marked run (reviewer with promo, editor without, 6 participants, ordinary + 3 qualification banks), refuses an existing bank, never prints or stores secrets in the repo"
    requirement: STAB-PROM-15
    verification:
      - kind: unit
        ref: "lib/phase19-acceptance.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "acceptance-shift moves only dates of this run (roster, buckets in window, attempts of run requests); bad kind or run id exits 2 with no DB call"
    requirement: STAB-PROM-15
    verification:
      - kind: unit
        ref: "lib/phase19-acceptance.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "acceptance-residual is read-only; acceptance-teardown deletes only run and window rows, leaves foreign rows, and exits 1 on any leftover"
    requirement: STAB-PROM-15
    verification:
      - kind: unit
        ref: "lib/phase19-acceptance.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Against a real isolated Supabase project (RLS, real RPCs, real app on LAN)"
    requirement: STAB-PROM-13
    verification: []
    human_judgment: false
    rationale: "BLOCKED until 19-06 (live seed on staging) and 19-07 (concurrency). Fake clients prove the logic only; nothing here was run against Postgres."
---

# Phase 19 Plan 03: Acceptance tooling for the Promotion flow Summary

**Env-guarded temporary promotion roster for a staging-bound app, plus acceptance-seed / shift / residual / teardown subcommands of the guarded Phase 16 wrapper, proven on fake clients only.**

## What was built

- `lib/portia-promotion-staging-roster.ts`: `stagingRosterPath(env)` (pure guard) and `loadStagingRoster(path)` (JSON `{ access, promotion }` parsed by the existing `accessRosterFromRows` / `promotionRosterFromRows`). `lib/portia-promotion-sheet.ts` asks the guard first in `loadPromotionAccessRoster` and `loadPromotionRoster`; the rest of the sheet logic is unchanged. No file in `components/` imports either module.
- `scripts/phase19-acceptance.mjs`:
  - `acceptanceSeed`: preexisting-bank check first (code `acceptance-preexisting-bank`, nothing created), then `createRun`, reviewer (`granted_tabs ["promo"]`) and editor (no promo), 6 participants as roster rows `${prefix}_<label>`, ordinary bank `trainee` with 5 items, qualification banks for the 3 transitions with 3 single, 2 multiple, 2 free-text active questions and options. Writes `roster.json` and `credentials.json` (mode 0600) to `<tmpdir>/portia-acceptance-<runId>/` and the manifest to `evidence/19-ACCEPTANCE-RUN.json`. stdout carries runId, nicknames and paths only. A failure mid-seed removes what the call created.
  - `acceptanceShift`: `cooldown`, `rank` (roster only), `penalty`, `cleanup` (aged past the 3-day prune rule, keys remembered), `deadline`, `retake` (attempts of run requests). Bad kind / run id / arguments return 2 before any DB call. Rules and durations in code and SQL are untouched (D-03).
  - `acceptanceResidual`: read-only; harness counters plus `banks`, `buckets`, `attempts`, `answers`.
  - `acceptanceTeardown`: `purgeRun` (attempt children first), banks by manifest id and by window (cascade to items, questions, options), buckets in window and shifted keys, then residual. Every step runs even if one fails; any error or non-zero counter gives exit 1; temp files are removed only on a clean result.
- `scripts/phase16-staging.mjs`: the four subcommands, each after `resolveStagingTarget`, with stdout/stderr passed through `redact`; usage line extended.
- `tests/e2e/fixtures/staging-harness.ts`: `purgeRun(live, runId, deps?)` returning `{ deleted, errors }` and `residualOf(live, runId, deps?)`, both throwing `unsafe-live-run-id` on a malformed id before building a client.

## Verification

- `npm test`: 933 tests, 0 failures (3 pre-existing skips). New files: 18 tests for the roster, 12 for acceptance.
- `npm exec tsc -- --noEmit`: clean. `npm run lint`: 0 errors (18 pre-existing warnings). `npm run build`: passes. `git diff --name-only -- supabase/`: empty.
- No live staging command was run (live seed is 19-06).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Production-import boundary tripped by a comment**
- **Found during:** Task 1
- **Issue:** `lib/e2e-import-boundary.test.ts` greps production files for the text `tests/e2e`; my explanatory comment in the new module named that path.
- **Fix:** reworded the comment to avoid the path.
- **Commit:** 628195f

### Process notes (not code deviations)

- Task 3 behaviour (residual/teardown) was implemented inside the Task 2 module because seed, shift, residual and teardown share manifest and helper code. The Task 2 commit (8b5a83b) therefore contains that code with only the seed/shift tests; the Task 3 tests were committed separately (64495c8) and passed on first run, so Task 3 has no genuine RED commit.
- Plan `must_haves` mention a "test on 7 cases" for the guard; the test file has 13 guard cases (the 7 required plus blank variable, case-insensitive CONTEXT, absent lists, unset URL).

## Known limits

- The run window compares the local clock with DB `created_at`/`updated_at`; seconds of skew are tolerated, banks are also tracked by id (code comment marks the shortcut).
- Window deletion on the isolated project also removes banks/buckets created by anyone in that window, as the plan defines (D-04); foreign rows older than the window stay.
- `portia_promo_attempt_questions` / `portia_promo_answers` are counted for run requests only; the schema's own cascades handle the rest.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-19-06 (guard, 13 tests), T-19-07 (prefix/marker/manifest/window only, foreign-rows test), T-19-08 (stdout and manifest checked against run secrets, passwords only in the OS temp file), T-19-09 (every acceptance-* resolves the target first) are all mitigated and covered by tests.

## Self-Check: PASSED

- Files exist: lib/portia-promotion-staging-roster.ts, lib/portia-promotion-staging-roster.test.ts, scripts/phase19-acceptance.mjs, lib/phase19-acceptance.test.ts (checked below).
- Commits a4f607d, 628195f, 8b5a83b, 64495c8 are ancestors of HEAD.
