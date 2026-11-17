---
phase: PORTIA-09-tselostnost-kontenta
plan: 01
subsystem: ui
tags: [svg, css-animation, wallpaper, compositor, edge-trace, cdp]

requires:
  - phase: PORTIA-07
    provides: wallpaper layer, motion gate html[data-motion], reduce rule for the wallpaper block
provides:
  - "headless Edge trace script comparing one wallpaper with the quiet baseline (09-wallpaper-trace.mjs)"
  - "DNA helix as one composited three-loop layer, 60 s per loop, seam exact"
  - "gel bands creeping down their lanes under a stronger glow"
  - "cells that drift, change shape and push apart; floating virions"
affects: [09-02 spider on the web wallpaper, 09-07 owner PC and phone check]

actuals:
  tokens: 7200
  tasks: 3
  commits: 3

plan_head_before: 9c9e784ba0358ff88cea7058d6cd64d95a68ab03
plan_head_after: 8c0552b89cc3b841d35bac424e6bb43878a9c9c9
commits: 3

tech-stack:
  added: []
  patterns:
    - "Layer animations on an outer <svg> use transform, not the individual translate property (Edge keeps translate off the compositor)"
    - "Per-element animation data as inline custom properties (--gel-from, --cell-dx, --particle-dx) read by one shared keyframe"
    - "Motion stream (seeded 17) separate from the drawing stream (seeded 5), so the still picture never changes"

key-files:
  created:
    - .planning/phases/PORTIA-09-tselostnost-kontenta/09-wallpaper-trace.mjs
  modified:
    - components/portia-wallpaper.tsx
    - app/portia.css

key-decisions:
  - "helix-scroll moves with transform: translate3d(0, calc(100% / -3), 0) and will-change: transform; the traced cause was translate on the outer svg, not the container-query unit"
  - "Cell sharp-zone factor stays 0.8; the trace passed without lowering it"
  - "Drift phase uses the plan formula verbatim (lane * 13.7 s), so a band does not start exactly at its drawn y once motion is on"

patterns-established:
  - "Trace every new wallpaper animation against the quiet baseline with 09-wallpaper-trace.mjs"

requirements-completed: [BG-01]

coverage:
  - id: D1
    description: "DNA helix glides: one composited three-loop layer, helix-scroll 60 s, seam exact"
    requirement: BG-01
    verification:
      - kind: automated_ui
        ref: "node 09-wallpaper-trace.mjs --wallpaper grid --expect-composited"
        status: pass
    human_judgment: true
    rationale: "60 fps without stepping on the owner's PC and phone cannot be judged in headless Edge without a GPU (backstop truth, 09-07)"
  - id: D2
    description: "Gel bands creep down their lanes and re-enter at the top, stronger breathing glow, ladder still"
    requirement: BG-01
    verification:
      - kind: automated_ui
        ref: "node 09-wallpaper-trace.mjs --wallpaper gel (motion on and off)"
        status: pass
    human_judgment: true
    rationale: "Calm, readable motion speed and glow strength are a visual judgment"
  - id: D3
    description: "Cells drift, change shape and push apart in anti-phase; virions float and tumble"
    requirement: BG-01
    verification:
      - kind: automated_ui
        ref: "node 09-wallpaper-trace.mjs --wallpaper cells (motion on and off)"
        status: pass
    human_judgment: true
    rationale: "Whether the motion reads as living tissue is a visual judgment"
  - id: D4
    description: "With «Анимации: Выключены» no wallpaper animation runs and everything sits at its drawn position"
    requirement: BG-01
    verification:
      - kind: automated_ui
        ref: "node 09-wallpaper-trace.mjs --wallpaper grid|gel|cells --motion off"
        status: pass
    human_judgment: false

duration: 100min
completed: 2026-10-25
status: complete
---

# Phase 9 Plan 01: Wallpaper motion Summary

**Edge-traced fix of the DNA helix (one composited three-loop layer moved with transform), plus gel bands that creep down their lanes under a stronger glow and living cells with floating virions, all gated by html[data-motion="full"]**

## Performance

- **Duration:** about 100 min (start time was not captured at launch; estimated)
- **Completed:** 2026-10-25T11:25:08Z
- **Tasks:** 3
- **Files modified:** 3 (1 created, 2 edited)

## Accomplishments

