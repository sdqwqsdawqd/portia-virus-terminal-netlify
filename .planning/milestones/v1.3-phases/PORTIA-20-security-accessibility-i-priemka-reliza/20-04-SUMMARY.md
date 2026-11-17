---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 04
subsystem: ui
tags: [wallpaper, svg, css, flasks, motion, a11y, playwright-candidates]
requires:
  - phase: PORTIA-20
    provides: 20-03 phase20-art.spec.ts and candidate conventions; 20-19 production-build e2e approach (port 3100)
provides:
  - "«Лабораторные колбы» (id flasks): sixth wallpaper option, separate from the five old ones, default stays «Паутина»"
  - "Four flasks on a lab stand, each with its own cycle (6.8/8.9/11.3/7.7 s) and phase; bubbles clipped to the liquid; CSS opacity/transform only"
  - "Wallpaper save failure keeps the previous wallpaper and shows a role=alert message"
  - "Candidate frames, contrast and trace evidence for PC and phone under .runs/"
affects: [20-10, 20-11, 20-14]
status: complete
key-files:
  created: []
  modified:
    - components/portia-wallpaper.tsx
    - components/portia-desktop.tsx
    - app/portia.css
    - tests/e2e/visual-candidates/phase20-art.spec.ts
key-decisions:
  - "The flasks' accent is blended 70/30 toward --desktop-base (color-mix), not capped with relative colours (the accent-theme test forbids oklch(from ...)). Without it, label contrast over the brightest 8 px square was 4.22 (teal) and 3.46 (near-white custom); with it 7.0 and 6.3 on PC."
  - "Contrast is asserted over the brightest 8 px square (what a label sits on). The single brightest pixel (a thin line or bubble ring) is recorded only (3.85 to 8.30 across accents)."
  - "Save-failure handling is wallpaper-only: chooseWallpaper writes localStorage first and on failure keeps the previous wallpaper. Other settings keep their old in-memory behaviour (a blocked storage must not freeze every setting)."
  - "The leftmost flask is hidden by a container query on portrait screens (aspect ratio at most 3/5), so a phone shows three flasks fully inside the frame."
requirements-completed: []
duration: ~1h20m
completed: 2026-11-04
actuals:
  tokens: 36000
  tasks: 2
  commits: 2
plan_head_before: f20dac6e8c6ab2a3325285a03e60890e6b3d6aec
plan_head_after: ff47b281e2bef61185efb09a4f7e92ffba26d08b
---

# Phase 20 Plan 04: «Лабораторные колбы» wallpaper Summary

A sixth, selectable wallpaper with four flasks on a lab stand that glow and bubble independently in full motion and stand still and finished in reduced and off; the choice persists, the old five and the default are untouched.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Selectable flask wallpaper from settings to screen (art, allowlist, chooser, CSS) | 700f07c |
| 2 | Stop motion and prove all states (spec, 22 tests per lane) | ff47b28 |

Both tasks share `phase20-art.spec.ts`; the source and the tests were committed separately, so Task 2's evidence commit also covers Task 1's behaviour.

## What was built

- `components/portia-wallpaper.tsx`: `WallpaperFlasks`, a conical flask, a round-bottom flask, a beaker and a tall clamped tube, plus stand. Per flask: glass outline, lip, shine, a liquid group clipped to the glass, a wave line, and 5-7 bubbles. Bubble travel is computed from the liquid floor to just under the surface, and the bubble group is clipped to the glass as well. Seeded, so the drawing is stable.
- `components/portia-desktop.tsx`: `"flasks"` added to the wallpaper allowlist and the chooser (label «Лабораторные колбы»); `chooseWallpaper` writes first and keeps the previous wallpaper with the message «Не удалось сохранить фон на этом устройстве. Остался прежний фон.» if the device refuses.
- `app/portia.css`: flask styles; animations only under `html[data-motion="full"]` (glow, surface slide, bubble rise); reduced/off are covered by the existing `.desktop-wallpaper *` rule; container query hides the far flask on tall narrow screens; option labels wrap.

## Evidence (production build, port 3100, chromium-desktop and chromium-phone)

