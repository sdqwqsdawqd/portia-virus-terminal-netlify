---
phase: PORTIA-01-ispravlenie-bagov
plan: 01
subsystem: ui
tags: [nextjs, next-font, css, iframe, ibm-plex-serif, cyrillic]

requires: []
provides:
  - "User WIP (embedded-document zoom, darkreader-lock, empty-archive subtitle removal) committed on its own"
  - "Embedded «Устав»/«Таблица» fill the window body at every zoom step, windowed/maximized/375px"
  - "IBM Plex Serif (latin+cyrillic, 400/600/700) behind a --serif token, replacing the legacy serif"
affects: [PORTIA-02-vnesnii-vid (LOOK-02 interface font), PORTIA-03-redaktor]

actuals:
  tokens: 3940
  tasks: 3
  commits: 3
plan_head_before: 39c56f88de0e87d6c4f14c8a792c0e07a6116dcf
plan_head_after: 2be14170200ba53b3454844eee3416b8ed13b393
commits: 3

tech-stack:
  added: []
  patterns:
    - "Embedded iframe sized by percentages against an absolutely positioned viewport box, then transform: scale(zoom)"
    - "Font families as next/font CSS variables on <html>, consumed through :root tokens (--serif next to --mono/--sans/--display)"

key-files:
  created: []
  modified:
    - app/layout.tsx
    - app/portia.css
    - components/portia-desktop.tsx

key-decisions:
  - "Plex Serif weights 400/600/700 (not 400/600): the editor «Толщина» control offers 400/600/800 and the family tops out at 700"
  - "No italic style loaded: rich text has no italic option, the only italic (placeholder) uses --sans"
  - "Mobile .document-app height set to calc(100svh - 142px), measured, instead of the plan's 140px starting guess"

requirements-completed: [FIX-02, FIX-03]

coverage:
  - id: D1
    description: "Finished WIP committed as its own commit before any fix, containing exactly the three WIP files"
    verification:
      - kind: other
        ref: "git show --name-only ecaf6a4 lists app/layout.tsx, app/portia.css, components/portia-desktop.tsx only; lint/tsc/test green on it"
        status: pass
    human_judgment: false
  - id: D2
    description: "«Устав» and «Таблица» iframe covers the whole .document-app at zoom 50/100/200 % in windowed, maximized and 375px states; zoom bar stays a compact overlay"
    requirement: FIX-02
    verification:
      - kind: automated_ui
        ref: "CDP getBoundingClientRect probe (Edge headless), iframe vs .document-app within 1px for both documents x 9 states; app bottom == window inner bottom; bar and external link 36px tall on one line at 375px"
        status: pass
    human_judgment: true
    rationale: "Geometry is measured, but the cross-origin page content inside the iframe was not visually inspected; the original crop was never reproduced"
  - id: D3
    description: "Editor rich-text fields, scientist logs and archive paragraphs render in IBM Plex Serif with Cyrillic; focusing an editor field keeps the family"
    requirement: FIX-03
    verification:
      - kind: automated_ui
        ref: "CDP CSS.getPlatformFontsForNode on probe nodes with the three production classes: IBM Plex Serif for all, also after focus; Cyrillic glyphs rendered"
        status: pass
    human_judgment: true
    rationale: "Probed on synthetic nodes carrying the real classes, not on the live editor behind owner login; visual weight difference of «ЖИРНЫЙ» vs «СРЕДНИЙ» not eyeballed"

duration: 5min
completed: 2026-10-12
status: complete
---

# Phase PORTIA-01 Plan 01: WIP commit, Устав fill (FIX-02), IBM Plex Serif (FIX-03) Summary

**User's zoom/Dark Reader WIP landed as its own commit, embedded documents pinned to an absolutely positioned viewport so they fill the window at any zoom, and the legacy serif replaced by next/font IBM Plex Serif behind a `--serif` token.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-10-12T19:23:29Z
- **Completed:** 2026-10-12T19:27:48Z
- **Tasks:** 3
- **Files modified:** 3 (app/layout.tsx, app/portia.css, components/portia-desktop.tsx)

## Accomplishments

