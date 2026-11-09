---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 03
subsystem: ui
tags: [wallpaper, spider, svg, css, playwright-candidates, sharpness, tdd]
requires:
  - phase: PORTIA-20
    provides: 20-01 wave-1 base (plan depends_on)
provides:
  - "Spider body and legs: opaque fills from --panel/--panel-2, #020706 contour; accent only in .wallpaper-spider-accent (eyes) (D-25/D-26)"
  - "lib/wallpaper-web.ts spiderTransform: one pure builder for the spider transform; resting shift on the device-pixel grid, no scale() (D-45)"
  - "will-change moves to .wallpaper-spider[data-spider-walking], set by the loop only while the spider moves (D-45)"
  - "tests/e2e/visual-candidates/phase20-art.spec.ts: accent/hide/motion-mode candidates and the rest-sharpness measurement for PC and phone"
affects: [20-10, 20-11, 20-14]
status: complete
actuals:
  tokens: 14000
  tasks: 3
  commits: 4
plan_head_before: f8b8f1a575fb82afde7ab4a75d786b05132fb394
plan_head_after: 17a80ba5787533cd188eb3da1cc13a4da91fb477
tech-stack:
  added: []
  patterns:
    - "Compositor layer only while moving: a data attribute set by the rAF loop gates will-change"
    - "Sharpness measured in the page (mean absolute Laplacian over an OffscreenCanvas) against an unmoved reference clone, factor by factor"
key-files:
  created:
    - tests/e2e/visual-candidates/phase20-art.spec.ts
  modified:
    - components/portia-wallpaper-spider.tsx
    - app/portia.css
    - lib/wallpaper-web.ts
    - lib/wallpaper-web.test.ts
    - lib/accent-theme.test.ts
key-decisions:
  - "The existing artwork paths were restyled, not redrawn point by point: silhouette, LEG_PIVOTS and the web geometry stay, so routes, sectors, gait and waves are untouched. The redraw is the palette, contour, leg segment banding and the new accent eyes; whether this satisfies the drawing is the owner gate 20-10."
  - "D-25 supersedes the quick 261102-d7r «no outline» rule, so the old accent-theme test was replaced by a contour check."
  - "The resting write snaps the shift to 1/dpr (at most half a device pixel) when the spider settles; accepted as invisible."
requirements-completed: []
duration: ~40 min
completed: 2026-11-04
---

# Phase 20 Plan 03: Dark outlined spider, accent only in details, sharp at rest Summary

The spider is now a dense, opaque dark-palette body with a dark contour and accent eyes. A resting spider is sharp on PC because the compositor layer is gone when it stands, which the measurements below confirm.

## What was done

**Task 1 (commit 5c4308a).** Body and legs are filled from `--panel` / `--panel-2` with `stroke: #020706`. The old accent-filled leg segments are now `wallpaper-spider-limb` (panel-2). The wrapper no longer sets `color: var(--teal)`. Four accent circles (eyes, `wallpaper-spider-accent`, `fill: var(--teal)`, no stroke) are the only accent. D-27 is untouched: `SettingGroup title="Паук"`, `html[data-spider="off"] .wallpaper-spider { display: none; }`, the dew and wave rules and the observer filter. Test «D-25/D-26» replaces «spider palette follows the accent».

**Task 2 (commit e79c82d).** `phase20-art.spec.ts` captures, on chromium-desktop and chromium-phone: the spider at rest on the default, very dark (`#1a1a1a`) and very light (`#f2f2f2`) «Свой» accents, with computed checks (opacity and fill-opacity 1, stroke not none, no body part filled with the accent, details filled with it); «Паук: Скрыть» (web visible, spider display none, dew and waves hidden, then off to on via the real switch); full walk with a 4 s gait trace; «Анимации: Выключены» chosen mid-step (legs neutral at once, no scale(), waves cleared, position held for 4 s, no will-change); «Уменьшены»; OS `prefers-reduced-motion` does not change `data-motion` (still `full`). Gait frame budget is recorded as BLOCKED.

