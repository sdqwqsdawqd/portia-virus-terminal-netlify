---
phase: 15-baseline
plan: 14
subsystem: security
tags: [local-security-review, npm-audit, secret-scan, rls-static-review, csp]
requires:
  - phase: 15-13
    provides: signed visual metadata gate; green manifest tests
provides:
  - 15-SECURITY.md local source/dependency/configuration audit with explicit coverage, limitations and dispositions
  - dev-dependency high advisories cleared (lockfile only)
  - stale visual-policy unit test corrected so `npm test` is green
affects: [15-15, phase-16, phase-19, phase-21, phase-22]
tech-stack:
  added: []
  patterns: [local-security-gate-with-typed-blocked-lanes]
key-files:
  created: [.planning/phases/PORTIA-15-baseline/15-SECURITY.md]
  modified: [lib/e2e-visual-policy.test.ts, package-lock.json]
key-decisions:
  - "Local security status is PASS only for the repository-local scope; authenticated/RLS-runtime/staging/production lanes stay BLOCKED and are not passed."
  - "Dev-tooling high advisories were fixed with a lockfile-only npm audit fix verified on a scratch copy first; 16 moderate dev-only advisories remain (npm only offers breaking downgrades)."
  - "No critical/high local finding is unresolved, so no Qloxz acceptance was requested or written."
requirements-completed: []
requirements-addressed: [STAB-BASE-02, STAB-BASE-05, STAB-BASE-06]
status: complete
commits: 3
plan_head_before: 4426ee5f0e823de4b3ec9f3dc1ec4aa988a7f39b
plan_head_after: dfa77ac
actuals:
  tasks: 2
  commits: 3
duration: 45min
completed: 2026-11-01
---

# Phase 15 Plan 14: Local Security Gate Summary

**A reproducible local security review (`15-SECURITY.md`) finds 0 unresolved critical/high issues, 2 medium, 5 low and 3 info items with owning phases, and keeps authenticated, RLS-runtime, staging and production behavior explicitly BLOCKED.**

## Task Commits

1. **Task 1: Local security evidence matrix** — `90f86a9` (stale visual-policy test), `d6fe7e3` (lockfile-only audit fix), `dfa77ac` (`15-SECURITY.md`)
2. **Task 2: Disposition critical/high findings** — completed within `dfa77ac`; the checkpoint gate did not trigger because no critical/high finding was unresolved, so no owner input was needed.

## Verification (actual results, Node 22.13.1)

| Command | Result |
|---|---|
| `npm test` (start of plan) | FAIL: 634/636 pass, 1 fail, 1 skipped (`e2e-visual-policy` expected 23 states, policy declares 26) |
| `npm test` (final) | PASS: 636 tests, 635 pass, 0 fail, 1 skipped |
| `npm exec tsc -- --noEmit` | PASS |
| `npm run build` | PASS |
| `npm run lint` | PASS: 0 errors, 18 pre-existing `no-img-element` warnings |
| `npm audit --omit=dev` | PASS: 0 vulnerabilities |
| `npm audit` | 21 (4 high) before; 16 (0 high, 16 moderate dev-only) after |
| tracked-secret, history and service-role scans | 0 matches; no secret values printed or recorded |
| plan Task 2 automated check (`Status\|Coverage\|Disposition\|Limitations` in `15-SECURITY.md`) | all present |

## Findings by severity

Critical 0. High 0 unresolved (4 npm dev-only highs fixed). Medium 2: anon-callable `portia_editor_is_approved` email oracle (Phase 16/21); CSP `unsafe-inline` (Phase 21). Low 5: upload pre-parse size, storage policy lacks tab/prefix check, no Origin check on cookie mutations, `x-forwarded-for` fallback, `PORTIA_E2E_ALLOW_HTTP` weakens production CSP if ever set. Info 3. Details, evidence and owners are in `15-SECURITY.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Stale visual-policy unit test failed `npm test`**
- **Found during:** Task 1
- **Issue:** `lib/e2e-visual-policy.test.ts` asserted 23 states; Plan 15-12 legitimately raised the policy to 26 (3 added viewport/browser states, motion states replaced one-for-one). The task's own verify command could not pass.
- **Fix:** Updated the expected count and title to 26. Test-only.
- **Files modified:** `lib/e2e-visual-policy.test.ts`
- **Commit:** `90f86a9`

**2. [Rule 2 - Security] Four high npm advisories (dev-only) fixed instead of deferred**
- **Found during:** Task 1
- **Issue:** `npm audit` high: brace-expansion, browserslist, js-yaml, zod, all devDependency transitives.
- **Fix:** `npm audit fix` run first on a scratch copy (tsc/lint green; the git-dependent manifest test is not meaningful there), then applied lockfile-only to the repo (`package.json` unchanged), `npm ci`, and full test/tsc/build/lint/audit re-run in the repo.
- **Files modified:** `package-lock.json`
- **Commit:** `d6fe7e3`

### Plan path drift

`15-14-PLAN.md` references `lib/portia-promotion-server.ts` and `supabase/migrations/`, which do not exist. The review covered the real equivalents (`lib/portia-promotion-api.ts`, `lib/portia-promotion-reviewer.ts`, the route handlers, `supabase/*.sql`). Also the plan lists only `15-SECURITY.md` in `files_modified`; the two fixes above were necessary to make the plan's own verify command pass.

## Known Stubs

None.

## Threat Flags

None beyond the findings already recorded in `15-SECURITY.md`.

## Issues / Notes

- The deep review was performed inline by the executor, not by a separate reviewer agent; `15-SECURITY.md` states this and the single-pass limitation.
- `package-lock.json` changed with no `package.json` change; Plan 15-15's clean-checkout run will exercise `npm ci` from it.
- The five owner-dirty paths were not touched or staged.

## Self-Check: PASSED

`15-SECURITY.md` exists; `90f86a9`, `d6fe7e3`, `dfa77ac` are ancestors of HEAD.