- Trace script `09-wallpaper-trace.mjs`: dependency-free, headless Edge over CDP, measures a wallpaper against «Без фона» in the same run, prints one JSON verdict, kills Edge and deletes its profile in `finally`.
- Helix: drawn over three loops (2160 units), layer moved by a third of its own height in 60 s (12 units/s). After the fix `helix-scroll` is reported composited.
- Gel: bands in lanes 1-8 creep at 6 units/s, fade out in the bottom fade and back in at the top; each band has its own phase; ladder and labels still; glow factors 3 / 0.16, breathing 8 s from .5.
- Cells: each cell of the sharp zone (under 0.8 of the eyepiece radius) is its own group drifting 12 units, swelling 5 percent, turning 2 degrees; neighbours in anti-phase on a polar checkerboard; nucleus wanders 2 units; virions float 18 units and still tumble.

## Trace results (Edge 156, headless, production build on :3124, 10 s windows)

Cause finding (Task 1). The plan's hypothesis was the container-query unit inside the keyframe. The "before" trace shows `helix-scroll` not composited (`compositeFailed` 524288), but isolated probes show the container unit is not the cause: on a plain probe page a `translate` animation fails on an `<svg>` element whether it uses px, a percentage, a container unit or sits under `container-type: size`, passes on a `<div>` in all those cases, and an animation of `transform` on the `<svg>` passes. So Edge keeps a `translate` animation on an outer `<svg>` on the main thread; the three-loop retile alone did not change that (re-trace after step 4 still failed with 524288). The plan's last fallback (`transform: translate3d(0, calc(100% / -3), 0)`, `will-change: transform`) fixed it. The `.system-bar` blur steps of the plan were skipped because the measured cause pointed elsewhere (the bar was never a factor: baseline and result both held 0 frames over 20 ms).

| Run | Code | Key numbers | Verdict |
|---|---|---|---|
| grid, before | `translate` keyframe on svg, 90 s, container unit | helix-scroll composited: false (524288); framesOver20 0 (baseline 0); paints/s 2.2 (baseline 2.0) | not ok: "helix-scroll is not composited" |
| grid, after retile with `translate` | three loops, 60 s, `calc(100% / -3)` | helix-scroll composited: false (524288) | not ok (same cause) |
| grid, after (final) | `transform: translate3d(0, calc(100% / -3), 0)` | helix-scroll composited: true; framesOver20 0 (baseline 0); maxFrame 7.2 ms (baseline 7.5); paints/s 2.2 (baseline 2.0); long tasks 0 | ok |
| gel, motion on | final | framesOver20 0 (baseline 0); maxFrame 13.9 ms (baseline 7.5); gel-glow composited, gel-creep not (SVG child); 111 running animations; paints/s 307.1 (baseline 2.0) | ok |
| gel, motion off | final | running animations 0; paints/s 2.2 (baseline 2.0) | ok |
| cells, motion on | final, sharp zone 0.8 | framesOver20 0 (baseline 0); maxFrame 14.0 ms (baseline 7.6); 335 running animations, all five animations non-composited (SVG children); paints/s 307.1 | ok |
| cells, motion off | final | running animations 0; paints/s 2 (baseline 2) | ok |
| grid, motion off | final | running animations 0; paints/s 2.2 (baseline 2.0) | ok |

Direct measurement on the final build (viewport 1896 x 988, scale 1.3167): the grid layer is 2844 px tall (2160 x scale) and moves 15.85 px/s (12 x scale); a gel band moves 7.9 px/s downward (6 x scale).

## Task Commits

1. **Task 1 (tracer): helix retile + trace script** - `5c3e4be` (fix)
2. **Task 2: gel bands creep, stronger glow** - `13fae94` (feat)
3. **Task 3: living cells and floating virions** - `8c0552b` (feat)

**Plan metadata:** committed after this file (docs: complete plan)

## Files Created/Modified

- `.planning/phases/PORTIA-09-tselostnost-kontenta/09-wallpaper-trace.mjs` - CDP trace of one wallpaper against the quiet baseline; flags `--url --wallpaper --motion --seconds --expect-composited --expect-spider` (plus `--debug-events` for diagnosis); exit 0/1/2
- `components/portia-wallpaper.tsx` - three-loop helix, `GEL_SPEED` and per-band drift data with `GelDrift` wrapper, `cellField()` returning per-cell records, `CELL_SHARP_ZONE`
- `app/portia.css` - `helix-scroll` (transform, 60 s), `gel-creep`, `gel-glow` 8 s, `cell-drift`, `cell-shape`, `nucleus-wander`, `particle-drift`; group-level `cells-drift` removed

