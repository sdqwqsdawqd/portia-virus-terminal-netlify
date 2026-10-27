---
phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
plan: 04
subsystem: ui
tags: [collapsible-cards, table-of-contents, intersection-observer, ellipsis, edge-cdp]
requires:
  - phase: PORTIA-11-redaktor-panel-oformleniya-i-teksty
    provides: harness with openEditor, clickText, phone, desktop, fixtures and the blocked-write stub (11-01..11-03)
provides:
  - CollapsibleCard: one-line header (handle, one toggle button with ellipsis title, actions) and a hidden body, for Информация sections, subsections, blocks and Сводка cards
  - EditorToc: one sticky table of contents component with four call sites (Информация, Сводка, virus list, Корзина), shown at 5 or more entries
  - jumpToCard, openVirus, openRecycleEntry: one scroll path and one open path shared by a row and its TOC entry
  - aside-list ellipsis and full-name title for viruses and Корзина, title on recommendation rows
  - harness check sections, steps (a)-(p), with sectionsFixture()
affects: [PORTIA-11 plan 07 (owner checks the feel of folding, drag and TOC)]
status: complete
actuals:
  tokens: 52000
  tasks: 3
  commits: 3
plan_head_before: 1ec5d3ffd2d400ce6569d9908782039230ce24bc
plan_head_after: 1a493557c1f4de952e2fadeb42a019bdbb83c55e
tech-stack:
  added: []
  patterns:
    - "Collapsed bodies use the hidden attribute, not unmounting, so rich fields keep DOM and selection"
    - "A TOC owns only its list state and the entry in view; the caller owns what a jump does"
    - "Row button and TOC entry call one named handler per list (openVirus, openRecycleEntry)"
key-files:
  created:
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-04-SUMMARY.md
  modified:
    - components/portia-editor.tsx
    - app/portia.css
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-editor-check.mjs
    - .planning/phases/PORTIA-11-redaktor-panel-oformleniya-i-teksty/11-UI-SPEC.md
key-decisions:
  - "Open state is a Set in PortiaEditor state, never stored; the next visit starts collapsed"
  - "Collapse all also closes the format panel when its field sits in a card body (same Pitfall 7 rule as a single collapse)"
  - "The TOC list is closed by default; the bar (trigger and fold buttons) is always visible; a click on an entry closes the list"
requirements-completed: [EDIT-03]
duration: 45min
completed: 2026-10-26
---

# Phase 11 Plan 04: Sections, folding and table of contents Summary

Long editor lists are now easy to move through: every «Информация» section, subsection and block and every Сводка card opens collapsed to a one-line header, long names end in «…» with the full name in a tooltip, and a sticky «ОГЛАВЛЕНИЕ» jumps to any entry on «Информация», Сводка, the virus list and «Корзина».

## What was built

- **Task 1 (tracer), commit 442e1b5.** `CollapsibleCard` and the `expanded` Set state with `isOpen` / `setOpen`. Header is `[≡] [label · title as one toggle button, ▸/▾, aria-expanded, aria-controls, aria-label] [Удалить]`; the body is `hidden`, not unmounted. Used for «Информация» sections. CSS `.nested-editor-head .nested-editor-toggle` with ellipsis span, chevron, focus ring, 44px on a phone. Harness check `sections` (a), (c), (d).
- **Task 2, commit cbe6a05.** Subsections, blocks (a text block's title is its first non-empty line) and Сводка cards use the same card. Every add button makes its id first and opens the new item; `revealCard` and the type-change reveal open the card before the reveal effect focuses the field; `toggleCard` closes the format panel when the card being folded holds the active field. Virus and Корзина aside rows and recommendation rows got `title`; `.editor-record-list strong, small` got the ellipsis (the D-05 overlap bug). A dragged card is force-folded by CSS `:has(... [data-dragging])`. Empty «Информация» shows the line naming «+ ДОБАВИТЬ РАЗДЕЛ». Harness (f), (g), (i), (k), (m).
- **Task 3, commit 1a49355.** `EditorToc` (trigger «ОГЛАВЛЕНИЕ ▾», «СВЕРНУТЬ ВСЕ» / «РАЗВЕРНУТЬ ВСЕ» only when `onAll` is given, list with `max-height: 40svh`, IntersectionObserver with rootMargin `-80px 0px -60% 0px` marks the entry in view with `aria-current="location"`). Four call sites; `jumpToCard` scrolls smoothly only when `dataset.motion === "full"`; `openVirus` and `openRecycleEntry` are shared by the row button and the TOC entry; rows carry `id="card-<id>"`. Sticky CSS (`top: 44px` on a phone), `scroll-margin-top` 56px / 100px. UI-SPEC section 1 amended (planner decisions 1-4, the owner's D-02 clarification, the active-entry rule). Harness (b), (e), (h), (l), (n), (o), (p).

## Verification

- `npm test`: 313 pass, 0 fail. `npx tsc --noEmit`: clean. `npm run build`: ok.
- `npm run lint`: 19 problems, unchanged from before this plan (2 known `.cjs` errors in phase 06, 17 existing `<img>` warnings); the new code adds none.
- On `next start -p 3124` (stopped afterwards): `--check sections` (a)-(p) `"ok": true`, no "write blocked" reasons; `--check savechip` (incl. step h, the reason jump opens the collapsed quest card), `--check panel` and `--check mark` still `"ok": true`.
- Greps: `function EditorToc` 1, `aria-label="Оглавление"` 1, `<EditorToc` 4, `openRecycleEntry` 3, `openVirus` 3, `СВЕРНУТЬ ВСЕ` 1, `РАЗВЕРНУТЬ ВСЕ` 1, `IntersectionObserver` 1, `max-height: 40svh` 1; `localStorage` count in the editor unchanged at 3 (collapse state is never stored).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, harness] Row selectors**
- **Found during:** Task 3
- **Issue:** `.editor-record-row > button` first match is the ≡ handle, not the row button, so (o) and (p) reported "not active".
- **Fix:** use `:scope > button:last-child`.
- **Files modified:** 11-editor-check.mjs. **Commit:** 1a49355.

**2. [Rule 3 - Blocking, harness] Missing helper**
- **Found during:** Task 3
- **Issue:** the TOC item counter was referenced by several steps but not defined in the check.
- **Fix:** defined once at the top of `sections`.
- **Files modified:** 11-editor-check.mjs. **Commit:** 1a49355.

No product-code deviations. Two small choices the plan left open: the sticky TOC for Сводка sits after the sub-tab nav and before the add button; the TOC list stays closed until the trigger is pressed.

## Known Stubs

None.

## Threat Flags

None. T-11-09 is mitigated and exercised (`revealCard` opens the card before the reveal effect focuses the field; savechip step h passes with collapsed cards). T-11-10 accepted: names go into `title` attributes and TOC buttons as React text and attribute values, no `dangerouslySetInnerHTML`. The harness blocked every non-GET to /api/*.

## Notes

- The owner checks the feel of folding, the drag of an expanded card and the TOC in 11-07 (backstop verification for the drag-feel truth).
- Uncommitted user changes (package.json, package-lock.json, .planning/state.json, .planning/milestone.lock, .planning/ui-reviews/) were left untouched.

## Self-Check: PASSED

- FOUND: components/portia-editor.tsx, app/portia.css, 11-editor-check.mjs, 11-UI-SPEC.md
- FOUND commits: 442e1b5, cbe6a05, 1a49355
