---
phase: 03-redaktor
plan: 02
subsystem: ui
tags: [react, keyboard-shortcuts, beforeunload, native-dialog, node-test]

requires:
  - phase: 03-redaktor
    provides: "plan 03-01: history reducer, save(): Promise<boolean>, step(), ConfirmDialog, dialog state"
provides:
  - "lib/editor-shortcuts.ts: pure shortcutOf(event) mapping KeyboardEvent.code (KeyS/KeyZ/KeyY) with Ctrl or Meta, layout independent, AltGr excluded"
  - "Ctrl/Cmd+S, Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y window listeners active only for the active, non-minimized editor with no dialog open"
  - "Close guard: x with unsaved edits asks СОХРАНИТЬ / НЕ СОХРАНЯТЬ / ОТМЕНА in a PORTIA dialog; minimize never asks"
  - "beforeunload leave-page warning while dirty"
  - "Move-to-bin and delete-forever confirmations moved to ConfirmDialog (no native confirm left in the editor)"
affects: [03-03, 03-04]

plan_head_before: 7763523dd1395bf1b6e7835e7d83cffaf8219ab6
plan_head_after: f9d257841e82f878dcd52b304a6bd1553a70c2b6

actuals:
  tokens: 3350
  tasks: 2
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Window manager asks the editor to confirm a close through a counter prop (closeRequest) compared with a handled counter in state, no effect and no setState-in-effect"
    - "Latest-callback ref (actionsRef) so window listeners are not re-subscribed on every render"
    - "Dirty flag mirrored to the desktop through a ref, read inside event handlers only"

key-files:
  created:
    - lib/editor-shortcuts.ts
    - lib/editor-shortcuts.test.ts
  modified:
    - components/portia-editor.tsx
    - components/portia-desktop.tsx

key-decisions:
  - "Shortcut effect reads save/step through a ref updated every render instead of listing them in deps (react-hooks/exhaustive-deps warned: the functions change each render)"
  - "СОХРАНИТЬ in the close dialog closes only when save() resolved true; a failed or ignored save leaves the window open with the bar showing the state"

requirements-completed: [EDIT-02]

coverage:
  - id: D1
    description: "shortcutOf maps Ctrl/Cmd+S, Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y by physical key code; Russian layout and AltGr handled"
    requirement: EDIT-02
    verification:
      - kind: unit
        ref: "lib/editor-shortcuts.test.ts (8 tests)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Shortcuts reach the editor only while it is the active, non-minimized window; Сотрудники/Доступ keep native undo; browser save dialog never opens"
    requirement: EDIT-02
    verification:
      - kind: other
        ref: "node structural check 'shortcuts tracer OK' + tsc + lint + build"
        status: pass
    human_judgment: true
    rationale: "Real browser key interception on a Russian layout and the absence of the browser save dialog need a human in the logged-in editor (D-10, D-11)"
  - id: D3
    description: "Close dialog (СОХРАНИТЬ / НЕ СОХРАНЯТЬ / ОТМЕНА, Esc, backdrop), minimize without a question, immediate close when clean, beforeunload warning on F5"
    requirement: EDIT-02
    verification:
      - kind: other
        ref: "node structural check 'close guard OK' + tsc + lint + build"
        status: pass
    human_judgment: true
    rationale: "Window-manager flow, browser leave-page warning and focus behaviour are only observable live; editor login is owner-only (D-12)"
  - id: D4
    description: "Move-to-bin and delete-forever confirm in the PORTIA dialog with the previous texts; works in embedded browsers; 1.8 s idle timer race fixed"
    requirement: EDIT-02
    verification:
      - kind: other
        ref: "node structural check 'close guard OK' (no window.confirm( left, texts verbatim, saveStateTimer cleared)"
        status: pass
    human_judgment: true
    rationale: "Embedded-browser behaviour (Telegram/Discord in-app) cannot be exercised here"

duration: 5min
completed: 2026-10-14
status: complete
---

# Phase 3 Plan 02: Keyboard shortcuts, close guard and PORTIA dialogs Summary

**Ctrl/Cmd+S saves and Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y step the shared history on any keyboard layout while the editor is the active window; closing with unsaved edits asks in a PORTIA dialog, reload warns, and the last two native confirm prompts are gone.**

## Performance

- **Duration:** about 5 min
- **Started:** 2026-10-13T23:12:08Z
- **Completed:** 2026-10-13T23:17:00Z
- **Tasks:** 2 (1 tracer TDD, 1 auto)
- **Files modified:** 4 (2 created, 2 modified)

## Accomplishments

- `lib/editor-shortcuts.ts`: `shortcutOf` matches `KeyboardEvent.code` only (`key` is «ы» on a Russian layout), requires Ctrl or Meta, rejects Alt (AltGr is Ctrl+Alt on Windows) and Ctrl+Shift+S.
- Editor shortcut effect: window `keydown` and `beforeinput` listeners, attached only when `active`, no dialog, no close request pending. Save is taken on every tab and always `preventDefault()`ed; undo/redo only on draft tabs, so Сотрудники and Доступ keep native undo. `historyUndo`/`historyRedo` input types (phone keyboards, Edit menu) map to `step()`.
- Close guard: `requestExit(appId, kind, force = false)` bumps `editorCloseRequest` when the editor is closed with `editorDirtyRef.current` true; the editor shows «Закрыть редактор?» with the unsaved sections. СОХРАНИТЬ closes only after `save()` resolved true, НЕ СОХРАНЯТЬ closes and drops the draft, ОТМЕНА / Esc / backdrop keep everything (default focus on ОТМЕНА). Minimize is unguarded.
- `beforeunload` listener registered only while dirty (`preventDefault` + `returnValue = ""`), removed on cleanup and on unmount.
- «ПЕРЕМЕСТИТЬ В КОРЗИНУ» and «УДАЛИТЬ НАВСЕГДА» open `ConfirmDialog` with the former texts verbatim; `window.confirm(` count in the editor is now 0 (closes the Phase 2 blocker in STATE.md).
- `saveContent` keeps its idle timer in `saveStateTimer` and clears the previous one, so a second save within 1.8 s is not flipped to idle mid-request.

