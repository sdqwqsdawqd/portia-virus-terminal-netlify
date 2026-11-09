---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 27
subsystem: uat-ledger
tags: [uat, owner-acceptance, fail-closed-validator, gap-closure, physical-devices]
requires: []
provides:
  - 20-UAT.md - owner checklist PC then phone (39 PC steps, 41 phone steps, 14 prerequisites, two verdict lines, D-15 section), every step ОЖИДАЕТ
  - lib/phase20-uat.test.ts - requiredUatIds, parseUat, validateUat, gitCommitExists, 30 tests with fixtures built from the real ledger, strict mode PORTIA_REQUIRE_UAT=1
affects: [20-14, 20-15, 20-28]
actuals:
  tokens: 20400
  tasks: 3
  commits: 4
plan_head_before: 2f2dc912a93a5343717f504e016f6f0c3743fd3e
plan_head_after: 5b329db3cf31f0d4d3fd07234c99dd540b6ac6bf
tech-stack:
  added: []
  patterns: [ledger parsed by section heading and table cell count, fixtures made by editing a copy of the real file (mapRows/editRow/dropRow/completeLedger), commit existence via git cat-file -e with spawn failure raised as an error]
key-files:
  created:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-UAT.md
    - lib/phase20-uat.test.ts
  modified: []
key-decisions:
  - "Task 1 of the unexecuted 20-14 is done here: same ids and rules, plus QUAL-LOCK-01 and EDITOR-03 (the two behavior-unverified items), A11Y-CONTRAST-D10 (D-10) and the Promotion/window/media steps. 20-14 now only reconciles the ledger with the release commit and fills RELEASE-GATE; its Task 2 (owner on the physical devices) is untouched."
  - "Prerequisite statuses are set from SUMMARY evidence only: P19-GAP-20 and P19-GAP-22 are PASS (staging evidence with residual 0 in the SUMMARY); P19-GAP-15, 18, 19, 21 are BLOCKED (DATA); P19-GAP-16, 17 are BLOCKED (ENV). A prerequisite PASS does not accept STAB-PROM-15 or CR-01."
  - "A verdict PASS requires every step of that device PASS and a commit that exists; any BLOCKED or FAIL step forces FAIL. BLOCKED never turns into PASS."
  - "OWNER-MIG-D36 and OWNER-MIG-NOTES can never be PASS; ПРИМЕНЕНО ВЛАДЕЛЬЦЕМ needs the owner date and method; ОЖИДАЕТ ВЛАДЕЛЬЦА stays legal in strict mode (an honest pending production action)."
  - "Strict mode also requires RELEASE-GATE PASS, release_candidate_commit equal to the phone verdict commit, and step commits equal to their device verdict commit."
requirements-completed: []  # plan requirements: STAB-REL-05, STAB-REL-06, STAB-REL-07, STAB-A11Y-01..04, STAB-SEC-03, STAB-EDIT-03. Left open on purpose: this plan prepares the ledger; no owner verdict exists, so none of them is proven.
duration: ~35 min
completed: 2026-11-04
status: complete
coverage:
  - id: D1
    description: "20-UAT.md holds the full PC-then-phone checklist with prerequisites, per-device step tables, two verdict lines and the D-15 section; all steps ОЖИДАЕТ, no agent PASS in any step or verdict"
    requirement: STAB-REL-06
    verification:
      - kind: unit
        ref: "lib/phase20-uat.test.ts :: the committed ledger is structurally valid; every required id is present exactly once per place"
        status: pass
    human_judgment: true
    rationale: "The checklist is only prepared; the verdicts on the physical PC and phone are the owner's and are not recorded."
  - id: D2
    description: "Validator rejects PASS without device, existing commit or date; PASS on an unmet prerequisite; FAIL without note/screenshot; BLOCKED without reason; missing, duplicate and wrong-device ids; phone before PC; OWNER-MIG PASS"
    requirement: STAB-REL-07
    verification:
      - kind: unit
        ref: "lib/phase20-uat.test.ts :: 20-UAT required ids; 20-UAT honest statuses (T-20-41) - 30 pass, 0 fail"
        status: pass
    human_judgment: false
  - id: D3
    description: "Strict mode PORTIA_REQUIRE_UAT=1 refuses a ledger with pending rows, verdicts without a commit, differing commits without D-15 text, or a non-hex release_candidate_commit"
    requirement: STAB-REL-05
    verification:
      - kind: unit
        ref: "lib/phase20-uat.test.ts :: 20-UAT strict mode (8 fixtures); real file exits 1 under PORTIA_REQUIRE_UAT=1 as expected before the owner fills it"
        status: pass
    human_judgment: false
  - id: D4
    description: "QUAL-LOCK-01 (focus trap and focus return of the qualification window) and EDITOR-03 (key move across a column border, focus on the handle, one undo) are written as steps with expected results on both devices"
    requirement: STAB-A11Y-01
    verification:
      - kind: unit
        ref: "lib/phase20-uat.test.ts :: the two behavior-unverified items are written out as steps on both devices"
        status: pass
    human_judgment: true
    rationale: "The steps exist; whether the behavior holds in a real browser is exactly what the owner run decides."
