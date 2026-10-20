---
phase: 02-vneshniy-vid
plan: 04
subsystem: ui
tags: [motion, css-animations, reduced-motion, windows, taskbar, loading-states]

requires:
  - phase: 02-03
    provides: "interface font and Vivian label (unchanged here)"
provides:
  - "«Анимации» setting (system / on / off) resolved to html[data-motion=full|reduce] before first paint"
  - "Motion language tokens (--motion-*, --ease-out, --ease-in) and window exit machinery (requestExit / finishExit)"
  - "macOS-like windows: zoom from icon, scale into / out of the taskbar button, short close"
  - "Per-icon hover animations for all 10 app icons; press + taskbar hop; drag to reorder the taskbar"
  - "LoadingState + contentReady / employeesReady; image and iframe loaders"
  - "Document print-out reveal; content cross-fade on switches; living web wallpaper"
affects: [02-05, 02-06]

actuals:
  tokens: 30000
  tasks: 4
  commits: 9

tech-stack:
  added: []
  patterns:
    - "Motion gate = html[data-motion=\"full\" | \"reduce\"] (no bare prefers-reduced-motion media query; test enforces it)"
    - "Reduced motion = short opacity fades for state changes, no movement (global net + targeted !important fades)"
    - "Exit animations finish by timer constants equal to the CSS durations, never animationend"
    - "Loaders appear only after 150 ms (loader-appear delay), so ready data never flashes them"
    - "Stored settings are applied/saved only after restore (desktopSettingsLoaded / taskbarOrderLoaded flags)"

key-files:
  created: []
  modified: [components/portia-desktop.tsx, components/portia-wallpaper.tsx, app/portia.css, lib/accent-boot.ts, lib/accent-theme.test.ts]

key-decisions:
  - "Plan revised at review: macOS-like windows, loading indicators, icon press + Dock hop, taskbar reorder, instant (later: cross-faded) switches"
  - "The user's OS requests reduced motion, so an «Анимации» setting was added; default follows the system"
  - "Genie minimise dropped after user feedback (looked cheap): macOS 'Scale' into the taskbar button instead"
  - "Documents (Корзина files, scientist logs) print out top to bottom; record / profile / section switches cross-fade 200 ms"
  - "Every app icon has its own hover act (scan, spike, hop, ripple, fold+write, sliders, stamp, grid, lid, scribble)"
  - "Web wallpaper sways around its hub and carries glints along the spokes (overrides D-12 'no new wallpaper animation' at the user's request)"
  - "Vivian's animations (D-14) are reworked in plan 02-05, per the user"

patterns-established:
  - "New motion: add to the motion block in portia.css, gate with html[data-motion=\"full\"], give reduce a fade or nothing"

requirements-completed: []

coverage:
  - id: D1
    description: "Motion setting and reduced-motion behaviour"
    requirement: LOOK-03
    verification:
      - kind: unit
        ref: "lib/accent-theme.test.ts#the motion setting overrides the system, and follows it by default"
        status: pass
    human_judgment: true
    rationale: "Feel of reduced vs full motion judged by the user"
  - id: D2
    description: "Window open / close / minimise / restore, icon hover / press, taskbar hop and reorder, document print-out, web wallpaper motion"
    requirement: LOOK-03
    verification:
      - kind: automated_ui
        ref: "browser: computed animation names / durations / origins per state and per hovered icon; taskbar drag reorder persisted"
        status: pass
    human_judgment: true
    rationale: "Animation quality is visual; user reviewed three rounds and approved with the wallpaper fix"
  - id: D3
    description: "Loading indicators only while data is loading"
    requirement: LOOK-03
    verification:
      - kind: automated_ui
        ref: "browser: sheet iframe loader invisible at 60 ms, visible at 460 ms, gone after load"
        status: pass
    human_judgment: true
    rationale: "Slow-network appearance checked by the user"

duration: 4 h
completed: 2026-10-13
---

