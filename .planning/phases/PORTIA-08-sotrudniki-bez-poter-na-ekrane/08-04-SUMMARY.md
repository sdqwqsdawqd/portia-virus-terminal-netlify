---
phase: PORTIA-08-sotrudniki-bez-poter-na-ekrane
plan: 04
subsystem: verification
tags: [employees, browser-check, review-ledger, docs]
status: complete

requires:
  - phase: PORTIA-08-sotrudniki-bez-poter-na-ekrane
    provides: "08-01..08-03 code changes (EMP-02, EMP-05, EMP-06, EMP-07, EMP-08)"
provides:
  - "Gates and anonymous smoke of both employee read routes on the merged tree"
  - "Owner browser check on a temporary employee outside the sheet (steps 1-11, all matched)"
  - "Review ledgers 03.1, 03.2, 03.3 updated with what phase 8 closed"
affects: []

actuals:
  tokens: 6000
  tasks: 3
  commits: 1
plan_head_before: 51de57e44af6b5b219086d50e1a182fdccd20e38
plan_head_after: 331c6b2bc2378dcd9b235588d6f70e776592513c

tech-stack:
  added: []
  patterns:
    - "Ledger cell format: fixed in <hash>; <requirement>; <re-runnable proof>; owner check 08-04 (temporary employee)"

key-files:
  created: []
  modified:
    - .planning/milestones/v1.0-phases/PORTIA-03.1-stabilizatsiya/03.1-REVIEW-DISPOSITION.md
    - .planning/milestones/v1.0-phases/PORTIA-03.2-sotrudniki-i-svodka/03.2-REVIEW-DISPOSITION.md
    - .planning/milestones/v1.0-phases/PORTIA-03.3-sotrudniki-vne-tablitsy-i-gaydy-v-informatsii/03.3-REVIEW-DISPOSITION.md

key-decisions:
  - "Visitor-step rows (03.1-WR-01, 03.3-WR-02) record owner browser verification, because the owner ran the optional step 10 and did not skip it"
  - "03.2-WR-04 names both halves: d3bfdd9 (07-03 server) and 8bce191 (08-02 editor)"

requirements-completed: [EMP-02, EMP-05, EMP-06, EMP-07, EMP-08]

coverage:
  - id: D1
    description: "Merged tree passes every gate; anonymous editor-route GET is 403 with no-store; public GET carries manualRead and the public CDN header"
    requirement: EMP-02
    verification:
      - kind: other
        ref: "npm test 253 pass / 0 fail; tsc clean; eslint 0 errors; npm run build exit 0; curl smoke on localhost:3123"
        status: pass
    human_judgment: false
  - id: D2
    description: "Owner browser check on a temporary employee: editor list route, diff-only saves, typing kept during a save, remembered switch, saved-label timer, photo reload, empty list, incomplete list with retry, visitor degraded data, delete"
    requirement: EMP-05
    verification:
      - kind: manual
        ref: "08-04 Task 2 steps 1-11, owner answer: verified"
        status: pass
    human_judgment: true
    rationale: "No component test harness; D-03 allows saves only on a temporary employee outside the sheet"
  - id: D3
    description: "Ledgers record WR-01, WR-05, WR-06 (03.1), WR-02, WR-03, WR-04 (03.2), WR-02, WR-04 (03.3) as fixed, each with a commit and a re-runnable proof"
    requirement: EMP-06
    verification:
      - kind: other
        ref: "node .planning/phases/PORTIA-06-uchet-zamechaniy-i-strahovka-dannyh/06-check-disposition.cjs (03.1 open=15 total=23, 03.2 open=5 total=10)"
        status: pass
    human_judgment: false
---

# Phase 8 Plan 04: Phase 8 proven on the running site and recorded in the review ledgers Summary

**All gates green on the merged tree, both employee read routes answer correctly to an anonymous caller, the owner confirmed every browser step on a temporary employee, and eight review findings are recorded as fixed with commits and proofs.**

## Accomplishments

