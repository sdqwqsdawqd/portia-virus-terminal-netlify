---
phase: 03-redaktor
plan: 06
subsystem: ui
tags: [css, container-queries, mobile, gap-closure]
status: complete

requires:
  - phase: 03-redaktor
    provides: "plan 03-03: phone format panel (FloatingTextFormatPanel) that takes the keyboard's place"
provides:
  - "Phone format panel capped at min(38svh, 300px) on the 44px taskbar, header and СБРОСИТЬ / ГОТОВО pinned, only the toolbar scrolls"
  - "Personnel nickname sized from its column (clamp(24px, 8cqi, 44px)); profile head stacks at a 680px container width"
affects: []

plan_head_before: 3b5af5e
plan_head_after: c76772d

actuals:
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Flex column with overflow hidden and flex:none header/footer, so only the middle section scrolls"
    - "First container queries in portia.css: inline-size containers on .personnel-profile and .personnel-profile-identity"

key-files:
  created: []
  modified:
    - app/portia.css

key-decisions:
  - "Stacking rules moved from the 900px viewport block into @container (max-width: 680px): a 681-900px tablet column now shows avatar and name side by side"
  - "overflow-wrap break-word kept only as a last resort for nicknames longer than about 20 characters"

requirements-completed: [EDIT-01, LOOK-02]
---

# Plan 03-06 Summary: phone format panel and nickname header

Applied inline by the orchestrator (the executor subagent spawn was blocked by the auto-mode classifier; the owner said "apply 03-06").

## Commits

- `bbd6002` fix(03-06): phone format panel fits above the taskbar with header and ГОТОВО pinned
- `c76772d` fix(03-06): size the personnel nickname from its column and stack the head by window width

## What changed (app/portia.css only)

- **Task 1 (uat-03-t3-format-panel):** in the 900px block the panel is `bottom: 44px`, `max-height: min(38svh, 300px)`, a flex column with `overflow: hidden`; header and footer are `flex: none`; `.rich-text-toolbar` has `flex: 1 1 auto; min-height: 0; overflow-y: auto; overscroll-behavior: contain`; the editor padding follows the new cap. At ≤430px the header is no longer sticky and header, toolbar and footer are tighter. No control hidden (still 3 `display: none` rules).
- **Task 2 (uat-03-t10-nickname):** `.personnel-profile` and `.personnel-profile-identity` are inline-size containers; the h2 uses `clamp(24px, 8cqi, 44px)`, no `12ch`, `overflow-wrap: break-word`; the three stacking rules moved into `@container (max-width: 680px)`; the phone h2 font rule is deleted.

## Verification

| Check | Result |
|---|---|
| Plan node checks | "phone format panel OK", "nickname OK" |
| `npm test` | 72/72 pass |
| `npm run build` | exit 0 (dev server on 3123 kept running) |
| `npm run lint` (exit code checked) | exit 0; 0 errors, 13 warnings (existing no-img-element baseline) |
| `npx tsc --noEmit` | clean |
| Live app, PORTIA://PERSONNEL «Kotik_play1232» | one line at 384px pane (24px font) and at 820 / 950 / 1100px windows (33.5 / 40.6 / 44px), head stacked |

## Pending human checks

- Format panel on a real phone (375×667, 390×844): panel just over a third of the screen, header and ГОТОВО always visible, only the controls scroll, page behind does not move, colour picker present, ГОТОВО brings back the save bar. Needs the owner login, so not checked here.
- Nickname maximized and on a 768px tablet (side by side there by design), on real phones 390 / 360px.