- WIP committed untouched (no stash, reset or edits) as `feat(desktop): zoom embedded documents, lock Dark Reader`, with lint (0 errors, 13 warnings), tsc and 13/13 tests green first.
- `.document-app-viewport` is now `position: absolute; inset: 0` and its iframe `position: absolute; top: 0; left: 0`, so the inline `100/zoom %` size resolves against a definite box instead of a percentage-height chain. Zoom math, listeners and iframe attributes untouched.
- Mobile `.document-app` height moved from `calc(100svh - 150px)` to `calc(100svh - 142px)`, closing a measured 9px gap above the window's bottom edge at 375px.
- `IBM_Plex_Serif` loaded through `next/font/google` (no new dependency), exposed as `--font-plex-serif`, consumed by `--serif`; used by `.formatted-rich-input`, `.scientist-rich-text`, `.archive-document-section p`. The focus rule no longer overrides `font-family`. Zero `Georgia` left in the repo sources.

## Task Commits

1. **Task 1 (tracer): commit the finished WIP** - `ecaf6a4` (feat)
2. **Task 2: «Устав»/«Таблица» fill the whole window (FIX-02)** - `d2c2909` (fix)
3. **Task 3: IBM Plex Serif (FIX-03)** - `2be1417` (fix)

**Plan metadata:** committed separately (docs: complete plan).

## Files Created/Modified

- `app/layout.tsx` - WIP (darkreader-lock, suppressHydrationWarning) in task 1; `plexSerif` font and `<html>` class in task 3
- `app/portia.css` - WIP zoom rules in task 1; absolute viewport/iframe and mobile height in task 2; `--serif` token and four font replacements in task 3
- `components/portia-desktop.tsx` - `EmbeddedDocument` zoom WIP in task 1 (no phase changes after)

## Decisions Made

- Weights 400/600/700 and no italic for Plex Serif (reasons in key-decisions).
- `white-space: nowrap` on `.document-app-external` was not added: at 375px the link measured 36px tall on one line, so the plan's conditional did not trigger.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mobile document area stopped 9px short of the window bottom**
- **Found during:** Task 2 (step 1 measurement)
- **Issue:** `.document-app` mobile height `calc(100svh - 150px)` left `.document-app` bottom at 761 vs window inner bottom at 769 (375x812).
- **Fix:** `calc(100svh - 142px)` (42px title bar + 2px borders + 98px page chrome), giving a 0px difference. The plan's suggested 140px would overflow the window's min-height by 2px.
- **Files modified:** app/portia.css
- **Verification:** CDP probe, both documents: app bottom minus window inner bottom is 0.0
- **Committed in:** d2c2909

### Other differences

- **Commit trailer:** the plan specifies `Co-Authored-By: Claude Opus 5.5`; the harness attribution instruction for this run names `Claude Sonnet 5.5` (the model actually executing), so all three commits carry that trailer.
- **FIX-02 reproduction:** before any edit, the WIP already satisfied the plan's geometry criteria on desktop (iframe rect equal to `.document-app` at all zooms, windowed and maximized, both documents), because `.document-app` has a definite height. The only defect measurable in Edge headless was the 9px mobile gap above. The originally reported crop was therefore not reproduced; the absolute-positioning change is the plan's prescribed hardening that removes the percentage-height dependency (likely culprit in other browsers or in the pre-WIP code), not a confirmed fix of a measured desktop crop. A human check in the user's real browser is advisable.

**Total deviations:** 1 auto-fixed (Rule 1), 2 noted differences. **Impact:** no scope creep; one CSS value tuned by measurement.

## Issues Encountered

None blocking. Browser verification used a throwaway Chrome DevTools Protocol script (Edge headless) kept in the scratchpad, not in the repo, because no browser-automation package is installed and none was added.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 01-02 (FIX-01, FIX-04, FIX-05) can proceed. `app/portia.css` and `components/portia-desktop.tsx` are clean (no uncommitted work in source files).
- Uncommitted `.planning/STATE.md`, `.planning/config.json`, `.planning/state.json` and untracked `.planning/milestone.lock` belong to the orchestrator and were not touched or committed by task commits.
- Pending for UAT: visual check of the live editor (owner login) that «ЖИРНЫЙ» is visibly heavier than «СРЕДНИЙ», and a real-browser look at «Устав»/«Таблица».

---
*Phase: PORTIA-01-ispravlenie-bagov*
*Completed: 2026-10-12*

## Self-Check: PASSED

All three task commits are ancestors of HEAD; app/layout.tsx, app/portia.css, components/portia-desktop.tsx exist.
