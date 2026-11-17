---
phase: PORTIA-06-uchet-zamechaniy-i-strahovka-dannyh
plan: 01
subsystem: review-ledger
tags: [triage, review-disposition, docs]
requires: []
provides:
  - 01 record open 5 of 7; 05 record open 4 of 13
affects: [06-02, 06-03, 06-04]
key-files:
  modified:
    - .planning/milestones/v1.0-phases/PORTIA-01-ispravlenie-bagov/01-REVIEW-DISPOSITION.md
    - .planning/milestones/v1.0-phases/PORTIA-05-oformlenie-teksta/05-REVIEW-DISPOSITION.md
decisions:
  - "05-IN-04 was not fixed at planning time, so it was fixed by its own commit (D-07) before being closed"
  - "01-WR-01 Source does not cite PROJECT.md Known Limitations: that section does not exist"
metrics:
  tasks: 3
  files: 2
status: complete
requirements: [TRIAGE-01, TRIAGE-02]
actuals:
  tokens: 4000
  tasks: 3
  commits: 3
plan_head_before: ff4ea79a17af00b6de43dcb558c24a63b9341325
plan_head_after: fa753ea61c490dcd8f89d95cde6eabce4e678f8e
---

# Phase 6 Plan 01: Close findings in the 01 and 05 review records Summary

Seven findings in the archived 01 and 05 disposition records now carry a status with a commit and a re-runnable command, or an accepted-risk reason; no source file was touched.

## Findings

| Finding | New status | Proof and result seen |
|---------|-----------|-----------------------|
| 01-CR-01 | fixed | `git show --stat a4df852` lists app/layout.tsx only; `grep -n darkreader-lock app/layout.tsx` gives line 22, `"darkreader-lock": "true"` |
| 01-WR-01 | deferred (accepted risk) | cross-origin frame limit; +/− buttons zoom instead; workaround in REQUIREMENTS.md Future Requirements |
| 05-IN-04 | fixed | fixed in 3be593b; the 05-WR-02 row now names the deferred half (17 px «M» jump, explicit runs on repeat click; PROJECT.md Out of Scope) |
| 05-IN-01 | skipped | `grep -c jsdom package.json` gives 0; boundary test is TEST-02 (Phase 11) |
| 05-IN-02 | skipped | `grep -n "ownUntil: Infinity" lib/rich-text-style.ts` gives 147 |
| 05-IN-05 | skipped | `grep -n "on PC and phone" .../05-07-SUMMARY.md` gives 57; browsers not recorded |
| 05-WR-05 | deferred (accepted risk) | whole finding incl. re-clamp and any-button drag; owner decision, not re-checked |

Checker: `06-check-disposition.cjs` prints `open=5 total=7` for 01 and `open=4 total=13` for 05.

## Commits

- ed87bab: close 01-CR-01, accept 01-WR-01
- 3be593b: name the deferred half of 05-WR-02 (fixes 05-IN-04, D-07), one line
- fa753ea: close 05-IN-01/02/04/05, accept 05-WR-05

## Deviations from Plan

**1. [Rule 1 - Bug] WR-01 Source cited a nonexistent PROJECT.md section**
- **Found during:** Task 1 post-check
- **Issue:** the plan asked to cite "PROJECT.md Known Limitations"; PROJECT.md has no such section
- **Fix:** Source now says PROJECT.md has no Known Limitations section; the commit was amended before any later task
- **Files modified:** 01-REVIEW-DISPOSITION.md
- **Commit:** ed87bab

Otherwise the plan ran as written. Tracer gate: checker re-run passed (open=5 total=7) before expanding.

## Known Stubs

None.

## Self-Check: PASSED

Both record files exist; commits ed87bab, 3be593b, fa753ea are on HEAD; checker OK on both records.
