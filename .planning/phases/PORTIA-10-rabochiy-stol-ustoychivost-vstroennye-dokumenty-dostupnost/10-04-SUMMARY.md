---
phase: PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost
plan: 04
subsystem: desktop
tags: [accent, settings, keyboard, responsive-css, headless-edge]
requires: ["10-03"]
provides:
  - "«Свой» behaves like a preset: switching away keeps the saved colour, clicking it again restores it, second click closes the picker"
  - "Escape inside the accent picker closes only the picker, returns focus to «Свой», is preventDefault-marked for the quest-notice listener (10-06)"
  - "factory reset clears the custom colour, draft and open picker"
  - "colour row fits 5 columns on PC, 520 px window, and 2 columns with «Свой» spanning on a phone"
  - "10-desktop-check.mjs accent steps (f)-(l)"
affects: [10-06, 10-07]
key-files:
  modified:
    - components/portia-desktop.tsx
    - app/portia.css
    - .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-desktop-check.mjs
decisions:
  - "Colour row buttons stack the swatch over a 13px label: padding/gap alone could not fit «Холодный» (16px Plex Mono label is 77 px wide, button 75 px at the 520 px window)"
metrics:
  duration: ~30 min
  completed: 2026-10-26
status: complete
actuals:
  tokens: 6000
  tasks: 2
  commits: 2
plan_head_before: dcda5f1364b38a783da40663840b6549c5eebc2d
plan_head_after: a53fd55b636a850a0b06f353594c34bd657952c8
commits: 2
---

# Phase 10 Plan 04: «Свой» behaves like a preset Summary

Preset selection closes the picker and keeps the saved colour; Escape and focus work from the keyboard; the factory reset clears the colour; the colour row fits PC, 520 px and phone widths.

## Tasks

| Task | Commit | Result |
| ---- | ------ | ------ |
| 1 (tracer) round trip, toggle, Escape, factory reset | fe9e7e8 | `customAccentButton` ref, preset onSelect closes picker first, `.accent-picker` onKeyDown Escape, reset clears draft + closes picker; harness (f)-(i) |
| 2 layout at PC / 520 px / phone | a53fd55 | phone `grid-column: 1 / -1` for «Свой»; `.color-options > button` column layout; harness (j)-(l) |

## Verification

- Accent check against `next start -p 3124`: `ok: true` (3 consecutive runs after the final CSS, plus the tracer run); assistant check `ok: true`.
- `npm test`: 295 pass, 0 fail. `npx tsc --noEmit` clean. `npx eslint app lib components`: 0 errors (14 pre-existing warnings). `npm run build` ok. Server stopped (port 3124 closed).

## Deviations from Plan

**1. [Rule 1 - Bug] Padding/gap fallback did not fit the 520 px window**
- **Found during:** Task 2, step (k)
- **Issue:** the planned `.color-options button { gap: 6px; padding-inline: 6px; }` would also lose the cascade (the shared `.setting-options button` rule sits after the `.color-options` rule), and even placed correctly it left «Холодный» overflowing: the label is 16px IBM Plex Mono, 8 chars = 77 px, in a 75 px button (row is 407 px wide at 520 px).
- **Fix:** `.color-options > button { flex-direction: column; gap: 4px; padding-inline: 4px; font-size: 13px; }` placed after the shared button rule. Swatch now sits above the label on every width (PC included); scoped with `>` so the picker's own buttons keep their style.
- **Files modified:** app/portia.css
- **Commit:** a53fd55

**2. Harness reseed between (e) and (f)** — step (e) leaves a tampered key and accent not custom, so (f)-(i) reload from a valid saved colour first (the plan assumed «Свой» active). No product impact.

## Known Stubs

None.

## Threat Flags

None. T-10-07 mitigated: the custom colour lives in the device's settings object and the factory reset clears it; nothing is sent to a server (harness blocks any non-GET to /api/content).

## Self-Check: PASSED
