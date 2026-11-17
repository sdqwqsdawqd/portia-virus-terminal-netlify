---
phase: 15-baseline
plan: 18
subsystem: testing
tags: [e2e, visual-policy, playwright, gap-closure]
requires:
  - phase: 15-baseline
    provides: "15-16 visual policy, 15-REVIEW findings IN-05 and IN-01"
provides:
  - "unit test that runs the real visualPolicy on a fake Page for all 26 states"
  - "explicit PORTIA_VISUAL_COMPARATOR_MISSING guard on the Playwright internal comparator, pinned to 1.64.1"
affects: [15-19 review disposition]
tech-stack:
  added: []
  patterns: ["fake Page with locator(selector) for policy tests"]
key-files:
  created: []
  modified:
    - lib/e2e-visual-policy.test.ts
    - tests/e2e/fixtures/visual-policy.ts
key-decisions:
  - "IN-01 part 2 (attach diff on failed comparison) stays open until Phase 18; WR-02 tolerances and masks unchanged"
status: complete
commits: 2
plan_head_before: 508e4c7fd03c4a7d499a8c6e5963cd14864d20ec
plan_head_after: 7bc7f4811312dbf20cec00984d76f8477d8f5461
actuals:
  tokens: 4000
  tasks: 2
  commits: 2
---

# Phase 15 Plan 18: visual policy test and comparator guard (IN-05, IN-01 part 1) Summary

The visual-policy unit test now executes the real `visualPolicy` for all 26 states, and a missing Playwright internal comparator fails with `[PORTIA_VISUAL_COMPARATOR_MISSING]` instead of a TypeError.

## Changes

- `lib/e2e-visual-policy.test.ts`: 3 -> 5 tests. Kept: 26 unique states. New: no state exceeds `VISUAL_DIFF_CEILING` and all use `scale: "device"`; the 8 desktop states allow fewer than 16*32 pixels; masks are exactly `[".personnel-app"]` (employees), `["iframe"]` (table, charter) with `maskColor` `#0c1715`, and `mask`/`maskColor` undefined for the other 23; `utils.getComparator("image/png")` is a function and `devDependencies["@playwright/test"]` is exactly `1.64.1`. The fake `Page` is `{ locator: (selector) => ({ selector }) }` cast through `unknown`.
- `tests/e2e/fixtures/visual-policy.ts`: removed `assertVisualDiffAllowed` (only the old unit test called it; grep over `tests/` and `lib/` is now empty). Added the `shortcut:` comment (internal API, pinned 1.64.1) and a `typeof getComparator !== "function"` check that throws the stable code with the expected version, no paths or env data. The cast type now marks `utils` and `getComparator` as optional.

## Verification

- Node: reference 22.13.1 (found in TEMP, prepended to PATH).
- `lib/e2e-visual-policy.test.ts`: 5/5 pass. Sensitivity check: temporarily raising the desktop tolerance 256 -> 600 failed the desktop test (1 fail); file restored, not committed.
- `npm test`: 684 tests, 683 pass, 0 fail, 1 skipped (pre-existing). `npm exec tsc -- --noEmit`: clean. `npm run lint`: 0 errors, 18 warnings (pre-existing `<img>`).
- `node scripts/phase15-visual-manifest.mjs --verify-promotion`: "Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded."
- The five protected sed ranges (desktopPolicy..motionPolicy constants, `declarations`, `maskLocator`, `visualPolicy`, `compareApprovedScreenshot`) are identical to `769c3d1`.
- `git diff --quiet 769c3d1` over `tests/e2e/visual`, `tests/e2e/visual-candidates`, phase `evidence`, `package.json`, `package-lock.json`: exit 0.

## Commits (for Plan 15-19 disposition)

- 0203844 test(15-18): exercise real visualPolicy on a fake Page, drop dead cap helper (IN-05)
- 7bc7f48 fix(15-18): fail with PORTIA_VISUAL_COMPARATOR_MISSING when Playwright internal comparator is gone (IN-01 part 1)

## Deviations from Plan

- Commit trailer is `Co-Authored-By: Claude Sonnet 5.5` (harness attribution rule) rather than the `Claude Opus 5.5` text in the dispatch message; same as the later 15-17 commits.
- The tracer's RED step cannot fail on unchanged production code (the policy is already correct); sensitivity was shown by the temporary 256 -> 600 mutation instead.

## Left open

- IN-01 part 2 (attach diff when `compareApprovedScreenshot` fails): needs a failing browser comparison; moved to Phase 18 with WR-02.
- WR-02, G3, G4 unchanged; STAB-BASE-03 stays BLOCKED. STAB-BASE-06 advanced, not closed.

## Auth gates / BLOCKED

None. No BLOCKED status changed. Browser visual lanes were not run.

## Known Stubs

None.

## Threat Flags

None.

## Confirmations

- Real env files not read or printed. No Supabase or network use.
- Approved PNGs, signed evidence, owner paths, STATE.md and ROADMAP.md not touched or staged; visual-manifest `--verify` was not run.

## Self-Check: PASSED

Modified files exist; commits 0203844 and 7bc7f48 are ancestors of HEAD.
