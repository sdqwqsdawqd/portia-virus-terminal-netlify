---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 31
subsystem: release-notes-and-requirements-ledger
tags: [release-notes, requirements-ledger, stab-sec-06, honesty, gap-closure]
requires: [20-25, 20-26, 20-27, 20-28, 20-29]
provides:
  - 20-RELEASE-NOTES.md draft (status draft, release_commit ОЖИДАЕТ 20-15, matrix_commit b88669fb7d92dbf22d66ac6d7bb9a1b011195956) with 12 sections
  - lib/phase20-release-notes.test.ts - parseNotes, notesProblems and one rejecting fixture per rule (16 tests)
  - lib/phase20-requirements-ledger.test.ts - phaseIds, ledgerProblems, evidenceProblems and rejecting fixtures (15 tests)
  - REQUIREMENTS.md - STAB-A11Y-01, STAB-A11Y-03, STAB-MEDIA-07 reopened (Pending); STAB-SEC-05 kept Complete on matrix b88669f; STAB-SEC-06 Pending with the draft note
affects: [20-13, 20-15]
actuals:
  tokens: 19000
  tasks: 3
  commits: 5
plan_head_before: e5b7f3b09cbd357620f01a75194a5573f8670773
plan_head_after: 02fa9d147ea7a285026db86c800bc40388f39d5d
tech-stack:
  added: []
  patterns: [notes checked against the matrix and the waiver registry by ID, no-promise wording regexes, Complete requires a named evidence file]
key-files:
  created:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-RELEASE-NOTES.md
    - lib/phase20-release-notes.test.ts
    - lib/phase20-requirements-ledger.test.ts
  modified:
    - .planning/REQUIREMENTS.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/deferred-items.md
key-decisions:
  - "20-15 Task 2 must finalize 20-RELEASE-NOTES.md (status final, 40-hex release_commit, UAT results), not write it from scratch; matrix_commit has to match the matrix «Проверяемый commit» or the test reports stale notes."
  - "STAB-SEC-05 stays Complete: lib/security-matrix.test.ts passes on the matrix refreshed in 20-26 (b88669f). STAB-A11Y-01, STAB-A11Y-03 and STAB-MEDIA-07 are Pending with their BLOCKED sub-items; they return to Complete only with «Вердикт PC: PASS» (A11Y) or MEDIA-01 PASS on PC and phone (MEDIA-07) in 20-UAT.md."
  - "Production application of 20261104000000 and 20261104000100 is written as ОЖИДАЕТ ВЛАДЕЛЬЦА; staging results for the notes migration are worded without the word PASS on any line that names a migration (a test enforces it)."
requirements-completed: []  # plan requirements: STAB-SEC-06, STAB-SEC-05, STAB-A11Y-01, STAB-A11Y-03, STAB-MEDIA-07, STAB-REL-07. None newly completed: this plan reopens three and leaves SEC-05 Complete, SEC-06 and REL-07 Pending.
duration: ~10 min
completed: 2026-11-04
status: complete
coverage:
  - id: D1
    description: "Release notes draft with the exact limit sentences, all 10 D-09 medium risks, all 15 low/info findings, 7 D-33 rows, 10 PW rows, both pending migrations, Phase 19 inherited gaps and the unproven list; matrix_commit equals the matrix verified commit"
    requirement: STAB-SEC-06
    verification:
      - kind: unit
        ref: "lib/phase20-release-notes.test.ts :: the real release notes draft is consistent with the real security matrix and waiver registry (16 pass, 0 fail)"
        status: pass
    human_judgment: true
    rationale: "The test proves the draft names every finding, waiver and migration and promises nothing; whether the wording is acceptable to the owner is a human judgment made in 20-15."
  - id: D2
    description: "Rejecting fixtures: missing section, missing registry ID, stale matrix_commit, bad status, final without 40-hex release_commit, promise wording, missing SEC20, D-33, PW, migration (PASS or not pending), CR-01 and STAB-PROM-15"
    requirement: STAB-SEC-06
    verification:
      - kind: unit
        ref: "lib/phase20-release-notes.test.ts :: notesProblems fixture tests (14 tests)"
        status: pass
    human_judgment: false
  - id: D3
    description: "REQUIREMENTS.md no longer shows Complete for A11Y-01, A11Y-03, MEDIA-07 without proof; checkbox and traceability agree for all 32 Phase 20 IDs"
    requirement: STAB-A11Y-01
    verification:
      - kind: unit
        ref: "lib/phase20-requirements-ledger.test.ts :: the real REQUIREMENTS.md tests (15 pass, 0 fail; RED commit 1726fe5 failed with the four A11Y-01/03 and MEDIA-07 problems)"
        status: pass
    human_judgment: false
  - id: D4
    description: "STAB-SEC-05 stays Complete on the matrix refreshed in 20-26"
    requirement: STAB-SEC-05
    verification:
      - kind: unit
        ref: "node --experimental-strip-types --test lib/security-matrix.test.ts -> tests 45, pass 45, fail 0"
        status: pass
    human_judgment: true
    rationale: "The matrix is a static, local review; live RPC and RLS behaviour under Postgres was not re-run (receipts of Phase 16 only)."
