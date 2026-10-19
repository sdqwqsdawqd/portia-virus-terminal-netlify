---
phase: PORTIA-06-uchet-zamechaniy-i-strahovka-dannyh
plan: 04
subsystem: data-safety
tags: [backup, state, triage]
requires: []
provides:
  - owner JSON export of portia_employee_profiles and portia_content outside git
  - STATE.md export record line
affects: [phase-7, phase-8, phase-9]
tech-stack:
  added: []
  patterns: [owner-run read-only export, count-only checker]
key-files:
  created: []
  modified: [.planning/STATE.md]
decisions:
  - "Export record line uses 'строка' for the single content row (still contains 'строк' for the acceptance grep)"
metrics:
  duration: n/a
  completed: 2026-10-19
status: complete
requirements: [TRIAGE-03]
actuals:
  tokens: 600
  tasks: 3
  commits: 2
plan_head_before: e1fea976fdd2700a3723a553c0bd1cc0528d56e8
plan_head_after: 4764ec474506cc568ed9d9e0e65ce56c06d58017
---

# Phase 6 Plan 4: Owner data export (TRIAGE-03) Summary

The owner exported both production tables as JSON to `C:\Users\User\backups\portia\`, outside git. 06-check-backup.cjs parsed both files and the row counts match the owner's `count(*)` exactly. STATE.md records the export in one line and the project-move item is closed.

## Tasks

| Task | Name | Commit |
|------|------|--------|
| 1 (tracer) | Close the STATE.md project-move item; `git rev-parse --show-toplevel` printed `C:/Users/User/code/portia-site` | 329636e |
| 2 (human-action) | Owner exported both tables; replied `exported 18 1` | owner action, no commit |
| 3 | Check both files and record them in STATE.md | 4764ec4 |

## Export record (names and counts only)

Date: 2026-10-19. Folder: `C:\Users\User\backups\portia\`.

| File | Rows (checker) | Rows (owner) |
|------|----------------|--------------|
| portia_employee_profiles_2026-10-19.json | 18 | 18 |
| portia_content_2026-10-19.json | 1 | 1 |

## Verification

- 06-check-backup.cjs: two OK lines, exit 0, counts equal the owner's numbers.
- STATE.md: one `portia_employee_profiles_20..json` line, one `portia_content_20..json` line, "до правок (Phase 6)" count 0.
- `git ls-files` for the backup file names prints nothing; `.gitignore` unchanged against 7d53afd.
- Task 3 commit touches only `.planning/STATE.md`.
- No file content was opened, printed or quoted; no production query was run.

## Deviations from Plan

None - plan executed exactly as written. (Wording only: "1 строка" instead of "1 строк" for grammar.)

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- 329636e and 4764ec4 are ancestors of HEAD.
- Both backup files exist in the folder outside the repo.
