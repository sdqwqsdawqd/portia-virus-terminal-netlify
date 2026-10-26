---
phase: PORTIA-13-prilozhenie-spravochnik
plan: 02
subsystem: desktop-guide-window
tags: [guide, desktop, search, headless-harness]
requires: [13-01]
provides:
  - desktop app "guide" (shortcut «Справочник», PORTIA://GUIDE, 820 x 650, min 560 x 420) with folder icon
  - GuideApp (grid view / card view derived from guideCardId), GuideBlockView, GuidePhoto
  - YoutubeFigure shared by «Информация» and «Справочник»
  - global search items of type "guide" (mark REF, «СПРАВОЧНИК · {раздел}») that open the card
  - .guide-* styles and 13-guide-check.mjs (open-card, grid, card-blocks, poll-gone, search)
affects: [13-03, 13-04, 13-05]
tech-stack:
  added: []
  patterns: [derived view instead of stored mode, window.setTimeout(0) restore from localStorage, focus return via data-card-id]
key-files:
  created:
    - .planning/phases/PORTIA-13-prilozhenie-spravochnik/13-guide-check.mjs
  modified:
    - components/portia-desktop.tsx
    - components/portia-icons.tsx
    - app/portia.css
decisions:
  - "The view is derived: findGuide(sections, openCardId) with a card means card view, else grid, so a card removed by the 10 s poll silently shows the grid"
  - "Hover lift of a tile is gated by html[data-motion=\"full\"] so «Анимации: Выключены» needs no extra rule (D-00e); the plan put it in the plain hover block"
  - "Search preview of a guide card is rotated to start at the first block holding the query; the filter still runs on the unrotated body"
  - "The saved grid position is dropped after one use, so a card opened from search never inherits an old scroll position"
metrics:
  duration: ~10 min
  completed: 2026-10-27
status: complete
actuals:
  tokens: 11500
  tasks: 3
  commits: 3
plan_head_before: a00c456a64c501849fdcd11ebbbc7bb072415cfb
plan_head_after: 7b7160bb0e082a9af2ddb8fa3473d75abaa2d6ef
commits: 3
requirements-completed: [P13-SC1, P13-SC2, P13-SC3, P13-SC5]
---

# Phase 13 Plan 02: «Справочник» on the desktop Summary

A folder shortcut opens a window with a tile grid by sections, a card page that replaces the grid with «← Назад» as the only way back, remembered folding per device, and global search results that open a card directly.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 (tracer) | shortcut, window, tile, card page, «← Назад» to the same tile | a380e05 |
| 2 | every block kind, cover tiles and thin rows, section bands, folding memory, empty states, poll safety | b855c78 |
| 3 | global search finds guide cards by all their text and opens the card | 7b7160b |

## What was built

- `components/portia-icons.tsx`: `guide` folder icon.
- `components/portia-desktop.tsx`: `AppId`/`DesktopShortcutId` `"guide"` (meta, window state, size, minimum, allowed shortcut ids, DesktopIcon after info); `guideCardId` repaired at the three places content is set; `GuideApp`, `GuideBlockView`, `GuidePhoto`; `YoutubeFigure` extracted from the Info window (file still has exactly two `<iframe` tags, both `sandbox={embedSandbox}`); `guideCollapsedStorageKey` read in try/catch on mount (string ids only), written when loaded; search items, REF mark, open branch.
- `app/portia.css`: `.guide-*` rules; phone grid is 2 columns at 520 px; no keyframes, no `animation:`, no dense flow.
- `13-guide-check.mjs`: headless Edge harness on the production build, every non-GET `/api/*` blocked, five checks.

## Verification

- `13-guide-check.mjs --check all` on the production build (`next start -p 3124`): open-card, grid, card-blocks, poll-gone, search all `ok: true`.
- `npm test` 418/418, `node --test lib/portia-desktop.test.ts` 9/9 (SEC-03 frame count and pure updaters hold), `npx tsc --noEmit` clean, `npm run build` passes. Server on 3124 stopped afterwards.

## Deviations from Plan

**1. [Rule 1 - Bug] Hover lift gated by the motion setting**
- **Found during:** Task 2
- **Issue:** the plan asked for a 120 ms transform transition in the plain `@media (hover: hover)` block, but the house reduce-motion clamp only zeroes animations, not transitions, and D-00e says «Анимации: Выключены» must need no extra rule.
- **Fix:** the lift and its transition live under `html[data-motion="full"]` inside a `@media (hover: hover)` block, as the other hover effects do.
- **Files modified:** app/portia.css
- **Commit:** b855c78

**2. [Rule 3 - Blocking] Harness fixture and measurements**
- **Found during:** Tasks 1-2
- **Issue:** `normalizePortiaContent` refuses content without `searchRecommendations`; a rect height was 0.97 of the real height while the window scaled in; the broken photo also counts as a figure image before it fails.
- **Fix:** fixture carries `searchRecommendations: []`; geometry uses `offsetHeight`; the photo count is taken on figures with a caption.
- **Files modified:** 13-guide-check.mjs
- **Commit:** a380e05, b855c78

Also: the new CSS is appended at the end of `app/portia.css` (own `@media` blocks) instead of editing the existing 900/520/hover blocks; same effect, no cascade difference. Files in `components/portia-desktop.tsx` and `app/portia.css` use CRLF; edits kept it.

## Deferred Issues

- `npm run lint` still exits non-zero on the 2 pre-existing `no-require-imports` errors in `.planning/phases/PORTIA-06-uchet-zamechaniy-i-strahovka-dannyh/06-check-*.cjs` (already recorded in 13-01). The new `<img>` warnings follow the existing house pattern.
- Column geometry on a phone and the thin-row ratio are re-checked in 13-05, as the plan states.

## Known Stubs

None. Loading shows the house `LoadingState` until the first content answer, so there is no false «Справочник пока пуст».

## Threat Flags

None. T-13-05..08 mitigated as planned: text only through `FormattedText` / React text nodes, one `YoutubeFigure` with `embedSandbox`, `referrerPolicy="no-referrer"` on every guide image, malformed `portia-guide-collapsed-v1` ("not json") leaves everything open (harness-checked).

## Self-Check: PASSED

Commits a380e05, b855c78, 7b7160b present; files `13-guide-check.mjs`, `components/portia-desktop.tsx`, `components/portia-icons.tsx`, `app/portia.css` present.
