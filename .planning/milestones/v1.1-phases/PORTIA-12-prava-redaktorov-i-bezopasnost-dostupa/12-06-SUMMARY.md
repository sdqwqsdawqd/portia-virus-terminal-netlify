---
phase: PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa
plan: 06
subsystem: editor-ui
tags: [permissions, editor, tabs, PERM-03, PERM-04, browser-harness]
requires: ["12-01", "12-02", "12-03", "12-05"]
provides:
  - "PortiaEditor props openTabs and saveError; PortiaDesktop openTabs state, canEditRef, saveError state"
  - "12-editor-check.mjs with --check tabs|revert|all"
affects: [12-07, 12-08]
tech-stack:
  added: []
  patterns: [derived tab at render instead of an effect, closure effect with window.setTimeout 0, harness fake-save never forwarded]
key-files:
  created:
    - .planning/phases/PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa/12-editor-check.mjs
  modified:
    - components/portia-desktop.tsx
    - components/portia-editor.tsx
key-decisions:
  - "The employee draft flag is read synchronously when the closure effect runs, because the employee editor unmounts with its tab and reports clean before the timer fires"
  - "Panels and the leave dialog are cleared only for a newly closed section, so a tab the owner re-opens does not close the format panel mid-typing"
  - "lib/editor-save.ts extraction not taken (plan decision): closed sections go out as revertSections of the stored copy"
status: complete
commits: 2
plan_head_before: 04862b08b5eea381bb387010b363a13e3385a47f
plan_head_after: 098708f0545a2292bc8b612863cd15e88342d243
actuals:
  tokens: 11000
  tasks: 2
  commits: 2
completed: 2026-10-26
---

# Phase 12 Plan 06: Editor follows the tab list Summary

A restricted editor now sees only the tabs `/api/access` lists, picks up an owner's closure within one 10 s poll, loses only the closed sections' drafts (history included, with a message), and never sends a closed section other than as stored.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 | Tracer: tab list from `/api/access` to the editor strip, no-tab screen, `tabs` check | 8f5ef0d |
| 2 | Closure reset, reverted save payload, 403 reason, disabled restore, `revert` check | 098708f |

## What was built

- `components/portia-desktop.tsx`: `openTabs` state (same array kept when the ids are equal), `canEditRef`; the 10 s interval and `onVisible` call `fetchAccess` only while `canEditRef.current` (anonymous visitors never hit `/api/access` on the poll); `saveError` state, set from the body of a non-OK non-409 answer, with an immediate `fetchAccess` on 403; both props passed to the editor.
- `components/portia-editor.tsx`:
  - `pickedTab` plus a `tab` derived at render (first open tab when the pick is closed), `stripTabs` from `tabRegistry` and the owner's «Доступ», `noTabs` screen «Владелец пока не открыл вам ни одного раздела» after all hooks.
  - Closure effect (keyed on the closed set): `deniedSections` names what is lost, `restrict` with `revertSections` resets drafts and history, panels, record view and leave dialog are cleared, `closureNotice` shows «Владелец закрыл раздел «X», несохранённые правки в нём сброшены» (plural form for several). `showTab` and a successful save clear it.
  - `shownChanged` (changed minus closed sections) drives dots, chip, popover, dialogs and the sr-only line; `dirty` stays on the full `changed`.
  - `save()` sends and dispatches `revertSections(history.baseline, normalized, closedSections)`.
  - `ArchivedVirusEditor.restoreBlocked` disables «ВОССТАНОВИТЬ В БАЗУ» with a title while «База вирусов» is closed.
  - `statusText` shows `saveError` for the error state, else «ОШИБКА».
- `12-editor-check.mjs`: CDP plumbing copied from phase 11 (port 9336, own profile). `/api/access` and `/api/content` are stubbed; every other non-GET to `/api/*` is blocked and recorded as "write blocked"; a PUT `/api/content` is answered locally only while `fakeSave` is set. `tabs` covers strip labels, the no-tab screen and the derived tab. `revert` covers closure with two dirty sections (notice, popover list, one Ctrl+Z clean, redo, save payload), the phantom-diff case with a control run that proves it can fail, and the disabled restore.

## Verification

- `npx tsc --noEmit`: clean. `npm test`: 405 pass, 0 fail. `npm run build`: compiled.
- `npm run lint`: 0 errors in the touched files; the only errors are the 2 known `no-require-imports` in the PORTIA-06 check scripts.
- Production build on port 3124: `12-editor-check.mjs --check all` prints `ok: true` for `tabs` and `revert`. Server stopped afterwards (port 3124 no longer answers).
- Acceptance greps: `openTabs={openTabs}` 1, `if (canEditRef.current) void fetchAccess()` 2, `type: "restrict"` 1, `revertSections(history.baseline` 1, «несохранённые правки в нём сброшены» 1, `saveError={saveError}` 1.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `shownChanged` declared before `closedSections` (TDZ crash)**
- **Found during:** Task 2 first harness run (page exception "Cannot access before initialization").
- **Fix:** moved the `shownChanged` line below `closedSections`. Commit 098708f.

**2. [Rule 3 - Blocking] Harness cache collision**
- **Found during:** Task 2. A fake save writes revision + 1 into the page's localStorage cache, and the next fixture got the same revision, so the stale (normalized) cache won and check (b) could not fail meaningfully.
- **Fix:** `serve` advances the revision by 10. The bin check clicks the row's last button (the first is the drag handle).
- **Files modified:** 12-editor-check.mjs.

Two small points inside the plan's wording: `closedSections` is a plain derived array (a `useMemo` tripped the React Compiler lint rule), and the unused `editorSections` import was dropped.

## Pending human check

Task 2's two-account check (owner closes «Сводка» for a test editor with unsaved Сводка and virus edits) needs the SQL from 12-08 and two real accounts; it was not run. The harness fakes `/api/access`. Also not covered by the harness: the 403 text in the save status and the immediate `/api/access` re-read (verified by reading the code path only).

## Known Stubs

None.

## Threat Flags

None. No new endpoints; `/api/access` is read, not extended. T-12-26 held: no write was forwarded in any harness run.

## Self-Check: PASSED

- 12-editor-check.mjs, 12-06-SUMMARY.md and the two touched components exist.
- Commits 8f5ef0d and 098708f are in HEAD; `commits: 2` measured from the ledger.
