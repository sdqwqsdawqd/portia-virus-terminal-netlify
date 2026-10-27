---
phase: PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost
plan: 09
subsystem: theme
tags: [custom-accent, color-picker, css-combinator, gap-closure, G-10-2, WR-01, owner-verified]
requires: ["10-08"]
provides:
  - "Settings option-button rules scoped to direct children (.setting-options > button); the picker's × is a clean 24x24 button on PC and phone"
  - "Harness accent step (n): × size and glyph on 1920x1080 and 390x844"
  - "WR-01 recorded as fixed in 10-REVIEW-DISPOSITION.md (open 7 -> 6)"
  - "Owner confirmation of black, grey and coloured «Свой» picks and the × on PC and phone"
affects: []
tech-stack:
  patterns:
    - "Child combinator for component-scoped button rules so nested widgets keep their own sizing"
key-files:
  modified:
    - app/portia.css
    - .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-desktop-check.mjs
    - .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-REVIEW-DISPOSITION.md
decisions:
  - "G-10-2: scope the settings option-button base, hover and selected rules with `>` rather than overriding them inside the picker"
  - "The picker × gets `line-height: 1` so its glyph is not clipped by an inherited line box"
metrics:
  duration: ~40 min
  completed: 2026-10-26
status: complete
requirements-completed: [THEME-01]
actuals:
  tokens: 12000
  tasks: 3
  commits: 2
plan_head_before: 6df5286fdb60ca1c7477abf1a721e46227e4960b
plan_head_after: e9914b19fd7676d6e1d95cd930499fd80db8e036
coverage:
  - deliverable: "The picker's × measures 24x24 with its glyph inside on PC and phone and closes the picker"
    verification:
      - { kind: command, ref: "10-desktop-check.mjs --check accent step (n)", status: pass }
    human_judgment: true
    rationale: "Owner confirmed the × is a clean square on PC and phone"
  - deliverable: "Option-button rules apply only to direct children; the five colour options keep their look"
    verification:
      - { kind: command, ref: "10-desktop-check.mjs --check accent steps (j)-(l)", status: pass }
      - { kind: command, ref: "grep -c '.setting-options button' app/portia.css = 0; '.setting-options > button' = 3", status: pass }
    human_judgment: false
  - deliverable: "Gates and harness green on the production server"
    verification:
      - { kind: test, ref: "npm test 304 pass / 0 fail", status: pass }
      - { kind: command, ref: "npx tsc --noEmit exit 0; eslint 0 errors; npm run build OK", status: pass }
      - { kind: command, ref: "10-boot-check.mjs + 10-desktop-check.mjs --check assistant|accent|embeds|zoom|toast, all ok:true", status: pass }
    human_judgment: false
  - deliverable: "Owner sees a neutral grey desktop for #0D0D0D and #808080, a recoloured desktop for clear colours, a muted pick (#6B4A4A) that looks like the pick, and a working preset round trip"
    human_judgment: true
    rationale: "Owner replied 'verified' on PC and phone"
  - deliverable: "WR-01 recorded as fixed, open 7 -> 6"
    verification:
      - { kind: command, ref: "grep '^open: 6$' 10-REVIEW-DISPOSITION.md = 1", status: pass }
    human_judgment: false
---

# Phase 10 Plan 09: Picker × button and owner device check Summary

**The «Свой» picker's × is now a clean 24x24 button on a 1920x1080 PC and a 390x844 phone (option-button rules scoped with `.setting-options >`, plus `line-height: 1` on the × so the glyph is not clipped), and the owner confirmed on both devices that black, grey and coloured picks and the preset round trip look right.**

## Accomplishments

- **G-10-2 / WR-01 fixed.** The settings option-button rules (base, hover, selected) matched every descendant button of `.setting-options`, so the picker nested inside it inherited `min-height: 54px` and stretched the ×. They now use the child combinator (`.setting-options > button`, 3 sites, 0 descendant sites left). The five colour options keep their look (harness steps (j)-(l) still pass).
- **Harness step (n)** in `10-desktop-check.mjs` measures the × (24x24, glyph inside, click closes the picker) on PC and phone, waiting 600 ms for the Settings window-open animation before measuring and keeping diagnostic fields in the failure message.
- **Ledger.** `10-REVIEW-DISPOSITION.md` records WR-01 as fixed with commit 90a0231 and the harness proof; open 7 -> 6.
- **Owner check (Task 3, approved "verified").** On PC and phone: × button, black #0D0D0D, grey #808080, coloured picks including muted #6B4A4A, and switching to a preset and back to «Свой».

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 (tracer) | 90a0231 | scope settings option buttons to direct children (G-10-2, WR-01) |
| 1 (docs) | e9914b1 | WR-01 recorded as fixed |
| 2 | none | gates and harness checks only |
| 3 | none | owner verification, "verified" |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] × glyph still clipped after the combinator change**
- **Found during:** Task 1 (harness step (n) on the production build)
- **Issue:** The combinator change alone gave the 24x24 box, but the glyph was clipped: the inherited line-height produced a 24px line box against a 22px content box (scrollHeight 24 vs clientHeight 22).
- **Fix:** Added `line-height: 1` to `.custom-color-picker-head button` (app/portia.css:678) in the same commit. Step (n) now waits 600 ms for the window-open animation before measuring.
- **Files modified:** app/portia.css, 10-desktop-check.mjs
- **Commit:** 90a0231

Otherwise the plan was executed as written.

## Verification

- `npm test`: 304 pass, 0 fail. `npx tsc --noEmit`: exit 0. `npx eslint app lib components`: 0 errors (14 pre-existing `<img>` warnings). `npm run build`: OK.
- Production server (`next start -p 3124`, fresh build): `10-boot-check.mjs` custom, neutral, hostile, preset all true (customProps 11); `10-desktop-check.mjs --check assistant | accent (steps a-n) | embeds | zoom | toast`: six verdicts `ok: true`, `reasons: []`.
- No non-GET request reached /api/content during any check; the server on port 3124 was stopped afterwards.
- Acceptance greps: `.setting-options button` 0, `.setting-options > button` 3, `^open: 6$` 1, 90a0231 is a commit.

## Known Stubs

None.

## Threat Flags

None. CSS and harness changes only; no new endpoint, input path or storage.

## Self-Check: PASSED

- app/portia.css, 10-desktop-check.mjs, 10-REVIEW-DISPOSITION.md exist; commits 90a0231 and e9914b1 are ancestors of HEAD.
