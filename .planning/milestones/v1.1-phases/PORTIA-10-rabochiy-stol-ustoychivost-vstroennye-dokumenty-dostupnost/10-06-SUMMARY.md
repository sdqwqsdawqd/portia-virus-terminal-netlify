---
phase: PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost
plan: 06
subsystem: desktop
tags: [a11y, escape, listbox, tooltip, headless-edge]
requires: ["10-05"]
provides:
  - "quest notice closes on Escape through a document-level listener that lives only while the notice is mounted"
  - "notice aside is a plain landmark; a hidden role=status line announces «Новый квест: {название}»"
  - "virus list is a listbox of role=option rows only while it holds rows"
  - "Roblox portrait link has a native title equal to its aria-label"
  - "10-desktop-check.mjs check toast"
affects: [10-07]
key-files:
  modified:
    - components/portia-desktop.tsx
    - lib/portia-desktop.test.ts
    - .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-desktop-check.mjs
    - .planning/REQUIREMENTS.md
    - .planning/ROADMAP.md
decisions:
  - "D-18 recorded in REQUIREMENTS A11Y-02 and ROADMAP Phase 10 criterion 4: the ≡ handle gets no tooltip"
metrics:
  duration: ~30 min
  completed: 2026-10-26
status: complete
actuals:
  tokens: 6500
  tasks: 2
  commits: 2
plan_head_before: e5342804e99290908a46caa856ea2e9c5ecf6e45
plan_head_after: 56ad1d1103406af2d391d4cf301e83ed058f82a8
commits: 2
---

# Phase 10 Plan 06: Escape for the quest notice, real listbox options, Roblox tooltip Summary

The quest notice now closes with Escape without any focus and announces itself once through a hidden status line; the virus list is a proper listbox with option rows; the Roblox portrait has its tooltip; the docs record that the ≡ handle stays without one (D-18).

## Tasks

| Task | Commit | Result |
| ---- | ------ | ------ |
| 1 (tracer) Escape and notice roles | 1a97849 | `QuestToast` document keydown effect (skips defaultPrevented, input/textarea/select, contenteditable, open `dialog[open]`); aside lost `role` and `onKeyDown`; sr-only `role="status"` line; source test; harness check `toast` (a)-(c) |
| 2 options, tooltip, D-18 wording | 56ad1d1 | `virusListbox`, `role="option"` + `aria-selected`, portrait `title`; three source tests; harness steps (d)-(e); REQUIREMENTS A11Y-02 and ROADMAP criterion 4 reworded |

## Verification

- Red first: source tests for task 2 failed before the code (3 failing); the toast check failed against the previous build (task 1: role present, no status line, Escape ignored; task 2: no option rows).
- `node --experimental-strip-types --test lib/portia-desktop.test.ts`: 8 pass, 0 fail. `npm test`: 302 pass, 0 fail. `npx tsc --noEmit` clean. `npx eslint app lib components`: 0 errors (14 pre-existing warnings). `npm run build` ok.
- Against `next start -p 3124`: toast, zoom, embeds, accent, assistant all `ok: true`. Server stopped (no listener on 3124).

## Deviations from Plan

None - plan executed as written. (Task 2 edits were made together with Task 1 and temporarily set aside so each commit holds only its own task.)

## Known Stubs

None.

## Threat Flags

None. T-10-10 mitigated: the listener is registered on mount and removed on unmount, skips handled keys, text fields, contenteditable and open modal dialogs; harness step (c) proves Escape in the search field leaves the notice. The harness blocks any non-GET to /api/content; nothing was saved.

## Notes for 10-07

Whether each screen reader announces the hidden status line, and the look of the native portrait tooltip (none on phones), are owner checks.

## Self-Check: PASSED

Commits 1a97849 and 56ad1d1 are in HEAD; edited files exist; tests, harness checks, tsc, eslint and build ran green.
