---
status: complete
phase: PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa
source: [12-VERIFICATION.md]
started: 2026-10-26T00:00:00Z
updated: 2026-10-26T20:00:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Live tab toggle end to end on project wqiyghssdulzsbshjtur
As owner open «Доступ», switch off one tab for the real editor, reload and reopen «Доступ»; in the editor's session confirm the tab disappears within ~10 s and a save touching that section is refused; switch it back on.
expected: Chip state persists after reload; the editor strip no longer shows the closed tab; the closed-section write is refused with 403 «section-closed»; re-enabling restores it.
result: pass
reported: owner switched a real editor's tab off and on at localhost:3123 against project wqiyghssdulzsbshjtur; state kept after reload, the editor lost and regained the tab — "verified"

### 2. (Optional) Chips with keyboard/screen reader and at phone width
Tab/Space on chips with a screen reader (pressed state announced); the list at phone width; grant a new test email and confirm all seven chips are on.
expected: Chips are reachable and announce state; chips wrap and ОТОЗВАТЬ stays visible; new editor has all seven tabs.
result: skipped
reason: Deferred follow-up: optional chip accessibility (keyboard/screen reader) and phone-width check, not run by the owner; verifier marked it optional

## Summary

total: 2
passed: 1
issues: 0
pending: 0
skipped: 1
blocked: 0

## Gaps

## Deferred Follow-Ups

- Chips in «Доступ»: keyboard/screen-reader announcement, phone-width wrapping, new editor shows all seven chips on (test 2, optional).
