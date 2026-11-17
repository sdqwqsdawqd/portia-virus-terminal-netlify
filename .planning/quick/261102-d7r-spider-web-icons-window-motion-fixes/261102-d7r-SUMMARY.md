---
quick_id: 261102-d7r
phase: quick-261102-d7r
plan: 01
subsystem: desktop-motion
tags: [spider, web, shortcut-icons, window-motion, css, tests]
status: complete
requirements: [QUICK-261102-d7r]
key-files:
  modified:
    - app/portia.css
    - components/portia-wallpaper.tsx
    - components/portia-wallpaper-spider.tsx
    - lib/wallpaper-web.ts
    - lib/wallpaper-web.test.ts
    - lib/accent-theme.test.ts
    - lib/portia-desktop.test.ts
    - tests/e2e/visual-candidates/motion.spec.ts
    - .planning/phases/PORTIA-18-rabochiy-stol-okna-i-zhivye-animatsii/18-MOTION-APPROVAL.md
decisions:
  - "Web sway (D-09) and spider body outline (approval item 3) recalled by the owner; web is still in all modes, spider has no outline"
  - "Owner-delegated: spider no longer spins on the spot at route start; it curves into the new heading while the legs step (turnGate + turn-driven gait)"
  - "Owner-delegated: 6-10 s pauses between routes kept unchanged"
commits: 5
plan_head_before: 51401765262451c1f4032b863670ea282528a366
plan_head_after: 6222cf8a6f78b31b6883a0a39b28dc5719ce42d2
actuals:
  tokens: 14000
  tasks: 3
  commits: 5
node: "22.13.1 (reference, from %TEMP%\\portia-node-v22.13.1)"
completed: 2026-11-02
---

# Quick 261102-d7r: spider, web, shortcut icons and window motion fixes

Six owner remarks to Phase 18 live motion fixed in three tasks (plus one owner-delegated spider turn change): still web, spider without outline and without jumps at start and stop, shortcut cycles that settle softly and draw their lines fully, a smaller "База вирусов", a window that fades in smoothly.

## Commits

| Commit | Content |
| ------ | ------- |
| 1e4bf53 | Task 1: still web, no outline, `laneTarget` / `followStep`, simulation test |
| 398ae0b | Owner-delegated: spider curves into a new route with stepping legs (`turnGate`) |
| 7c79b89 | Task 2: shortcut keyframes, `icon-write-32`, virus icon size |
| 523c395 | Task 3: window open in Включены and Уменьшены |
| 6222cf8 | Lint fix in my simulation test (`const` destructuring) |

## Causes found

**Task 1 (web, spider)**
1. The 18-05 sway moved the whole wallpaper layer with the spider by 1-2px over 22 s. Thin threads and a standing spider hopped across the pixel grid: the "ragged web" and "spider that shifts at any moment".
2. The 1px 38% teal stroke from 18-05 landed on every `.wallpaper-spider-dark`, i.e. also the dark parts of all eight legs. The full silhouette became visible, so the spider looked bigger and outlined. Its scale was not changed in 18-05 (same formula in the diff).
3. Motion: the body follows its target exponentially (0.16 s) and lags by about 5.6 units. On `pose.done` the target was copied into the body, so the lag vanished in one frame: stop, then a lurch forward. At route start the target jumped onto the lane beside the new thread (up to ~42 units for a 90 degree turn), and the body ran there roughly 4x faster than walking speed: the sideways dart.

**Task 2 (shortcut icons)**
- (i) In eight keyframes the last segment into the rest frame ran on `--ease-in`: the part accelerates and is cut at full speed, a click into the static icon. Fixed: icon-scan, icon-focus (search), icon-broadcast-wave (broadcasts), icon-settings-rails (settings), icon-promotion-level (promotion), icon-lift, icon-stamp (charter), icon-scribble (editor). Each got a small overshoot frame at 84-90% and an explicit 100% rest frame, so the last segment runs on the rule's `--ease-out`. Properties that cannot overshoot (opacity, scale 1.035) get a near-rest value (opacity .94, scale 1.01). `icon-hop` and `icon-lid` also got an explicit 100% frame, because the new test requires one wherever there are intermediate frames (no visual change).
- (ii) "Таблица" and "Редактор" drew the line with `stroke-dasharray: 16`, but `vector-effect: non-scaling-stroke` makes dashes count in screen px: a 16-unit line is ~24 px at the largest icon (62px), so the tail appeared as a jump when the class was removed. Now `icon-write-32` with `stroke-dasharray: 32` (`icon-write-16` removed, the kept-keyframes list in the test updated).
- (iii) The "Справка" lines had `stroke-dasharray` inside the keyframes. It is a discrete property and flipped at 50% of the cycle, so the line became whole at once. Now `stroke-dasharray: 16` is on the rules, `icon-info-line` animates only offset and opacity.

**Task 3 (window)**
1. Уменьшены: the blanket reduced rule has specificity (0,2,2), the old window rule (0,2,1); both `!important`, so the blanket won and the open fade became `.01ms`: the window popped in. Close/minimise rules at (0,3,1) won, so closing dissolved. New selector `html[data-motion="reduced"] .app-window:not(.is-closing, .is-minimizing)` is (0,3,1).
2. Включены: opening was 280ms on `--ease-out` cubic-bezier(.16, 1, .3, 1), which reaches ~85% opacity in the first quarter and reads as a flash next to the soft close. Now `window-open var(--motion-base) ease-out` (240ms, plain CSS ease-out), frames identical to `window-close` (opacity 0, scale .97), no translate (the 18-04 nod is untouched). Выключены: nothing added, instant through the blanket rule.

## Decisions kept literally

