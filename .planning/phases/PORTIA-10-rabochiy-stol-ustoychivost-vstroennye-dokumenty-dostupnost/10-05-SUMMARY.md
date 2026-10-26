---
phase: PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost
plan: 05
subsystem: desktop
tags: [iframe-sandbox, zoom, accessibility, headless-edge]
requires: ["10-04"]
provides:
  - "one shared embedSandbox on the sheet/charter frame and the YouTube frame, no allow-top-navigation"
  - "zoomModifier: Ctrl everywhere, Cmd only on a Mac, never the Windows key (D-21)"
  - "zoom layer clears on keyup, blur, hidden tab and the first unmodified pointer move or press"
  - "zoom reset button named by its visible percent only"
  - "10-desktop-check.mjs checks embeds and zoom"
affects: [10-07]
key-files:
  modified:
    - components/portia-desktop.tsx
    - lib/portia-desktop.test.ts
    - .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-desktop-check.mjs
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
decisions:
  - "D-21 recorded in REQUIREMENTS ZOOM-01 and ROADMAP Phase 10 criterion 3: Ctrl everywhere, Cmd on a Mac, never the Windows key"
metrics:
  duration: ~25 min
  completed: 2026-10-26
status: complete
actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: 032ea26ecf18f82172a5554bf190f0823a44f379
plan_head_after: 7bef37dbd896d5add85b2fdff27810c2653c37e4
commits: 2
---

# Phase 10 Plan 05: Sandboxed embeds and a zoom that never sticks Summary

«Таблица», «Устав» and the YouTube embed run in one sandbox set without top-navigation; document zoom follows Ctrl (Cmd on a Mac), cannot get stuck, and its reset button reads out the percent.

## Tasks

| Task | Commit | Result |
| ---- | ------ | ------ |
| 1 (tracer) shared sandbox | 61fd69e | `embedSandbox` constant, `sandbox={embedSandbox}` on both iframe tags; source test; harness `embeds` check (both documents load, their loading states disappear, video frame has the same sandbox and allowfullscreen) |
| 2 zoom modifier, layer clearing, percent name | 7bef37d | `zoomModifier` helper, visibilitychange listener, layer `onPointerMove`/`onPointerDown`, reset button without aria-label; two source tests; harness `zoom` check (a)-(h); ZOOM-01 and roadmap criterion 3 reworded |

## Verification

- `node --experimental-strip-types --test lib/portia-desktop.test.ts`: 4 pass, 0 fail. `npm test`: 298 pass, 0 fail. `npx tsc --noEmit` clean. `npx eslint app lib components`: 0 errors (14 pre-existing warnings). `npm run build` ok.
- Against `next start -p 3124`: embeds `ok: true` (both documents and the video frame loaded in headless Edge); zoom `ok: true` (two runs); assistant `ok: true`. The zoom check was first run against the previous build and failed on (b), (e), (f), (g) as expected, then passed on the new build. Server stopped.

## Deviations from Plan

**1. [Rule 1 - Bug] Source-test regexes broke on `=>`** — the first draft of the layer and reset-button patterns used `[^>]*`, which stops at the arrow of the inline handlers; switched to a same-line match. Test code only, no product impact.

Otherwise the plan was executed as written.

## Known Stubs

None.

## Threat Flags

None. T-10-08 mitigated (shared sandbox, no top-navigation, attribute pinned by a test); T-10-09 mitigated (harness steps (a)-(h)). The harness blocks any non-GET to /api/content; nothing was saved.

## Notes for 10-07

Device-only items stay with the owner check: sheet tab switching, links opening in a new tab and video fullscreen inside the sandbox; Cmd on a real Mac (here checked with a CDP platform override); a screen-reader listen to the reset button.

## Self-Check: PASSED

Commits 61fd69e and 7bef37d are in HEAD; all edited files exist; the harness, tests, tsc, eslint and build ran green.
