---
phase: 15-baseline
plan: 06
subsystem: testing
tags: [playwright, preflight, supabase, target-guard, security]
requires:
  - phase: 15-05
    provides: initial clean-checkout runner and fail-closed mutation guard
provides:
  - tracked Node/environment preflight before Playwright discovery
  - explicit isolated allow-list plus production deny-list mutation boundary
  - redacted stable reason-code regression matrix
affects: [15-07, 15-08, 15-09, 15-10, phase-16]
tech-stack:
  added: []
  patterns: [preflight-before-discovery, positive-and-negative-target-identity]
key-files:
  created: [scripts/phase15-e2e-preflight.mjs, lib/e2e-preflight.test.ts]
  modified: [package.json, playwright.config.ts, tests/e2e/fixtures/target-guard.ts, lib/e2e-target-guard.test.ts, tests/e2e/README.md, .env.example]
key-decisions:
  - "Pin baseline execution to Node 22.13.x and fail before Playwright discovery on mismatch."
  - "Mutation authority requires a non-empty isolated allow-list and production deny-list with no overlap."
patterns-established:
  - "Preflight errors expose only variable names and stable reason codes."
  - "A syntactically valid Supabase ref is never sufficient mutation authority."
requirements-completed: [STAB-BASE-02, STAB-BASE-06]
duration: 12min
completed: 2026-10-31
---

# Phase 15 Plan 06: Browser Preflight and Target Guard Summary

**Tracked Node/environment preflight now runs before Playwright discovery, while mutation setup requires exact membership in an isolated allow-list and absence from a production deny-list.**

## Performance

- **Duration:** 12 min
- **Started:** 2026-10-31T02:18:00+05:00
- **Completed:** 2026-10-31T02:30:49+05:00
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- Added visitor and mutation preflight modes with Node 22.13.x, public configuration and device-secret validation.
- Routed committed E2E commands and direct Playwright config loading through the preflight before browser discovery.
- Added duplicate-free production/isolated project lists, overlap rejection, exact host matching and unknown-target rejection.
- Verified redaction and fail-closed behavior with 19 focused tests plus TypeScript checking.

## Task Commits

1. **Task 1: Add a tracked clean-checkout preflight** — `858c285`
2. **Task 2: Make mutation target identity fail closed** — `4469104`

## Files Created/Modified

- `scripts/phase15-e2e-preflight.mjs` — visitor/mutation preflight and safe CLI errors.
- `lib/e2e-preflight.test.ts` — Node, environment, redaction and guard-composition tests.
- `tests/e2e/fixtures/target-guard.ts` — positive isolated identity and negative production identity policy.
- `lib/e2e-target-guard.test.ts` — missing, malformed, duplicate, overlap, production, unknown and mismatch matrix.
- `package.json` / `playwright.config.ts` — preflight-before-discovery entrypoints.
- `.env.example` / `tests/e2e/README.md` — names/formats and clean-checkout sequence without credentials.

## Decisions Made

- The canonical public browser key name for this baseline is `NEXT_PUBLIC_SUPABASE_ANON_KEY`; application fallback support for publishable keys is unchanged.
- Remote schema/sentinel attestation remains the first blocking checkpoint in 15-07 and is not inferred from environment strings.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Regression] Updated the actor guard fixture for the new isolated allow-list**
- **Found during:** Task 2
- **Issue:** The existing positive actor test lacked `PORTIA_E2E_ISOLATED_PROJECT_IDS` and correctly became blocked under the stronger contract.
- **Fix:** Added the same sanitized isolated ref to the test fixture.
- **Files modified:** `lib/e2e-actors.test.ts`
- **Verification:** Focused actor/guard/preflight suite passes 19/19.
- **Committed in:** `4469104`

**Total deviations:** 1 auto-fixed regression fixture. **Impact:** Required for the intended stricter target contract; no product or schema scope expansion.

## Issues Encountered

- The host shell uses Node 24.21.0, which the new preflight intentionally rejects. Positive CLI evidence was run with `node@22.13.1`; unit and TypeScript checks also pass. Phase 15 final clean-checkout evidence still requires a Node 22.13.x runner.

## User Setup Required

None for this plan. Runtime-only isolated staging values are requested by the 15-07 checkpoint and must not be committed.

## Self-Check: PASSED

- Focused tests: 19 passed, 0 failed.
- TypeScript: passed.
- Node 22.13.1 sanitized visitor preflight: passed.
- Product source, schema and approved PNG changes: none.

## Next Phase Readiness

- Ready for 15-07 target attestation and disposable real actor sessions.
- Blocking prerequisite remains: an authorized isolated Supabase target and runtime-only credentials.

---
*Phase: 15-baseline*
*Completed: 2026-10-31*