---

# Phase 20 Plan 31: Release notes draft and honest requirement statuses Summary

**STAB-SEC-06 now has a checkable 20-RELEASE-NOTES.md draft (every SEC20 finding, D-33 row, waiver and pending migration named, no protection promised), and STAB-A11Y-01, STAB-A11Y-03 and STAB-MEDIA-07 are no longer Complete; a ledger test keeps them that way until the UAT proof exists.**

## Performance

- **Duration:** ~10 min (2026-11-04T19:14Z to 19:24Z)
- **Tasks:** 3 of 3 (Task 1 tracer, Task 3 TDD)
- **Files:** 3 created, 2 modified (REQUIREMENTS.md, deferred-items.md)

## Accomplishments

- **Task 1 (tracer).** Precondition held: 20-26-SUMMARY.md exists and `lib/security-matrix.test.ts` exits 0 (45 pass). Created the draft with frontmatter `status: draft`, `release_commit: ОЖИДАЕТ 20-15`, `matrix_commit: b88669fb7d92dbf22d66ac6d7bb9a1b011195956` and the first three sections. «Начальный режим теста подделываем» (SEC20-16) and «Привязка устройства не является аппаратной аттестацией» (SEC20-17, section starts with exactly that sentence) say what is not protected; «Принятые риски (medium, D-09)» has one row per ID of the matrix release registry (10 IDs: SEC20-01, 03, 04, 08, 09, 12, 13, 16, 17, 18). `parseNotes` and `notesProblems` check the commit link (stale notes), the sections, the registry IDs, status/release_commit and promise wording (`/гарантир/i`, `/защищ[её]н[аоы]? от подмены/i`). The tracer verify passed end to end (9 tests) before expansion. Commit b897209.
- **Task 2.** Added the remaining nine sections: «Находки low и info» (all 15 low/info IDs of the 25 SEC20 findings, SEC20-23 with the direct-RPC caveat), «Перенесённые находки 19-REVIEW (D-33)» (WR-03, WR-05, IN-01..IN-05 with status and fixing commit), «Зависимости» (production audit 0, 16 moderate dev-only, no safe upgrade, snapshot commit 59f90d2 to be repeated by 20-13), «CSP и HTTPS (D-05, D-08, D-14)», «Миграции, ожидающие владельца», «Playwright: waivers и ожидаемые неисправности» (PW-01..PW-10 with class and verdict; PW-07 and PW-10 «принято (владелец, 2026-11-04)»), «Изменения вне планов» (97d7abb, 23c1c85/7e5e17a, 2f54ba9, 807ab9f, 1b2a4e5/db6deb1/74ce5c7), «Унаследованные пробелы Phase 19» (CR-01, STAB-PROM-15, BLOCKED (DATA)), «Не доказано». `notesProblems` now cross-checks all SEC20 IDs (low/info in their own section), D-33 rows (status and fixing commit), every registry row of 20-PLAYWRIGHT-WAIVERS.md (class; waiver rows say «принято» only when the registry has the owner verdict and date, otherwise must be called a blocker), the pending migrations (named, marked ОЖИДАЕТ ВЛАДЕЛЬЦА, no line naming one says PASS) and CR-01/STAB-PROM-15, one fixture each. 16 tests pass. Commit fb3e9f5.
- **Task 3 (TDD).** RED commit 1726fe5: `lib/phase20-requirements-ledger.test.ts` with `phaseIds`, `ledgerProblems`, `evidenceProblems` and fixtures; on the unedited REQUIREMENTS.md the real-file evidence test failed with exactly four problems (A11Y-01 and A11Y-03 without «Вердикт PC: PASS», MEDIA-07 without MEDIA-01 PASS on PC and phone) while the checkbox/traceability test and the 32-ID roadmap test already passed. GREEN commit ddc7053: STAB-A11Y-01, STAB-A11Y-03, STAB-MEDIA-07 checkbox cleared, traceability Pending, each with a «(Pending — gap closure 20-31: …)» list of BLOCKED sub-items; STAB-SEC-06 annotated «(черновик 20-RELEASE-NOTES.md — 20-31; финал — 20-15)»; «Last updated» replaced with the 2026-11-04 gap-closure 20-31 note. 15 tests pass.
- **STAB-SEC-05 outcome (acceptance criterion).** `node --experimental-strip-types --test lib/security-matrix.test.ts` printed `# tests 45 / # pass 45 / # fail 0` (exit 0, run before Task 1 and again at self-check). Therefore STAB-SEC-05 stays Complete, annotated «матрица обновлена в 20-26 на b88669f» plus the statement that RPC and RLS execution under Postgres was not repeated (static reading and Phase 16 receipts).
- **Orchestrator facts reflected.** `deferred-items.md`: the guard-boundary entry is marked resolved by the owner decision 807ab9f (a skipped boundary is not a PASS; tracking the hook itself was not decided) and the 20-29 release-gate fixture entry is marked closed in 74ce5c7 (commit 02fa9d1). In the notes: PW-07 and PW-10 accepted by the owner; notes migration applied to staging and its four scenarios ran 20 of 20 on five projects (2026-11-05, HEAD 74ce5c7), with production still ОЖИДАЕТ ВЛАДЕЛЬЦА for both 20261104000000 and 20261104000100; the five staging-authz participant-status skips are BLOCKED (DATA); the ten rebaseline-* rows and blockers B1-B5 stay open in «Не доказано».

