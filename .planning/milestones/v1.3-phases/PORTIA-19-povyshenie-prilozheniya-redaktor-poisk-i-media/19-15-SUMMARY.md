---
phase: PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 15
subsystem: media
tags: [react, intersection-observer, playwright, media]
requires:
  - phase: PORTIA-19
    provides: EmbeddedDocument and PortiaImage loading states
provides:
  - Visibility-gated 15-second timeout for embedded frames and images
  - CR-01 Chromium desktop and phone regression evidence
affects: [PORTIA-19-19, STAB-MEDIA-02, STAB-MEDIA-03, STAB-MEDIA-05]
actuals:
  tokens: 13112
  tasks: 3
  commits: 5
plan_head_before: aa8e516360ed423d567cd2746a7be39025a179ce
plan_head_after: a5b136af4c150fa14d0885b120de9bfcd4d3c92d
tech-stack:
  added: []
  patterns: [IntersectionObserver visibility gate, timeout reset on hiding]
key-files:
  created: [tests/e2e/specs/media-offscreen.spec.ts]
  modified: [lib/media-display.ts, lib/media-display.test.ts, lib/portia-desktop.test.ts, components/portia-desktop-media.tsx, components/portia-desktop-documents.tsx, .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-EVIDENCE.md]
key-decisions:
  - "Keep STAB-MEDIA-02/-03/-05 Pending until 19-19 proves folded guide covers on seeded data."
  - "Use direct Playwright CLI because npm run test:e2e did not forward project filters in this Windows shell."
requirements-completed: []
coverage:
  - id: CR-01-frame
    description: Minimized charter frame retains its skeleton and times out only after visible waiting.
    requirement: STAB-APP-06
    verification:
      - kind: e2e
        ref: tests/e2e/specs/media-offscreen.spec.ts#charter
        status: pass
    human_judgment: false
  - id: CR-01-portrait
    description: Minimized employee portrait retains its skeleton and times out after visible waiting.
    requirement: STAB-MEDIA-03
    verification:
      - kind: e2e
        ref: tests/e2e/specs/media-offscreen.spec.ts#portrait
        status: pass
    human_judgment: false
  - id: CR-01-guide
    description: Folded guide covers remain loading until the section opens.
    requirement: STAB-MEDIA-05
    verification:
      - kind: e2e
        ref: tests/e2e/specs/media-offscreen.spec.ts#guide
        status: unknown
    human_judgment: false
duration: 15min
completed: 2026-11-03
status: complete
---

# Phase 19 Plan 15: Visible media timeout Summary

**Frames and images now count their 15-second timeout only while visible; charter and employee regressions passed on Chromium desktop and phone.**

## Performance

- **Started:** 2026-11-03T18:55:59Z (phase execution start)
- **Completed:** 2026-11-03T19:10:23Z
- **Tasks:** 3/3
- **Files created or modified:** 9, including RED evidence records and phase evidence

## Accomplishments

- `useVisibleTimeout` observes each frame separately, clears its timer when hidden or settled, and starts a fresh full interval when shown again. `visibleTimerRunning` isolates the loading and visibility rule.
- EmbeddedDocument and PortiaImage use that shared hook. Empty or disallowed image URLs still show the immediate placeholder; sandbox, zoom, retry, image priority, and record identity remain intact.
- New CR-01 Playwright spec exercises minimized «Устав», minimized «Сотрудники», and folded «Справочник» against real own API responses. The guide case remains BLOCKED (DATA) on this target.

## Task Commits

1. Task 1 RED: `305f815` — failing source test for the hidden frame, with `RED_EVIDENCE_OK` in `19-15-red-task1.json`.
2. Task 1 GREEN: `d642673` — visibility hook, frame integration, and browser tracer.
3. Task 2 RED: `94780ce` — failing source test for hidden images, with `RED_EVIDENCE_OK` in `19-15-red-task2.json`.
4. Task 2 GREEN: `14e04c6` — image integration and two further browser scenarios.
5. Task 3: `a5b136a` — staging regression results in `19-EVIDENCE.md`.

Both RED tests executed their intended assertion, failed on the old mount-time timer, and passed after the respective GREEN commits. No refactor commit was needed.

## Verification

- Visitor preflight: `ready`.
- `node --experimental-strip-types --test lib/media-display.test.ts lib/portia-desktop.test.ts`: 78 passed.
- `npm.cmd test`: 1,067 passed, 0 failed, 3 pre-existing skipped.
- `npm.cmd exec tsc -- --noEmit`: passed.
- Targeted ESLint on changed source and tests: 0 errors, one existing `<img>` warning.
- `npm.cmd run build`: passed.
- `media-offscreen.spec.ts` plus `media-states.spec.ts` on Chromium desktop and phone: 12 passed, 2 skipped, 0 failed. Both skips are guide covers with no data.
- `app-states.spec.ts --grep=STAB-APP-06` on the same projects: 4 passed, 0 skipped, 0 failed.
- Full `npm.cmd run lint`: failed on 34 errors in pre-existing `.agents/.claude` skill scripts outside this plan. This is not recorded as a pass.

## Deviations from Plan

- The initial `npm run test:e2e -- ...` invocation did not forward Playwright project flags in this Windows shell and ran five projects. The required Chromium desktop and phone runs were repeated through `npm.cmd exec playwright -- test ...` and passed. The extra Firefox diagnostic and WebKit taskbar timeout are recorded in `deferred-items.md`.
- The plan-level full lint command fails in unrelated skill scripts. Changed files pass targeted lint, and no unrelated scripts were edited.

## Deferred Issues

- Folded guide cover test: BLOCKED (DATA) on both projects because this staging target serves no guide card with a cover. 19-19 owns seeded proof. The test's conditional `test.skip` is intentional and is not counted as passed.
- STAB-MEDIA-02/-03/-05 stay Pending in `REQUIREMENTS.md`, as the plan requires.
- Full lint and extra browser project failures are listed in `deferred-items.md` for separate work.

## Known Stubs

None. The conditional guide skip records missing test data, not a product placeholder.

## Threat Review

No new endpoint, auth path, schema, or file access was introduced. The browser spec routes only third-party media; the fixture checks that own `/api` routes were never fulfilled by a test.

## Self-Check: PASSED

All nine task files exist; all five listed task commits are ancestors of HEAD. The persisted plan ledger measures five commits from `plan_head_before` to `plan_head_after`.
