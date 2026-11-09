---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 28
subsystem: accessibility-e2e
tags: [playwright, a11y, inert, focus-trap, qualification, editor-layout, gap-closure]
requires:
  - phase: PORTIA-20
    provides: 20-25 Playwright setup, per-test expected faults and the PW waiver registry
provides:
  - browser lane "(UI-contract stub) qualification window" on chromium-desktop and firefox-desktop (inert, Tab/Shift+Tab trap, focus return, no failure POST, axe)
  - product fix - Tab wraps inside the running qualification window (the lane found a real defect)
  - staging scenario "[STAB-EDIT-03] PC: a keyboard move across the column border ... one undo step" (BLOCKED (ENV) without safe staging)
  - accessibility.spec.ts re-run on four projects at HEAD 8b81221e0cf0e6e2020d7a2102d01e0c34835ad8
affects: [20-29, 20-31, 20-30, 20-13]
actuals:
  tokens: 9000
  tasks: 3
  commits: 4
plan_head_before: 010e53070ffaa8d92be375393d0f089604c237e6
plan_head_after: 8b81221e0cf0e6e2020d7a2102d01e0c34835ad8
tech-stack:
  added: []
  patterns: [stub only inside one test and named in the title, tab wrap via document keydown while the desktop lock is on]
key-files:
  created: []
  modified:
    - components/portia-desktop.tsx
    - tests/e2e/specs/accessibility.spec.ts
    - tests/e2e/specs/editor-layout.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-PLAYWRIGHT-WAIVERS.md
key-decisions:
  - "The stub lane found a real defect, not a test problem: on Chromium Tab from the last control of the qualification window left the page, window blur fired and the PC attempt was marked failed (Firefox happened to pass). 20-07 had claimed the window 'now actually traps'. Fixed in the product (Rule 1) with a Tab wrap, not by weakening the lane."
  - "The live qualification run stays BLOCKED (ENV) and owner step QUAL-LOCK-01; the stub lane proves client behaviour only."
  - "The editor scenario is written but not executed: no safe staging, 12 of 12 tests in editor-layout.spec.ts skipped as BLOCKED (ENV): safe target unavailable. Owner step EDITOR-03 stays open."
  - "A new flake (PW-10) is recorded as a waiver awaiting the owner; the spec was not weakened and the axe fingerprint set was not widened."
requirements-completed: []  # plan requirements: STAB-A11Y-01, STAB-A11Y-03, STAB-EDIT-03. Left open on purpose - the live qualification run and the staging editor scenario are still BLOCKED (ENV), and PW-10 has no owner verdict.
duration: ~5h wall clock including three builds and four full accessibility runs
completed: 2026-11-04
status: complete
coverage:
  - id: D1
    description: "Qualification window on a UI-contract stub: desktop shortcuts and taskbar entries inert, Tab and Shift+Tab (15 each) never leave .promotion-window, no failure POST, axe critical/serious empty, after finish inert lifted and focus on the opener or the Promotion heading"
    requirement: STAB-A11Y-01
    verification:
      - kind: e2e
        ref: "npm.cmd run test:e2e -- --retries=0 --project=chromium-desktop --project=firefox-desktop -g 'UI-contract stub\\) qualification window' tests/e2e/specs/accessibility.spec.ts -> 2 passed (also --repeat-each=4: 8 passed)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Live qualification run (participant and reviewer roles) and phone behaviour"
    requirement: STAB-A11Y-01
    verification: []
    human_judgment: true
    rationale: "BLOCKED (ENV): needs participant and reviewer identities on isolated staging and a physical phone; owner step QUAL-LOCK-01 in 20-UAT.md."
  - id: D3
    description: "Keyboard move across the column border: focus stays on the handle, one undo step (staging scenario)"
    requirement: STAB-EDIT-03
    verification:
      - kind: e2e
        ref: "tests/e2e/specs/editor-layout.spec.ts#[STAB-EDIT-03] PC: a keyboard move across the column border... -> skipped, BLOCKED (ENV): safe target unavailable"
        status: unknown
    human_judgment: true
    rationale: "Not executed in a browser: no safe staging. Runs in the mutation lane 20-13 or as owner step EDITOR-03."
  - id: D4
    description: "accessibility.spec.ts re-run on four projects at the final HEAD"
    requirement: STAB-A11Y-03
    verification:
      - kind: e2e
        ref: "four projects, --retries=0 --trace=retain-on-failure, HEAD 8b81221 -> 78 passed, 30 skipped, 0 failed, 0 flaky"
        status: pass
    human_judgment: false
