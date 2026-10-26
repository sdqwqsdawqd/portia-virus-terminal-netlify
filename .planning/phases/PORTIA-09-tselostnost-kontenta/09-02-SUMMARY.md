---
phase: PORTIA-09-tselostnost-kontenta
plan: 02
subsystem: ui
tags: [svg, wallpaper, requestAnimationFrame, spider, web-geometry, node-test]

requires:
  - phase: PORTIA-09 plan 01
    provides: "09-wallpaper-trace.mjs (--expect-spider), the quiet-baseline trace method, the finding that transform (not translate) is what Edge composites on an outer svg"
provides:
  - "lib/wallpaper-web.ts: one geometry (270 crossings, 522 threads) for drawing and walking, walk pose, visible crossings, walk planner, pulse pool"
  - "WallpaperSpider: the owner's spider (09-spider.svg) as static JSX, 8 legs with gait, one animation-frame loop, wave overlay"
  - "«Паутина» web drawn from the shared geometry (path strings byte-identical to before), whole-web sway removed"
affects: [09-07 owner PC and phone check]

actuals:
  tokens: 13165
  tasks: 3
  commits: 4

plan_head_before: 288f4d9ddaf8b6b4948621e4a744f33c533111a3
plan_head_after: 25dadcb0111f5758b67a1bb01d9305c6181483f6
commits: 4

tech-stack:
  added: []
  patterns:
    - "Pure node-tested module under lib/ that a client component reads for both drawing and animation, so the two cannot drift"
    - "One requestAnimationFrame loop per animated component: layout read once in setup and by ResizeObserver, DOM writes only, no React state, started and stopped from a MutationObserver on html[data-motion] and visibilitychange"
    - "Fixed-size pulse pool (8 slots): no allocation per step, cost has a ceiling"

key-files:
  created:
    - lib/wallpaper-web.ts
    - lib/wallpaper-web.test.ts
    - components/portia-wallpaper-spider.tsx
  modified:
    - components/portia-wallpaper.tsx
    - app/portia.css

key-decisions:
  - "The artwork's head points down its +y axis (eyes and fangs below the abdomen), so ARTWORK_HEADING is pi/2"
  - "The body centre (325, 360) is the anchor on the thread; the spider box is placed so that point sits on the crossing (translate -50% -46.875%, same transform-origin)"
  - "A child pulse at a crossing is born at the crossing time with half the peak (fresh 1.2 s fade), not inheriting the parent's age"
  - "planWalk drops the 2-4 hop rule below 6 visible crossings and when no 2-4 hop target exists; it prefers a target other than the crossing just left"

patterns-established:
  - "Trace and screenshot a new wallpaper animation in headless Edge against the production build on :3124 (09-wallpaper-trace.mjs plus a CDP screenshot)"

requirements-completed: [BG-01]

coverage:
  - id: D1
    description: "One geometry module: 270 crossings on their spokes, 522 threads, ring pieces follow the drawn quadratic curve, rest crossing ring 5 spoke 3; the web path strings are unchanged"
    requirement: BG-01
    verification:
      - kind: unit
        ref: "lib/wallpaper-web.test.ts#web geometry has 270 crossings and 522 threads between them"
        status: pass
      - kind: unit
        ref: "lib/wallpaper-web.test.ts#a spoke crossing lies on its spoke line and a ring segment follows the drawn curve"
        status: pass
      - kind: unit
        ref: "lib/wallpaper-web.test.ts#the rest crossing is ring 5, spoke 3"
        status: pass
    human_judgment: false
  - id: D2
    description: "The owner's spider appears at its rest crossing, walks along real threads at 36 units/s with 400 ms easing, 2-4 crossings inside the visible area, never back, pausing 3-6 s; legs swing by gait; turns follow the heading"
    requirement: BG-01
    verification:
      - kind: unit
        ref: "lib/wallpaper-web.test.ts#walkPose stays on the threads and eases in and out"
        status: pass
      - kind: unit
        ref: "lib/wallpaper-web.test.ts#planWalk goes 2-4 crossings over visible nodes and never back to the one just left"
        status: pass
      - kind: automated_ui
        ref: "node 09-wallpaper-trace.mjs --wallpaper radar --expect-spider"
        status: pass
    human_judgment: true
    rationale: "How the gait and turns look, and 60 fps without stutter on the owner's PC and phone, cannot be judged in headless Edge without a GPU (backstop truth, 09-07)"
  - id: D3
    description: "Footstep and arrival waves run along the threads, branch at crossings at half strength, at most 8 alive, gone by 1.2 s"
    requirement: BG-01
    verification:
      - kind: unit
        ref: "lib/wallpaper-web.test.ts#the pulse pool never holds more than 8 and a pulse dies by 1.2 s"
        status: pass
      - kind: unit
        ref: "lib/wallpaper-web.test.ts#a pulse that reaches a crossing continues into the other threads at half strength"
        status: pass
      - kind: unit
        ref: "lib/wallpaper-web.test.ts#pulseShape draws a 120-unit window on the thread with fading opacity and width"
        status: pass
    human_judgment: true
    rationale: "Whether the waves read as calm and alive is a visual judgment"
  - id: D4
    description: "With «Анимации: Выключены» the spider stands at its rest crossing with legs neutral, no wave is drawn, no wallpaper animation runs; the loop also stops on a hidden tab and on unmount"
    requirement: BG-01
    verification:
      - kind: automated_ui
        ref: "node 09-wallpaper-trace.mjs --wallpaper radar --motion off"
        status: pass
    human_judgment: false
  - id: D5
    description: "The jerky whole-web sway rotation and its keyframes are gone; spin-in and dew twinkle stay"
    requirement: BG-01
    verification:
      - kind: other
        ref: "grep -c web-sway app/portia.css prints 0"
        status: pass
    human_judgment: true
    rationale: "That the web now reads as calm needs the owner's eye (09-07)"

