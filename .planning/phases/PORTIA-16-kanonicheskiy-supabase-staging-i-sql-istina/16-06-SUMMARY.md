---
phase: 16-kanonicheskiy-supabase-staging-i-sql-istina
plan: 06
subsystem: testing
tags: [supabase, live-harness, cleanup, receipt, owner-fixture, d4]
requires: [16-03, 16-05]
provides:
  - tests/e2e/fixtures/staging-harness.ts (requireStagingLiveTarget, isStagingLiveInvocation, ownerEmailFromBaseline, createRun, sweep, buildReceipt, assertRedacted, writeReceipt)
  - npm scripts test:staging-live and test:staging-live:tracer
  - lib/phase16-staging-harness.test.ts (21 offline tests on an in-memory fake client)
affects: [16-08, 16-09, 16-12, 16-13]
actuals:
  tokens: 21000
  tasks: 3
  commits: 2
plan_head_before: 904191d3894ac54e5a25468af16ea94a30904297
plan_head_after: 49198eb
commits: 2
tech-stack:
  added: []
  patterns: ["injected createClient/now/random/commit for offline tests", "spec-driven table list shared by cleanup, residual and sweep", "LIKE-escaped prefix filters"]
key-files:
  created:
    - tests/e2e/fixtures/staging-harness.ts
    - lib/phase16-staging-harness.test.ts
  modified:
    - package.json
key-decisions:
  - "Cleanup, residual and sweep share one table/column spec list; sweep only discovers stale runIds (marker, `__portia_live_` prefix, `portia-live-<runId>-` email, storage folder) and runs the same purge per runId, so an unmarked user is never a candidate."
  - "Prefix filters are LIKE-escaped (`_` is a wildcard), covered by a test."
  - "Attempt children (answers, attempt questions, attempts) are removed explicitly by id before qualification requests; also rows tied to run users by reviewer_id/actor_id are removed so auth user deletion is not blocked by FKs."
  - "PASS needs: cleanup ran without errors, residual all zero, at least one suite and every suite PASS. FAIL beats BLOCKED beats SKIP; an empty suite list is BLOCKED."
  - "Storage convention for later plans: objects live under `<run.prefix>/...` in portia-media; promo nickname keys / bucket keys / content ids start with run.prefix."
requirements-completed: [STAB-REL-04, STAB-SEC-01]
status: complete
---

# Phase 16 Plan 06: Live-test harness Summary

A single guarded entry (`requireStagingLiveTarget`), run-marked disposable identities with one sign-in per identity, the D4 owner fixture (canonical email read from the baseline SQL, refusal on an unmarked account), dependency-ordered cleanup with a per-category residual, a stale-run sweep and a redacted `portia-staging-receipt-v1` receipt. Everything is offline: no Supabase contact, no keys, no env files.

## Commits
- 24fbcdc feat(16-06): live-test harness (tasks 1-3 code: guard, identities, owner fixture, cleanup/residual/sweep, receipt, tests)
- 49198eb feat(16-06): npm scripts test:staging-live and test:staging-live:tracer

## What was built
- `requireStagingLiveTarget`: `assertAppBoundToTarget` first, then `PORTIA_PROMO_LIVE_CONFIRM=ISOLATED_TEST_PROJECT`, a required live URL on the target host, both keys. Errors reuse `MutationTargetBlockedError` and name variables only.
- `createRun`: `runId = base36(now)_hex8`, prefix `__portia_live_<runId>` (<= 48), emails `portia-live-<runId>-<label>@example.invalid`; `createIdentity` (admin `createUser` with `email_confirm` and `app_metadata.portia_run`, optional `portia_editors` grant, one sign-in, session cached), `client(label|"anon")`, `createOwnerFixture` (absent: create; marked: delete and recreate; unmarked: `OwnerFixtureForeignError`, no delete/create), `cleanup`, `residual`, `secrets`.
- 42501 from the admin client becomes `admin-grant-missing` (D9, plan 16-10).
- `sweep(live, olderThanMs)`; `isStagingLiveInvocation` for live files to register a skip outside `npm run test:staging-live*`.
- Receipt: `buildReceipt` (schema, runId, commit, refHash, suites, created, deleted, residual, status, sha256 of canonical JSON), `assertRedacted` (run secrets, ref, host, `@`, `eyJ`, `sb_secret_`, `sb_publishable_`, `postgres(ql)://`), `writeReceipt` (only `test-results/staging/receipt-<suite>-<runId>.json`, after the redaction check).
- Scripts: `test:staging-live` (glob `lib/portia-*-live.test.ts`, flag before files as in the plan) and `test:staging-live:tracer`.

## Verification (Node 22.13.1)
- `node --experimental-strip-types --test lib/phase16-staging-harness.test.ts`: 21 pass, 0 fail.
- `npm test`: 782 tests, 781 pass, 0 fail, 1 skipped (pre-existing).
- `npm exec tsc -- --noEmit`: clean. `npm run lint`: 0 errors, 18 pre-existing warnings (none in new files).
- `npm run test:staging-live` with no environment: the existing promotion live file registers its skip (lifecycle event is not `test:promotion-live`), exit 0, nothing mutated.

## Deviations from Plan

**1. [Process] RED was not observed separately and tasks 1-3 share one commit.** The harness and its tests were written together, so the three tasks' code is in one commit (24fbcdc) and `package.json` in a second (49198eb). Task boundaries are covered by distinct test groups (guard/tracer, owner/cleanup/sweep, receipt). The plan's "tests first failed" claim is not evidenced.

**2. [Scope] `test:staging-live:tracer` points at `lib/portia-staging-live.test.ts`, which does not exist yet.** The plan assigns that file to 16-08; running the tracer script now fails with a missing file. Not created here.

Otherwise as planned.

## BLOCKED / not proven
- Nothing was run against a live project (keys arrive in 16-07). BLOCKED (ENV) until 16-07+: real supabase-js behavior of `listUsers` pagination, `delete({count})`, `.like` with escaped `\_`, storage `list` recursion (folder entries have `id === null`), `app_metadata` set through `createUser`, and the admin grants on PORTIA tables (D9). All of this is proven only against the in-memory fake.
- Table and column names for cleanup come from the baseline SQL by reading; cleanup of `portia_manual_employees` is not included (its id format cannot carry the prefix) and `portia_promo_qualification_banks`/task items beyond banks cascade only.
- The owner-fixture refusal of an unmarked account is proven offline only.

## Known Stubs
None.

## Threat Flags
None. No new endpoints; admin-key use is confined to the harness fixtures and state checks.

## Self-Check: PASSED
- tests/e2e/fixtures/staging-harness.ts, lib/phase16-staging-harness.test.ts, package.json scripts exist; commits 24fbcdc and 49198eb are ancestors of HEAD.
