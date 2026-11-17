---
phase: PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost
plan: 03
subsystem: desktop
tags: [accent, settings, color-picker, localStorage, headless-edge, tests]
requires: ["10-01", "10-02"]
provides:
  - "components/custom-color-picker.tsx: shared CustomColorPicker (group color | background | accent)"
  - "«Свой» option in Settings -> «Цвет интерфейса» with live preview, save on release, validated restore"
  - "desktop reads/writes settings through desktopSettingsStorageKey (test-guarded)"
  - "10-desktop-check.mjs check accent"
affects: [10-04]
tech-stack:
  added: []
  patterns: ["draft state (live, not persisted) separate from committed settings; commit on window pointerup/pointercancel, picker blur and close", "apply effect and persist effect split"]
key-files:
  created:
    - components/custom-color-picker.tsx
  modified:
    - components/portia-editor.tsx
    - components/portia-desktop.tsx
    - app/portia.css
    - lib/accent-theme.test.ts
    - .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-desktop-check.mjs
decisions:
  - "Picker moved verbatim; only change is the group union widened with accent (D-07)"
  - "Restore accepts customAccent only through deriveAccentTokens and drops accent custom when no valid colour came with it (D-11)"
  - "Harness seeds localStorage only after the page has written its own defaults, otherwise the seed is overwritten (race found by repeated runs)"
metrics:
  duration: ~35 min
  completed: 2026-10-26
status: complete
actuals:
  tokens: 16000
  tasks: 2
  commits: 3
plan_head_before: febd86d
plan_head_after: 6212648131b277b5493c4336e3ef1f84b2fd5ca6
commits: 3
---

# Phase 10 Plan 03: «Свой» accent with the editor's colour picker Summary

Settings -> «Цвет интерфейса» has a 5th button «Свой» that opens the editor's own colour picker; dragging recolours the whole desktop live, the colour is saved on release and is on html before the body is parsed after a reload; the desktop no longer holds a settings key literal.

## Tasks

| Task | Commit | Result |
| ---- | ------ | ------ |
| 1 (tracer) «Свой» -> shared picker -> live recolour -> saved on release -> reload | c795ef3 | custom-color-picker.tsx, desktop wiring, 3 CSS rules, harness check `accent` (a-d) |
| 2 settings key constant test, tampered colour | 5091af0 | test "the desktop reads and writes settings through the one key constant", harness step (e) |
| 2b harness race fix | 6212648 | seed localStorage after the page's own write |

## Verification

- Accent check against `next start -p 3124`: 12 consecutive runs `ok: true` after the race fix; assistant check `ok: true`.
- `node --experimental-strip-types --test lib/accent-theme.test.ts`: 22 pass, 0 fail. `npm test`: 295 pass, 0 fail.
- `npx tsc --noEmit` clean; `npx eslint app lib components`: 0 errors (14 pre-existing warnings); `npm run build` ok.
- Server stopped (port 3124 closed).

## Deviations from Plan

**1. [Rule 1 - Bug] Flaky harness seeding**
- **Found during:** Task 2 re-runs (one failure in four, then (e) failed 2 of 8)
- **Issue:** the page writes its own settings after restore and overwrote the seeded localStorage value before the reload.
- **Fix:** wait for the key to exist plus 300 ms before seeding (a), 600 ms before the tampered seed (e).
- **Files modified:** 10-desktop-check.mjs
- **Commit:** 6212648

Check (c) compares inline `--teal` before/after the drag rather than `--accent-hue` alone (hue can stay put when only saturation/value move).

## Known Stubs

None.

## Threat Flags

None. T-10-05 and T-10-06 mitigated as planned (strict check through deriveAccentTokens on restore, only derived values reach style.setProperty; harness step (e) feeds markup).

## Self-Check: PASSED

- FOUND: components/custom-color-picker.tsx, 10-03-SUMMARY.md
- FOUND commits: c795ef3, 5091af0, 6212648
