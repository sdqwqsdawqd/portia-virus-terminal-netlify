---
phase: PORTIA-09-tselostnost-kontenta
plan: 07
subsystem: verification
tags: [owner-check, wallpaper, trace, review-ledgers, gel, spider]

requires:
  - phase: PORTIA-09-tselostnost-kontenta
    provides: plans 09-01 .. 09-06 (wallpaper motion, spider, content integrity, editor limits and dates)
provides:
  - green gates and traces of every wallpaper, motion on and off, on a production server
  - the owner's acceptance of BG-01 on PC and phone, and of the editor behaviours without saving
  - gel bands on their own composited layer (WallpaperGelStrip) instead of animating inside the wallpaper svg
  - a smaller spider with a springy tetrapod gait whose waves fire only on footfall
  - 03.1, 03.2 and 03.3 review ledgers recording what phase 9 closed, with commits and proofs
affects: [phase-10]

actuals:
  tokens: 14000
  tasks: 3
  commits: 4

plan_head_before: 7f007a4
plan_head_after: 9089b0ecd11cf35d3c9e6d5120dd86116bd64bdf
commits: 4

tech-stack:
  added: []
  patterns:
    - "A moving wallpaper layer is an HTML element moved by transform and opacity only; static masks and baked blur give the soft edges, so the compositor does the work and the main thread paints about 3 times a second"
    - "Leg motion is a pure pose function (legPose) with stance sweep, swing tuck and overshoot, per-pair lag; waves are emitted when a leg group plants"

key-files:
  created:
    - .planning/phases/PORTIA-09-tselostnost-kontenta/09-07-SUMMARY.md
  modified:
    - .planning/milestones/v1.0-phases/PORTIA-03.1-stabilizatsiya/03.1-REVIEW-DISPOSITION.md
    - .planning/milestones/v1.0-phases/PORTIA-03.2-sotrudniki-i-svodka/03.2-REVIEW-DISPOSITION.md
    - .planning/milestones/v1.0-phases/PORTIA-03.3-sotrudniki-vne-tablitsy-i-gaydy-v-informatsii/03.3-REVIEW-DISPOSITION.md
    - app/portia.css
    - components/portia-wallpaper.tsx
    - components/portia-wallpaper-spider.tsx
    - lib/wallpaper-web.ts
    - lib/wallpaper-web.test.ts

key-decisions:
  - "Gel bands move as one HTML strip sliding a full period, so the compositor moves them; all lanes now move in unison and the ladder glow no longer breathes"
  - "The spider's artwork is unchanged (the owner's re-sent SVG has identical paths); only its size (97.425 to 72 units) and motion changed"
  - "Review ledger cells cite owner steps 8-13 as covered; step 13 was not reported skipped, so it is cited as covered"

patterns-established:
  - "Owner acceptance of motion work is on the owner's devices; a traced fix that the owner re-checks is part of the same plan"

requirements-completed: [BG-01, SYNC-01, CONT-01, CONT-02, CONT-03, CONT-04, CONT-05, CONT-06, CONT-07, CONT-08]

duration: n/a (owner-paced checkpoint)
completed: 2026-10-25
status: complete
---

# Phase 9 Plan 07: Prove the phase on the running site Summary

**Gates green, every wallpaper traced, the owner accepted the wallpapers and the editor on PC and phone after three motion fixes (composited gel, a smaller springy spider, soft gel edges), and the three review ledgers now record the ten findings phase 9 closed.**

## Performance

- **Tasks:** 3 of 3
- **Completed:** 2026-10-25
- **Files modified:** 3 ledgers plus the five source files touched by the owner-requested fixes

## Accomplishments

- Task 1 (tracer): `npm test` 283/283, `npx tsc --noEmit` clean, `npx eslint app lib components` 0 errors (14 warnings, baseline), `npm run build` ok; production server on port 3124 answered `/api/content` with `content` and `revision`; eight traces (grid, radar, gel, cells with motion on and off) passed. No commit, by plan.
- Task 2 (owner check, blocking): the owner first reported two mismatches, both on the wallpapers; everything else, including editor steps 8-13 and the reversed quest date block, matched. After the fixes below the owner answered "verified".
- Task 3: ledgers updated and committed (9089b0e). The checker prints `open=9 total=23` for 03.1 and `open=2 total=10` for 03.2.

## Checkpoint outcome

| Step group | First answer | Final |
|------------|--------------|-------|
| Spider, helix, cells, motion off, accent, phone (1, 2, 4-7) | spider too big and stiff (step 1) | verified after 5a3d55f |
| Gel (3) | moved stop-go and harsh on PC, fine on phone | verified after d0884a7 and 2b223a5 |
| Editor (8-13) | verified | verified |

## Task Commits

