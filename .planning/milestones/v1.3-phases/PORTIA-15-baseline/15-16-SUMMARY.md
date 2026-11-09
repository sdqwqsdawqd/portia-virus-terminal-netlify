---
phase: 15-baseline
plan: 16
subsystem: verification-tooling
tags: [gap-closure, g6, candidate-index, clean-checkout, fail-closed]
requires:
  - phase: 15-15
    provides: clean-checkout verification that documented G6 (UI map / approval not reproducible from tracked files)
provides:
  - tracked byte-free 15-CANDIDATE-INDEX.json (84 rows, 51 CAPTURED, 33 BLOCKED) generated from the raw capture
  - --verify-ui-map / --verify-approval that fall back to the tracked index when .runs/ is absent
  - --write-candidate-index mode and index-vs-capture drift guard (assertCandidateIndexMatches)
  - clean-checkout proof and refreshed G6 evidence rows
affects: [phase-16, phase-18, phase-19, phase-22]
tech-stack:
  added: []
  patterns: [tracked-projection-of-gitignored-capture, source-labelled-verifier-output, drift-guard]
key-files:
  created:
    - .planning/phases/PORTIA-15-baseline/evidence/15-CANDIDATE-INDEX.json
  modified:
    - scripts/phase15-visual-manifest.mjs
    - lib/phase15-visual-manifest.test.ts
    - .planning/phases/PORTIA-15-baseline/15-VERIFICATION.md
    - .planning/phases/PORTIA-15-baseline/evidence/15-BASELINE-RESULTS.md
    - .planning/phases/PORTIA-15-baseline/evidence/15-TRACEABILITY.md
    - .planning/ROADMAP.md
    - .planning/STATE.md
key-decisions:
  - "Raw capture stays the preferred source where it exists; the index is a byte-free projection and any divergence fails with PORTIA_CANDIDATE_INDEX_DRIFT."
  - "Index mode is opt-in per call site (allowIndex): only --verify-ui-map and --verify-approval use it; --promote-approved, --write-inventory and the default/--verify modes are unchanged."
  - "G6 is tooling reproducibility only: no STAB-BASE requirement changes status; G1-G5, gaps_found and score 1/4 are untouched."
requirements-completed: []
requirements-addressed: [STAB-BASE-03, STAB-BASE-04, STAB-BASE-06]
status: complete
commits: 3
plan_head_before: 84071bd284e6345a246e7064acf9ecda5c91cbb3
plan_head_after: c8ccfe340d7ec56df518455449bb08e8d1b7d71d
actuals:
  tasks: 3
  commits: 3
duration: 40min
completed: 2026-11-01
---

# Phase 15 Plan 16: G6 Tracked Candidate Index Summary

**`--verify-ui-map` and `--verify-approval` now pass in a disposable clean checkout with no `.runs/` directory by reading a tracked, byte-free `15-CANDIDATE-INDEX.json` (84 rows), while tampering with the index, the authority tuple or the index/capture pairing still exits 1 with stable `PORTIA_*` codes.**

## Task Commits

1. **Task 1 (tracer): index, index-aware collectRows, `--write-candidate-index`, drift helper, Source label** — `73d2e37`
2. **Task 2: tamper, approval-mode, missing-source and drift tests** — `b6164ed`
3. **Task 3: G6 evidence rows (VERIFICATION, BASELINE-RESULTS, TRACEABILITY)** — `c8ccfe3`

## Index Generation

`node scripts/phase15-visual-manifest.mjs --write-candidate-index` (Node 22.13.1) -> `Wrote candidate index for 84 rows.` Rows sorted by `project:id` with plain string comparison. A second run exits 1 with `PORTIA_CANDIDATE_INDEX_EXISTS` and leaves the file unchanged. Acceptance one-liner (schema, setId `phase15-current-efbc1401080d`, sourceCommit `efbc1401...`, 84 rows, 51 CAPTURED, 33 BLOCKED) exits 0. Pre-commit scan: no absolute paths, user names, hosts, tokens or keys (only `@playwright/test@1.64.1`, `chromium@156...` style tool/browser strings and public visitor-state text). No PNG copied; nothing under `tests/e2e/visual-candidates/.runs/` is tracked.

## Tests

