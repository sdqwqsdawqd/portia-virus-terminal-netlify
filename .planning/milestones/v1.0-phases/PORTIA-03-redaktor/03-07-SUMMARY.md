---
phase: 03-redaktor
plan: 07
subsystem: ui
tags: [editor, contenteditable, mobile, inputmode, css, gap-closure]
status: complete

requires:
  - phase: 03-redaktor
    provides: "plan 03-03: phone format panel (FloatingTextFormatPanel) with the Custom Highlight paint"
provides:
  - "Phone format panel stays open while the owner touches / long-presses text to select; rich fields carry inputMode none while it is open"
  - "Idle rich fields show real run colours on the preview background; selected text keeps its colour"
affects: [03-08]

plan_head_before: 2d2e8e6
plan_head_after: 828c0d3

actuals:
  tokens: 3000
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "inputMode none derived in render from formatterOpen + 900px matchMedia, so every close path drops it"
    - "flushSync(onClose) before field.focus so the keyboard-enabling re-render is committed first"
    - "::selection { color: currentColor } on rich fields keeps the run colour under the global tint"

key-files:
  created: []
  modified:
    - components/portia-editor.tsx
    - app/portia.css
    - .planning/phases/PORTIA-03-redaktor/03-03-PLAN.md

key-decisions:
  - "03-07: phone format panel stays open while selecting; rich fields get inputMode none while it is open; reverses the 03-03 tap-to-close truth (owner, UAT 12)"
  - "inputMode none goes on every rich field while the phone panel is open (not only the target), so touching another field retargets without the keyboard"
  - "Idle light-preview rich fields sit on the #f3f1e9 preview paper; dark preview needs no rule (base background already equals it)"

requirements-completed: [EDIT-01]
---

# Phase 03 Plan 07: format panel selection and idle colours Summary

On a phone the format panel no longer closes when the owner selects text, and the keyboard stays hidden while it is open (inputMode none, one blur from ✎). Fields that are not being edited now show their real text colours and highlight backgrounds.

## Commits

- `4cb73f4` fix(03-07): phone format panel stays open while selecting text
- `828c0d3` fix(03-07): idle rich fields show real run colours; selection keeps them

## What changed

- **Task 1 (uat-03-t12-panel-closes-on-select, tracer):** `ActiveFormatContext` gains `phonePanelOpen`, which the Provider sets to `formatterOpen && matchMedia("(max-width: 900px)")`. Every `FormattedTextarea` gets `inputMode={activeFormat.phonePanelOpen ? "none" : undefined}`. On phones the ✎ onClick blurs the target field once, and only when opening. `FloatingTextFormatPanel` no longer has the `focusin` close listener, the stored `onCloseRef` or the per-remount blur. The highlight paint, keep-visible scroll, cleanup and the four deps are unchanged. `finish` now calls `flushSync(onClose)` before focusing the field (`flushSync` comes from react-dom). In 03-03-PLAN.md the line-26 truth drops the tap-to-close clause and records "Reversed by 03-07".
- **Task 2 (uat-03-t12-color-not-shown):** every rich field now has a `preview-${surface}` class, and `is-editor-active` stays on the target field only. The idle grey `!important` override is replaced by `.formatted-rich-input.preview-light { background: #f3f1e9; color: #252827; }`. A new rule `.formatted-rich-input::selection, .formatted-rich-input *::selection { color: currentColor; }` sits after the global `::selection`, which is unchanged.

## Verification

| Check | Result |
|---|---|
| `npx tsc --noEmit` | exit 0 |
| `npm run lint` (exit code checked on its own) | exit 0; 0 errors, 13 warnings (all existing no-img-element) |
| `npm test` | 72/72 pass |
| `npm run build` | exit 0 |
| Task 1 node check | "panel stays open on select OK" (re-run after Task 2: still OK) |
| Task 2 node check | "rich field colours OK" |
| Tracer gate | `<verify>` re-run end-to-end passed before Task 2 |

## Deviations from Plan

None. The plan was executed as written.

Note: the dev server on port 3123 was not running when this plan started (no `next dev` process; `.next/dev/logs` last written 17:27; edits did not trigger a recompile). It was not restarted.

## Pending human checks

These need the owner's login and a real phone, so they were not checked here. Steps are in the Task 2 human-check of the plan.

- Phone: ✎ hides the keyboard; touching and long-pressing text with the panel open keeps the panel and no keyboard appears; a style applies to the new selection; touching another big field retargets the panel; ГОТОВО gives back the caret and the save bar (iPhone may need one more tap).
- Phone and PC: a coloured word in an idle field shows its colour and reads well on the light paper (Вирусы) and on dark-preview tabs (Информация); БЕЛЫЙ / ЧЁРНЫЙ switches the field backgrounds; a selected coloured word keeps its colour with only the tint under it. On PC, ✎ opens the panel as before.
- Unverified on a device: `inputmode="none"` on contenteditable with long-press handles (iOS Safari / Chrome Android), and `currentColor` in `::selection` since the Chrome 134 inheritance change.

## Self-Check: PASSED

- FOUND: components/portia-editor.tsx, app/portia.css, .planning/phases/PORTIA-03-redaktor/03-03-PLAN.md
- FOUND: 4cb73f4, 828c0d3 (ancestors of HEAD)
