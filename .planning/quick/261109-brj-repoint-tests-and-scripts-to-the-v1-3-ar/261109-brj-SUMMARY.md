---
phase: quick-261109-brj
plan: 01
subsystem: release-evidence
tags: [archive, v1.3, path-repoint, release-gate]
status: complete
requirements: [QUICK-261109-brj]
commits: 1
plan_head_before: fe34639ad876a4722f17e44eaa7fd1b7c88eba27
plan_head_after: 3bfa520f9db77c478f71e17fe03be3f1c411ccf1
actuals:
  tasks: 3
  commits: 1
key-files:
  modified:
    - scripts/phase20-release-gate.mjs
    - lib/phase20-release-gate.test.ts
    - scripts/phase15-visual-manifest.mjs
    - lib/phase15-visual-manifest.test.ts
    - tests/e2e/visual-candidates/support.ts
    - lib/phase20-uat.test.ts
    - lib/phase20-requirements-ledger.test.ts
    - lib/phase20-release-notes.test.ts
    - lib/phase20-hints-inventory.test.ts
    - lib/security-matrix.test.ts
    - lib/editor-image-framing.test.ts
    - scripts/phase20-audit-check.mjs
    - scripts/phase19-matrix-data.mjs
    - scripts/phase19-acceptance.mjs
    - scripts/phase16-staging.mjs
  created:
    - .planning/milestones/v1.3-phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-POST-ARCHIVE-PATHS.md
---

# Quick 261109-brj: archive the v1.3 phases and repoint release-evidence paths

The six v1.3 phase directories (PORTIA-15..20, 412 files) now live in `.planning/milestones/v1.3-phases/` as pure renames. The release gate, the visual manifest and the Phase 20 document tests read the archived copies.

## Result

- Commit `3bfa520f9db77c478f71e17fe03be3f1c411ccf1`: 412 R100 renames, 15 modified files (path constants and the new tests), 1 added file (the dated note).
- `.planning/phases/` is empty on disk and holds no tracked file.
- Node 22.13.1 from `%TEMP%\portia-node-v22.13.1` was used for every command.
- No STOP was raised. `tests/e2e/visual/phase20-baselines.json`, the Phase 15 evidence, the owner summaries, `20-RECONCILIATION.md` and `20-SECURITY-MATRIX.md` are untouched apart from the rename.

## Changes

- `scripts/phase20-release-gate.mjs`: new constants `V13_PHASES`, `LEGACY_PHASES`, `LEGACY_PHASE_DIR`, `PLAN_BASE_REQUIREMENTS_MD`; `PHASE_DIR`, `REQUIREMENTS_MD`, `ROADMAP_MD` and the Phase 18/19 verification paths point to the archive. `phaseDirIn()` is used only for commit-bound reads (`readEffectiveOwnerVerdict` and the waiver read in `--run`). The `git show <plan_base>` read keeps the pre-archive path. `POST_FRC_PATHS` gains exactly 11 file entries.
- `scripts/phase15-visual-manifest.mjs`: Phase 15 evidence is read from the archive; `phase20VerdictSource` keeps the legacy literal (the register's signed identity) and the summary is read through the new `phase20VerdictFile`.
- Document tests and operational scripts: one path constant per file. `lib/security-matrix.test.ts` maps the leading legacy `.planning/phases/` of the frozen matrix sources to the archive, only inside its existence predicates.
- Tests added in `lib/phase20-release-gate.test.ts`: "v1.3 archive layout", "phaseDirIn and readEffectiveOwnerVerdict" (legacy only, both layouts with the archive winning, empty dir), a `lib/portia-content.test.ts` negative for `POST_FRC_PATHS`, a plan_base fake git that answers only the pre-archive object name. `lib/phase15-visual-manifest.test.ts` asserts that a register naming the archived path is `PORTIA_PHASE20_REGISTER_INVALID`.

## Verification (after the commit)

- `lib/*.test.ts`: 1721 tests, 1718 pass, 0 fail, 3 skipped.
- `--verify-promotion`: "Verified 65 exact owner-approved snapshot bytes; 18 non-approved rows excluded."
- `phase20-release-gate.mjs`: `--verify-docs`, `--verify-reconciliation`, `--verify-lineage`, `--verify-evidence`, `--verify-independent` all exit 0 ("docs verified", "reconciliation verified", "lineage verified", "release evidence verified", "independent verification passed").
- tsc `--noEmit`: exit 0. eslint on `scripts lib tests/e2e/visual-candidates`: 0 errors, 3 warnings (the same 3 in the gitignored `.runs/`).
- GSD queries `init.manager`, `roadmap.analyze`, `init.new-milestone`: exit 0.
- Grep gate A: 3 lines (the two `phase20VerdictSource` constants and the register's `source`). Gate B: 3 lines (`PLAN_BASE_REQUIREMENTS_MD`, its assertion, the fake `.planning/ROADMAP.md` change entry).
- `git diff --name-only a05a6019e867 HEAD` outside `.planning/`: exactly 15 files, all in `POST_FRC_PATHS`.

## Deviations from Plan

- `lib/security-matrix.test.ts` has one more `archived()` use than the plan names: the "covered path does not exist" check of the freshness test (same frozen-matrix source paths). It is a read predicate only; the matrix is not edited.
- Tasks 1 and 2 were not committed separately, as the plan prescribes (single commit in Task 3). Between tasks one test ("the real audit evidence verifies") was red until `scripts/phase20-audit-check.mjs` was repointed in Task 3, as the plan anticipated.

## Known Stubs

None.

## Threat Flags

None.