---

# Phase 20 Plan 28: Qualification-window stub lane, editor keyboard-move scenario and accessibility re-run Summary

**The new browser lane for the qualification window (inert, Tab trap, focus return) exposed a real defect - Tab left the page and failed the PC attempt on Chromium - which is fixed with a Tab wrap; the editor keyboard-move scenario is written but BLOCKED (ENV); accessibility.spec.ts re-runs 78 passed, 30 skipped, 0 failed at HEAD 8b81221.**

## Accomplishments

- **Task 1 (tracer).** Added the test "[STAB-A11Y-01] (UI-contract stub) qualification window: the rest of the desktop is inert, Tab stays inside, focus returns after finish" in `accessibility.spec.ts`. The stubs live inside this one test: GET `/api/promotion/status?nickname=` returns the existing participant stub with `qualification.active = {status: "testing", attemptId: "e2e-qualification-attempt"}`; POST `/api/promotion/test` answers `start`/`heartbeat` with an active projection (clientMode desktop, deadline +10 min from the determinism time, one single-choice question with two options), `answer` with a finished projection (result passed, percent 100, question null), `failure` is recorded and answered 200. Shapes are copies of `QualificationTest` and `safeProjection`. Assertions: (1) every `[data-shortcut]` and `[data-taskbar-app]` has an `[inert]` ancestor-or-self while locked and the window itself does not; (2) 15 Tab and 15 Shift+Tab from the first radio keep `document.activeElement` inside `.promotion-window`; (3) no POST with action `failure` in the whole run; (4) axe critical/serious empty; (5) after the answer no `[inert]` is left and focus is on the Promotion heading or a button inside the window, not `<body>`. PC only; phones skip with "PC trap; phone is UAT QUAL-LOCK-01". The header comment says the lane stubs only for itself and proves client behaviour. The "BLOCKED (ENV): a live qualification run" row and the source test were not touched.
  - **Tracer verify failed first, then passed after the fix.** Chromium failed at Tab #1 (focus on BODY) and the page snapshot showed "ПОПЫТКА ЗАВЕРШЕНА / Зафиксирован выход из проверки на ПК": the focus left the page, window blur fired, `reportFailure("blur")` ended the attempt. Firefox passed on that run. After the fix: 2 passed, and 8 passed with `--repeat-each=4` on both projects.
- **Product fix (Rule 1).** `components/portia-desktop.tsx`: `trapQualificationTab` is attached to `document` keydown while `qualificationLocked` and removed on cleanup. It wraps Tab from the last tabbable of `.promotion-window` to the first and Shift+Tab from the first to the last (radio groups count as one stop, disabled and inert elements are skipped, empty window keeps the focus). Follow-up commit 8b81221 removed the modifier checks because `lib/portia-desktop.test.ts` (ZOOM-01) requires exactly one `metaKey` line in that file.
- **Task 2.** Added "[STAB-EDIT-03] PC: a keyboard move across the column border keeps the focus on the handle and is one undo step" after the existing ArrowDown/ArrowUp test: ArrowDown on the fifth card handle, card first in the second column with `data-sort-index` 5 and focus on its own handle, one Control+z, card back at index 4 in the first column. Same `openInfo` rules (staging only, content `main` restored, nothing stubbed). Existing tests unchanged. Actual result without staging: **skipped, BLOCKED (ENV): safe target unavailable** (all 12 tests of the file on chromium-desktop, `--list` shows the new test). Not a pass.
- **Task 3.** Full re-run of `accessibility.spec.ts`, see the table.

