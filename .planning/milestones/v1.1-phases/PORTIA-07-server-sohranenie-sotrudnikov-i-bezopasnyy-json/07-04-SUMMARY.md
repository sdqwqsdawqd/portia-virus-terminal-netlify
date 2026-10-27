---
phase: PORTIA-07-server-sohranenie-sotrudnikov-i-bezopasnyy-json
plan: 04
subsystem: verification
tags: [live-check, review-ledgers, partial-upsert, owner-check]
requires: ["07-01", "07-02", "07-03"]
provides:
  - "Integrated tree passes every gate (npm test 231/231, tsc, eslint 0 errors, build) and the dev server answers through the whole stack"
  - "Owner confirmed the save contract on the live database with a temporary manual employee (RESEARCH A1 closed)"
  - "03.1, 03.2 and 03.3 review ledgers record what phase 7 closed, with commits and re-runnable proofs"
affects: [Phase 8 client (EMP-02), Phase 10 (SEC-03)]
status: complete
commits: 1
plan_head_before: a3cf509b0e6d14592bbf777b852d1cba3d9b756f
plan_head_after: 98e08f6a108cb72e8a320d5350499adc2cc99dbd
actuals:
  tokens: 9000
  tasks: 3
  commits: 1
tech-stack:
  added: []
  patterns: []
key-files:
  created: []
  modified:
    - .planning/milestones/v1.0-phases/PORTIA-03.1-stabilizatsiya/03.1-REVIEW-DISPOSITION.md
    - .planning/milestones/v1.0-phases/PORTIA-03.2-sotrudniki-i-svodka/03.2-REVIEW-DISPOSITION.md
    - .planning/milestones/v1.0-phases/PORTIA-03.3-sotrudniki-vne-tablitsy-i-gaydy-v-informatsii/03.3-REVIEW-DISPOSITION.md
key-decisions:
  - "03.1 IN-03 is closed by the owner rule D-13 (the sheet has exactly 34 places), not by a code change"
  - "03.2 WR-04 and 03.3 IN-04 stay open with a progress note naming the remaining half (EMP-02 in Phase 8, SEC-03 in Phase 10)"
requirements-completed: [EMP-01, EMP-03, EMP-04, EMP-09, EMP-10, ROB-02]
---

# Phase 07 Plan 04: Live check and review ledgers Summary

The merged phase 7 tree passes every gate, the owner confirmed the partial-save contract on the live database with a temporary employee, and the review ledgers now show what phase 7 closed.

## Tasks

| Task | Name | Commit | Result |
| ---- | ---- | ------ | ------ |
| 1 (tracer) | Integrated tree passes every gate | none (verification only) | `npm test` 231/231; `npx tsc --noEmit` clean; `npx eslint app lib components` 0 errors, 14 warnings; `npm run build` OK. Smoke on localhost:3123: home 200, anonymous PATCH body `x` gives 403 JSON error, GET /api/employees gives JSON with "employees" |
| 2 (checkpoint:human-action) | Owner live check on a temporary employee | none | Owner answered "verified" |
| 3 | Record closed findings in the 03.1, 03.2, 03.3 ledgers | 98e08f6 | Checker prints `open=18 total=23` (03.1) and `open=8 total=10` (03.2) |

## Owner check (2026-10-20)

Temporary manual employee jppk070 (id roblox-9094194542), not in the sheet. No sheet id used, no PUT /api/content. The owner ran steps 4-10 through a console script on localhost:3123; the orchestrator then re-read the live state with an anonymous GET and it matched.

- Step 4: 200, first save with no profile row: biography "Проверка 1", photoUrl "", six visible ratings null. knowledgeRating 1 is the column default and was not written by the request (A1 and the first-save concern confirmed).
- Step 5: 200, photoUrl and ratings set, biography still "Проверка 1".
- Step 6: 200, biography changed, photoUrl and ratings unchanged.
- Step 7: 200, pawsRating null, activityRating 7, biography unchanged.
- Step 8: details {title, rank 1, callsign} then {rank 9} gives title and callsign kept, rank 9.
- Step 9: pawsRating true gives 400 «Некорректные данные.»; values unchanged afterwards.
- Step 10: PATCH `x`, empty and `[]` give 400 each; DELETE /api/employees with `x` gives 400; POST /api/editors with `x` gives 400.
- Step 11: editor save after reload worked; the card kept the Roblox spelling and avatar (the avatar was hidden only while photoUrl pointed at the test placeholder; after clearing it the Roblox avatar showed, as designed since a photo overrides the avatar).
- Step 12: deleted with «Удалить», gone from the list. The profile row stays in the database by design.

## Ledger changes (commit 98e08f6)

- 03.1: WR-02 (d3bfdd9, EMP-01), WR-03 (d3bfdd9 and 05342e8, EMP-03), IN-03 (1ea2040, EMP-10, owner rule D-13), IN-06 (2cd4851 and 423579e, ROB-02) set to `fixed`; `open: 18`, `recorded:` updated.
- 03.2: WR-04 stays `open` with a progress note: the server writes only sent fields since d3bfdd9; the editor still sends every rating until EMP-02 (Phase 8). `open` stays 8.
- 03.3: WR-03 (9c9e13b, EMP-04), IN-01 (ccd3c65 and 1df1c57, EMP-09), IN-02 (9c9e13b, EMP-01), IN-03 (2cd4851 and 423579e, ROB-02) set to `fixed`; IN-04 stays `open`: part (b) fixed in 2cd4851 (EMP-09), part (a) iframe sandbox remains for SEC-03 (Phase 10). Rows WR-01, WR-02, WR-04 unchanged.

## Deviations from Plan

None to the plan's tasks. Notes to record honestly:

- In step 1 the owner typed the nickname in the same letter case as Roblox shows ("jppk070"), so the D-10 case correction on add was NOT exercised live. It is covered only by the 07-02 unit tests (ccd3c65 and 1df1c57). The 03.3 IN-01 row says this.
- The owner steps ran as a console script rather than one at a time; the orchestrator independently re-read the live state afterwards.
- Pre-existing, out of scope: the two Phase 6 helper `.cjs` scripts fail `no-require-imports` in a full-repo lint; this plan linted app, lib and components only, as planned.

## Known Stubs

None.

## Threat Flags

None. T-07-11 held: only one temporary manual employee was written, no sheet id, no PUT /api/content; T-07-12: no cookie, token or key was pasted.

## Self-Check: PASSED

- Ledger files exist and the checker prints `OK ... open=18 total=23` and `OK ... open=8 total=10`.
- Commit 98e08f6 is an ancestor of HEAD and `git show --stat` lists only the three ledger files.
- Every hash cited in the ledger rows appears in `git log --format=%h --grep="(07-0"`.
