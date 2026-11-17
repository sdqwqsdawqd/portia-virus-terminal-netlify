---
phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
plan: 07
subsystem: ui
tags: [owner-check, harness, firefox, webkit, phone-fit, review-disposition]
requires:
  - phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
    provides: the whole phase-11 editor (mark, panel, save chip, sections, table, multi-selection) and 11-editor-check.mjs
provides:
  - 11-editor-check.mjs --check all (mark, panel, savechip, sections, table, multiselect in one Edge session) and a phonefit check at 360x640 and 390x844
  - 11-engines-check.mjs (Playwright Firefox for Ctrl selection, iPhone 13 WebKit for phone fit and the info tab strip)
  - owner-found fixes for Firefox and iPhone (Ctrl selection, phone width, WebKit tab strip)
  - 05-REVIEW-DISPOSITION.md (WR-01, IN-03, WR-06, IN-06 fixed, open 4 -> 0) and 03.1-REVIEW-DISPOSITION.md (IN-05 fixed, open 4 -> 3)
affects: [PORTIA-12 (phase 11 is closed; the owner approved on PC Firefox and iPhone Firefox/WebKit)]
status: complete
actuals:
  tokens: 14000
  tasks: 3
  commits: 8
plan_head_before: 87b5113bbb91116ecd7821883e34d3dddeb84b7a
plan_head_after: 930bf54
tech-stack:
  added: []
  patterns:
    - "Real-engine harness outside the project: playwright-core@1.64.1 lives in %LOCALAPPDATA%\\portia-pw-tools (override with PLAYWRIGHT_CORE); it is not a project dependency"
    - "Selection code reads the newest range when a browser keeps several (Gecko), and never trusts a caret that a Ctrl press moved to offset 0"
key-files:
  created:
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-engines-check.mjs
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/owner-phone-editor.png
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/owner-phone-info-tabs.png
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-07-SUMMARY.md
  modified:
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-editor-check.mjs
    - components/portia-editor.tsx
    - lib/format-fragments.ts
    - lib/format-fragments.test.ts
    - app/portia.css
    - .planning/milestones/v1.0-phases/PORTIA-05-oformlenie-teksta/05-REVIEW-DISPOSITION.md
    - .planning/milestones/v1.0-phases/PORTIA-03.1-stabilizatsiya/03.1-REVIEW-DISPOSITION.md
key-decisions:
  - "The owner's check on real devices found three bugs the Edge-only harness could not: Gecko keeps several Selection ranges, Gecko puts the caret at offset 0 on a Ctrl press in another field, WebKit sizes flex/grid children differently. They were fixed in the plan that built them (EDIT-03, EDIT-06) and a Firefox and a WebKit harness now guards them"
  - "Fixes stay inside the files of the plans that built the feature; no new wish was built here"
  - "The owner's own test edits were never saved (ОТМЕНИТЬ -> ВЕРНУТЬ СОХРАНЁННОЕ), so the shared content was not touched"
requirements-completed: [EDIT-01, EDIT-02, EDIT-03, EDIT-04, EDIT-05, EDIT-06, EDIT-07]
duration: owner-paced, three fix rounds
completed: 2026-10-26
---

# Phase 11 Plan 07: Owner check and closing the phase Summary

The phase-11 editor was checked by the owner on a PC (Firefox) and an iPhone (Firefox and WebKit), three owner-found bugs were fixed and put under a Firefox and a WebKit harness, and the owner replied «подтверждаю». The review findings the phase fixed are now closed with evidence.

## What was built

- **Task 1, commit 66afffc.** `11-editor-check.mjs --check all` runs mark, panel, savechip, sections, table and multiselect in one Edge session, resetting `reasons`, the served fixture and the fake save before each check, and prints one verdict `{ check: "all", ok, results }` with exit 1 on any failure. The commit touches only the harness.
- **Task 2 (owner check, human-verify).** The owner went through the eight steps on the PC and the phone and reported bugs in two rounds (below). After the fixes they re-checked on PC Firefox and iPhone (Firefox and WebKit) and answered «подтверждаю». The owner's test edits were not saved.
- **Task 3, commit 930bf54.** 05-REVIEW-DISPOSITION.md: WR-01, IN-03, WR-06 and IN-06 set to `fixed` in the frontmatter and the table, each Source naming the 11-01 commit (73d1100 for WR-01 and IN-03, 2aacbc2 for WR-06 and IN-06), the test name and the owner's step; the IN-01 Source gained the 11-01 boundary test «the own-input window closes exactly 400 ms after up (05-IN-01)»; `open: 4` -> `open: 0`. 03.1-REVIEW-DISPOSITION.md: IN-05 `fixed` in both places, Source names 73d1100 and `grep -rn -e фигни -e дружок -e пирожок components/` -> nothing; `open: 4` -> `open: 3`. The plan's «stop the background server» step was skipped on purpose: the owner's server (PID 27332) no longer exists and port 3124 now belongs to the orchestrator's preview server, which the orchestrator stops.

## Verification

- `npm test`: 332 pass, 0 fail (re-run at the end of this plan). `npx tsc --noEmit`: clean.
- Plan Task 3 greps: the four 05 ids in the frontmatter 4; the four 05 rows `fixed` 4; `^open: 0` in 05 1; 03.1 `IN-05 | info | fixed` 1; 05 `disposition: open` 0; 03.1 `disposition: open` 3 (WR-11, IN-02, IN-10-storage), matching `open: 3`.
- Engine checks (run by the executor during the fix rounds, Playwright firefox and webkit with the iPhone 13 descriptor): `11-engines-check.mjs --check ctrl` ok (Firefox: select a word, Ctrl+select more words in the same and another field, one colour styles all); `--check phone` ok (iPhone WebKit: nothing wider than the screen, names stop before their buttons, the info tab strip does not overlap, ОГЛАВЛЕНИЕ pans only up and down). They were not re-run for this closing step; no code changed after commit 1d1aa42.