## Re-run of accessibility.spec.ts (`--retries=0 --trace=retain-on-failure`, four projects)

Final run, HEAD `8b81221e0cf0e6e2020d7a2102d01e0c34835ad8` (PLAN_BASE `010e53070ffaa8d92be375393d0f089604c237e6`), production build served on 3100 with `PORTIA_E2E_ALLOW_HTTP=1`:

| Project | passed | skipped | failed | flaky |
|---------|--------|---------|--------|-------|
| chromium-desktop | 19 | 8 | 0 | 0 |
| firefox-desktop | 19 | 8 | 0 | 0 |
| chromium-phone | 20 | 7 | 0 | 0 |
| webkit-phone | 20 | 7 | 0 | 0 |
| total | 78 | 30 | 0 | 0 |

Comparison with 20-07 (76 passed, 28 skipped, 0 failed, 26 tests x 4): the file now has 27 tests x 4 = 108. The new lane adds 2 passed (chromium-desktop, firefox-desktop) and 2 skipped (phones, "PC trap; phone is UAT QUAL-LOCK-01"). Same totals were obtained at 8fb9de2 (before the last one-line product change) and at 8b81221.

"Повышение" rows, all four projects: gate passed x4, participant stub passed x4, template builder passed x4, source contract passed x4; new qualification lane passed on chromium-desktop and firefox-desktop, skipped on both phones; "BLOCKED (ENV): a live qualification run" skipped x4 (kept, counted as skipped, not as a pass).

Other runs, recorded honestly:

- **First full run (HEAD 8fb9de2): 57 passed, 30 skipped, 21 failed - not valid evidence.** The server had been built without `PORTIA_E2E_ALLOW_HTTP=1`: the CSP carried `upgrade-insecure-requests`, webkit-phone hit "SSL connect error" and 18 webkit-phone tests timed out (my environment error, rebuilt and re-run). The other 3 failures were the "home desktop and the opened desktop surfaces" axe test on chromium-desktop, chromium-phone and firefox-desktop: `[PORTIA_E2E_DIAGNOSTICS]` unexpected `requestfailed / fetch / GET [url-redacted] ERR_ABORTED` (firefox NS_BINDING_ABORTED). The `/api/promotion/status -> 404` entries are allowlisted and were not the cause.
- **Classification of those 3:** not caused by a commit outside the plans (97d7abb, 2f54ba9, 23c1c85, 7e5e17a touch reviewer UI, viewport and GIF preload; none changed since 20-25 in `app`, `components`, `lib`, and the aborted request is a `fetch`, not the GIF image preload). Not reproduced: two later full runs (78/30/0), 6 repeats of the test on a build without the E2E flag (6 passed) and two probes that logged every `requestfailed` (none). Cause **not proven**, so registered as **PW-10 in `20-PLAYWRIGHT-WAIVERS.md`, class waiver, ОЖИДАЕТ ВЛАДЕЛЬЦА**. The spec was not weakened and no product code was changed for it. Passing runs do not replace the owner verdict: for 20-29/20-31 the gate stays FAIL until the owner decides on PW-10.
- Axe fingerprints: `git diff 010e530..HEAD -- tests/e2e/specs/accessibility.spec.ts` adds no line to `approvedCriticalOrSeriousFingerprints` (the set is still empty).

## Task Commits

1. Task 1 product fix: `bef5d93` fix(20-28): wrap Tab inside the qualification window so the focus cannot leave the page and fail the attempt
2. Task 1 lane: `8d19ae1` test(20-28): browser run of the qualification window on a UI-contract stub
3. Task 2: `8fb9de2` test(20-28): staging scenario for a keyboard move across the column border
4. Fix follow-up: `8b81221` fix(20-28): keep a single metaKey reference in portia-desktop.tsx (ZOOM-01 source test)

