---
phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
plan: 03
subsystem: ui
tags: [save-chip, popover, aria-live, phone-stacking, edge-cdp]
requires:
  - phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
    provides: floating format panel and phone bottom sheet (11-02), harness with openEditor, phone, desktop
provides:
  - compact unsaved chip with a popover (list of sections, undo, discard, save) replacing the full-width save bar
  - red chip with a leading ! for a blocked, failed or conflicting save
  - always-mounted polite live region for save status
  - phone chip stacked above the bottom nav and above the format sheet, open or folded
  - harness check savechip, steps (a)-(l), with a local-only fake save
affects: [PORTIA-11 plan 07 (owner checks chip on PC and phone)]
status: complete
actuals:
  tokens: 21000
  tasks: 2
  commits: 2
plan_head_before: 71ede72a232741c7ba4d1df21e71dfcfe9a924e5
plan_head_after: d4050be21dc7de1f974a89c7c377cf378a5d6caa
tech-stack:
  added: []
  patterns:
    - "Derived state reset during render (popoverOpen closes when the draft is clean) instead of an effect"
    - "Harness answers a PUT locally only while current.fakeSave is set; no non-GET is ever forwarded"
key-files:
  created:
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-03-SUMMARY.md
  modified:
    - components/portia-editor.tsx
    - app/portia.css
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-editor-check.mjs
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-UI-SPEC.md
key-decisions:
  - "A failed save or a conflict also turns the chip red with !, not only a blocked save"
  - "The saved check mark lasts the desktop's existing 1.8 s, no second timer"
  - "At 520px and below the chip sits at right 54px, left of the pencil button column"
requirements-completed: [EDIT-05]
duration: 35min
completed: 2026-10-26
---

# Phase 11 Plan 03: Save chip Summary

The full-width «НЕ СОХРАНЕНО» bar is replaced by a small chip in the editor's bottom-right corner that counts changed sections, opens a popover with the list and the existing undo, discard and save actions, and turns red when the save cannot go through. On a phone it is a fixed 44px target that stacks above the bottom nav and above the format sheet.

## What was built

- **Task 1 (tracer), commit 3414b54.** `.editor-save-chip` (sticky in the editor window) with a button showing `changed.length`, `…` while saving, `✓` after a save; `aria-expanded`, `aria-haspopup="dialog"`, `aria-controls`, `aria-label` «Не сохранено разделов: N». The popover (`role="dialog"`) holds the title, the one-line section list with titles, status, oversize and body reasons, the quest-date fix button (`.editor-save-fix`) and the same three buttons with the same disabled rules as the old bar. It closes on Esc (focus returns to the chip), on an outside `pointerdown`, and by a render-time reset when the draft becomes clean. An always-mounted `sr-only` `role="status" aria-live="polite"` node announces save status and unsaved sections. `save()`, the shortcuts, the dirty report, the leave warning and the discard dialog are untouched. Old bar CSS removed. Harness check `savechip` (a)-(g).
- **Task 2, commit d4050be.** `alarm = dirty && (saveBlocked || saveState === "error" || conflict)` sets `data-blocked`, the text `!N` and an extended aria-label; red border and text from `--danger` / `#e07d74`. Phone CSS (max 900px): chip fixed at `bottom: 52px; right: 8px`, 44x44; `calc(52px + min(34svh, 270px))` with the sheet open; `96px` with it folded; `right: 54px` at 520px and below. The old phone bar rules and the rule that lifted the pencil button above the bar are gone; a `padding-bottom: 110px` rule keeps the last field above the chip when no sheet is open. Harness steps (h)-(l) and a local-only fake save. UI-SPEC section 3 amended.

## Verification

- `npm test`: 313 pass, 0 fail. `npx tsc --noEmit`: clean. `npm run build`: ok.
- `npm run lint`: 0 errors in this plan's files; the 2 errors are the known `.cjs` files in phase 06; the new code adds no warnings.
- On `next start -p 3124` (stopped afterwards): `--check savechip` prints `"ok": true` for (a)-(l) with fakeSaves 1 and no "write blocked" reasons (390x844 and 360x640); `--check panel` and `--check mark` still `"ok": true`.
- Greps: `editor-savebar` and `barVisible` appear nowhere in `components/portia-editor.tsx` or `app/portia.css`; UI-SPEC section 3 has the amendment mark and «1.8 s».

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, harness] Live-region count, focus, toggle and content cache**
- **Found during:** Tasks 1 and 2
- **Issue:** the plan's check counted every polite `role="status"` on the page, which also counts the Settings window's saved-status node; harness `click()` does not focus the chip like a real tap, so Esc did not hit the wrapper; calling the open helper twice toggled the popover shut; the page caches content by revision, so the quest fixture at revision 1 was served from cache and the blocked state never appeared.
- **Fix:** the live-region count is scoped to `.content-editor`; the open helper focuses the button and clicks only when `aria-expanded` is not true; each fixture step uses its own revision (2, 3, 10).
- **Files modified:** 11-editor-check.mjs. **Commits:** 3414b54, d4050be.

No product-code deviations.

## Known Stubs

None.

## Threat Flags

None. T-11-06 (СОХРАНИТЬ keeps the bar's disabled rule and `save()` its own guards; harness step h confirms it is disabled for a bad quest), T-11-07 (red chip, live region, popover reason text) and T-11-08 (fake-save PUT is fulfilled locally and never forwarded) are mitigated and exercised.

## Notes

- The popover lists the section labels only while the draft is dirty; after a save the chip shows ✓ without a popover.
- The owner checks the chip on the PC and on a real phone in 11-07.

## Self-Check: PASSED

- FOUND: components/portia-editor.tsx, app/portia.css, 11-editor-check.mjs, 11-UI-SPEC.md
- FOUND commits: 3414b54, d4050be