---

# Phase 20 Plan 27: Owner physical-UAT ledger and its fail-closed validator Summary

**20-UAT.md gives the owner a complete PC-then-phone checklist (39 + 41 steps, 14 prerequisites, all ОЖИДАЕТ), and lib/phase20-uat.test.ts refuses any ledger that claims PASS without device, existing commit, date and satisfied prerequisites, or that closes with pending rows, unbacked verdicts or unexplained commit differences.**

## Performance

- **Duration:** about 35 minutes (not timed to the second)
- **Tasks:** 3 (one tracer, one doc task, one TDD task)
- **Files:** 2 created
- **Plan commit ledger:** 4 commits, `2f2dc91..5b329db`

## Accomplishments

- **Ledger (Tasks 1, 2).** `20-UAT.md`: rules (D-05, D-10, D-13..D-16, D-34), prerequisites table, PC table, phone table, verdict lines `Вердикт PC: ОЖИДАЕТ` and `Вердикт phone: ОЖИДАЕТ`, and the D-15 section. Steps carry requirement IDs and a «Зависит от» column (PROMO-03 depends on REVIEWER-ROLE; PROMO-01/02/04/05 on STAGING-FREE, P19-GAP-20 and P19-GAP-22; EDITOR-02/04 on STAGING-FREE; MEDIA-01 on P19-GAP-15; SPIDER, CLASS-04, WALL-01 and SVG-01 on VISUAL-APPROVED).
- **Step set.** INFO-PHONE-01..05 only on phone; INFO-PC-01, SEARCH-02, A11Y-KEY-01, A11Y-CONTRAST-D10 only on PC; A11Y-TOUCH-01 only on phone; the other 35 ids on both devices.
- **Behavior-unverified items.** QUAL-LOCK-01 and EDITOR-03 hold the two items from the verifier (focus trap and return; keyboard move across a column border with focus on the handle and one undo). The phone variants say that without a hardware keyboard the keyboard part is BLOCKED (DEVICE), not PASS.
- **Validator (Tasks 1, 3).** `parseUat`, `validateUat`, `requiredUatIds`, `gitCommitExists` (`git cat-file -e <hex>^{commit}`; a non-zero exit means absent, a spawn failure throws). Fixtures are edits of a copy of the real ledger, so they break together with the format.
- **Strict mode.** `PORTIA_REQUIRE_UAT=1` makes the real-file test require final statuses; on today's ledger it fails with exit 1, which is the expected fail-closed result for 20-14 Task 2.

## Task Commits

1. Task 1 (tracer): `ff85ab0` - skeleton ledger and minimal validator with PASS-needs-commit fixtures.
2. Task 2: `0877e80` - full checklist and prerequisites.
3. Task 3 RED: `411c9b1` - 19 failing fixtures against the minimal validator.
4. Task 3 GREEN: `5b329db` - full validator, strict mode, EDITOR-03 phone wording fix.

Tracer gate: the tracer `<verify>` was re-run before the expansion tasks and passed (5 tests).

## Acceptance Criteria

