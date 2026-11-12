---
phase: PORTIA-23-vhod-po-niku-povyshenie-i-ego-regressii
plan: 05
subsystem: promotion-editor
tags: [react, editor, bank-crud]
requires:
  - phase: PORTIA-20
    provides: ordinary and qualification bank editors
provides:
  - guarded reorder after a failed first write
  - full question text in destructive confirmation
affects: [PORTIA-23-07]
actuals:
  tokens: 180
  tasks: 2
  commits: 1
tech-stack:
  added: []
  patterns: [preserve local drafts on failed bank writes]
key-files:
  created: []
  modified: [components/portia-promotion-ordinary-editor.tsx, components/portia-promotion-qualification-editor.tsx, lib/portia-promotion-editor.test.ts]
key-decisions:
  - "Keep existing authorized bank CRUD routes and client draft retention; stop reordering when its first write fails."
requirements-completed: [PROM-04]
duration: 20min
completed: 2026-11-13
status: complete
---

# Phase 23 Plan 05 Summary

Existing ordinary and qualification bank CRUD flows remain in place. Reordering now stops after a failed first mutation, and question deletion asks for confirmation with the full question text.

## Verification

- PASS: `node --experimental-strip-types --test lib/portia-promotion-editor.test.ts lib/portia-promotion-editor-state.test.ts` (31 tests).
- PASS: TypeScript, scoped ESLint and Next.js build.
- BLOCKED: Authenticated reviewer roles, real Postgres writes and 320/390/900px browser overflow checks require isolated role fixtures and browser evidence.

## Commit

- `28b7842` — reorder guard and deletion copy.
