---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 29
subsystem: visual-evidence-refresh
tags: [visual-approval, candidates, evidence-freshness, playwright, gap-closure, rebaseline]
requires:
  - phase: PORTIA-20
    provides: 20-25 retries=0 readiness, 20-26 security matrix, 20-28 accessibility rerun, 20-11 ledger and its validator
provides:
  - 20-EVIDENCE-REFRESH.md drift register (out-of-plan commits 97d7abb, 2f54ba9, 23c1c85, 7e5e17a plus docs 397597c, f6c5844 and in-plan drift), candidates was-to-now table, old baselines on HEAD, 20-25/26/28 rerun summary, blockers B1..B5
  - all 73 CANDIDATE rows of 20-VISUAL-APPROVAL.md recaptured on HEAD 0929a084c13d (set phase20-refresh-0929a084c13d; 52 hashes changed, 21 unchanged), candidates_commit and candidates_set in the frontmatter
  - section 10 of the ledger with 10 rebaseline-* CANDIDATE rows awaiting the owner
  - lib/phase20-visual-approval.test.ts - candidates_commit check (40 hex, exists, ancestor of HEAD, non-zero git exit is an error) and staleCandidateProblems / changedSinceCommit with the strict-mode gate
affects: [20-11, 20-12, 20-13, 20-31]
actuals:
  tokens: 60800
  tasks: 3
  commits: 7
plan_head_before: 0929a084c13dc8cd420152c949c3332e82ed7e67
plan_head_after: bd50a75b5765cb7a7a2a54d69b048c5d1da6a447
tech-stack:
  added: []
  patterns: [candidate set named after the capture commit, injectable git runner and changedSince for fail-closed freshness checks, gate comparator reused offline to estimate snapshots the gate never reached]
key-files:
  created:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-EVIDENCE-REFRESH.md
  modified:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-VISUAL-APPROVAL.md
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/deferred-items.md
    - lib/phase20-visual-approval.test.ts
key-decisions:
  - "One capture run covers every set: the npm script test:e2e:candidates already carries the directory path, so the extra spec argument did not narrow it and the whole candidate directory ran on chromium-desktop and chromium-phone (179 passed, 37 skipped, 0 failed), then webkit-phone (20 passed, 88 skipped). All 73 rows therefore point at one set S = phase20-refresh-0929a084c13d."
  - "Class (a) for old-baseline failures was widened from 'Phase 20 redesign' to 'documented product change after the Phase 15 approval' (Phase 18/19 icon rest frames, virus icon, Phase 20 spider and empty-state drawings). Attribution is by diff region and commit history, not A/B."
  - "Failures whose diff is data or content (Информация, Корзина, База вирусов, Рекомендации) or whose cause is not isolated (phone-webkit 54239 px, scrollbar shift) are class (b): blockers B1..B5, no rebaseline row."
  - "Snapshots the gate never reached (desktop.spec stops at the first mismatch) were estimated with the gate's own comparator and tolerance on the candidate frame of the same scenario and are labelled as estimates; gate and estimate agreed within 1-5 px wherever both exist."
  - "Port 3000 was held by a foreign next process, so the production build was served on 3100 via PORTIA_E2E_BASE_URL; the server was stopped afterwards."
requirements-completed: []  # plan requirements: STAB-VIS-01, STAB-VIS-02, STAB-VIS-03, STAB-VIS-04, STAB-REL-03, STAB-REL-08. Left open on purpose: every verdict is the owner's (20-11 Task 2, 20-12), the old visual gate stays red (blockers B1-B5) and 20-13 reruns stale evidence.
coverage:
  - id: D1
    description: "Drift register lists 97d7abb, 2f54ba9, 23c1c85, 7e5e17a (and 397597c, f6c5844) with files, surfaces, action and result, plus in-plan product drift (20-22, 20-23, 20-28)"
    requirement: STAB-REL-03
    verification:
      - kind: other
        ref: "grep -cE '^\\| (97d7abb|2f54ba9|23c1c85|7e5e17a) \\|' 20-EVIDENCE-REFRESH.md -> 4"
        status: pass
    human_judgment: false
  - id: D2
    description: "All candidate rows recaptured on HEAD with new path and SHA256, previous hash kept in the note, candidates_commit in the frontmatter, BLOCKED rows still BLOCKED"
    requirement: STAB-VIS-04
    verification:
      - kind: unit
        ref: "node --experimental-strip-types --test lib/phase20-visual-approval.test.ts -> 19 pass, 0 fail, 1 skipped (strict gate)"
        status: pass
      - kind: other
        ref: "grep -E '| CANDIDATE | ' ledger | grep -vcE '| CANDIDATE | .tests/e2e/visual-candidates/.runs/phase20-refresh-' -> 0 (of 83 CANDIDATE rows)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Stale candidates cannot be approved: PORTIA_REQUIRE_APPROVAL=1 rejects product changes after candidates_commit"
    requirement: STAB-VIS-01
    verification:
      - kind: unit
        ref: "lib/phase20-visual-approval.test.ts :: stale candidates (20-29, T-20-43) - 7 tests, RED commit cd5a24c then GREEN f1893ff"
        status: pass
    human_judgment: false
  - id: D4
    description: "Old approved baselines rerun on HEAD with --retries=0; every failure classified (a) rebaseline row or (b) blocker; no approved baseline file touched"
    requirement: STAB-VIS-03
    verification:
      - kind: other
        ref: "git diff --exit-code --stat HEAD -- tests/e2e/visual/__screenshots__ -> exit 0; git log 0929a08..HEAD on that directory prints nothing"
        status: pass
    human_judgment: false
  - id: D5
    description: "Owner verdicts on the refreshed candidates and the rebaseline-* rows, and whether the (a) classification matches the owner's intent"
    requirement: STAB-VIS-02
    verification: []
    human_judgment: true
    rationale: "Aesthetic verdicts belong to the owner (20-11 Task 2); rebaseline rows are CANDIDATE with verdict ОЖИДАЕТ and nothing is approved."
