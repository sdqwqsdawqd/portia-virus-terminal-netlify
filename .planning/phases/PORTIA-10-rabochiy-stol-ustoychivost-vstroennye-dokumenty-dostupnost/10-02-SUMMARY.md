---
phase: PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost
plan: 02
subsystem: desktop
tags: [robustness, assistant, react-state, headless-edge, tests]
requires: []
provides:
  - "assistantSpeaking: derived bubble visibility (components/portia-desktop.tsx)"
  - "10-desktop-check.mjs headless Edge harness with stubbed GET /api/content, check assistant"
  - "lib/portia-desktop.test.ts: state updaters stay pure"
affects: [10-03, 10-04, 10-05, 10-06, 10-07]
tech-stack:
  added: []
  patterns: ["derived visibility instead of an effect that clears stored state", "z counter in a ref, setters called outside updaters"]
key-files:
  created:
    - lib/portia-desktop.test.ts
    - .planning/phases/PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost/10-desktop-check.mjs
  modified:
    - components/portia-desktop.tsx
decisions:
  - "Bubble visibility is derived (assistantSpeaking = assistantTipVisible && usable text), so a tip removed by the 10 s poll closes the bubble on the next render without an effect"
  - "Updater purity test requires at least one parameter in the header regex, so setTimeout(() => {...}) is not mistaken for a state updater"
metrics:
  duration: ~20 min
  completed: 2026-10-25
status: complete
actuals:
  tokens: 9000
  tasks: 2
  commits: 2
plan_head_before: 12e47369babf3299ebfdd13a33aea6446997b73f
plan_head_after: ff4328af16be4dcc08c22aaf3cbc7d216255c373
commits: 2
---

# Phase 10 Plan 02: Empty tips and pure state updaters Summary

An empty, whitespace-only, malformed or vanished advice tip now closes the assistant bubble instead of unmounting the desktop, and focusApp no longer calls setWindows from inside a state updater.

## What changed

- `activateAssistant` returns early with no bubble and no timer when no usable tip exists; the old placeholder text «Добавьте советы в редакторе PORTIA.» is gone.
- `shuffledUniqueIndices` skips non-string entries; `FormattedText` takes `text?: string`.
- `focusApp` takes z from `topZ` (a ref) and calls `setWindows` outside any updater.
- `10-desktop-check.mjs`: dependency-free harness (Edge port 9334, temp profile deleted in finally). GET `/api/content` is served from fixtures; any non-GET is failed with `Fetch.failRequest` and fails the check.

## Verification

- Assistant check against the old build: RED (page exception `Cannot read properties of undefined (reading 'length')`, desktop unmounted). After the fix: `ok: true`, no reasons. Re-run after the ROB-03 rebuild: `ok: true`.
- `node --experimental-strip-types --test lib/portia-desktop.test.ts`: red on `setTopZ` (line 728) before the change, pass 1 / fail 0 after.
- `npm test`: pass 294 / fail 0. `npx tsc --noEmit`: clean. `npx eslint app lib components`: 0 errors, 14 warnings (pre-existing). `npm run build`: ok.

## Deviations from Plan

None - plan executed as written. (The first draft of the updater regex matched `setTimeout(() => {`; fixed in the same task before going green.)

## Known Stubs

None.

## Self-Check: PASSED

- FOUND: lib/portia-desktop.test.ts, 10-desktop-check.mjs, 10-02-SUMMARY.md
- FOUND commits: 4ea6a4b, ff4328a
