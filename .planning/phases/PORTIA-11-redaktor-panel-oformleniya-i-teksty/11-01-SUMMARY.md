---
phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
plan: 01
subsystem: ui
tags: [css-highlight, oklch, node-test, edge-cdp, contenteditable]
requires:
  - phase: PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost
    provides: 10-desktop-check.mjs harness model, oklch accent tokens and the accent-theme test helpers
provides:
  - accent-following target mark with 3:1 contrast on every preview field
  - npm test guards for the mark, the own-input window boundary and the single rich-text-style import
  - neutral editor copy and no empty field-head element
  - no caret at 0 stored after ГОТОВО with an unknown selection
  - 11-editor-check.mjs, a headless Edge harness that opens the editor without login and without writes
affects: [PORTIA-11 plans 02-07]
status: complete
actuals:
  tokens: 7530
  tasks: 2
  commits: 2
plan_head_before: e29b94394e3dbcc9950f3e42310494b8e487fa3f
plan_head_after: 73d1100d5f3236cd65f78f688ab3e1bfd2d394b3
tech-stack:
  added: []
  patterns:
    - "CDP Fetch interception answers GET /api/access and /api/content inside the launched browser only; every non-GET is blocked and recorded"
    - "CSS guard tests parse the comment-stripped stylesheet and sweep hue 0-345 and strength 0/0.5/1"
key-files:
  created:
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-editor-check.mjs
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/deferred-items.md
  modified:
    - app/portia.css
    - components/portia-editor.tsx
    - lib/accent-theme.test.ts
    - lib/rich-text-style.test.ts
    - lib/portia-desktop.test.ts
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-UI-SPEC.md
key-decisions:
  - "Mark colour is oklch(.57 calc(.1 * var(--accent-chroma)) var(--accent-hue) / .95), not the fixed rgba(0,150,132,.95): the literal fails the turquoise-literal test, ignores the owner accent and measures 2.99:1 over #eeeee9"
  - "TEST-02 boundary of own-input is the 400 ms window of fieldSelectionStep, not the panel clamp (that gets its tests in 11-02)"
requirements-completed: [EDIT-01, EDIT-02, A11Y-03, TEST-02]
duration: 40min
completed: 2026-10-26
---

# Phase 11 Plan 01: Editor mark, neutral copy and guard tests Summary

The format mark is now an accent-following teal underline that keeps 3:1 on all light and dark preview fields, `npm test` guards it, and the joke and empty labels are gone.

## What was built

- **Task 1 (tracer), commit 2aacbc2.** `::highlight(portia-format)` uses `oklch(.57 calc(.1 * var(--accent-chroma)) var(--accent-hue) / .95)` with `underline solid 3px`. The new test in `lib/accent-theme.test.ts` finds exactly one such rule, requires an underline and no `background`, then composites the mark over 5+ light and 2+ dark field backgrounds for every hue in 15 degree steps and strength 0, 0.5 and 1, requiring contrast >= 3. `11-editor-check.mjs` was built from the phase 10 harness (port 9335, profile `portia-editor-check`) with the stubbed access and content GETs, blocked writes, dialog auto-accept and the helpers `editorFixture`, `openEditor`, `clickText`, `wordBox`, `mouseSelect`, `phone`, `desktop`. Check `mark` (a)-(b): a mouse-selected word «второе» is painted through `CSS.highlights` and the served stylesheet holds one rule with underline, `accent-chroma` and no background. UI-SPEC amended (colour row, EDIT-02 section, Test Contract), including the Test Contract own-input line that Task 2 also listed.
- **Task 2, commit 73d1100.** Tests first: the 400 ms boundary test (a read at 1400 keeps the stored selection, at 1399 takes the incoming one) and the editor source guard test (one `from "@/lib/rich-text-style"`, no empty `<small>`, none of the three 03.1-IN-05 words, written as escapes in the test). The editor now has a single merged import with inline `type` specifiers, the hint «Текст и GIF можно использовать вместе. Не добавляйте лишних элементов.», «пользователь» in the idle guidance, no empty `<small>` in the field head (its dead CSS rule removed), and `finish` returns before `field.focus` when `target.selection` is null. Harness step (c) checks the field head and the hint.

## Verification

- `npm test`: 307 pass, 0 fail.
- `npx tsc --noEmit`: clean.
- `npm run lint`: 0 new problems; 2 pre-existing errors in phase 06 `.cjs` scripts (see Deferred Issues).
- `npm run build`: ok. `npx next start -p 3124` then `11-editor-check.mjs --check mark`: `"ok": true`, no reasons, after each task (after Task 2 with steps (a)-(c)).
- Fail-first, Task 1: with `background-color: red;` added to the rule the new test failed («expected to not match /background/i»); reverted before commit.
- Mutation check, Task 2: changing `event.at < state.ownUntil` to `<=` made the boundary test fail; reverted (lib/rich-text-style.ts unchanged).
- Task 2 behaviour tests: the boundary test passed on the existing code (it is a pin, not a fix); the source guard test failed before the edits and passes after.

## Deviations from Plan

None in code. Two notes:
- The UI-SPEC Test Contract own-input line was amended in the Task 1 commit together with the colour amendment (the plan listed it under Task 2). Same file, same content.
- The EDIT-01 phone behaviour (ГОТОВО without a selection closes without focusing) is covered by code and source reading only; no automated phone check exists in this plan. The owner confirms it on a device in 11-07, as the plan states.

## Deferred Issues

- `npm run lint` errors (`no-require-imports`) in `.planning/phases/PORTIA-06-uchet-zamechaniy-i-strahovka-dannyh/06-check-backup.cjs` and `06-check-disposition.cjs`. Pre-existing, out of scope; logged in `deferred-items.md`.

## Known Stubs

None.

## Threat Flags

None. The `/api/access` stub exists only as a CDP interception in the harness (`git grep 'canEdit":true' -- components lib app` prints nothing); the harness records and blocks every non-GET request.

## Self-Check: PASSED

- FOUND: app/portia.css, components/portia-editor.tsx, lib/accent-theme.test.ts, lib/rich-text-style.test.ts, lib/portia-desktop.test.ts, 11-editor-check.mjs, 11-UI-SPEC.md, deferred-items.md
- FOUND commits: 2aacbc2, 73d1100
