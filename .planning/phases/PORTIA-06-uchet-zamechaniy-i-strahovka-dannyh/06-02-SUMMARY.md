---
phase: PORTIA-06-uchet-zamechaniy-i-strahovka-dannyh
plan: 02
subsystem: review-ledger
tags: [triage, accepted-risk, docs]
requires: []
provides:
  - 03.1 record open 22 of 23 (IN-10 deferred, IN-10-storage open)
  - PROJECT.md "## Known Limitations" with 01-WR-01, 03.1-IN-10, 05-WR-05
affects: [06-03, 06-04]
key-files:
  modified:
    - .planning/milestones/v1.0-phases/PORTIA-03.1-stabilizatsiya/03.1-REVIEW-DISPOSITION.md
    - .planning/PROJECT.md
    - .planning/milestones/v1.0-phases/PORTIA-01-ispravlenie-bagov/01-REVIEW-DISPOSITION.md
decisions:
  - "Storage-listing part of 03.1-IN-10 stays open as IN-10-storage: no source records the owner accepting it (owner decision needed)"
metrics:
  tasks: 2
  files: 3
status: complete
requirements: [TRIAGE-02]
actuals:
  tokens: 3000
  tasks: 2
  commits: 3
plan_head_before: 7858565019df1fbcde7adc6902e9128f47a63285
plan_head_after: a341312d58a5c972131f113b41e9944dd3007de1
---

# Phase 6 Plan 02: Record accepted risks Summary

03.1-IN-10 is `deferred` as an accepted risk for the three parts the owner accepted, and PROJECT.md now has a `## Known Limitations` section with three bullets (01-WR-01, 03.1-IN-10, 05-WR-05).

## Results

- 03.1 record: IN-10 `deferred`, Source starts `accepted risk:` and names profile column grants, the owner email, the anonymous approval check, and that Phase 12 removes none. New row and frontmatter entry `IN-10-storage` (`open`). Checker prints `open=22 total=23`; no `@` in the file; WR-11 row unchanged.
- PROJECT.md: section placed between `## Constraints` and `## Key Decisions`, exactly three bullets, each with what / why / review ID; the IN-10 bullet says what Phase 12 changes and leaves. Node check prints `OK known-limitations`; diff is 6 added lines, none removed.
- Orchestrator note: the 01-WR-01 Source cell in the 01 record now points at PROJECT.md Known Limitations; checker still prints `open=5 total=7`.

## Open owner decision

IN-10-storage (the storage select policy at supabase/portia_setup.sql:244 lets anyone list portia-media) is kept `open`. If the owner accepts it too, flip that row to `deferred` with an `accepted risk:` Source and drop the last sentence of the IN-10 bullet.

## Commits

- 73e5bbc: accept 03.1-IN-10, keep storage listing open
- 8972166: record accepted risks in PROJECT.md Known Limitations
- a341312: point 01-WR-01 Source at PROJECT.md Known Limitations (orchestrator note)

## Deviations from Plan

The extra a341312 commit was requested by the orchestrator (the 01-WR-01 cell could not cite a section that did not exist during 06-01). The first attempt to edit the 03.1 file with a node script and an early commit attempt were blocked by the permission classifier; the edits were redone with the Edit tool and the commits succeeded on retry. TRIAGE-01/TRIAGE-02 were not marked complete in REQUIREMENTS.md (06-03 and 06-04 still own parts).

## Known Stubs

None.

## Self-Check: PASSED

Both edited files exist; commits 73e5bbc, 8972166, a341312 are on HEAD; checker OK on the 03.1 and 01 records; Known Limitations check OK.