duration: 14min
completed: 2026-10-25
status: complete
---

# Phase 9 Plan 02: Spider on the web Summary

**The owner's spider walks along the «Паутина» threads (one shared geometry module, node-tested walk, planner and an 8-slot wave pool), with one frame loop and theme colours; the whole-web sway is gone**

## Performance

- **Duration:** 14 min
- **Started:** 2026-10-25T11:33:08Z
- **Completed:** 2026-10-25T11:47:16Z
- **Tasks:** 3 (Task 3 changed no file, so it has no commit)
- **Files modified:** 5 (3 created, 2 edited)

## Accomplishments

- `lib/wallpaper-web.ts`: the web's numbers in one place (hub, 18 spokes, 15 rings, sag points), 270 crossings and 522 threads, analytic points on threads, an arc-length table per thread, `walkPose` (36 units/s, 400 ms ease in and out, triangle profile when short), `visibleNodes` (xMaxYMin slice, 40-unit margin), `planWalk` (2-4 hops over visible crossings, never back, any visible crossing below 6), and a fixed 8-slot pulse pool (260 units/s, 120-unit window, 1.2 s life, half strength at crossings).
- `WallpaperSpider`: the owner's SVG as static JSX (empty Virus group dropped, three classes instead of three hard-coded colours), 8 leg groups assigned by geometry, `LEG_PIVOTS` measured from the path data, gait A/B with 12 degrees swing and a 0.8 s cycle, body turn eased to the heading, wave overlay of 8 paths, one `requestAnimationFrame` loop.
- Web path strings now come from the shared geometry; the old and new `web` object were compared and are byte-identical, so the drawing did not change.
- CSS: placement from the rest crossing with the web's own xMaxYMin mapping, theme fills (accent, `--desktop-base`, 30 percent accent in white), 600 ms fade-in after 1.8 s, reduce gate, sway rule and keyframes removed.

## Trace results (Edge 156, headless, production build on :3124, 10 s windows)

Radar, motion on, `--expect-spider` (exit 0):

```json
{"kind":"radar","motion":"on",
 "baseline":{"frames":1657,"maxFrameMs":7.2,"framesOver20":0,"paintsPerSecond":2,"longTasks":0,"runningAnimations":0,"spiderMoved":null},
 "result":{"frames":1834,"maxFrameMs":7.2,"framesOver20":0,"paintsPerSecond":261.6,"longTasks":0,
  "animations":[{"name":"web-dew","composited":false,"failed":131072},{"name":"web-draw","composited":false,"failed":8224},{"name":"web-dew-in","composited":true,"failed":0},{"name":"fade-in","composited":true,"failed":0}],
  "runningAnimations":16,"animationStatesAtStart":["web-draw:running","web-dew-in:running","web-dew:running","fade-in:running"],"spiderMoved":true},
 "ok":true,"reasons":[]}
```

Radar, motion off (exit 0):

```json
{"kind":"radar","motion":"off",
 "baseline":{"frames":1575,"maxFrameMs":7.3,"framesOver20":0,"paintsPerSecond":2,"longTasks":0,"runningAnimations":0,"spiderMoved":null},
 "result":{"frames":1575,"maxFrameMs":7.3,"framesOver20":0,"paintsPerSecond":2.2,"longTasks":0,"animations":[],"runningAnimations":0,"spiderMoved":false},
 "ok":true,"reasons":[]}
```

The spider is moved with `transform` on a `div` (composited, `will-change`); the only animations on the page are the web's own (spin-in, dew), which the trace lists as before. Paints per second (261.6 against 2) come from the legs and wave paths changing every frame, like the gel and cells in 09-01; the frame budget holds (0 frames over 20 ms, max 7.2 ms equal to the baseline).

