---
phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
plan: 05
subsystem: ui
tags: [table-editor, drag-handle, column-swap, content-normalizer, edge-cdp]
requires:
  - phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
    provides: CollapsibleCard, OrderDragHandle reuse, harness with sections fixtures and the blocked-write stub (11-04)
provides:
  - table row id in the content type and normalizer (stored unique id kept, else positional <blockId>-row-<index>)
  - a row ≡ (OrderDragHandle) on every table row, keyed by row id
  - ColumnSwapHandle on the Признак / Значение headers: swaps key and value in every row, one undo step
  - empty-table state «Строк пока нет. Добавьте первую кнопкой «+ СТРОКА».»
  - harness check table, steps (a)-(i)
affects: [PORTIA-11 plan 07 (owner checks the table drag on the PC and the phone)]
status: complete
actuals:
  tokens: 38000
  tasks: 2
  commits: 2
plan_head_before: 8919335539b1f026eae5efa53763f67397e4ed64
plan_head_after: 70501ebdaa53f86885281de2cd646cd5cfc091e6
tech-stack:
  added: []
  patterns:
    - "Row identity comes from the normalizer (as block ids did in Phase 9 D-21), so ≡ moves keep React keys and keyboard focus"
    - "Column handle marks data-dragging=\"column\" (not \"true\") so editKeyFor does not fold it as a row drag"
key-files:
  created:
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-05-SUMMARY.md
  modified:
    - lib/portia-content.ts
    - lib/portia-content-normalize.ts
    - lib/portia-content-normalize.test.ts
    - components/portia-editor.tsx
    - app/portia.css
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-editor-check.mjs
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-UI-SPEC.md
key-decisions:
  - "A column swap swaps key and value in every row; no schema flag, public render unchanged (dt = key, dd = value)"
  - "Rows carry a stable id; old rows without one get a positional id on load, so saved content loads unchanged"
  - "Column handle swaps on drop (or ArrowLeft/ArrowRight), not live"
  - "Row handles keep the house label «Изменить порядок: строка N»"
requirements-completed: [EDIT-07]
duration: 35min
completed: 2026-10-26
---

# Phase 11 Plan 05: Table rows and columns Summary

The owner can now drag table rows by a leading ≡ and swap the two columns by dropping one header ≡ on the other; the order is stored in the content and shown as is on the site.

## What was built

- **Task 1 (tracer), commit 2080f32.** `rows: { id, key, value }[]` in `lib/portia-content.ts`. The normalizer keeps a stored non-empty row id not yet seen in the table, otherwise uses `<blockId>-row-<index>`; key, value and order are unchanged. Three new tests («table rows keep their ids and order», «a missing or repeated row id gets its position», «a column swap survives normalization»); existing expectations got the positional ids. In the editor each row is `data-sort-index` + `key={row.id}` with an `OrderDragHandle` first; «+ СТРОКА» and «+ ТАБЛИЦА» create rows with `makeId("row")`. CSS: 4-track row grid with a 34px handle, `min-width: 0` inputs, phone grid `44px 1fr` with the handle spanning three rows, row added to the lifted-row selector. The row delete button rule now excludes the handle (it would otherwise recolour it).
- **Task 2, commit 70501eb.** `ColumnSwapHandle` (pointer capture, drop target marker `data-drop-target`, ArrowLeft/ArrowRight, no `title`) and `swapTableColumns` (one `changeDraft` = one undo step). `.info-table-head` above rows of any table with at least one row; zero rows show the empty line and no head. Harness check `table` (a)-(i). UI-SPEC section 5 amended.

## Verification

- `npm test`: 316 pass, 0 fail. `npx tsc --noEmit`: clean. `npm run build`: ok.
- `npm run lint`: 19 problems, same as before the plan (2 known phase-06 `.cjs` errors, 17 `<img>` warnings).
- On `next start -p 3124` (stopped afterwards): `--check table` (a)-(i), `sections`, `savechip`, `panel`, `mark` all `"ok": true`, no "write blocked" reasons.
- Greps: `function ColumnSwapHandle` 1, `Переставить столбец` 1, key/value swap line 1, `Строк пока нет` 1, `title=` on column handle 0, `key={rowIndex}` 0, `key={row.id}` 1, `makeId("row")` 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Row delete button rule recoloured the ≡**
- **Found during:** Task 1
- **Issue:** `.info-table-row button` (specificity 0,1,1) beat `.order-drag-handle` and would remove its border and colour.
- **Fix:** `.info-table-row button:not(.order-drag-handle)`.
- **Files modified:** app/portia.css. **Commit:** 2080f32.

**2. [Rule 3 - Blocking, lint] react-hooks "Cannot access refs during render"**
- **Found during:** Task 2
- **Issue:** an inline IIFE in the table render that closed over `changeDraft` raised a third lint error.
- **Fix:** a named `swapTableColumns(subsectionId, blockId)` next to `changeDraft`.
- **Files modified:** components/portia-editor.tsx. **Commit:** 70501eb.

**3. [Rule 1 - Bug] Ancestor cards lit up while a row was dragged**
- **Found during:** Task 2
- **Issue:** the lifted-card selector `.nested-editor-card:has(.order-drag-handle[data-dragging])` matched every ancestor card of a dragged row.
- **Fix:** `:has(> .nested-editor-head .order-drag-handle[...])` (the card's own handle only).
- **Files modified:** app/portia.css. **Commit:** 70501eb.

**4. [Plan addition] Hidden spacer in the header**
- The head carries a hidden «Удалить строку» span so its auto track matches the rows and the header cells line up with the inputs.

**5. [Plan addition] Harness step (i)** checks the 44px handles on a phone.

## Known Stubs

None.

## Threat Flags

None. T-11-11 mitigated and tested (non-string, empty and repeated ids replaced by positional ids; ids are used only as React keys). T-11-12 accepted (`MAX_TABLE_ROWS` 500 unchanged, swap is O(rows)). No `/api` write was made by any check.

## Notes

- Finger drag of rows and columns is not exercised by CDP; the owner checks it on the phone in 11-07.
- Uncommitted user changes (package.json, package-lock.json, .planning/state.json, .planning/milestone.lock, .planning/ui-reviews/) were left untouched.

## Self-Check: PASSED

- FOUND: lib/portia-content.ts, lib/portia-content-normalize.ts, lib/portia-content-normalize.test.ts, components/portia-editor.tsx, app/portia.css, 11-editor-check.mjs, 11-UI-SPEC.md
- FOUND commits: 2080f32, 70501eb