duration: ~2 h wall clock (approximate; start time was not captured), including one production build, three Playwright runs and image review
completed: 2026-11-05
status: complete
---

# Phase 20 Plan 29: Evidence refresh on HEAD Summary

**All 73 owner-review candidates were recaptured on HEAD 0929a084c13d and tied to it by a commit-checked frontmatter field and a strict-mode "stale candidates" test; the old approved baselines were rerun without touching them: 13 pass, 16 are red, 10 of those are explained and attached as rebaseline rows awaiting the owner, 6 stay blockers for 20-13.**

## Performance

- **Duration:** about 2 h (approximate)
- **Tasks:** 3 of 3
- **Files:** 4 touched (1 created, 3 modified); the only code file is `lib/phase20-visual-approval.test.ts`
- **PLAN_BASE** (commit before Task 1): `0929a084c13dc8cd420152c949c3332e82ed7e67`

## Accomplishments

- **Task 1 (tracer).** Wrote the drift register, recaptured Promotion on HEAD (10 of 10 hashes changed, expected from the global CSS and editor changes), rewrote the participant rows, added `candidates_commit` / `candidates_set` and the validation. The tracer verify passed (`# pass 12`, `# fail 0`) and was re-run before expanding.
- **Task 2 (TDD).** RED `cd5a24c` (7 failing tests: ReferenceError), GREEN `f1893ff`: `staleCandidateProblems(commit, { changedSince })`, `changedSinceCommit(commit, git)` (`git diff --name-only <commit> HEAD -- app components public lib`, non-zero exit throws), `*.test.*` and paths outside app/components/public/lib ignored, wired into `validateLedger` only under `requireApproval`; the real ledger gives a `t.diagnostic` normally and an error under `PORTIA_REQUIRE_APPROVAL=1`. The other 63 candidate rows (spider, rest sharpness, flasks, empty drawings, class icons, info phone) were rewritten to the same set: 42 changed, 21 unchanged (PC frames mostly unchanged, phone frames almost all changed). Sharpness "after" numbers reproduced exactly (1.112 / 1.121 PC, 1.276 / 1.268 phone), threshold 0.9 untouched. BLOCKED rows stayed BLOCKED, including the Behavior-class icons on the phone.
- **Task 3.** Reran the old approved baselines with `--retries=0`: `test:e2e:visual` 8 passed, 8 failed, 14 skipped; phone/webkit/firefox lane 0 passed, 5 failed, 40 skipped. Of 33 baselines the gate evaluated 26 (13 pass, 13 fail) and 7 were not reached (estimated). Red total 16: class (a) 10 (rebaseline rows in ledger section 10), class (b) 6 (blockers B1-B5). 20-25 and 20-26 runs are marked stale (portia-desktop.tsx changed in 20-28), 20-28 is current.

## Task Commits

1. Task 1: `3e0a70a` feat(20-29): refresh Promotion candidates on HEAD, drift register and candidates_commit check
2. Task 2 RED: `cd5a24c` test(20-29): failing tests for stale candidates after candidates_commit
3. Task 2 GREEN: `f1893ff` feat(20-29): recapture all candidate sets on HEAD and reject stale candidates in strict mode
4. Task 3: `bd50a75` docs(20-29): classify prior approved baselines on HEAD, rebaseline-* rows and 20-13 blockers

`commits: 7` in the frontmatter is the measured `rev-list --count` of `plan_head_before..plan_head_after`; three of them (`db6deb1`, `807ab9f`, `4fa0001`) were committed by the owner or another process concurrently and are not part of this plan.

## Decisions Made

See `key-decisions` above. The two that matter to the owner: the class (a) widening (the Phase 15 baselines were already out of date through Phases 16-19, so "expected" is not only Phase 20) and the choice to leave data-driven or non-isolated failures as blockers instead of re-approving them by rebaseline.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Port 3000 was held by a foreign process; served on 3100**
- **Found during:** Task 1 precondition
- **Issue:** The precondition and the environment note say port 3000 is free; a `next` process (PID 36324, not started by me) was listening. It was not touched.
- **Fix:** `npm run build` with `PORTIA_E2E_ALLOW_HTTP=1`, `next start` on 127.0.0.1:3100, `PORTIA_E2E_BASE_URL=http://127.0.0.1:3100` (the 20-25 precedent). Server stopped at the end.
- **Files modified:** none