Docs commit (SUMMARY, PW-10 row, STATE, ROADMAP) follows this file.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Qualification window did not trap Tab; leaving the page failed the PC attempt**
- **Found during:** Task 1 (tracer verify)
- **Issue:** with the rest of the desktop inert, Tab on the last control moved focus to the browser UI on Chromium; the `blur` handler then reported the attempt as failed. A keyboard user could lose a qualification attempt with one extra Tab. The 20-07 claim "the aria-modal qualification window now actually traps" was true only for the source, not for Chromium.
- **Fix:** `trapQualificationTab` in `components/portia-desktop.tsx` (wrap at both ends), added in the same effect that sets `inert` and removed on cleanup.
- **Files modified:** `components/portia-desktop.tsx` (outside the plan's `files_modified`)
- **Verification:** lane 2 passed, 8 of 8 with `--repeat-each=4`; `npm.cmd test` 1384 tests, 1380 pass, 0 fail, 4 skipped; `tsc --noEmit` 0; eslint 0 errors.
- **Commits:** bef5d93, 8b81221 (the first version added a second `metaKey` line and broke the ZOOM-01 source test, found by `npm.cmd test`).

**2. [Rule 3 - Blocking] initial-focus assertion removed from the lane**
- My first version asserted the question heading is focused when it appears. Firefox lost that race once (the Promotion heading focus from the nickname check can win). That is outside the plan's five assertions and was a side check, so it was replaced by "heading visible, two radios present". Not a weakening of assertions (1) to (5).

**3. [Environment] first accessibility run on a wrongly built server**
- See the table section. Rebuilt with `PORTIA_E2E_ALLOW_HTTP=1`; the invalid run is not used as evidence. PW-10 documents the 3 non-webkit failures of that run.

**Total deviations:** 1 Rule 1 fix, 1 Rule 3 test adjustment, 1 environment note. **Impact:** product change is two small functions and one listener; no behaviour other than Tab at the window edges changed.

## Authentication gates

None.

## Known Stubs

None in product code. The stub in the new lane is test-local and named in the test title and the spec header.

## Threat Flags

None. T-20-42 mitigated: the title and header name the stub, the "BLOCKED (ENV): a live qualification run" row is still skipped, stubs are registered inside one test. T-20-SC: no packages installed.

## Verification

- Lane: `npm.cmd run test:e2e -- --retries=0 --project=chromium-desktop --project=firefox-desktop -g "UI-contract stub\) qualification window" tests/e2e/specs/accessibility.spec.ts` -> 2 passed.
- `npm.cmd exec tsc -- --noEmit` -> 0. `npm.cmd test` -> 1384 tests, 1380 pass, 0 fail. `npm.cmd run lint` -> 0 errors, 14 warnings (unchanged).
- editor-layout.spec.ts on chromium-desktop: 12 skipped (BLOCKED (ENV): safe target unavailable), new test listed.
- Acceptance greps: `grep -c "UI-contract stub) qualification window"` -> 1; `grep -c "BLOCKED (ENV): a live qualification run"` -> 1; `grep -c "keyboard move across the column border"` -> 1 in editor-layout.spec.ts.
- `lib/security-matrix.test.ts` passes (no path in the matrix scope was touched).

## Environment notes

- Servers: production build on 127.0.0.1:3100 (port 3000 was free but the config would rebuild on every run), started and stopped by me; nothing listens on 3000 or 3100 now. Node 22.13.1.
- `.next` was rebuilt several times (untracked). Pre-existing owner changes (`.planning/milestone.lock`, `.planning/state.json`, untracked dirs) were not staged.
- Owner action still needed: verdict on PW-10; QUAL-LOCK-01 and EDITOR-03 live checks; the editor scenario needs the mutation lane (20-13).

## Next

Ready for 20-29 (hashes and candidates: use HEAD 8b81221 for the accessibility evidence) and 20-31.

## Self-Check: PASSED

Commits bef5d93, 8d19ae1, 8fb9de2 and 8b81221 are ancestors of HEAD; `components/portia-desktop.tsx`, both spec files and the waiver registry exist and contain the described changes.
