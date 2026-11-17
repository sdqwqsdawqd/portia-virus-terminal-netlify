---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 09
subsystem: ui
tags: [shortcut-icons, svg, css-animation, will-change, pixel-diff, playwright-candidates]
requires:
  - phase: 18-03
    provides: the 560ms shortcut cycle, is-icon-animating timer, source-test helpers for the 12 icons
  - phase: 19-08
    provides: wave 4 baseline (4d2a3e9 carries it)
provides:
  - Rest rule per animated icon part (12 icons, both hosts) equal to the last keyframe, outside the animating selector
  - Constant transform-box/origin, shape-rendering and will-change for icon parts, independent of is-icon-animating and html[data-motion]
  - Source tests for rest = last keyframe, and tests/e2e/visual-candidates/icon-rest.spec.ts (pixel diff of the last cycle frame vs the frame after the class is gone)
  - 19-ICON-REST.md with getTotalLength measurements, the measured cause of the jump and a 54-row diff table
affects: [19-14]
status: complete
actuals:
  tokens: 13800
  tasks: 3
  commits: 3
plan_head_before: 4d2a3e934de41f4fd9e6db45120085d141b2e851
plan_head_after: c86372ba0043b21ad3b2d7a6f88f9b1936ff5b6c
tech-stack:
  added: []
  patterns:
    - "Every animated shortcut-icon part has one rest rule with the same selector as its cycle rule, declaring the 100% keyframe values; the cycle rule carries only `animation`"
    - "Pixel-diff of an animation's last frame vs rest: park CSSAnimations on endTime - 0.001ms via the Web Animations API (page.clock stops timers, not the CSS timeline), capture, let the class timer remove it, capture again, compare RGBA in the page"
key-files:
  created:
    - tests/e2e/visual-candidates/icon-rest.spec.ts
    - .planning/phases/PORTIA-19-povyshenie-prilozheniya-redaktor-poisk-i-media/19-ICON-REST.md
  modified:
    - app/portia.css
    - lib/portia-desktop.test.ts
key-decisions:
  - "Root cause of the post-cycle jump, measured: parts are composited while they animate and rasterised in the parent layer at rest; a constant will-change (only the composited properties each part animates) puts rest and last frame on the same raster path (diff 330 px -> 0 on settings)."
  - "Promotion levels: artwork opacity .65 vs last keyframe 1 (fill both) was a real brightness jump; per plan rule 4 the rest is changed to opacity 1, keyframes and artwork untouched. Visible static change, flagged for the owner."
  - "will-change lives in the ungated rest rules (all motion modes) so rest looks the same in full, reduced and off."
  - "Playwright lane ran on a webpack `compile`-mode build served by `next start` on port 3100 from this worktree (Turbopack build fails on the node_modules junction; full build fails type-check on the absent .claude/hooks/guard.mjs). Ports 3000/3001 and `next dev` untouched."
requirements-completed: []
requirements-advanced: [STAB-MOTION-05]
---

# Phase 19 Plan 09: Shortcut icon rest = last keyframe Summary

After the 560ms cycle every shortcut icon now stays pixel-for-pixel on its last frame: each animated part declares its 100% keyframe values as a permanent rest, and a constant `will-change` keeps rest and cycle on the same raster path. Measured on chromium-desktop, chromium-dpr125 and chromium-phone: 54 icon/host/project pairs, all `diff = 0`, against ten-to-hundreds of differing pixels per pair on the base commit for 8 of the 12 icons.

## Performance

- **Duration:** not measured (single session)
- **Tasks:** 3 of 3 (Task 1 tracer, Task 2 auto/tdd, Task 3 auto)
- **Files:** 2 created, 2 modified; `components/portia-icons.tsx`, `tests/e2e/visual/` and all `@keyframes` untouched

## Accomplishments

- **Task 1 (tracer, f20ac4f):** «Информация». Measured `getTotalLength` of the info lines (7, 7, 4.5), added rest rules for page, fold and lines (constant dasharray 16, offset 0, origin, will-change), wrote the Playwright candidate and the source test. Info diff on chromium-desktop: 99 px before, 0 after. Tracer gate passed end to end before expansion.
- **Task 2 (c27e5e0):** the remaining 11 icons, one rest rule per cycle rule; animating rules reduced to `animation:` only; the animation-less broadcast-signal origin rule moved to rest; `shape-rendering: geometricPrecision` for `.start-panel-icon svg`; source tests generalised (all 12 icons, only-`animation` in animating rules, constant origins, no `will-change` under the class, will-change = animated composited properties).
- **Task 3 (c86372b):** full spec run and `19-ICON-REST.md`: 72 tests, 54 passed with `diff = 0`, 18 skipped because the host does not exist (start panel lists 5 apps only). `editor` has no host anywhere and is checked on a synthetic host built from the real artwork paths.

## Verification