**2. [Rule 3 - Blocking] Capture command ran the whole candidate directory, not one spec**
- **Found during:** Task 1
- **Issue:** `test:e2e:candidates` already passes `tests/e2e/visual-candidates`, so naming `promotion.spec.ts` as well did not narrow the run.
- **Fix:** none needed; the full run (179 passed, 37 skipped, 0 failed) produced every set Task 2 needed. webkit-phone `info-phone` was run separately; `desktop.spec` was run on chromium-dpr125 and firefox-desktop to get candidate frames for the gate-unreached snapshots.

**2a. [Class (a) widened]** Plan text says (a) means a Phase 20 redesign consequence. I also used it for changes after the Phase 15 approval that predate Phase 20 (icon rest frames, virus icon), flagged in the evidence file.

**3. [Rule 2 - Missing critical] Extra in-plan drift listed**
- **Found during:** Task 1
- **Issue:** `git diff <old set commit> HEAD` showed product changes from 20-22, 20-23 and 20-28 as well, not only the four out-of-plan commits.
- **Fix:** second table "Коммиты внутри планов" in 20-EVIDENCE-REFRESH.md. The four-row grep acceptance is unaffected.

**Total deviations:** 4 (2 blocking environment/command, 1 added coverage, 1 classification note). **Impact:** none on scope; no product code changed.

## Acceptance results

- `grep -c "candidates_commit:" 20-VISUAL-APPROVAL.md` -> 1. PASS
- participant rows pointing at `phase15-current-17215b3a8bae` -> none. PASS
- `grep -cE "^\| (97d7abb|2f54ba9|23c1c85|7e5e17a) \|" 20-EVIDENCE-REFRESH.md` -> 4. PASS
- CANDIDATE rows not in the new set -> 0 (of 83 including the 10 rebaseline rows). PASS
- `git status --porcelain` and `git diff --exit-code --stat HEAD` on `tests/e2e/visual/__screenshots__` -> empty / exit 0; `git log 0929a08..HEAD` on that directory prints nothing. PASS
- `node --experimental-strip-types --test lib/phase20-visual-approval.test.ts` -> 19 pass, 0 fail, 1 skipped. PASS
- strict mode (`PORTIA_REQUIRE_APPROVAL=1`, run as an environment variable from bash) -> exit 1, 19 pass, 1 fail, 146 "owner verdict is still pending" errors. EXPECTED (no verdicts yet). No "stale candidates" error: nothing under app/components/public/lib changed after `candidates_commit`.
- `npm.cmd test` -> exit 1, 1444 pass, 4 fail, 4 skipped. The 4 failures are in `lib/phase20-release-gate.test.ts` (PW-10 waiver expectations) and come from the owner's commit `db6deb1`, not from this plan; logged in `deferred-items.md`. Plan-level verification "npm.cmd test exit 0" is therefore NOT met; this is pre-existing and out of scope.

## Issues Encountered

- The old visual gate is red and stays red after any rebaseline: B1 (Информация 43446 px), B2 (Корзина 9865 px), B3 (База вирусов 4457 px, different data on target), B4 (phone-webkit 54239 px, scrollbar shift, cause unproven), B5 (firefox window-search frames, estimates). Needed for 20-13: pinned data for the gate and an isolated cause for B4.
- The "approved desktop and window shell" test stops at the first mismatch; 7 snapshots were only estimated.
- Candidate frame of `desktop-clean--chromium-phone` shows 537 px against the gate's 542; the plan's phone numbers are within a few px between runs.

## Known Stubs

None. No stub patterns in the files created or modified.

## Threat Flags

None. No new network endpoints, auth paths or schema; candidates only in the ignored `.runs` directory; no packages installed; no `.env` or production data used.

## Next Phase Readiness

- 20-11 Task 2 (owner verdicts) and 20-12 (promotion of exact approved hashes) now work on current frames. Any product change under app/components/public/non-test lib before the owner decides makes the strict check fail with "stale candidates" and needs a new recapture (`candidates_commit` is `0929a084c13d...`).
- 20-13 must rerun 20-25 and 20-26 evidence (marked stale) and resolve B1-B5.
- The 20-29 rerun of the old visual gate did not add a Playwright flake, so `20-PLAYWRIGHT-WAIVERS.md` was not changed.

## Self-Check: PASSED

- Files exist: 20-EVIDENCE-REFRESH.md, 20-VISUAL-APPROVAL.md, deferred-items.md, lib/phase20-visual-approval.test.ts, 20-29-SUMMARY.md.
- Commits reachable from HEAD: 3e0a70a, cd5a24c, f1893ff, bd50a75.
- Candidate files for all 73 rows (and the 10 rebaseline rows) exist on this machine; the validator checked SHA256 against disk.