# Phase 2 Plan 04: Desktop motion Summary

**A single motion language for PORTIA OS: windows zoom from icons and scale into the taskbar, documents print out, every app icon acts out its own hover, the taskbar hops and reorders by drag, data shows a loader only while it is actually loading, the web wallpaper keeps living — all switchable through a new «Анимации» setting that follows the system by default.**

## What was built

- **Motion setting (`aead1a1`).** Настройки → «Анимации»: Как в системе / Включены / Выключены. The head script resolves it to `html[data-motion]` before first paint; the desktop keeps it live. All motion CSS is gated on that attribute (test enforces no bare `prefers-reduced-motion` query).
- **Bug fixed on the way:** settings were saved (and accent / motion applied) before the stored values were restored; React's dev double-mount lost the visitor's choice and the default accent flashed for a frame. Now gated by `desktopSettingsLoaded`.
- **Windows (`ad41492`, `7886cb2`, `08c3d79`, `398c0ec`).** `requestExit` / `finishExit` with timers (close 180 ms, minimise 320 ms, reduced 120 ms fade); focus moves at once; re-open cancels an exit. Open from icon zooms from 0.3 (340 ms); minimise scales to 0.08 into its taskbar button and restore grows back out (340 ms); default open rises 18 px from 0.93 (280 ms).
- **Icons and taskbar (`3fcda6e`, `398c0ec`).** Press to .93 without overshoot; the taskbar entry of an appearing window hops once (380 ms gravity curve). Drag entries with mouse/pen to reorder (`portia-taskbar-order-v1`, filtered to known apps); touch keeps scrolling. Each of the 10 icons has its own hover act, also on keyboard focus and in the start menu.
- **Loading (`dd48dc9`).** `contentReady` / `employeesReady` from cache restore or settled fetch; `LoadingState` (role=status) in the archive list and dossier, employee list and profile, search, «Информация», announcements, Корзина; dossier photos and the sheet iframe show it until load. Every loader fades in only after 150 ms.
- **In-window (`08c3d79`).** Корзина documents and scientist logs: viewer rises while the page prints out top to bottom (560 ms). Record / employee / section switches: 200 ms cross-fade. The old slides were removed.
- **Wallpaper (`5b489ec`).** «Паутина» sways around its hub (19 s) and glints run along its spokes (9 s cycle).

## Review rounds with the user

1. Plan review → revision (macOS windows, loaders, taskbar drag, press + hop, instant switches).
2. "Animations look like junk, too fast or absent, documents flat" → found the OS reduced-motion cause, added the setting's fade path, replaced the genie and the 10 % zoom, unified timings, added the document print-out.
3. "Bring back hover on every icon, a bit more window motion" → per-icon acts, stronger window / document motion.
4. "Web is static after drawing; Vivian is lacklustre" → living web here; Vivian → plan 02-05.

## Deviations from Plan

- **[User revision] Scope and timings** — see Review rounds; D-13's 150–250 ms relaxed to 180–560 ms for windows and documents at the user's request.
- **[User revision] D-12 wallpaper** — the web wallpaper now animates after the draw-in (user request).
- **[Rule 1 - Bug] Settings restore race** — fixed as above.
- **[Rule 2 - Missing critical] Reduced motion erased all feedback** — now fades instead of cutting.
- **Taskbar reorder has no keyboard path** (order is cosmetic; every entry stays reachable by Tab).

**Total deviations:** 2 auto-fixed, several user revisions. **Impact:** more motion than D-13 originally allowed, all switchable off.

## Verification

- npm test 25/25, tsc clean, lint 0 errors, build OK, Impeccable detector 0 findings
- Browser: computed animations per window state, per hovered icon, loader timing, taskbar reorder persistence, motion setting persistence across reloads

## Next

Ready for 02-05 (boot spider + terminal lines, Vivian reworked per user feedback).

## Self-Check: PASSED