- Approval item 1 (560ms, `--ease-out` on the action, `--ease-in` on the return, last frame = rest) is kept; the return ends in a small overshoot, and the entry into rest is on the rule's `--ease-out`, like settings/info/guide/promotion-base/virus already were. 560ms, shifts <= 90ms and the 700ms timer unchanged.
- "Уменьшить" for "База вирусов" = scale ~0.86 through CSS: `.desktop-icon-symbol[data-icon="virus"] svg` 50% (others 58%) and `.start-panel-icon[data-icon="virus"] svg` 16px (others 19px). Artwork in `components/portia-icons.tsx` untouched, line width unchanged (non-scaling-stroke), shortcut frame does not move. Taskbar and window icons carry no `data-icon` and are deliberately unchanged.
- 18-MOTION-APPROVAL.md: table rows untouched; a dated note "Примечание 2026-11-02 (quick 261102-d7r)" appended with the owner's quotes (item 3 recalled; D-09 sway recalled).

## Owner-delegated decisions ("по желанию, но чтобы выглядело естественным")

The two open questions were answered by the owner through the coordinator after the plan was written; the plan's "do not change" notes were overridden for them. Feel is left to the owner's browser review.

1. **In-place turn at route start: changed.** New `turnGate(turn)` in `lib/wallpaper-web.ts` (1 within 60 degrees off heading, 0 from 90 degrees, smoothstep between). The route clock `walked` advances by `dt * turnGate(turn)`, so the spider turns first (still capped by `MAX_TURN_RATE` / `turnStep`, same turn speed) and starts walking once within 90 degrees, curving into the new direction instead of sliding backwards or sideways. While turning, the gait distance grows with the turned angle (`TURN_STEP_RADIUS = 20` units per radian, about walking cadence) and the gait amplitude stays on while more than `TURN_STEP_MIN` (0.02 rad) is left to turn, so the legs step during any rotation, also at route end, and never turn on frozen legs. No waves from turn steps (only walking footfalls make waves). Unit tests: `turnGate` (values, symmetry, monotone, a 180 degree turn releases the clock after ~0.4-1 s) and a structural test of the tick wiring.
2. **Pauses between routes (6-10 s): kept.** `rest = 6 + rand() * 4` unchanged (tested: exactly two occurrences, `rand()` call count unchanged at 11, so the seeded route sequence is unchanged). The stop-to-start transition has no snap: the body eases onto its rest point (`followStep` + snap under 0.01 unit) and legs ramp down over `GAIT_EASE`.

## Verification (real results)

- Node 22.13.1 (reference).
- `bash .claude/skills/portia-check/run.sh build`: **all checks passed** (exit 0): unit tests 886 pass / 0 fail / 3 skipped of 889 (the skips are pre-existing, not from this plan) plus the visual-manifest test suite 37/37, `tsc --noEmit` clean, `npm run lint` 0 errors / 18 warnings (all pre-existing `@next/next/no-img-element`), `phase15-visual-manifest.mjs --verify-promotion` passed, `npm run build` succeeded. A first run caught 4 `prefer-const` lint errors in my simulation test; fixed in 6222cf8 and re-run green.
- `npm exec playwright -- test --list`: compiles, 220 tests in 13 files (`motion.spec.ts` 25 tests). No frames captured, no candidate capture run.
- TDD: tests were red before the change for the structural checks (web layer, outline, keyframes, dasharray, virus size, window rules). The spider simulation was written against both schemes: the previous scheme (lane jump, copy on arrival) violates the step bound in 24 seeds x 3 routes, the new one has 0 violations. The simulation checks the start only on the straight run before the first corner and the stop only once the heading is final (within 0.01 rad): a lane point swinging round a sharp rounded corner inside the first 60 units moves up to ~2.9x walking speed under either scheme (route geometry, not the start jump).
- `git diff --name-only HEAD -- tests/e2e/visual .planning/phases/PORTIA-15-baseline`: empty. `components/portia-icons.tsx` and `components/portia-desktop-shortcuts.tsx` unchanged. Owner paths not staged or modified. `lib/wallpaper-web.ts` showed modified only by line endings before; the committed diff is the 21-line content change.

## Waiting for the owner in the browser (NOT a pass by the executor)

1. Web is still with the spider on and off in Включены.
2. Spider has no outline and is back to its previous size; stop without a lurch; new route starts without a sideways dart; the new curving turn with stepping legs looks natural.
3. All 12 shortcuts on the desktop (normal, compact, large) and in "Пуск": cycles end softly without a click; "Таблица", "Редактор", "Справка" draw their lines to the end.
4. "База вирусов" is smaller and balanced with the other 11.
5. A window fades in smoothly in Включены and Уменьшены, appears at once in Выключены; reopening an already open window still gives the previous nod.

Still BLOCKED, not touched: authenticated roles, Postgres/RLS, staging/production, physical devices.

## Deviations from Plan

**1. [Owner scope change] Spider turn at route start** - changed per the coordinator message (see above), commit 398ae0b, with tests.

**2. [Rule 3 - test needs] explicit 100% in `icon-hop` and `icon-lid`** - the new "explicit 100%" test requires it; rest value only, no visual change.

**3. [Rule 1 - test bound] simulation bounds** - the plan's "no step over 2 x speed x dt while distance < blend / near the stop" is violated by corner geometry itself (even with the lane held fixed), so the start check is limited to the straight run and the stop check to frames already in the final heading. The plan's key claim (previous scheme fails, new passes) holds.

**4. [Process] Lint errors in my test** - `let` -> `const`, commit 6222cf8.

## Known Stubs

None.

## Threat Flags

None (client-side CSS and pure motion functions only; no new network, auth or storage surface).

## Self-Check: PASSED

All five commits are ancestors of HEAD (`git rev-list --count 51401765..HEAD` = 5); the modified files listed above exist; portia-check with build passed.
