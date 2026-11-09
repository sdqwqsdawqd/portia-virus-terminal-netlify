---
phase: 15-baseline
plan: 17
subsystem: testing
tags: [e2e, preflight, playwright, supabase-env, node-pin, gap-closure]
requires:
  - phase: 15-baseline
    provides: "15-16 preflight and target guard, 15-REVIEW findings WR-03/WR-05/WR-06"
provides:
  - "visitor preflight with publishable/anon key priority identical to lib/supabase/env.ts"
  - "mutation preflight target guard judged on the pre-loadEnvConfig shell snapshot"
  - "documented, test-pinned Node 22.13.x runtime pin"
affects: [15-19 review disposition]
tech-stack:
  added: []
  patterns: ["shell-environment snapshot before loadEnvConfig", "temp-dir fake env file with process.env restore"]
key-files:
  created: []
  modified:
    - scripts/phase15-e2e-preflight.mjs
    - lib/e2e-preflight.test.ts
    - .env.example
    - tests/e2e/README.md
key-decisions:
  - "WR-03: shell-only variant (guard sees shell env snapshot) instead of loading env files in playwright.config.ts"
  - "WR-05: Node 22.13.x pin kept (ROADMAP, 15-RESEARCH); engines stays the wider app range; contradiction fixed in docs"
status: complete
commits: 4
plan_head_before: a5c86c829e636b454478b41e457b3da741f12e7e
plan_head_after: 30cc202
actuals:
  tokens: 6000
  tasks: 3
  commits: 4
---

# Phase 15 Plan 17: preflight gap closure (WR-03, WR-05, WR-06) Summary

Preflight now accepts the publishable or legacy anon Supabase key with the app's priority, rejects mutation config that exists only in an env file, and documents the intentional Node 22.13.x pin.

## Changes

- `scripts/phase15-e2e-preflight.mjs`: new `PUBLIC_KEY_VARIABLES` (PUBLISHABLE, ANON; first truthy wins, as `||` in `getSupabaseConfig`). `missing-environment` names both key names when neither is set. `public-key-shape` names the selected key. `runPreflight` snapshots `{ ...process.env }` before `loadEnvConfig` and passes `options.environment ?? shellEnvironment` to the target guard. One-line comment above the unchanged Node regex explains the pin. Error codes and message format unchanged (names only, no values).
- `lib/e2e-preflight.test.ts`: 7 -> 9 tests (the plan-level count). Added: env-file-only mutation config -> `MutationTargetBlockedError` (fake `.env` in `mkdtempSync(os.tmpdir())`, with a control that the same values as `options.environment` give `ready`; process.env keys snapshotted, cleared and restored in `finally`, dir removed; single loading `runPreflight` call because `@next/env` caches); publishable-only passes, publishable beats anon in shape check; Node 22.13.0/22.13.1 accepted, 22.12.9/22.14.0/23.0.0/24.0.0 rejected with `node-version`; `engines.node` pinned to `>=22.13.0 <23`.
- `.env.example`: publishable key is line 2 (anon noted as fallback); five mutation variables are commented placeholders with a shell-only note; active lines are exactly URL, publishable key, device secret, production ids.
- `tests/e2e/README.md`: Node pin documented as intentional and narrower than engines, `node-version` code named; visitor checks read env files, mutation check reads shell only; key names updated.

## Verification

- Node: reference 22.13.1 (found in TEMP, prepended to PATH).
- `lib/e2e-preflight.test.ts` + `lib/e2e-target-guard.test.ts`: 16/16 pass. RED confirmed before implementation (publishable-only gave `missing-environment`).
- `npm test`: 682 tests, 681 pass, 0 fail, 1 skipped (pre-existing). `npm exec tsc -- --noEmit`: clean. `npm run lint`: 0 errors, 18 warnings (all pre-existing `<img>` warnings elsewhere).
- Unchanged vs `769c3d1`: `tests/e2e/fixtures/target-guard.ts`, `playwright.config.ts`, `package.json`, `package-lock.json`, `README.md`.

## Commits (for Plan 15-19 disposition)

- 22f8818 fix(15-17): preflight accepts publishable key and judges mutation target by shell env (WR-06, WR-03)
- 4e30bd1 test(15-17): pin Node 22.13.x and publishable/anon key boundaries in preflight (WR-05, WR-06)
- bbf2a55 docs(15-17): align e2e README with preflight (WR-03, WR-05, WR-06)
- 30cc202 test(15-17): drop unused binding flagged by lint

## Deviations from Plan

**1. [Rule 1 - lint] Unused `_anon` binding** in my new test produced a lint warning; replaced with an `undefined` override (30cc202). No behavior change.

Also: the first commit carries the `Co-Authored-By: Claude Opus 5.5` trailer from the dispatch instruction; later commits use the harness-given `Claude Sonnet 5.5` trailer.

## Auth gates / BLOCKED

None. No BLOCKED status or requirement changed: STAB-BASE-02 stays BLOCKED (G1/G2); STAB-BASE-06 advanced, not closed.

## Known Stubs

None.

## Threat Flags

None.

## Confirmations

- Real env files in the repo were not read, printed or loaded; the test uses only its own temp-dir fake file.
- Owner paths, approved PNGs and signed evidence were not touched or staged; visual-manifest `--verify` was not run.
- STATE.md and ROADMAP.md not modified.

## Self-Check: PASSED

Files exist (4 modified, SUMMARY); commits 22f8818, 4e30bd1, bbf2a55, 30cc202 are ancestors of HEAD.