## Decisions Made

- Fixed the helix with `transform` after measuring that Edge refuses to composite `translate` on an outer `<svg>`; this also tells later plans (09-02 spider) not to animate `translate` on an outer svg when compositing matters.
- Kept the cell sharp-zone factor at 0.8: the cells trace passed without lowering it.
- Followed the plan's drift-delay formula as written (`lane * 13.7` s term), which keeps lanes 3 and 4 out of step.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Trace script could not see compositing verdicts**
- **Found during:** Task 1
- **Issue:** the plan reads `args.data.compositeFailed` from "Animation" events, but the real trace splits an Animation into a "b" event (with `displayName`, `name` empty) and a later "n" event (with `compositeFailed`) joined by `id2.local`; animations that started before the trace emit nothing.
- **Fix:** join events by `pid:id2.local`, name by `displayName`; flip `html[data-motion]` off and on right after `Tracing.start` so the page's own CSS recreates the animations inside the window (a manual `cancel()`/`play()` was tried first and is not used).
- **Files modified:** 09-wallpaper-trace.mjs
- **Committed in:** 5c3e4be

**2. [Rule 1 - Bug] Plan's diagnosis hypothesis was wrong; fallback fix applied directly**
- **Found during:** Task 1, step 5
- **Issue:** the retile (step 4) left `helix-scroll` non-composited; probes proved the cause is `translate` on an `<svg>`.
- **Fix:** applied the plan's last fallback (`transform: translate3d(0, calc(100% / -3), 0)`, `will-change: transform`) without the intermediate `.system-bar` blur change, since the measurement ruled the bar out. The acceptance criterion offers this variant explicitly.
- **Files modified:** app/portia.css
- **Committed in:** 5c3e4be

**3. [Plan acceptance literal] `grep -c "wallpaper-gel-drift" components/portia-wallpaper.tsx` prints 1, plan asks at least 2**
- **Found during:** Task 2
- **Issue:** the core and the glow wrappers both render through one shared `GelDrift` component, so the class name appears once in the source. The intent (a wrapper for the core and one for the glow, moving together) is met and shows in the trace as 111 running animations.
- **Fix:** none; deliberately not duplicating the string to satisfy the count.

**Total deviations:** 2 auto-fixed (both Rule 1) and 1 acceptance-literal note.
**Impact on plan:** none on behaviour; the helix cause is documented with evidence for later plans.

## Issues Encountered

- One mid-task trace of the retiled grid returned `runningAnimations: 0` and no animation events (the page was apparently measured before the helix animation existed); an identical re-run immediately after showed the animation running. Treated as a one-off headless timing flake; later runs were stable.
- Pre-existing working-tree changes in `.planning/STATE.md`, `.planning/milestone.lock`, `.planning/state.json` were left untouched by task commits.

## Known Stubs

None.

## Threat Flags

None. The trace script opens a local debugging port only while it runs (headless Edge, throwaway profile in the temp dir, killed and deleted in `finally`; verified no listener left on 3124/3125 and the profile directory gone).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for 09-02 (spider on «Паутина»); the trace script already supports `--expect-spider`.
- Risk for 09-07 (owner PC and phone check): gel and cells animate SVG children, so they repaint on the main thread every frame (about 307 paints/s in headless Edge against 2/s for the quiet baseline) while staying within the plan's frame budget (0 frames over 20 ms). Phone 60 fps for these two is not proven by the trace; first lever if the phone stutters is `CELL_SHARP_ZONE` (0.8 to 0.7, 0.6, 0.5), never the amplitude.

---
*Phase: PORTIA-09-tselostnost-kontenta*
*Completed: 2026-10-25*

## Self-Check: PASSED

- FOUND: .planning/phases/PORTIA-09-tselostnost-kontenta/09-wallpaper-trace.mjs, components/portia-wallpaper.tsx, app/portia.css
- FOUND commits: 5c3e4be, 13fae94, 8c0552b (ancestors of HEAD)
- Gates: npm test 253 pass / 0 fail; npx tsc --noEmit clean; npx eslint app lib components 0 errors (14 warnings, as baseline); npm run build passes