## Task Commits

1. Task 1 (tracer): `b897209` feat(20-31): release notes draft with the two limit statements and the D-09 registry
2. Task 2: `fb3e9f5` docs(20-31): complete release notes draft
3. Task 3 RED: `1726fe5` test(20-31): requirements ledger needs proof for Complete
4. Task 3 GREEN: `ddc7053` docs(20-31): reopen STAB-A11Y-01, STAB-A11Y-03, STAB-MEDIA-07
5. `02fa9d1` docs(20-31): deferred-items entries marked resolved

## Acceptance Criteria

- Task 1: attestation sentence `grep -c` 2 (>= 1); `status: draft` 1; fixture without a registry ID rejected (`SEC20-17 ... is missing from «Принятые риски (medium, D-09)»`). The file was not on HEAD before. PASS.
- Task 2: every one of the 25 SEC20 IDs (10 medium, 15 low/info) is in the draft (checked by the test and by a shell loop, none missing); `ОЖИДАЕТ ВЛАДЕЛЬЦА` lines 3 (>= 2); `CR-01|STAB-PROM-15` lines 2 (>= 2). PASS.
- Task 3: Pending trace rows for the three IDs 3 (was 0); unchecked boxes 3 (was 0); `gap closure 20-31` lines 4 (>= 4; was 0); `git diff --stat e5b7f3b..HEAD -- .planning/milestone.lock .planning/forensics .planning/ui-reviews` empty with exit 0. PASS.