## Deviations from Plan

### Owner-found bugs (fix rounds, plan Task 2 resume rule)

**1. [Rule 1 - Bug] Gecko keeps several Selection ranges; Ctrl selection read the wrong one (EDIT-06)**
- **Found during:** Task 2, round 1 (owner on PC Firefox)
- **Issue:** Ctrl+select in Firefox adds a range instead of replacing it; the code read range 0, the oldest, so the new fragment was lost or the wrong word was styled. Edge keeps one range, so the harness never saw it.
- **Fix:** the field reads every range and `pickCurrentRange` (new in `lib/format-fragments.ts`) picks the newest one, i.e. the last range that was not already known; two unit tests in `lib/format-fragments.test.ts` cover it.
- **Files modified:** components/portia-editor.tsx, lib/format-fragments.ts, lib/format-fragments.test.ts
- **Commit:** 3321f7b

**2. [Rule 1 - Bug] Phone: cards, lists and ОГЛАВЛЕНИЕ wider than the screen; ОГЛАВЛЕНИЕ panned sideways (EDIT-03)**
- **Found during:** Task 2, round 1 (owner on iPhone)
- **Issue:** list grids used `1fr`, whose minimum is the content width, so a long name widened the grid; the editor scrolled sideways; the table of contents allowed a horizontal pan.
- **Fix:** list grids use `minmax(0, 1fr)`, the editor clips `overflow-x`, the table of contents gets `touch-action: pan-y`.
- **Files modified:** app/portia.css
- **Commit:** 6feebe4

**3. [Rule 1 - Bug] Gecko: Ctrl press in another field put the caret at offset 0, so Ctrl+drag started on the first character (EDIT-06)**
- **Found during:** Task 2, round 2 (owner on PC Firefox; reproduced in Playwright Firefox)
- **Issue:** the Ctrl pointer-down on a different field makes Gecko focus it and place the caret at 0 before the drag; the drag then extended from there, not from under the pointer.
- **Fix:** `pinCaretUnderPointer` puts the caret under the pointer when a Ctrl press lands in another field.
- **Files modified:** components/portia-editor.tsx
- **Commit:** 10ef075

**4. [Rule 1 - Bug] WebKit (every iPhone browser): info tab strip, block labels and page panning (EDIT-03)**
- **Found during:** Task 2, round 2 (owner on iPhone; reproduced in Playwright WebKit)
- **Issue:** in the public info tab strip the subsection group shrank under its content, so «02 …» overlapped the next tab; a card-head label had `flex: none` and ran under «Удалить»; the page itself could pan sideways; the table of contents still allowed a horizontal pan.
- **Fix:** the subsection group no longer shrinks under its content; the card-head label may shrink and ends with «…»; `html` and `body` clip `overflow-x`; the table of contents is `touch-action: pan-y pinch-zoom`.
- **Files modified:** app/portia.css
- **Commit:** 56e7c74

**5. [Rule 3 - Blocking, tooling] The Edge-only harness missed Gecko and WebKit bugs**
- **Found during:** Task 2, rounds 1 and 2
- **Issue:** `11-editor-check.mjs` drives Edge over CDP and sent synthetic Ctrl events, so none of bugs 1-4 could fail it.
- **Fix:** the harness now sends real Ctrl presses and clicks and has a `phonefit` check at 360x640 and 390x844 (a59aaa7); `11-engines-check.mjs` drives Playwright Firefox (Ctrl selection) and iPhone 13 WebKit (phone fit, tabs) and keeps the owner's two screenshots (1d1aa42). playwright-core@1.64.1 is installed outside the project at `%LOCALAPPDATA%\portia-pw-tools`; set `PLAYWRIGHT_CORE` to use another folder. It is not a project dependency, so no package was added to `package.json`.
- **Files modified:** 11-editor-check.mjs, 11-engines-check.mjs, owner-phone-editor.png, owner-phone-info-tabs.png
- **Commits:** a59aaa7, 1d1aa42

### Not reproduced in emulation

Two owner reports (an expanded section wider than the screen, ОГЛАВЛЕНИЕ panning sideways) could not be reproduced in Playwright WebKit. The CSS changes in 6feebe4 and 56e7c74 target their most likely causes, and the owner confirmed on the device that both are gone. They are guarded by the `phonefit` checks only as far as emulation sees them.

### Lesson

Checking a UI with one engine is not a check of the phone. Edge passed everything while Firefox and WebKit had real bugs. For any later phase with selection, touch or flex/grid sizing: run `11-engines-check.mjs` (Firefox and WebKit) next to `11-editor-check.mjs` (Edge) before asking the owner.

### Plan steps not done

- Task 1 asked for the PC's LAN address and a note on whether phone login works over plain http. The owner reached the editor on the phone through the orchestrator's preview and the deploy preview, so this plan records no LAN-login finding; no auth code was changed.
- Task 3 «stop the background server»: see above, nothing to stop and port 3124 is not this plan's to stop.

## Known Stubs

None.

## Threat Flags

None. No endpoint, auth path or schema changed; the harness blocks every non-GET `/api/*` request, and the owner ended without saving.

## Self-Check: PASSED

- Files: 11-07-SUMMARY.md, 11-engines-check.mjs, owner-phone-editor.png, owner-phone-info-tabs.png, both REVIEW-DISPOSITION files all exist.
- Commits all ancestors of HEAD: 66afffc, 3321f7b, 6feebe4, a59aaa7, 10ef075, 56e7c74, 1d1aa42, 930bf54. `git rev-list --count 87b5113..HEAD` = 8 before this SUMMARY commit.