- Task 1 (tracer): `npm test` 253 pass / 0 fail, `npx tsc --noEmit` clean, `npx eslint app lib components` 0 errors (14 pre-existing img warnings), `npm run build` exit 0 with `/api/employees` and `/api/employees/editor` in the route list. Anonymous GET `/api/employees/editor` gave 403 `{"error":"Нет доступа к редактору."}` with `cache-control: no-store` and `netlify-cdn-cache-control: no-store`. Anonymous GET `/api/employees` gave 200 with keys `employees`, `syncedAt`, `degraded`, `profilesRead`, `manualRead` (22 employees) and `netlify-cdn-cache-control: public, durable, s-maxage=600, stale-while-revalidate=86400`. The dev server on port 3123 was already running; this plan did not start it.
- Task 2 (checkpoint): the owner answered "verified". Steps 1-11 all matched, including the optional step 10 (visitor degraded data); it was not skipped.
- Task 3: three ledgers updated, checker prints `open=15 total=23` (03.1) and `open=5 total=10` (03.2).

| Ledger row | Closed by | Proof |
|------------|-----------|-------|
| 03.1 WR-01 | a6849de, 36abe03 (EMP-06) | tests "mergeEmployeesAnswer: profiles not read keep the last good biography, photo and ratings" and "...manual employees not read stay from the last good list" |
| 03.1 WR-05 | 6738626 (EMP-07) | `grep -n "key={props.src}" components/portia-desktop.tsx` → 1399 |
| 03.1 WR-06 | b11f590 (EMP-05) | `grep -n "savedTimer.current = window.setTimeout" components/portia-editor.tsx` → 1511 |
| 03.2 WR-02 | 5c3ed46 (EMP-02) | test "acceptsEditorList: only a list with profilesRead true is accepted"; grep of `api/employees/editor` → 1426 |
| 03.2 WR-03 | 2b6e1d0 (EMP-05) | test "settleDraft: text typed during a save stays, untouched fields take the stored copy" |
| 03.2 WR-04 | d3bfdd9 (07-03) and 8bce191 (EMP-01, EMP-02) | tests "one-field save writes only that column" and "changedFields: only changed keys are sent, a missing rating is never sent as null" |
| 03.3 WR-02 | a6849de, 36abe03 (EMP-06) | test "mergeEmployeesAnswer: manual employees not read stay from the last good list" |
| 03.3 WR-04 | 084e30a (EMP-08) | `grep -n "Сотрудников пока нет" components/portia-editor.tsx` → 1670 |

Every row also carries "owner check 08-04 (temporary employee)". Unit-test commands use `node --experimental-strip-types --test lib/portia-employees.test.ts`.

## Task Commits

1. Task 1 (tracer): no commit (gates and read-only smoke, no file changes by design)
2. Task 2 (checkpoint): no commit (owner browser check)
3. Task 3: `331c6b2` - docs(08-04): record findings closed by phase 8 in review ledgers

## Deviations from Plan

None - plan executed as written. The 03.3 ledger uses its older 4-column format and was edited in that format; the Phase 6 checker does not apply to it.

## Verification

- Checker: `OK ... 03.1-REVIEW-DISPOSITION.md open=15 total=23`, `OK ... 03.2-REVIEW-DISPOSITION.md open=5 total=10`
- Each of the eight `| WR-NN | warning | fixed | fixed in ` rows is present once in its ledger; the WR-04 row of 03.2 contains both `d3bfdd9` and `EMP-02`
- Every hash cited in the new rows except d3bfdd9 appears in `git log --format=%h --grep="(08-0"`
- `git show --stat HEAD` for 331c6b2 lists only the three ledger files

## Known Stubs

None.

## Threat Flags

None. T-08-12 (saves only on a temporary employee, no sheet employee saved, no PUT /api/content), T-08-13 (cited hashes checked against the phase git log) and T-08-14 (no secrets in the conversation) are mitigated as planned.

## Issues Encountered

None. The temporary employee's profile row stays in the database after deletion by design.

## Next Phase Readiness

Phase 8 plans are complete. EMP-02, EMP-05, EMP-06, EMP-07 and EMP-08 are done in code, unit tests and the owner's browser check, and recorded in the review ledgers.

## Self-Check: PASSED

- Commit 331c6b2 is an ancestor of HEAD
- The three ledger files exist and carry the new rows
