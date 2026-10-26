---
status: testing
phase: PORTIA-12-prava-redaktorov-i-bezopasnost-dostupa
source: [12-VERIFICATION.md]
started: 2026-10-26T00:00:00Z
updated: 2026-10-26T00:00:00Z
---

## Current Test

number: 1
name: Live tab toggle end to end on project wqiyghssdulzsbshjtur
expected: |
  Chip state persists after reload; the editor strip no longer shows the closed tab;
  the closed-section write is refused with 403 «section-closed»; re-enabling restores it.
awaiting: user response

## Tests

### 1. Live tab toggle end to end on project wqiyghssdulzsbshjtur
As owner open «Доступ», switch off one tab for the real editor, reload and reopen «Доступ»; in the editor's session confirm the tab disappears within ~10 s and a save touching that section is refused; switch it back on.
expected: Chip state persists after reload; the editor strip no longer shows the closed tab; the closed-section write is refused with 403 «section-closed»; re-enabling restores it.
result: [pending]

### 2. (Optional) Chips with keyboard/screen reader and at phone width
Tab/Space on chips with a screen reader (pressed state announced); the list at phone width; grant a new test email and confirm all seven chips are on.
expected: Chips are reachable and announce state; chips wrap and ОТОЗВАТЬ stays visible; new editor has all seven tabs.
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