**Task 3, TDD (commits efff12a RED, 17a80ba GREEN).** See D-45 below.

## D-45: cause of the blur, measured

Sets: `tests/e2e/visual-candidates/.runs/phase20-spider-rest-before/` and `.../phase20-spider-rest-after/` (`spider-rest-sharpness.json`; frames `phase20-spider-rest-off|full--<project>.png` for 20-11). Sharpness = mean absolute discrete Laplacian of luminance over a fixed crop; ratio = live frame / same SVG in an unmoved container without transform, translate or will-change, rotated by an SVG attribute. Chromium headless, dpr 1 (desktop) and 2.625 (phone).

Before the fix (factor overridden one at a time on the live element):

| Factor | desktop off | desktop full (standing) | phone off | phone full |
|---|---|---|---|---|
| as-is | 0.564 | 0.559 | 1.026 | 1.017 |
| will-change: auto | **1.108** | 0.559 | 1.280 | 1.017 |
| shift snapped to device pixels | 0.569 | 0.569 | 1.027 | 1.018 |
| no scale() | 0.564 | 0.559 | 1.026 | 1.017 |
| translate/left/top snapped | 0.563 | 0.562 | 1.027 | 1.018 |
| all of them | 1.115 | 0.568 | 1.278 | 1.018 |

After the fix, as-is: desktop off 1.112, desktop full 1.121, phone off 1.276, phone full 1.268 (all at least 0.9). The verify script printed `rest sharp 4`.

Regression rows on the fixed build (old cause put back): `will-change: transform` alone gives desktop 0.569 / 0.569 and phone 1.027 / 1.018; a forwards-filled 600 ms `fade-in` alone gives 1.112 / 1.121 and 1.276 / 1.268, so it does not blur by itself.

**Cause: `will-change: transform` on `.wallpaper-spider`.** On PC it keeps a rotated, rasterised compositor layer that is resampled, which halves edge sharpness (0.56). A fractional shift, scale() and the fractional `translate: -50% -46.875%` do not change sharpness by themselves. The blur is not reproduced on chromium-phone (headless, dpr 2.625): that is not a physical-device pass (20-14, SPIDER-03).

Open point: in the desktop full-standing state, removing will-change by an inline override alone did not lift the blur (0.559), while the combined fix (will-change gone plus `fade-in` with `backwards` instead of `both`) did. The fill-only regression row does not reproduce it, so I did not isolate why the override failed in that state. The `backwards` change is kept as a precaution: it stops a filled animation from lingering on the element. Inferred, not isolated.

Fix: `spiderTransform` (lib/wallpaper-web.ts) builds all three transform writes; at rest the shift is `round(v * dpr) / dpr` and there is no `scale()`; the write that settles the spider is the resting one; `dpr` is read on mount and in the ResizeObserver, not per frame; `data-spider-walking` toggles `will-change`.

### TDD record
- RED: «D-45 spiderTransform snaps a resting shift…» (and three more D-45 tests) failed on `assert.equal`, actual `undefined`, expected `translate(10.5px, -3px) rotate(12.35deg)`. `gsd-tools check tdd-red-evidence` returned `RED_EVIDENCE_OK` (target_test_failed; 35 other tests passed). Semantic assessment: the target ran and failed on the planned assertion, with no syntax, import or fixture fault.
- GREEN: `spiderTransform` plus the spider and CSS changes; `lib/wallpaper-web.test.ts` 39 of 39, `npm test` 1177 tests, 0 fail.
- REFACTOR: none.

## Verification