1. **Task 1 (tracer): gates and traces** - no commit (plan says none)
2. **Task 2 (owner check): fixes made after the owner's first answer**
   - `d0884a7` fix(09-07): gel bands glide on their own composited layer (BG-01)
   - `5a3d55f` fix(09-07): smaller spider with a springy tetrapod gait and footfall waves (BG-01)
   - `2b223a5` fix(09-07): soft edges on the moving gel bands so they do not shimmer row by row (BG-01)
3. **Task 3: ledgers** - `9089b0e` docs(09-07): record findings closed by phase 9 in review ledgers

## Findings recorded as closed

| Ledger | Findings | Commits |
|--------|----------|---------|
| 03.1 | WR-04 | e7b8c5a, ac744c2 |
| 03.1 | WR-07 | cecae1e, caa3dd7, ac744c2, de54afc, 8e1b849 |
| 03.1 | WR-08 | 0089167 |
| 03.1 | WR-09 | caa3dd7, ac744c2, e6ebaee |
| 03.1 | WR-12 | caa3dd7, ac744c2 |
| 03.1 | IN-08 | 204a7e9 |
| 03.2 | WR-01 | e7b8c5a, ac744c2 |
| 03.2 | IN-04 | e6ebaee |
| 03.2 | IN-05 | 0e77220 |
| 03.3 | WR-01 | cecae1e, de54afc, 8e1b849 |

## Decisions Made

- Gel motion moves into an HTML strip (`WallpaperGelStrip`) that slides one period by `transform`; the glow breathes by `opacity`; a static mask makes the fades. Trace: both layers composited, about 3 paints per second (was about 307), 0 frames over 20 ms.
- The spider shrank from 97.425 to 72 units wide (in `app/portia.css`). `legPose()` in `lib/wallpaper-web.ts` (tested) gives the stance sweep back, the swing tuck with overshoot forward, a per-pair lag and a body bob at footfall. Pulses are emitted only when a leg group plants; the timer pulses and the arrival pulse were removed.
- A vertical `feGaussianBlur` is baked into the static gel strip (core 1.6, glow 4) so the moving bands do not shimmer row by row.

## Deviations from Plan

### Owner-requested fixes

**1. [Rule 1 - Bug, owner-requested] Gel wallpaper moved stop-go on PC**
- **Found during:** Task 2, step 3 (owner's first answer)
- **Issue:** the bands animated inside the wallpaper svg and repainted the main thread (about 307 paints per second in the trace)
- **Fix:** bands moved to a composited HTML strip; lane phase offset dropped (all lanes move in unison); the ladder glow no longer breathes
- **Files modified:** components/portia-wallpaper.tsx, app/portia.css
- **Commit:** d0884a7

**2. [Rule 1 - Bug, owner-requested] Spider too big and stiff**
- **Found during:** Task 2, step 1 (owner's first answer)
- **Issue:** legs swung stiffly left-right with no elasticity; waves ran on timers instead of steps. The owner re-sent the spider SVG; its paths match the shipped artwork, so only size and motion changed
- **Fix:** width 97.425 to 72 units; `legPose()` with a tetrapod gait; waves only on footfall
- **Files modified:** lib/wallpaper-web.ts, lib/wallpaper-web.test.ts, components/portia-wallpaper-spider.tsx, app/portia.css
- **Commits:** d0884a7 (width), 5a3d55f (gait)

**3. [Rule 1 - Bug, owner-requested] Gel bands shimmered row by row once composited**
- **Found during:** re-trace after fix 1
- **Fix:** baked vertical blur in the static strip
- **Commit:** 2b223a5

**Total deviations:** 3 owner-requested fixes (all Rule 1). Impact: two wallpaper motion behaviours differ from the 09-01 and 09-02 summaries (gel lanes in unison, spider size and gait); the owner accepted both.

Gates after the fixes: `npm test` 284/284, `npx tsc --noEmit` clean, build ok, gel trace ok (composited), radar on and off and gel off traces ok. The 3124 server was stopped by the orchestrator before Task 3 (T-09-15).

## Issues Encountered

None beyond the owner's two mismatches above.

## Known Stubs

None.

## Threat Flags

None. No content was saved and `PUT /api/content` was never called (T-09-14); the LAN-bound server was stopped before the ledger task (T-09-15).

## Next Phase Readiness

All ten phase 9 requirements (BG-01, SYNC-01, CONT-01..08) are implemented and owner-accepted. Open review findings remain in 03.1 (9) and 03.2 (2) for later phases. Limit states at 400 rows were not exercised by the owner and rest on unit tests and greps (stated in the ledger rows).

## Self-Check: PASSED

- FOUND: the three ledger files (modified, checker prints `open=9 total=23` and `open=2 total=10`)
- FOUND commits in HEAD: d0884a7, 5a3d55f, 2b223a5, 9089b0e
- `git show --stat 9089b0e` lists only the three ledger files