## Task Commits

1. **Task 1 (tracer): shortcuts on the active editor window** - `42ff8fe` (test, RED), `c5de873` (feat, GREEN)
2. **Task 2: close guard, leave warning, native prompts replaced** - `f9d2578` (feat)

**Plan metadata:** committed separately (docs: complete plan)

Tracer gate: Task 1 `<verify>` is automated-only and `HUMAN_VERIFY_MODE` is `end-of-phase`, so it was re-run end to end (unit tests, tsc, lint 0 errors, test, build, structural check "shortcuts tracer OK"); it passed and expansion continued.

## Files Created/Modified

- `lib/editor-shortcuts.ts` - pure `shortcutOf`, `KeyInfo`, `EditorShortcut`
- `lib/editor-shortcuts.test.ts` - 8 node:test cases incl. Russian «ы» and Ctrl+Alt
- `components/portia-editor.tsx` - new props `active`, `onDirtyChange`, `closeRequest`, `onCloseApproved`; shortcut and beforeunload effects; close, recycle and delete dialogs; `moveSelectedVirusToRecycle`, `deleteSelectedRecycledVirus`
- `components/portia-desktop.tsx` - `editorDirtyRef`, `reportEditorDirty`, `editorCloseRequest`, `saveStateTimer`, `requestExit` force parameter and guard, new editor props

## Decisions Made

- Listeners read `save`/`step` through `actionsRef` (updated each render) and depend only on `active`, `dialog`, `closeAsked`, `tab`. Listing the plan's `save, step` deps raised 2 new `react-hooks/exhaustive-deps` warnings (functions are recreated each render); the ref keeps lint at the 13 pre-existing warnings and avoids re-subscribing each render.
- `editorDirtyRef` is not cleared on unmount: the next mount reports `dirty=false` immediately, and a closed editor cannot be closed again.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug/lint] Shortcut effect deps raised new exhaustive-deps warnings**
- **Found during:** Task 1
- **Issue:** `[active, dialog, tab, save, step]` made the effect re-run every render and added 2 warnings (13 -> 15).
- **Fix:** `actionsRef` holding the latest `{ save, step }`, updated in an effect without deps; effect deps reduced to `active, dialog, closeAsked, tab`. Behaviour as specified; the plan's structural check still passes.
- **Files modified:** components/portia-editor.tsx
- **Verification:** lint back to 0 errors / 13 warnings; tsc, tests, build green
- **Committed in:** c5de873

**2. [Process] RED commit carries a stub module**
- **Found during:** Task 1
- **Issue:** The test imports `./editor-shortcuts.ts`; without a file the run would fail on import (INVALID_RED).
- **Fix:** Stub `shortcutOf` returning `null` in the RED commit; 4 of 8 tests failed on `AssertionError` (save, russian layout, undo/redo, Ctrl+Y); the 4 null-expectation tests pass trivially on a stub.
- **Committed in:** 42ff8fe

---

**Total deviations:** 1 auto-fixed (lint/structure), 1 process note. **Impact on plan:** none on behaviour or scope.

## TDD Gate Compliance

Task 1 has `test(03-02)` (42ff8fe) before `feat(03-02)` (c5de873). The `check tdd-red-evidence` classifier was not run (`workflow.tdd_mode` is off; the runner prints the spec reporter, not TAP). Semantic assessment: the failing tests executed `shortcutOf` and failed on the planned `"save"`/`"undo"`/`"redo"` expectations, not on import or fixture errors. No REFACTOR commit. Task 2 is `type="auto"` without `tdd`.

## Issues Encountered

- Human-check for Task 2 (Ctrl+S on a Russian layout, undo/redo, other window untouched, close dialog paths, F5 warning, minimize, bin/delete dialogs, embedded browser) was not run: the editor needs the owner login. Recorded as `human_judgment: true` in the coverage block for the phase UAT.
- Assumption carried from the plan: × while a save is already running shows the dialog and its СОХРАНИТЬ returns false (save ignores a running save), so the window stays; a second × after the save closes normally.

## Known Stubs

None.

## Threat Flags

None. Window-level key listeners and `beforeunload` are the planned trust-boundary items T-03-06 and T-03-07; no new endpoints, auth paths or schema changes.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Keyboard, close and reload paths cannot drop the draft without a choice; STATE.md blocker about native prompts in the editor can be closed.
- Open for the phase UAT: the live checks listed above (D2, D3, D4).

## Self-Check: PASSED

- Created files exist: lib/editor-shortcuts.ts, lib/editor-shortcuts.test.ts (FOUND); modified: components/portia-editor.tsx, components/portia-desktop.tsx (FOUND).
- Commits 42ff8fe, c5de873, f9d2578 are ancestors of HEAD; 1 `test(03-02)` and 2 `feat(03-02)`.
- Plan verification: shortcut unit tests 8/8, full `npm test` 62/62, `tsc --noEmit` 0, lint 0 errors (13 pre-existing warnings), build 0, structural checks "shortcuts tracer OK" and "close guard OK"; `window.confirm(` count in the editor is 0.

---
*Phase: 03-redaktor*
*Completed: 2026-10-14*