- `grep -cE "^Вердикт (PC|phone): .+"` on 20-UAT.md: 2 - PASS.
- `grep -cE "P19-GAP-(15..22)"`: 21 (needs 8) - PASS.
- QUAL-LOCK-01 / EDITOR-03 rows: 4 - PASS. INFO-PHONE-01..05 rows: 5; A11Y-CONTRAST-D10: 1 - PASS.
- Step rows with PASS status: 0 - PASS.
- PASS-without-commit fixture rejected; OWNER-MIG-NOTES PASS and "different commits without D-15" fixtures rejected; a loop removes every id of `requiredUatIds` (14 prerequisites, 35 shared on both devices, 4 PC-only, 6 phone-only) - PASS.
- `PORTIA_REQUIRE_UAT=1 node --experimental-strip-types --test lib/phase20-uat.test.ts` (also via `cmd /c "set ...&& ..."`): exit 1, 1 fail. Expected fail-closed result on the unfilled ledger; the owner fills it in 20-14 Task 2.

## Verification

- `node --experimental-strip-types --test lib/phase20-uat.test.ts`: 30 pass, 0 fail.
- `npm.cmd test`: 1384 tests, 1380 pass, 0 fail, 4 skipped (the 4 skips predate this plan).
- `npm.cmd exec tsc -- --noEmit`: exit 0. ESLint on `lib/phase20-uat.test.ts`: clean.
- `lib/security-matrix.test.ts` was not affected: no path of the matrix coverage section was changed.

## Deviations from Plan

None - plan executed as written.

Notes that are choices inside the plan, not deviations:
- Validator rules beyond the plan's list, all fail-closed and covered by fixtures: a PASS verdict needs every step of that device PASS; step commits must match their device verdict commit; `release_candidate_commit` must equal the phone verdict commit and RELEASE-GATE must be PASS (strict mode); `FAIL` needs the tested commit in strict mode; unknown prerequisite ids in «Зависит от» are errors.
- Frontmatter `status` is not checked in strict mode (the plan did not ask for it).

## Issues Encountered

- MEDIA-01 depends on P19-GAP-15, which is BLOCKED (DATA) because 19-15's SUMMARY shows no residual-0 evidence (its CR-01 skips were closed in 19-19). MEDIA-01 cannot be PASS until that row is updated with evidence; 20-14 Task 1 reconciliation should decide it. I did not make MEDIA-01 depend on P19-GAP-19, because the three "Сотрудники" BLOCKED (DATA) cells there are permanent under the owner's verdict B and would make it unpassable.
- P19-GAP-21 is BLOCKED (DATA): its SUMMARY records a non-zero residual before the owner's decision (zero residual is in 19-22), and 19-VERIFICATION does not confirm real reviewer-queue frames.

## Known Stubs

None. The `ОЖИДАЕТ` rows are the intended initial state of an owner-filled ledger, not stubs.

## Threat Flags

None. Documentation and a unit test only; no network, auth, file-access or schema surface was added (T-20-41 mitigated, T-20-SC: no packages installed).

## Authentication Gates

None.

## Owner-gated and BLOCKED items (not passes)

- Every step and both verdicts are ОЖИДАЕТ: physical PC and phone acceptance is the owner's (plan 20-14 Task 2).
- OWNER-MIG-D36 and OWNER-MIG-NOTES: ОЖИДАЕТ ВЛАДЕЛЬЦА. STAGING-FREE, REVIEWER-ROLE, VISUAL-APPROVED, RELEASE-GATE: ОЖИДАЕТ.
- P19-GAP-15, 18, 19, 21 BLOCKED (DATA); P19-GAP-16, 17 BLOCKED (ENV). P19-GAP-20 and 22 PASS means only "SUMMARY has staging evidence with residual 0", not acceptance of STAB-PROM-15 or CR-01.
- The two behavior-unverified items stay unverified until the owner runs QUAL-LOCK-01 and EDITOR-03; 20-28 prepares the automatic side.
- No requirement was marked complete by this plan.

## Next Phase Readiness

- 20-14 Task 1 reduces to reconciling the ledger with the release commit from 20-13 (fill `release_candidate_commit`, RELEASE-GATE) and re-checking P19-GAP statuses; Task 2 is the owner run, gated by the strict command above.
- 20-15 reconciliation must treat any ledger that fails `PORTIA_REQUIRE_UAT=1` as not accepted.

## Self-Check: PASSED

- Files exist: `20-UAT.md`, `lib/phase20-uat.test.ts`.
- Commits `ff85ab0`, `0877e80`, `411c9b1`, `5b329db` are ancestors of HEAD.