| Check | Result |
|-------|--------|
| `node --experimental-strip-types --test lib/portia-desktop.test.ts lib/accent-theme.test.ts` | 84 pass, 1 fail (pre-existing, see Deferred Issues) |
| `npm test` | 971 pass, 2 fail (both pre-existing) |
| `npm exec tsc -- --noEmit` | one error, pre-existing (`.claude/hooks/guard.mjs` absent in worktree) |
| `npm run lint` | 0 errors, 19 warnings (none in changed files) |
| `playwright test .../icon-rest.spec.ts --list` | 120 tests (24 per project x 5 projects), required 24 |
| `playwright test .../icon-rest.spec.ts` (chromium-desktop, chromium-dpr125, chromium-phone, port 3100) | 54 passed, 18 skipped (no host), every row `diff = 0` |
| Base-commit control run | 8 of 12 icons non-zero (settings desktop 330 px at DPR 1): the method detects the jump |
| `lib/phase15-visual-manifest.test.ts` | 37 pass |
| `node scripts/phase15-visual-manifest.mjs --verify-promotion` | exit 0, 33 approved snapshots verified |
| `git diff --name-only 4d2a3e9 HEAD -- components/portia-icons.tsx tests/e2e/visual/` | empty |
| `@keyframes` lines in the CSS diff | none |
| `npm run build` | not runnable in this worktree (env), see Environment |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Promotion levels dropped from opacity 1 to .65 after the cycle**
- **Found during:** Task 1 measurement (promotion diff 217 px at DPR 1)
- **Issue:** artwork sets `opacity=".65"` on the two level strokes, the last keyframe holds `opacity: 1` (`both`); removing the class snapped them to .65.
- **Fix:** rest `opacity: 1` for both levels (plan rule 4: change the rest, not keyframes or artwork). This is a visible change of the static icon.
- **Files modified:** app/portia.css
- **Commit:** c27e5e0

**2. [Rule 3 - Blocking] Hypothesis in the plan (dasharray/origin only under the class) was not the cause**
- **Found during:** Task 1 measurement
- **Issue:** a covering dasharray renders like a solid line (sheet and editor were already diff 0). The measured cause is compositing: animated parts live in their own composited layer during the cycle and in the parent layer at rest.
- **Fix:** constant `will-change` per part in the rest rules, limited to the composited properties the part animates; still never tied to the class, so the plan's rule 3 holds. The plan's rest/dasharray/origin changes are in as specified.
- **Files modified:** app/portia.css, lib/portia-desktop.test.ts
- **Commit:** f20ac4f, c27e5e0

**3. [Rule 2 - Missing critical] Transitional dasharray test in Task 1**
- Task 1 narrowed the write-on test to sheet/editor (info's dasharray moved to rest) and covered info in the tracer test; Task 2 restored the unified loop. No lasting effect.

### Plan wording adjusted

- The plan's "560ms minus one frame" for the last-frame capture became "endTime minus 0.001ms of each cycle animation, parked through the Web Animations API", because `page.clock` fakes timers and `Date` but not the CSS animation timeline; the cycle is 560ms plus up to 90ms offsets, so a single 560ms point would not be the last frame of every part.
- The spec uses `focus()` as the trigger (same `play()` as hover and touch, works on every project) instead of hover.

## Environment

- Node 22.13.1 (reference version is the default `node` here).
- `npm run build`: Turbopack cannot resolve `next` through the `node_modules` junction, and a full webpack build stops at type-check because `.claude/hooks/guard.mjs` (untracked in the main tree) is missing. For the Playwright lane the CSS was built with `next build --webpack --experimental-build-mode compile` and served by `next start --port 3100` from this worktree (`PORTIA_E2E_BASE_URL`). The process was stopped afterwards. The plan's verification line `npm run build` is therefore **not run**, not passed.
- The `generate` build step errors on a `proxy.js` to `middleware.js` rename but leaves a complete `.next` that starts and serves (checked: HTTP 200, spec ran against it).

## Deferred Issues

- `lib/portia-desktop.test.ts` "editor form cards keep one fixed width ... (D-15)" fails at the base commit 4d2a3e9 and after (not touched by this plan; cause not investigated).
- `lib/phase16-guard-boundary.test.ts` and `tsc` fail only because `.claude/hooks/guard.mjs` is absent from the worktree.
- Signed Phase 15 visual baselines: `tests/e2e/visual` (chromium-desktop/dpr125/phone) already had 12 failing tests on the base build before any change; the phase15 manifest verification of the approved bytes passes. Not investigated here.

## Known Stubs

None.

## Threat Flags

None. CSS and tests only; no new endpoints, auth paths or schema. T-19-21 held: snapshots only under the git-ignored `tests/e2e/visual-candidates/.runs/`, `tests/e2e/visual/` untouched, `--verify` not run. T-19-SC: no packages installed.

## Open for the owner (goes to 19-14)

- **BLOCKED (owner device):** physical PC and phone verdict "no icon jump after the cycle" (UI E9 overflow). Not recorded as a pass.
- Static look changes to confirm by eye: promotion levels now full brightness at rest; parts now raster as on the last cycle frame (a touch softer than the old uncomposited rest on some icons).
- Not pixel-tested: `reduced` and `off` modes (rest rules are ungated, source-tested), Firefox and webkit-phone (not in the plan's lanes).

## Self-Check: PASSED

- FOUND: app/portia.css, lib/portia-desktop.test.ts, tests/e2e/visual-candidates/icon-rest.spec.ts, 19-ICON-REST.md
- FOUND commits: f20ac4f, c27e5e0, c86372b (ancestors of HEAD)
