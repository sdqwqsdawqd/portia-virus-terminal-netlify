---
phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
plan: 06
subsystem: ui
tags: [multi-selection, format-panel, undo-batch, custom-highlight, edge-cdp]
requires:
  - phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
    provides: floating format panel with Esc handling and header keys (11-02), harness helpers wordBox / mouseSelect / phone / desktop
provides:
  - lib/format-fragments.ts (FormatFragment, mergeFragments, removeFragmentAt) with 12 tests
  - batch:<id> history keys that coalesce whatever the pause, like drag:
  - FormatTarget.gesture / fragments / peers; a Ctrl (Cmd on a Mac) press adds a fragment across fields, a plain gesture clears
  - one applyOp path for every panel control, one undo step per control interaction
  - header «ВЫБРАНО: N» + «СБРОСИТЬ», footer hint (PC only), one Highlight with N ranges
  - harness check multiselect, steps (a)-(o)
affects: [PORTIA-11 plan 07 (owner checks the multi-selection feel on the PC)]
status: complete
actuals:
  tokens: 9800
  tasks: 2
  commits: 2
plan_head_before: 8a1f376663a489608d0dc3796879441f910f528f
plan_head_after: 6fac27f47f2992db9fb379f9ba9520a10eb918ca
tech-stack:
  added: []
  patterns:
    - "Multi-selection state lives inside FormatTarget, so every existing setFormatTarget(null) path (undo, discard, tab switch, card collapse) clears it by construction"
    - "A gesture id decides keep / extend / clear; the same id repeated (focus, select, mouseup, keyup) is idempotent"
    - "One undo step across fields is a batch:<id> key; a new id per control interaction, reused while the same control fires within TYPING_PAUSE_MS"
key-files:
  created:
    - lib/format-fragments.ts
    - lib/format-fragments.test.ts
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-06-SUMMARY.md
  modified:
    - lib/editor-history.ts
    - lib/editor-history.test.ts
    - components/portia-editor.tsx
    - app/portia.css
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-editor-check.mjs
key-decisions:
  - "Fragments are (field key, from, to) in UTF-16 code units; an application uses the stored offsets, so losing the DOM selection to a panel input changes nothing"
  - "A bare caret is not a fragment: the word-under-caret rule stays single-selection only"
  - "Ctrl+click on a caret removes the merged fragment it lands in (edges included); the removal runs on every collapsed activation of an additive gesture, because the first activation (focus) may still carry no caret"
  - "A field's gesture is reset to plain on blur, so a later Tab focus never reuses an old additive id"
  - "The same control firing again within 700 ms is one undo step (two quick «Заголовок» clicks undo together); the harness pauses 900 ms between them"
requirements-completed: [EDIT-06]
duration: 15min
completed: 2026-10-26
---

# Phase 11 Plan 06: Multi-selection with Ctrl Summary

On a PC the owner can Ctrl-select text in several fields (or several places in one) and every panel control styles all fragments at once; one Ctrl+Z takes the whole application back.

## What was built

- **Task 1 (tracer), commit 164310b.** `lib/format-fragments.ts` (no imports) with `mergeFragments` (orders, drops empty, sorts by key then start, folds touching and overlapping fragments of one field) and `removeFragmentAt`; 12 tests including «touching fragments merge» and a surrogate-pair case. `FormatTarget` gained `gesture`, `fragments`, `peers`. FormattedTextarea keeps a gesture ref: a primary pointerdown starts one (additive only with Ctrl, or Cmd on a Mac, and only outside `(max-width: 900px), (pointer: coarse)`), any editing key or blur starts a plain one. `joinFormatTarget` (used by `activateFormatter`) returns a plain target as is, and for an additive one moves the previous non-empty selection into `fragments` and the previous target into `peers` on the first activation of the gesture. The panel's `applyOp` folds the operation over each field's fragments, calls that field's `onCommit`, and updates the peers once; `applyStyle` goes through it. The paint effect builds one Range per fragment and sets `new Highlight(...ranges)`.
- **Task 2, commit 6fac27f.** `historyReducer` coalesces `batch:` keys regardless of time (2 tests). `changeDraft` uses `batchKey.current ?? editKeyFor(...)`; `runBatch` is passed to the panel as `onBatch`. In the panel every control (Обычный, Заголовок, Важно, Основной, swatches, sizes, weights, БЕЗ ФОНА, density, both custom pickers) goes through `applyOp(control, op)`; presets remove when every fragment already has them (`marked` over the set), else apply. All range-based `disabled` flags became `disabled={!hasTarget}`. Header: `ВЫБРАНО: <b>N</b>` plus «СБРОСИТЬ» (aria-label «Снять все выделенные фрагменты») for two or more, `N ЗНАК.` for one. СБРОСИТЬ and the panel Esc call `onUpdate({ ...target, fragments: [], peers: {} })`. Footer hint in a `.format-notes` wrapper; CSS for the count, the reset button and the hint, all hidden at 900px and below. Harness steps (f)-(o).