## Verification

- `node --experimental-strip-types --test lib/phase20-release-notes.test.ts lib/phase20-requirements-ledger.test.ts lib/security-matrix.test.ts`: 76 tests, 76 pass, 0 fail.
- `npm.cmd test`: 1483 tests, 1479 pass, 0 fail, 4 skipped (the skips existed before this plan).
- `npm.cmd exec tsc -- --noEmit`: exit 0, no output.
- ESLint on the two new test files: no output.

## Deviations from Plan

**1. [Rule 2 - Missing critical] Honesty caveat added to SEC20-23 line and a limit sentence to STAB-SEC-05**
- **Found during:** Task 2 and Task 3 (re-reading the matrix).
- **Issue:** a short «no bypass» wording would have dropped the matrix note that a reviewer with the promotion tab can call the confirm RPC directly (duplicate ids are filtered only by the route); the SEC-05 annotation alone would read as live-Postgres proof.
- **Fix:** both texts carry the caveat (RPC/RLS under Postgres was not repeated in the matrix).
- **Files modified:** 20-RELEASE-NOTES.md, REQUIREMENTS.md. **Commits:** fb3e9f5, ddc7053.

**2. [Scope, orchestrator-directed] deferred-items.md updated**
- Not in the plan's `files_modified`; the orchestrator asked for the guard-boundary entry to be marked resolved-by-decision. Also closed the 20-29 release-gate fixture entry (74ce5c7), verified by a green `npm.cmd test`. **Commit:** 02fa9d1.

**3. [Plan reading] Waiver rule is stricter than the plan text**
- The plan asks for each waiver-class row; the test mirrors every PW row (all classes) and checks the class and, for waivers, owner-verdict wording. Not a conflict, a superset.

**Total deviations:** 3 (1 Rule 2, 1 orchestrator scope addition, 1 stricter-than-plan test). **Impact:** none on the plan's goal.

## Known Stubs

None. The draft's `release_commit: ОЖИДАЕТ 20-15` is an intentional placeholder resolved by plan 20-15, not a stub.

## Threat Flags

None. Documents and tests only; no production, staging, secret or `.env` access; no migration pushed; no product code (`app/`, `components/`, `public/`, non-test `lib/`) changed, so 20-29's stale-candidates check is unaffected.

## Issues Encountered

- The matrix on its own commit (b88669f) still describes the notes migration as BLOCKED (OWNER) on staging, which is older than the owner-approved staging run (20-EDITOR-NOTES-EVIDENCE.md). The release notes state the current fact and name the discrepancy; the matrix was not edited (not in this plan's files, and any covered-path change would make the matrix test report stale matrix). A later matrix refresh should update that row and the «Не доказано» line.

## Next Phase Readiness

Ready for 20-13 and 20-15. 20-15 must: finalize `20-RELEASE-NOTES.md` on the release commit (status final, 40-hex `release_commit`, UAT results) rather than create it; make the matrix commit current if covered paths changed; create `20-RECONCILIATION.md` before STAB-REL-07 can be Complete; and only after the owner's UAT verdicts (PC PASS, MEDIA-01 PASS on both devices) can the ledger test allow STAB-A11Y-01, STAB-A11Y-03 and STAB-MEDIA-07 back to Complete. Still open and owner-dependent: production application of both 20261104 migrations, the ten rebaseline-* verdicts, blockers B1-B5, physical devices, screen reader, the D-10 contrast verdict.

## Self-Check: PASSED

- Files found: 20-RELEASE-NOTES.md, lib/phase20-release-notes.test.ts, lib/phase20-requirements-ledger.test.ts, .planning/REQUIREMENTS.md.
- Commits found as ancestors of HEAD: b897209, fb3e9f5, 1726fe5, ddc7053, 02fa9d1.
- Task acceptance criteria and plan verification re-run after the last code commit (76 targeted tests, `npm.cmd test` 0 fail, tsc exit 0).
