---
phase: PORTIA-05-oformlenie-teksta
plan: 05
subsystem: ui
tags: [css, react, window-motion, info-app, settings]
status: complete

requires:
  - phase: PORTIA-05 plan 04
    provides: shared app/portia.css, components/portia-desktop.tsx
provides:
  - windows open and close with opacity + scale .97 around their own centre (icon zoom removed)
  - one-line ellipsised subsection buttons in PORTIA://INFORMATION with a title tooltip
  - compact nested subsection/block cards and add buttons in the editor's Информация tab
  - Settings -> Содержимое сайта no longer has a 260px empty band on narrow screens
affects: []

actuals:
  tokens: 3500
  tasks: 2
  commits: 2
plan_head_before: 2d0b1b1182f635ccc0a99fdb42e6aa89d1ce47a9
plan_head_after: 819b10bf17253f6fd40c8109514f9197711b264e

tech-stack:
  added: []
  patterns:
    - "AppWindow origin effect clears the inline transform-origin when there is no taskbar target"

key-files:
  created: []
  modified: [components/portia-desktop.tsx, app/portia.css]

key-decisions:
  - "05-05: windows open and close with opacity + scale .97 around their centre; the icon zoom is removed (D-14)"

requirements-completed: []
---

# Phase 5 Plan 5: Window motion, compact Информация, Settings height Summary

Windows now fade in and out in place (opacity + scale .97, no rise, no icon zoom, no slide toward the icon on close); subsection entries are one ellipsised line on the site and denser in the editor; the Settings content block hugs its content on phones.

## Tasks

| Task | Commit | What |
|------|--------|------|
| 1 (tracer) | bacbdf9 | `window-open`/`window-close` keyframes = opacity + scale .97; `window-zoom` rule and keyframes deleted; AppWindow effect drops the icon target and sets `transformOrigin = ""` when there is no taskbar target. WINDOW_CLOSE_MS stays 180. window-restore, window-minimize and reduced-motion fades untouched. |
| 2 | 819b10b | `.info-subsections` margin/padding tightened; subsection button grid `auto minmax(0, 1fr)`, padding 5px 8px, title one line with ellipsis, `title` attribute on the button; phone sub-buttons `flex: 0 0 auto; max-width: 190px`; editor `.info-subsection-list` / `.info-block-list` gap 6px, cards padding 8px 10px, add buttons 6px 10px; `.content-control-entry > div:first-child { flex: 0 0 auto; }` inside the 900px block. |

## Verification

- `npm test` (192 pass), `npx tsc --noEmit`, `npm run build`: exit 0. `npm run lint`: 0 errors, 14 warnings (existing `<img>` warnings, not from this plan).
- Both plan node gates pass ("window motion OK", "compact info and settings OK"); run from script files because the Windows shell layer halves backslashes in `node -e` regexes (the gate as written in the plan returns false negatives there).
- Human checks (visual: window motion, compact cards, Settings band) NOT performed; left for UAT. No СОХРАНИТЬ was pressed and nothing was PUT to /api/content.

## Deviations from Plan

None - plan executed as written. Gate regexes were re-expressed without backslashes only to run them under this shell; the checked conditions are identical.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- bacbdf9 and 819b10b are ancestors of HEAD; components/portia-desktop.tsx and app/portia.css contain the planned strings.
