---
phase: 03-redaktor
plan: 04
subsystem: ui
tags: [react, css, tabs, drag-and-drop, pointer-events, node-test]

requires:
  - phase: 03-redaktor
    provides: "plan 03-01: history/draft/changed, editKeyFor and the drag: coalescing in the reducer, tab-dot markup; plan 03-03: phone list-to-record layout"
provides:
  - "changedDossierTabs(baseline, draft, virusId), DossierTab, dossierTabs in lib/editor-changes.ts, with 11 new node:test cases"
  - "Four dossier tabs (Основное, Описание, Мутации, Записи учёных) in the live and the recycled virus editor, with amber dots for unsaved parts"
  - "OrderDragHandle reworked: midpoint hysteresis, edge autoscroll, ArrowUp / ArrowDown, one undo step per drag"
  - "Gel-lane CSS: rail, lit band, two-digit positions, 44px handle column on phones"
affects: []

plan_head_before: 57f83d04b013a7c95637e09801b766170a5fac12
plan_head_after: 0ab78f198daa73edfb40788cf94a1f753f43b550

actuals:
  tokens: 3800
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Per-slice JSON comparison with a catch-all slice (main), so a future virus field still marks a tab"
    - "Drag identity through data-drag-id on the held handle, read by editKeyFor, so the reducer folds a whole drag into one undo step"
    - "Hold timer starts a requestAnimationFrame loop that scrolls the real scroller (.content-editor if it scrolls, else window) and re-runs the target search"

key-files:
  created: []
  modified:
    - lib/editor-changes.ts
    - lib/editor-changes.test.ts
    - components/portia-editor.tsx
    - app/portia.css

key-decisions:
  - "Dossier tab state lives in PortiaEditor for live viruses (survives opening another virus) and in ArchivedVirusEditor for bin viruses; selecting a live tab also closes the format panel (Pitfall 7)"
  - "Unsaved dots for a bin virus are computed against the baseline lookup in both lists, so moving a virus alone marks nothing"
  - "onMove and the row index are read through refs inside OrderDragHandle so the animation-frame loop never calls a stale closure"

requirements-completed: [EDIT-04, EDIT-03]

coverage:
  - id: D1
    description: "changedDossierTabs marks main / text / mutations / logs per virus, finds the virus in viruses or recycledViruses, marks all four for a virus new since the last save"
    requirement: EDIT-04
    verification:
      - kind: automated
        ref: "lib/editor-changes.test.ts (17 tests, 11 new) via npm test, 72/72"
        status: pass
  - id: D2
    description: "Live and bin virus editors render four dossier tabs with conditional rendering; bin / restore / delete-forever buttons stay outside the tab switch; tab switch clears the format target"
    requirement: EDIT-04
    verification:
      - kind: other
        ref: "node structural check 'dossier tabs tracer OK' + tsc + lint + npm test + build"
        status: pass
    human_judgment: true
    rationale: "Tab look, dots and that no field was lost can only be seen in the logged-in editor, which only the owner can open"
  - id: D3
    description: "Reorder in База вирусов, Корзина, Информация and Рекомендации: lit band on a lane, positions, no flip-flop, edge autoscroll, arrow keys, one undo step per drag, 44px handles on phones, no visible hints"
    requirement: EDIT-03
    verification:
      - kind: other
        ref: "node structural check 'lanes OK' + tsc + lint + npm test + build"
        status: pass
    human_judgment: true
    rationale: "Drag feel with a finger, autoscroll speed and the one-step undo need a real pointer/touch in the logged-in editor (RESEARCH A6 reasoned, not run)"

duration: 25min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 04: Dossier tabs and gel-lane reorder Summary

**Virus dossiers split into four tabs with amber unsaved dots (live and bin), and the ≡ reorder rebuilt as gel lanes: lit band, positions, midpoint hysteresis, edge autoscroll, arrow keys and one undo step per drag.**

## Performance

- **Duration:** about 25 min
- **Tasks:** 2 (1 tracer with TDD, 1 auto)
- **Files modified:** 4

## Accomplishments

- `changedDossierTabs` compares a catch-all `main` slice (every virus field except text, mutations, logs) plus text (`external`, `physiology`, `ppu`, `virus:<id>:external|physiology|ppu-*`), mutations (`mutations`, `virus:<id>:mutation:*`) and logs (`scientistLogs`); order is fixed main, text, mutations, logs.
- `DossierTabs` (`nav.editor-tabs.dossier-tabs`, label «Разделы досье») renders in both virus editors; groups are switched by conditional rendering, so inactive blocks are not in the DOM. «ПЕРЕМЕСТИТЬ В КОРЗИНУ» and the restore / delete-forever row sit after the tab content.
- `OrderDragHandle`: `moveTo` with `getBoundingClientRect` midpoint hysteresis; a hold timer (170 ms, pointer capture, aria-label kept) sets `data-dragging` and `data-drag-id`, starts the rAF autoscroll (8px per frame within 48px of the edge, `.content-editor` if it actually scrolls, else window with 56px / 44px insets); `stop` cancels the frame and removes both data attributes, also on unmount; ArrowUp / ArrowDown with `aria-keyshortcuts` and no visible UI.
- `editKeyFor` returns `drag:<id>` while a handle is held, so the existing reducer coalescing makes a drag one ↶ step.
- CSS: rail via `:has()` on record / recommendation lists and `.flat-editor-form`, lit band on the moving row or card, `lane` counter with `decimal-leading-zero` positions on record rows, and a trailing 900px block with the 44px handle column.

