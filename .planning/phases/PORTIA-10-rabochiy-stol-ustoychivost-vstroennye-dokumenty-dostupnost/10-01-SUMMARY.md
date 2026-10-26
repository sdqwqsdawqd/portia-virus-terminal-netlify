---
phase: PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost
plan: 01
subsystem: theme
tags: [accent, oklch, boot-script, localStorage, tests]
requires: []
provides:
  - "deriveAccentTokens / accentTokenNames (lib/accent-custom.ts)"
  - "desktopSettingsStorageKey constant and a custom-accent branch in accentBootScript"
  - "10-boot-check.mjs served-HTML check"
affects: [10-03]
tech-stack:
  added: []
  patterns: ["function source embedded in the head script with Function.prototype.toString, stored value passed only as an argument"]
key-files:
  created:
    - lib/accent-custom.ts
    - .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-boot-check.mjs
  modified:
    - lib/accent-boot.ts
    - lib/accent-theme.test.ts
decisions:
  - "Filter hue is found by a fixed-size coarse-to-fine search (CSS hue-rotate is not an OKLCH rotation), with a 0.02*|s-1| pull towards saturate(1) to break near-ties"
  - "TEST-01 and THEME-01 not marked complete: the desktop half of the key constant (10-03) and the picker UI are still to come"
metrics:
  duration: ~25 min
  completed: 2026-10-25
status: complete
actuals:
  tokens: 14000
  tasks: 2
  commits: 2
plan_head_before: 342b3f2b709881a63d1a07a83d686293bd7d41a4
plan_head_after: 56bd3da616a2c94c93e85630c299a2285f180421
commits: 2
---

# Phase 10 Plan 01: «Свой» accent derivation and boot path Summary

One picked #rrggbb now becomes all ten accent tokens (readable, gamut-fitted, spider and Vivian filters landing on the hue), and the head boot script applies a saved custom colour before hydration, ignoring anything that is not a strict hex string.

## Tasks

| Task | Commit | Result |
| ---- | ------ | ------ |
| 1 (tracer) saved «Свой» colour painted by the served head script | 589358b | accent-custom.ts, boot branch, settings key constant, 2 tests, served-HTML check |
| 2 readability, hue landing, hostile values, key drift tests | 56bd3da | 6 new tests; derivation passed first run, no tuning needed |

## Verification

- `node --experimental-strip-types --test lib/accent-theme.test.ts`: 21 tests, 0 fail (13 existing, 2 from Task 1, 6 from Task 2)
- `npm test`: 293 pass, 0 fail; `npx tsc --noEmit`: clean; `npx eslint app lib components`: 0 errors (14 pre-existing warnings)
- `npm run build` passed; `next start -p 3125`, `node 10-boot-check.mjs --url http://localhost:3125` printed `{"ok":true,"cases":{"custom":true,"hostile":true,"preset":true,"customProps":10}}`, exit 0; server stopped
- Limits kept as written: 10 deg spider/Vivian, 0.5 deg hue match, 4.5:1 contrast; swept 36 hues plus 9 grey/primary cases

## Deviations from Plan

None - plan executed exactly as written. (Used `Math.pow` instead of `**` inside the embedded function, an implementation detail; added the small saturate(1) tie-break pull in the filter search.)

## Notes

- Requirements THEME-01 and TEST-01 left unchecked in REQUIREMENTS.md: this plan covers the colour maths, boot path and boot half of the key test; the picker UI and the desktop half (no key literal in components/portia-desktop.tsx, 10-03) are still open.
- The served-HTML check runs the head script in Node, not a browser; the in-browser no-flash proof is the harness accent check in 10-03.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- FOUND: lib/accent-custom.ts, lib/accent-boot.ts, lib/accent-theme.test.ts, 10-boot-check.mjs
- FOUND commits: 589358b, 56bd3da
