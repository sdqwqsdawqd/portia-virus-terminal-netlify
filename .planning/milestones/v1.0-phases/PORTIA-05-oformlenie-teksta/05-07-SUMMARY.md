---
phase: PORTIA-05-oformlenie-teksta
plan: 07
subsystem: ui
tags: [css, highlight-api, rich-text, gap-closure]
status: complete

requires:
  - phase: PORTIA-05 plans 01-06
    provides: format panel and the portia-format highlight registry name (CSS.highlights.set in components/portia-editor.tsx)
provides:
  - "::highlight(portia-format) is a thick teal underline with no fill, so the target marker cannot be mistaken for an applied «Фон» (G-05-2)"
affects: [PORTIA-05 end-of-phase verification]

requirements-completed: [TEXT-01]
gap_closed: [G-05-2]

actuals:
  tokens: 100
  tasks: 2
  commits: 1
plan_head_before: 23112164fc608456869425df5cc4d92ee9bc6337
plan_head_after: 7191038ef1f2560ed1186e9535a1940d273273cf

tech-stack:
  added: []
  patterns:
    - "::highlight carries only valid properties (text-decoration shorthand here); the look of a marker is separated from the look of an applied style"

key-files:
  created: []
  modified:
    - app/portia.css

key-decisions:
  - "05-07: the format-panel target marker ::highlight(portia-format) is a thick teal underline (text-decoration, glow token) with no fill, so it cannot be mistaken for an applied «Фон» (G-05-2)"

metrics:
  completed: 2026-10-19
---

# Phase PORTIA-05 Plan 07: Target marker as underline Summary

The format-panel target marker `::highlight(portia-format)` is now a 3px solid teal underline (`rgba(var(--desktop-glow), .9)`) with no fill; a teal fill on text can only come from an applied «Фон».

## What changed

`app/portia.css` (commit 7191038), two lines:

- Rule: `background-color: rgba(var(--desktop-glow), .35)` became `text-decoration: underline solid rgba(var(--desktop-glow), .9) 3px`.
- Comment above it: the stale phone-only line was replaced by one stating that the rule marks the text the next style changes, is drawn as an underline so it is not mistaken for an applied «Фон», and shows at every width.

`::selection` (lines 69, 71) and `components/portia-editor.tsx` are unchanged (the latter has no diff against HEAD). The automated check printed `highlight marker OK`.

## Device check (Task 2, owner)

Owner answered "approved" for steps 1-5, on PC and phone. СОХРАНИТЬ was not pressed and no automated step wrote content.

| Step | Check | Result |
| ---- | ----- | ------ |
| 1 | PC, selected word: teal underline, no fill, БЕЗ ФОНА; line stays on same word on HEX focus | approved |
| 2 | PC, caret in word: word under caret underlined, field not filled | approved |
| 3 | Phone: same underline, no fill, no keyboard while panel open | approved |
| 4 | «Фон» fill gives a real background, underline visible over it; БЕЗ ФОНА / Ctrl+Z work | approved |
| 5 | Ordinary text selection looks as before | approved |

## Review findings

Only the comment half of review IN-03 is closed here. The import-merge half stays deferred, and 05-REVIEW-DISPOSITION.md was not edited.

## Deviations from Plan

None. The plan's note that app/portia.css has CRLF endings did not hold (the file is LF); the two single-line Edits were unaffected.

## Known Stubs

None.

## Threat Flags

None. T-05-11 (marker spoofing) is mitigated and confirmed by the owner; T-05-12 (production content) held, no content was saved.

## Self-Check: PASSED

- app/portia.css contains the new rule; commit 7191038 is an ancestor of HEAD.
