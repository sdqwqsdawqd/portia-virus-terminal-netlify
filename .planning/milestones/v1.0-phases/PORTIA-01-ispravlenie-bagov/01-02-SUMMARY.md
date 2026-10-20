---
phase: PORTIA-01-ispravlenie-bagov
plan: 02
subsystem: ui
tags: [react, css, drag-handle, trash-viewer, roblox-link, a11y]

requires:
  - phase: PORTIA-01-ispravlenie-bagov (plan 01)
    provides: "committed WIP, absolute document viewport, IBM Plex Serif token; clean portia.css / portia-desktop.tsx"
provides:
  - "OrderDragHandle shows only the ≡ glyph (aria-label kept, no title/label), first child in all four sortable lists"
  - "Корзина viewer fills the window body below the title bar (.trash-app.is-viewing)"
  - "Roblox profile opens from the small portrait anchor; no text link"
affects: [PORTIA-02-vnesnii-vid, PORTIA-03-redaktor]

actuals:
  tokens: 2600
  tasks: 3
  commits: 3
plan_head_before: 6c20e9dc3aae60dc6d61ea867116565996d5a2c1
plan_head_after: 4676cf4e968d337f891de68b4fd351700d301db6
commits: 3

tech-stack:
  added: []
  patterns:
    - "Modifier class on a window root (is-viewing) driven by the same values that render the viewer, with a child combinator to avoid hiding nested headers"
    - "Link-or-figure conditional for an image that is clickable only when its data exists"

key-files:
  created: []
  modified:
    - components/portia-editor.tsx
    - components/portia-desktop.tsx
    - app/portia.css

key-decisions:
  - "Handle column is 34px in both .editor-record-row and .recommendation-order-row (was 40px for recommendations), matching the handle's own 34px width"
  - "Anchor portrait gets overflow:hidden and the figure background in one extra rule, because the generic .personnel-profile-head figure rule no longer applies to it"

requirements-completed: [FIX-01, FIX-04, FIX-05]

coverage:
  - id: D1
    description: "Drag handle shows only ≡ at the row start in virus, recycle, info-section and recommendation lists"
    requirement: FIX-01
    verification:
      - kind: other
        ref: "plan grep + node source-order check prints ok 3; tsc, lint (0 errors), 13/13 tests"
        status: pass
    human_judgment: true
    rationale: "Editor needs an owner session; rendered containment of each handle inside its row at desktop and 375px and long-press drag were not exercised"
  - id: D2
    description: "A file or recycled virus opened in Корзина fills the window below the title bar; × restores header and list"
    requirement: FIX-04
    verification:
      - kind: automated_ui
        ref: "CDP getBoundingClientRect (Edge headless): viewer rect equals .trash-app rect, top = title bar bottom, bottom = window bottom - 1px border; windowed, maximized, 375px; × restores header (display block)"
        status: pass
    human_judgment: true
    rationale: "First four file rows measured; the recycled-virus case (inner record header stays visible) rests on the child-combinator selector, not on a measurement"
  - id: D3
    description: "Portrait is the Roblox profile link (new tab, noreferrer, aria-label only, no title, no text link); plain figure without robloxUserId"
    requirement: FIX-05
    verification:
      - kind: automated_ui
        ref: "CDP DOM probe at 1440 and 375px: A tag, href https://www.roblox.com/users/{id}/profile, target _blank, rel noreferrer, aria-label set, title null, cursor pointer, no 'Профиль Roblox' text in the page, portrait 76/72px at the stage corner"
        status: pass
    human_judgment: true
    rationale: "Hover ring, focus outline and the new-tab navigation itself were not driven; the no-id figure fallback was not rendered (only one employee, with an id, was available)"

duration: 7min
completed: 2026-10-12
status: complete
---

# Phase PORTIA-01 Plan 02: Drag handle, Корзина viewer, Roblox portrait Summary