## Task Commits

1. **RED: failing tests for changedDossierTabs** - `e8ac504` (test; stub returns [] so 7 assertions fail, not an import error)
2. **Task 1 (tracer) GREEN: dossier tabs** - `66fe13b` (feat)
3. **Task 2: gel-lane reorder** - `0ab78f1` (feat)

Tracer gate: Task 1 `<verify>` is automated-only and `HUMAN_VERIFY_MODE` is `end-of-phase`, so it was re-run end to end (tsc, lint 0 errors, 72/72 tests, build, "dossier tabs tracer OK"); it passed and expansion continued.

## TDD Gate Compliance

RED `e8ac504` (17 tests, 7 failing on assertions with a stub, 10 passing), GREEN `66fe13b` (17/17). No refactor commit. The RED evidence was inspected by hand from the TAP report; `gsd_run check tdd-red-evidence` was not run.

## Decisions Made

- Kept the plan's tab grouping; the mutation key test uses `key.includes(":mutation:")`, which both reads clearly and satisfies the plan's structural check.
- `useEffect(() => stop, [])` in the handle: a handle unmounted mid-drag (for example the row removed) must not leave the frame loop running (threat T-03-14).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] RED needed a stub export**
- **Found during:** Task 1 RED
- **Issue:** Importing a not-yet-existing `changedDossierTabs` fails with a module error, which `tdd.md` classes as INVALID_RED.
- **Fix:** Added `DossierTab`, `dossierTabs` and a stub `changedDossierTabs` returning `[]` in the RED commit so the failures are real assertions.
- **Files modified:** lib/editor-changes.ts
- **Committed in:** e8ac504

**2. [Rule 1 - Bug] Two new react-hooks/exhaustive-deps warnings**
- **Found during:** Task 1 lint
- **Issue:** Memos keyed on `selectedVirus?.id` while reading `selectedVirus`.
- **Fix:** Key on `liveVirusId` / `archivedVirusId` consts and pass the id to `changedDossierTabs`; lint back to the 13 baseline warnings.
- **Committed in:** 66fe13b

---

**Total deviations:** 2 auto-fixed. **Impact on plan:** none on scope.

## Issues Encountered

- Human-checks were not run: the editor needs the owner login. For the phase UAT (`human_judgment`): (a) dossier tabs and dots in a live and a bin virus, (b) touch drag with autoscroll on a real phone, (c) arrow keys on a focused ≡, (d) one ↶ after a multi-position drag, (e) hysteresis on rows of unequal height (RESEARCH A6, reasoned only), (f) autoscroll speed.
- Pre-existing, not touched: `npm run build` prints a Turbopack warning "Parsing CSS source code failed" at `::highlight(portia-format) { background-color: rgba(var(--desktop-glow), .35); }` (app/portia.css, added in 03-03). The build still succeeds; the rule may be dropped by the CSS minifier, so the phone selection mark may not paint. Recommend fixing in a follow-up (write the colour with `rgb(var(--desktop-glow) / .35)` or a fixed value) and checking in UAT.
- Employee / access editors and a reorder of arrays other than the four lists are unchanged.

## Known Stubs

None.

## Threat Flags

None. T-03-13 (hold + capture kept, one undo step, nothing saved until СОХРАНИТЬ), T-03-14 (loop only while active, cancelled in `stop` and on unmount) mitigated; T-03-15 accepted (fixed labels, React text nodes); no package installed (T-03-SC).

## User Setup Required

None.

## Next Phase Readiness

- ROADMAP Phase 3 criteria 3 and 4 are implemented; live confirmation remains for the phase UAT together with the 03-03 phone items.

## Self-Check: PASSED

- Modified files exist: lib/editor-changes.ts, lib/editor-changes.test.ts, components/portia-editor.tsx, app/portia.css.
- Commits e8ac504, 66fe13b, 0ab78f1 are ancestors of HEAD.
- Verification: tsc 0, lint 0 errors (13 pre-existing warnings), npm test 72/72, build 0, structural checks "dossier tabs tracer OK" and "lanes OK".

---
*Phase: 03-redaktor*
*Completed: 2026-10-14*