Manifest test file: 24 -> 37 tests, all pass. New: index-mode `--verify-ui-map` pass and `--verify-approval` pass (`Source: tracked index`); index tamper with a changed row hash (`PORTIA_UI_MAP_HASH_MISMATCH` / `PORTIA_APPROVAL_VERDICT_MISSING`), replaced candidate set (`PORTIA_CANDIDATE_INDEX_INVALID`), replaced source commit (`PORTIA_CANDIDATE_SET_SOURCE_MISMATCH`), removed row (`PORTIA_CANDIDATE_ROW_MISSING`), contract-byte drift for both verbs (`PORTIA_AUTHORITY_LOCAL_CONTRACT_DIGEST_MISMATCH`), missing index for both verbs (`PORTIA_CANDIDATE_SET_MISSING`); `assertCandidateIndexMatches` unit cases (order-independent pass, changed field / missing / extra row -> `PORTIA_CANDIDATE_INDEX_DRIFT`). Every tamper case asserts exit status 1.

## Verification (actual results, Node 22.13.1)

| Check | Main tree | Disposable clean checkout (detached `b6164ed`, no `.runs/`) |
|---|---|---|
| manifest tests | 37/37 | 37/37 |
| `--verify-ui-map` | `Verified repository UI map for 84 rows (51 captured, 33 blocked). Source: capture.` | `... Source: tracked index (candidate PNG bytes not re-hashed).` |
| `--verify-approval` | `Verified owner verdict coverage for 51 captured rows; 33 blocked rows excluded. Source: capture.` | `... Source: tracked index (candidate PNG bytes not re-hashed).` |
| `--verify-promotion` | `Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded.` | identical |
| `npm test` | 649 tests, 648 pass, 0 fail, 1 skip | not run (no install; Node built-ins only) |
| `npm exec tsc -- --noEmit` | exit 0 | not run |
| `git status --porcelain` | n/a | empty; clone deleted afterwards |

Tamper probe in the clone (one CAPTURED row sha256 zeroed in the clone's index): `--verify-ui-map` exit 1 `PORTIA_UI_MAP_HASH_MISMATCH`; `--verify-approval` exit 1 `PORTIA_APPROVAL_VERDICT_MISSING`.

Signed evidence (`15-VISUAL-APPROVAL.md`, `15-LOCAL-UI-CONTRACT.md`, `15-FRAME-TEST-MAP.md`, `15-STABLE-ROW-INVENTORY.json`, `15-VISUAL-CANDIDATES.md`) is byte-unchanged versus `b250c5a`; `.planning/REQUIREMENTS.md` unchanged; default `--verify` mode was never run.

Runtime: reference Node 22.13.1 from `%TEMP%\portia-node-v22.13.1\node-v22.13.1-win-x64` was present and used (machine default is v24.21.0).

## Honest Limits

- The clean checkout does not re-hash candidate PNG bytes (they live in the gitignored run directory by design). The main tree does, and also checks index == capture; approved bytes are covered by `--verify-promotion` in both trees.
- No requirement status changed. STAB-BASE-02/03/04/06 stay BLOCKED; STAB-BASE-01/05 stay satisfied. Phase 15 stays `gaps_found`, score 1/4. G1-G5 are untouched and owned by Phases 16/18/19/22.
- Accepted debt: if a new candidate set is signed, the index must be regenerated deliberately (write mode refuses to overwrite).

## Deviations from Plan

**1. [Process] TDD order blurred between Task 1 and Task 2.** Task 1's commit also carried the `verifyApproval` wiring and `assertCandidateIndexMatches` (tiny, same `collectRows` change), so Task 2's tests passed on first run instead of being watched failing. Task 1's own test was run red first (fixture could not load the missing index) and then green. Task 2's commit is therefore tests only. No behavior difference; coverage is complete per the plan's acceptance list.

**2. [Rule 1 - Bug] Test regex typo.** The first draft of the Task 1 test used an unescaped `(51 captured, 33 blocked)` regex and failed against correct output; fixed in the same task before commit.

**Total deviations:** 2 (1 process note, 1 trivial auto-fix). **Impact:** none on scope or results.

## Known Stubs

None.

## Threat Flags

None. The index is committed metadata only; the new CLI mode writes a single new tracked path and refuses to overwrite.

## Self-Check: PASSED

- `15-CANDIDATE-INDEX.json` exists and is tracked; commits `73d2e37`, `b6164ed`, `c8ccfe3` are ancestors of HEAD.
- All Task 1/2/3 acceptance criteria re-run and passing (see tables above); owner paths untouched.