**Drag handle reduced to a bare ≡ at the start of every sortable row, Корзина files and viruses open across the whole window (`is-viewing`), and the Roblox profile is reached only through the small portrait anchor.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-10-12T19:29:51Z
- **Completed:** 2026-10-12T19:36:53Z
- **Tasks:** 3
- **Files modified:** 3 (components/portia-editor.tsx, components/portia-desktop.tsx, app/portia.css)

## Accomplishments

- FIX-01: removed the `ТЯНИТЕ` label and the `title` tooltip from `OrderDragHandle`; handler bodies and `aria-label` untouched. The handle is now the first child of virus rows, recycle rows, info-section heads (out of `nested-editor-actions`) and recommendation rows. Row grids start with a 34px column, content-button selectors switched to `:last-child` (desktop and mobile), `.nested-editor-head strong` takes `margin-right: auto`, and the dead `.order-drag-handle small` rule is gone.
- FIX-04: `.trash-app` gets ` is-viewing` exactly when `activeTrashFile || activeTrashVirus`; CSS removes padding, hides the Корзина header with `> header`, drops the layout border, adds a mobile `min-height: calc(100svh - 140px)` and an accent hover on the close button. Measured: viewer rect equals the app rect and ends at the window's inner bottom (1px border) windowed, maximized and at 375px.
- FIX-05: «Профиль Roblox» text link removed; the portrait is an `a.personnel-portrait` (href roblox.com/users/{id}/profile, `target="_blank"`, `rel="noreferrer"`, aria-label only) when `robloxUserId` is set, otherwise the original `figure`. Accent hover/focus-visible ring added; the dead `.personnel-profile-head a, .personnel-nickname` rule deleted.

## Task Commits

1. **Task 1: Drag handle only ≡ at row start (FIX-01)** - `801c031` (fix)
2. **Task 2: Корзина file fills the window (FIX-04)** - `8e0800d` (fix)
3. **Task 3: Roblox profile from the portrait (FIX-05)** - `4676cf4` (fix)

**Plan metadata:** committed separately (docs: complete plan).

## Decisions Made

See key-decisions. Commit trailer is `Claude Sonnet 5.5` per the run's attribution instruction, not the plan's `Opus 5.5` text.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Anchor portrait lost the figure's clipping and background**
- **Found during:** Task 3
- **Issue:** `.personnel-profile-head figure { overflow: hidden; background }` does not match an `a`, so the rounded portrait box would not clip its image or show the dark backing while loading.
- **Fix:** one extra rule `a.personnel-portrait { overflow: hidden; background: #07110f; }`.
- **Files modified:** app/portia.css
- **Committed in:** 4676cf4

**Total deviations:** 1 auto-fixed (Rule 1). **Impact:** one CSS line, no scope change.

## Issues Encountered

- `components/portia-editor.tsx` is CRLF in the working tree (index is LF, `core.autocrlf=true`); the edit script preserved CRLF so the diff is the intended 6/7 lines only.
- Browser checks used throwaway Edge-headless CDP scripts in the scratchpad (no automation package added). The editor part of FIX-01 could not be browser-checked without an owner session.

## Known Stubs

None.

## User Setup Required

None - no external service configuration required.

## Threat Flags

None. T-01-03 mitigated (`rel="noreferrer"` on the `_blank` anchor, enforced by the verify grep).

## Next Phase Readiness

Phase 1 plans are complete; remaining for UAT: owner-session check of handle containment and drag-reorder (desktop and 375px), recycled-virus viewer header, hover/focus/new-tab behaviour of the portrait and the no-id fallback.

---
*Phase: PORTIA-01-ispravlenie-bagov*
*Completed: 2026-10-12*

## Self-Check: PASSED

Commits 801c031, 8e0800d, 4676cf4 are ancestors of HEAD; components/portia-editor.tsx, components/portia-desktop.tsx and app/portia.css exist.
