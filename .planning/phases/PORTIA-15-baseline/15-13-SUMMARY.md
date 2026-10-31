---
phase: 15-baseline
plan: 13
subsystem: visual-regression
tags: [signed-metadata, authority-binding, manifest, snapshot-path]
requires:
  - phase: 15-12
    provides: 33 approved exact snapshot bytes and signed approval ledger
provides:
  - candidate-set / source-commit / local-contract-digest equality gate over approval, contract, frame map and stable inventory
  - disposable-fixture CLI tests for every mismatch, missing and duplicate case
  - verified canonical snapshot path contract (tests/e2e/visual/__screenshots__/)
affects: [15-14, 15-15]
tech-stack:
  added: []
  patterns: [fail-closed-authority-tuple, verification-never-derives-set-from-HEAD]
key-files:
  created: []
  modified: [scripts/phase15-visual-manifest.mjs, lib/phase15-visual-manifest.test.ts]
key-decisions:
  - "The contract is the digest source; its tuple digest is computed from its own LF-normalized bytes, while approval, frame map and inventory must carry/equal it."
  - "Verified manifests are named by the rows' (inventory-bound) set id, never the HEAD-derived default."
requirements-completed: []
requirements-addressed: [STAB-BASE-03, STAB-BASE-04, STAB-BASE-06]
status: complete
commits: 1
plan_head_before: 4d8b38aaec3cf231b11bb98b867aa79374ba128e
plan_head_after: a0bc339
actuals:
  tasks: 2
  commits: 1
duration: 20min
completed: 2026-11-01
---

# Phase 15 Plan 13: Signed Visual Metadata and Snapshot-Path Summary

**Every visual verification verb (`--verify-ui-map`, `--verify-approval`, `--verify-promotion`, `--promote-approved`) now fails closed unless approval, contract, frame map and stable inventory agree on one candidate set, source commit and local-contract digest before any row is validated.**

## Task Commits

1. **Task 1: Verify signed local visual metadata** — `a0bc339`
2. **Task 2: Correct canonical snapshot path contract** — already delivered by `59d60e7` (`docs(15-13): correct canonical snapshot path`, an ancestor of HEAD, made before this execution). Re-verified here; no new commit.

## Metadata identities (all four artifacts agree)

| Field | Value |
|---|---|
| Candidate set | `phase15-current-efbc1401080d` |
| Source commit | `efbc1401080d6b65ba1f4916ad0343b783c62bb8` |
| Local contract SHA-256 | `3bad50d079f6c0973a93903147b29e3e1bf4243de21cac3e9cb9a569dac13d40` |

## What changed

- `scripts/phase15-visual-manifest.mjs`: `parseAuthorityMetadata` / `validateAuthorityMetadata` already existed (15-11) but were only partly wired (frame map vs contract in `--verify-ui-map`). Added `verifyAuthority()` (shared `compareAuthority`) covering approval, contract (digest computed from bytes), frame map and `15-STABLE-ROW-INVENTORY.json`; invoked first by `--verify-ui-map`, `--verify-approval`, `--verify-promotion`, `--promote-approved`. Stable codes: `PORTIA_AUTHORITY_{CANDIDATE_SET,SOURCE_COMMIT,LOCAL_CONTRACT_DIGEST}_MISMATCH`, `PORTIA_{APPROVAL,CONTRACT,FRAME_MAP}_*_{MISSING,DUPLICATE}`.
- Removed the fragile HEAD-derived default from verification output: the default-mode/`--verify` manifest is written under the rows' set id (previously `PORTIA_VISUAL_SET_ID` / HEAD, which created a stray `.runs/<HEAD>` directory and mislabelled `setId`). The HEAD default remains only for capture-time `--write-inventory`.
- Signed evidence (`15-VISUAL-APPROVAL.md`, `15-LOCAL-UI-CONTRACT.md`, `15-FRAME-TEST-MAP.md`, `15-STABLE-ROW-INVENTORY.json`) is byte-unchanged; mismatches are tested only on temp copies.

## Mismatch tests (8 new, disposable git-initialised temp workspaces, CLI `--verify-promotion`)

approval candidate set; frame-map source commit; approval digest; contract byte drift (digest mismatch); approval missing digest; frame-map duplicate candidate set; inventory set; plus an untouched fixture that passes authority and fails only later at `PORTIA_APPROVED_SNAPSHOT_MISSING`. Existing in-memory tests cover the same three mismatch codes plus missing/duplicate parsing.

## Verification (actual results)

| Command | Node | Result |
|---|---|---|
| `node --experimental-strip-types --test lib/phase15-visual-manifest.test.ts` | 24.21.0 | 24 tests, 24 pass, 0 fail |
| same | 22.13.1 | 24 tests, 24 pass, 0 fail |
| plan form `node --test --experimental-strip-types ...` | 22.13.1 | exit 0 |
| `node scripts/phase15-visual-manifest.mjs --verify-ui-map` | 22.13.1 and 24.21.0 | Verified repository UI map for 84 rows (51 captured, 33 blocked) |
| `--verify-promotion` (with and without `PORTIA_VISUAL_SET_ID`) | 22.13.1 and 24.21.0 | Verified 33 exact owner-approved snapshot bytes; 18 non-approved rows excluded |
| `--verify-approval` | 24.21.0 | Verified owner verdict coverage for 51 captured rows; 33 blocked rows excluded |
| `rg -n "tests/e2e/visual/snapshots/" 15-05-PLAN.md` | n/a | no match (exit 1 = pass) |

Node 22.13.1 (reference runtime) was available at `C:\Users\User\AppData\Local\Temp\portia-node-v22.13.1\node-v22.13.1-win-x64` and was used via PATH; the machine default is 24.21.0 and both were run. No substitution was needed. The plan's Task 2 verify line is PowerShell syntax; its bash/`rg` equivalent was run.

## Task 2 path-only correction

`59d60e7` changed exactly 5 lines in `15-05-PLAN.md`, all `tests/e2e/visual/snapshots/` -> `tests/e2e/visual/__screenshots__/`. No verdicts or PNGs touched; `tests/e2e/visual/snapshots/` does not exist; the store holds the 33 approved PNGs.

## Deviations from Plan

**Task 2 was already complete** before execution (commit `59d60e7`), so it produced no new commit. Task 1 extended already-present parsing helpers (from 15-11) rather than writing them anew; the gap was wiring and inventory binding.

## Issues / Notes

- The plan's `--verify` markdown regeneration (`15-VISUAL-CANDIDATES.md`) was not run, to keep signed evidence untouched.
- No blocked evidence was recorded as a pass; 33 BLOCKED rows remain excluded.
- Owner-dirty paths (`.planning/milestone.lock`, forensics, v1.2-incomplete-research, quick/261028..., ui-reviews) were not touched.

## Self-Check: PASSED

`a0bc339` is an ancestor of HEAD; `scripts/phase15-visual-manifest.mjs`, `lib/phase15-visual-manifest.test.ts` exist.