## Verification

- `npm test`: 330 pass, 0 fail (316 after 11-05, plus 12 fragment tests and 2 batch tests). `npx tsc --noEmit`: clean. `npm run build`: ok.
- `npm run lint`: 19 problems, same as before the plan (2 known phase-06 `.cjs` errors, 17 `<img>` warnings).
- On `next start -p 3124` (stopped afterwards): `--check multiselect` (a)-(o), `mark`, `panel`, `savechip`, `sections`, `table` all `"ok": true`, no "write blocked" reasons. A mutated copy of the harness (changed expected counts and alphas) failed in the expected places, so the steps are not vacuous.
- Greps: `export function mergeFragments` 1 and `^import` 0 in format-fragments.ts; `touching fragments merge` 1; `new Highlight(...ranges)` 1; `addsFragment` 2; `metaKey` in portia-desktop.tsx still 1; `key.startsWith("batch:")` 1; `batch key coalesces regardless of time` 1; `ВЫБРАНО:` 1; `Снять все выделенные фрагменты` 1; the multi hint text 1; `disabled={!range}` 0.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking, lint] React Compiler rejected two constructs**
- **Found during:** Task 2 (`npm run lint` showed 4 errors, baseline 2)
- **Issue:** `Date.now()` inside the panel's `batchFor` ("Cannot call impure function during render") and the `useMemo` dependency list for the fragment set ("Existing memoization could not be preserved").
- **Fix:** the batch id logic moved to a module-level `nextBatch(last, control)`; the memo depends on `[target]` and reads the text length from `target.document`.
- **Files modified:** components/portia-editor.tsx. **Commit:** 6fac27f.

**2. [Rule 2 - Missing critical] Gesture reset on blur**
- **Found during:** Task 1 design review
- **Issue:** a field's gesture ref could keep an old additive id, so a later Tab focus would be read as a new additive gesture and keep fragments.
- **Fix:** `onBlur` starts a plain gesture.
- **Files modified:** components/portia-editor.tsx. **Commit:** 164310b.

**3. [Layout choice] Reset button inside the header `<small>`, notes in a wrapper**
- The header grid has three tracks on a PC, so a fourth child would wrap; the count and «СБРОСИТЬ» sit inside the existing `<small>`. The two footer notes share a `.format-notes` block so the footer flex row keeps two items. No behaviour change.

Otherwise the plan was executed as written.

## Authentication gates

None.

## Known Stubs

None.

## Threat Flags

None. T-11-13 (stale offsets) is mitigated as planned: every edit key or plain pointer press starts a plain gesture that clears the fragments, undo / discard / tab switches / collapses clear the target, `applyRichTextStyle` clamps through `orderedRange`, and harness step (d) checks the text is unchanged. No new endpoints, no content written (the harness blocks every non-GET request to /api/*).

## Self-Check: PASSED

- FOUND: lib/format-fragments.ts, lib/format-fragments.test.ts, 11-06-SUMMARY.md
- FOUND commits: 164310b, 6fac27f (both ancestors of HEAD)