`npx playwright test tests/e2e/visual-candidates/phase20-art.spec.ts --retries=0`: 44 passed (22 per lane, including the 20-03 tests), 66 skipped (other projects, by the file's lane rule). `npm test` 1221 pass, 0 fail; `tsc --noEmit` clean; eslint on the touched files has no errors.

- D-22 selection: sixth option, saved `gel`+`ice`+large settings not reset, only `wallpaper` changes in storage, survives reload, settings window and shortcuts do not move, all old options still work, factory reset returns to «Паутина», unknown stored value falls back to «Паутина».
- PC four flasks, phone three, none cut by the viewport; PC group right of centre.
- Cycles 6.8/8.9/11.3/7.7 s with five distinct delays; glow sampled every 50 ms: range about .55 to 1, largest step under .05 (no flash); first peaks differ by more than 400 ms.
- Bubbles: 41 time steps through each bubble's cycle, always under the surface and inside the glass.
- D-01: OS reduced-motion emulated, site mode stays `full`, animations run. D-02: reduced/off have no animation, finished frame, nothing moves in 700 ms. D-04: off in mid-cycle removes all animations at once, the picture stays put for 1.2 s, `motion: off` saved, «Настройки сохранены» shown. D-03: no change was made to GIF/video.
- E1: frame in the DOM with the shortcuts at first paint, liquid visible at once; with the effect disabled the flasks stay drawn; with the picture removed the dark base and the shortcuts remain.
- E2: all six options and the current choice stay visible during the crossfade; refused save keeps «Гель» active and chosen and shows the message; recovery works; a very long label wraps, focus ring not clipped, no page-level horizontal scroll.
- Accents (default, `#1a1a1a`, `#f2f2f2` custom): frame at z-index 0 with pointer-events none, below shortcuts, Vivian and windows; label contrast over the brightest 8 px square 7.02 / 9.20 / 6.31 (PC), 10.76 / 12.66 / 10.50 (phone), all at least 4.5.
- Trace (3 s, headless Chromium): 0 layout reads from page code (control wallpaper also 0), trace and summary in `.runs/`.

Candidate frames are in `tests/e2e/visual-candidates/.runs/phase15-current-f20dac6e8c6a/` (`phase20-flasks-*`); nothing under `tests/e2e/visual/__screenshots__` changed.

## Deviations from Plan

**1. [Rule 1 - Bug] Contrast below 4.5 on the first build.** Found in Task 2: label contrast 4.22 (teal) and 3.46 (near-white custom accent). First tried relative colour capping, which `lib/accent-theme.test.ts` forbids ("no relative colour syntax"); replaced by `color-mix(in oklab, var(--teal) 70%, var(--desktop-base))`. Commit 700f07c.

**2. [Rule 2 - Missing functionality] Save-failure path.** The plan and UI-SPEC E2 require the previous wallpaper and a text message on a failed save; the existing code swallowed storage errors. Added `chooseWallpaper` (wallpaper only).

**3. Metric choice.** The text threshold is applied to the brightest 8 px square rather than the single brightest pixel (explained above); the pixel figure is recorded.

**4. Environment.** Port 3000 was held by the other session, so e2e ran on a production build served on 3100 (`PORTIA_E2E_ALLOW_HTTP=1`), stopped afterwards; `npm run build` ran into `.next/` while the other session's dev server uses `.next/dev`.

**Total deviations:** 1 bug fix, 1 added critical behaviour, 2 notes.

## BLOCKED / not proven

- Frame budget on PC and phone hardware: no approved budget exists and no physical device was measured. Recorded as `phase20-flasks-frame-budget--<project>.blocked.json` (`MOTION_CAPTURE_BOUNDARY_REQUIRED`); the headless trace is evidence only. Physical check belongs to 20-14.
- Owner approval of the drawing, the exact durations (6.8/8.9/11.3/7.7 s are design candidates), tones and the three-flask phone crop: candidates only, not baselines (20-10 / 20-11).
- Visual identity of `custom-dark` and `custom-light` contrast numbers (equal on PC) suggests the custom accent derivation clamps both ends to a similar lightness; not investigated.
- In a hidden (phone) far flask, `getAnimations()` still lists its animations while its subtree is `display: none`; no paint cost is expected but it was not measured.

## Known Stubs

None.

## Threat Flags

None. T-20-04 held: the flasks are decorative (`aria-hidden` frame, pointer-events none), not default, no CTA; T-20-SC: no packages installed.

## Requirements

STAB-VIS-02 and STAB-A11Y-04 stay open: speed on PC/phone is BLOCKED, owner approval of the candidates is pending, and STAB-A11Y-04 also covers every other motion surface and physical-device checks.

## Self-Check: PASSED

Files present: the four modified files and this SUMMARY. Commits 700f07c and ff47b28 are ancestors of HEAD. Both tasks' `<verify>` spec file re-ran green (44 passed).