- `node --experimental-strip-types --test lib/wallpaper-web.test.ts lib/accent-theme.test.ts`: 70 pass, 0 fail.
- `npm test`: 1177 tests, 1174 pass, 0 fail (3 skipped, not from this plan). `tsc --noEmit`: clean.
- `npm run lint`: 32 errors, none in this plan's files; all are in untracked `.agents/`, `.claude/` skill scripts and a `.claude/worktrees` copy. `eslint` on the changed files is clean.
- `phase20-art.spec.ts` on chromium-desktop and chromium-phone: 16 passed, 0 skipped, run against a production build (`PORTIA_E2E_ALLOW_HTTP=1`) served by `next start` on port 3100 with `PORTIA_E2E_BASE_URL`; the server was stopped afterwards and the other session's port 3000 was left alone. Candidates are in `.runs/phase20-spider-art/`.
- `git status --porcelain -- tests/e2e/visual/__screenshots__` is empty.
- Gait trace (`spider-gait-trace--<project>.json`): `layoutReadsWhileWalking` is 0 on both projects (counted via patched `getBoundingClientRect`, `clientWidth/Height`, `offsetWidth/Height` over 4 s of walking).
- Acceptance greps: «D-25/D-26» 1; `wallpaper-spider-teal` 0; `wallpaper-spider-accent` 4; `SettingGroup title="Паук"` 1; the `data-spider="off"` rule 1; `spiderTransform` lines 4; «D-45» tests 5.

## Deviations from Plan

**1. [Rule 1 - Stale test] accent-theme test contradicted D-25/D-26.**
- **Found during:** Task 1
- **Issue:** `lib/accent-theme.test.ts` «the spider has no outline» (quick 261102-d7r) asserted `stroke: none`, the old accent-mixed fills and `.wallpaper-spider-teal`. D-25 requires a dark contour and D-26 removes the accent leg class, so the plan's own requirement made this test fail. The file is not in the plan's `files_modified`.
- **Fix:** Replaced with a D-25/D-26 contour and no-accent-fill test; the full check is in `lib/wallpaper-web.test.ts`.
- **Commit:** 5c4308a

**2. [Rule 3 - Type constraint] Candidate requirement id.** `support.ts` only accepts `STAB-BASE-03|04`, so frames carry `STAB-BASE-03`; the evidence belongs to STAB-VIS-01 and STAB-A11Y-04. `support.ts` was not changed.

**3. Scope of the redraw.** Paths and the web were restyled, not redrawn point by point (see key-decisions). The visual judgement stays with the owner (20-10 / 20-11).

**4. Server.** Port 3000 was held by the other session, so e2e ran on 3100 as in 20-19.

**Total deviations:** 1 auto-fixed test, 1 constraint, 1 scope note. **Impact:** none on the contracts D-01..D-04, D-27.

## BLOCKED / not proven

- Gait frame budget on PC and phone hardware: `phase20-spider-gait-frame-budget--<project>.blocked.json` (`MOTION_CAPTURE_BOUNDARY_REQUIRED`). The headless run under a fake clock shows no layout reads, not a frame time. Physical check: SPIDER-03 in 20-14.
- The blur is not reproduced on chromium-phone; a physical-phone pass is not claimed.
- The after-fix standing spider at the very dark `#1a1a1a` accent: the spider is dark on a dark background by design, so legibility is an owner call (20-11 side-by-side frames: `phase20-spider-accent-default|custom-dark|custom-light`).

## Known Stubs

None.

## Threat Flags

None. T-20-03 held: base artistic language, the system motion preference and existing wallpapers are unchanged; no packages were installed.

## Requirements

STAB-VIS-01 and STAB-A11Y-04 are left open. STAB-VIS-01 needs the owner's approval of the drawing (20-10); STAB-A11Y-04 still lacks the physical-device frame and interaction evidence (SPIDER-03, 20-14). Headless PC/phone-emulation evidence is in place.

## Self-Check: PASSED

Files: `components/portia-wallpaper-spider.tsx`, `app/portia.css`, `lib/wallpaper-web.ts`, `lib/wallpaper-web.test.ts`, `lib/accent-theme.test.ts`, `tests/e2e/visual-candidates/phase20-art.spec.ts` all present. Commits 5c4308a, e79c82d, efff12a, 17a80ba are ancestors of HEAD. The four `<acceptance_criteria>` sets re-ran green.
