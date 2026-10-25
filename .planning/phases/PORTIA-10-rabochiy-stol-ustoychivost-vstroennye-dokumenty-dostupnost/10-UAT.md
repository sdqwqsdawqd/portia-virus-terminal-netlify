---
status: testing
phase: PORTIA-10-rabochiy-stol-ustoychivost-vstroennye-dokumenty-dostupnost
source: [10-VERIFICATION.md]
started: 2026-10-26T00:00:00Z
updated: 2026-10-26T00:00:00Z
---

## Current Test

number: 1
name: YouTube video plays inside the shared sandbox
expected: |
  Open an Info page that has a YouTube video block on PC and on a phone and press play.
  The video plays (and goes fullscreen) inside the shared sandbox. If it does not, add only the one allow-* flag it needs.
awaiting: user response

## Tests

### 1. YouTube video plays inside the shared sandbox
expected: The video plays inside the shared sandbox (allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox) on PC and phone; if not, add only the one allow-* flag it needs
result: [pending]

### 2. Picker close button looks right
expected: Settings → Цвет интерфейса → Свой: the × in the picker header is a clean 24×24 button with a visible × on PC and phone (code review WR-01 suspects it is stretched to ~24×54 with a clipped glyph)
result: [pending]

## Summary

total: 2
passed: 0
issues: 0
pending: 2
skipped: 0
blocked: 0

## Gaps