Extra check outside the plan, with a throwaway CDP script (not committed): screenshots show the spider on the web at the rest crossing and turned along its travel direction mid-walk (heading about 55 degrees, moving down and right), and the 8 wave paths hold 8-point `d` values with opacities about .56 (steps) and .29 (half strength), then clear after the arrival wave.

## Task Commits

1. **Task 1 (tracer, TDD):** RED `5f0a464` (test), GREEN `9bdf58a` (feat)
2. **Task 2 (TDD):** RED `8b438f4` (test), GREEN `25dadcb` (feat)
3. **Task 3:** no commit (gates and traces passed with no file change, so the optional perf commit was not needed)

**Plan metadata:** committed after this file (docs: complete plan)

## TDD Gate Compliance

RED evidence for both cycles was classified with `gsd_run check tdd-red-evidence`: `RED_EVIDENCE_OK`, reason `target_test_failed`. Semantic assessment: against the stub module the target tests failed on the planned assertions (`nodes.length` expected 270 got 0; pool `slots.length` expected 8 got 0; `REST_NODE` expected 75 got 0), not on syntax, import or fixture errors. `seeded gives the same sequence for the same seed` passed in RED by design: the plan says to move `seeded` unchanged, so the stub already carried it. Each cycle has its `test(09-02)` commit before its `feat(09-02)` commit. No REFACTOR commit was needed.

## Files Created/Modified

- `lib/wallpaper-web.ts` - web geometry, edges, walk pose, visible crossings, planner, pulse pool
- `lib/wallpaper-web.test.ts` - 11 node tests
- `components/portia-wallpaper-spider.tsx` - `WallpaperSpider`, artwork, loop, wave overlay
- `components/portia-wallpaper.tsx` - web drawn from the lib, local `seeded` removed, radar layer renders the spider
- `app/portia.css` - spider rules, wave stroke, reduce gate entry, sway removed

## Decisions Made

- Head direction: the render shows eyes and fangs below the abdomen, so the artwork's head points along +y and `ARTWORK_HEADING` is pi/2.
- The anchor is the body centre (325, 360), not the box centre, so the translate and the transform-origin use 50% 46.875%.
- A wave that reaches a crossing spawns its children with a fresh 1.2 s fade at half the peak; the plan only fixed the half strength.
- `planWalk` falls back to any visible crossing (not the one just left when another exists) both below 6 visible crossings and when no 2-4 hop target is reachable.

## Deviations from Plan

None - plan executed exactly as written. Minor reading of the plan, not a deviation: `walkPose` also returns `edge`, `at`, `forward` and `distance` (the loop needs the thread under the spider for the waves, the tests need the distance), and the lib exports one helper beyond the plan's list, `emitAtCrossing`, used for arrival waves and for branching.

**Total deviations:** 0.
**Impact on plan:** none.

## Issues Encountered

- Two scratch-script mishaps, no effect on the repo: a shell-quoted `node -e` splice broke on an apostrophe in a comment (nothing was written; redone from a file), and a regex that was meant to drop the empty `Virus` group also swallowed the first leg group until it was corrected (caught by counting 7 legs instead of 8).
- The shell-script sentinel `git status` shows mixed LF/CRLF warnings on the touched files; line endings follow the repo's existing mix and were not changed on purpose.

## Known Stubs

None.

## Threat Flags

None. The artwork is static JSX (no `dangerouslySetInnerHTML`, no runtime markup); the loop starts only for the radar layer with motion full and a visible tab, is cancelled on hide and unmount, clamps dt, keeps at most 8 pulses and reads no layout (T-09-03, T-09-04 mitigated).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Ready for the rest of phase 9. For the owner check in 09-07: 60 fps on the owner's PC and phone is not provable in headless Edge; the visual calm of the web, the gait and the waves are judgment items. On a narrow phone the spider walks over the visible crossings only (390 px wide shows about a dozen).
- Known limit: if the window is resized so that the spider's current crossing falls outside the visible area and no visible crossing is reachable from it, it stays put (and off-screen) until the window grows again.

---
*Phase: PORTIA-09-tselostnost-kontenta*
*Completed: 2026-10-25*

## Self-Check: PASSED

- FOUND: lib/wallpaper-web.ts, lib/wallpaper-web.test.ts, components/portia-wallpaper-spider.tsx, components/portia-wallpaper.tsx, app/portia.css
- FOUND commits: 5f0a464, 9bdf58a, 8b438f4, 25dadcb (ancestors of HEAD; `check evaluation-scope --plan 09-02 --commits-only` lists them)
- Gates: npm test 272 pass / 0 fail; npx tsc --noEmit clean; npx eslint app lib components 0 errors (14 warnings, as baseline); npm run build passes; both radar traces ok
