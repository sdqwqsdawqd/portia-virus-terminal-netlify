---
phase: 15-baseline
plan: 01
subsystem: planning
tags: [git-forensics, ownership, evidence, sha256, baseline]

requires:
  - phase: 14-promotion
    provides: existing PORTIA OS product state and unresolved worktree material
provides:
  - immutable source, environment and dirty-worktree evidence for Phase 15
  - owner-approved disposition and touch boundary for every captured dirty path
  - clean package manifests released for controlled Playwright setup
affects: [15-02-tooling, 15-03-role-contracts, 15-05-owner-approval]

tech-stack:
  added: []
  patterns: [immutable evidence capture, owner-signed dirty ownership ledger, withheld unrelated work]

key-files:
  created:
    - .planning/phases/PORTIA-15-baseline/evidence/15-CURRENT-STATE-LEDGER.md
    - .planning/phases/PORTIA-15-baseline/evidence/15-DIRTY-OWNERSHIP.md
    - .planning/phases/PORTIA-15-baseline/evidence/15-ENVIRONMENT.md
    - .planning/phases/PORTIA-15-baseline/evidence/15-ACCEPTED-LIMITATIONS.md
  modified:
    - .planning/phases/PORTIA-15-baseline/scripts/capture-current-state.mjs

key-decisions:
  - "Remove only the captured unused motion@14.6.0 experiment; preserve and withhold every other pre-existing dirty path."
  - "Treat the initial current-state ledger as immutable after owner disposition instead of regenerating it from the changed worktree."

patterns-established:
  - "Evidence boundary: generated capture files are excluded from the snapshot they describe."
  - "Ownership boundary: KEEP/WITHHOLD material is never absorbed into Phase 15 commits."

requirements-completed: [STAB-BASE-01, STAB-BASE-06]

duration: 8min
completed: 2026-10-30
---

# Phase 15 Plan 01: Baseline Control Summary

**Immutable repository evidence and an owner-approved dirty-worktree boundary now protect all later PORTIA OS baseline work.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-10-30T10:44:04+05:00
- **Completed:** 2026-10-30T10:51:59+05:00
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Captured source commit `dc02013ae6dec3996a4548138fc9e15218912ccd`, branch/upstream, environment, porcelain-v2 state and SHA-256 evidence for 12 pre-existing dirty files.
- Classified the inventory into eight explicit ownership rows and tied accepted limitations back to canonical project requirements.
- Recorded the owner's verbatim response `разрешаю`, removed only the captured Motion experiment, and left all other pre-existing material preserved with `KEEP + WITHHOLD`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create a deterministic read-only current-state capture** - `6e52af7`
2. **Task 2: Build the dirty ownership and accepted-limitations ledgers** - `8bf6ef1`
3. **Task 3: Obtain owner disposition for every dirty path** - `24e1edb`

**Plan metadata:** included in the plan completion commit.

## Files Created/Modified

- `.planning/phases/PORTIA-15-baseline/scripts/capture-current-state.mjs` - deterministic capture plus immutable-ledger verification.
- `.planning/phases/PORTIA-15-baseline/evidence/15-CURRENT-STATE-LEDGER.md` - source, Git and dirty inventory snapshot `2219470e563f86a2ed8a47f5e427e339589fe598254514844bd50bc74028e367`.
- `.planning/phases/PORTIA-15-baseline/evidence/15-DIRTY-OWNERSHIP.md` - eight owner dispositions with recovery evidence and touch permissions.
- `.planning/phases/PORTIA-15-baseline/evidence/15-ENVIRONMENT.md` - OS, Node, npm, Git and environment-variable presence without secret values.
- `.planning/phases/PORTIA-15-baseline/evidence/15-ACCEPTED-LIMITATIONS.md` - canonical scope and limitation references.

## Decisions Made

- The unused Motion dependency experiment was removed only after explicit authorization; `package.json` and `package-lock.json` now match `HEAD` and may be changed by Plan 15-02.
- `.planning/HANDOFF.json`, `.planning/milestone.lock`, prior forensics, v1.2 research, Promotion quick work and the prior UI-review workspace remain untouched and withheld.
- The captured source ledger is immutable after the owner decision; later validation checks its completeness and capture determinism without rewriting history.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Ownership verification initially followed live HEAD**

- **Found during:** Task 2
- **Issue:** After the first task commit, validating against the live worktree could make the immutable source inventory drift.
- **Fix:** Bound ledger verification to the source commit recorded inside the initial current-state evidence.
- **Files modified:** `.planning/phases/PORTIA-15-baseline/scripts/capture-current-state.mjs`
- **Verification:** `--verify-ledgers` reports eight rows with zero missing or duplicate paths.
- **Committed in:** `8bf6ef1`

**2. [Rule 3 - Blocking] Post-decision checks could overwrite immutable evidence**

- **Found during:** Task 3
- **Issue:** The original `--check` implementation regenerated the current-state ledger after authorized package cleanup, destroying the original dirty-state record.
- **Fix:** Existing evidence is now preserved while two live captures are compared for determinism; ownership keys are parsed from the immutable inventory.
- **Files modified:** `.planning/phases/PORTIA-15-baseline/scripts/capture-current-state.mjs`
- **Verification:** `--check` and `--verify-ledgers` both exit 0 after Motion removal.
- **Committed in:** `24e1edb`

---

**Total deviations:** 2 auto-fixed blocking validation issues.
**Impact on plan:** Both changes preserve the intended immutability and ownership guarantees without product or package scope creep.

## Issues Encountered

- The environment-ledger heading differed from the first validator literal; the validator was aligned to the generated evidence and re-run successfully.
- Windows reported future LF-to-CRLF conversion warnings while comparing the package files, but `git diff --exit-code` confirmed both files are clean.

## User Setup Required

None for Plan 15-01. Plan 15-02 still requires a supported Node `22.13.x` runtime before package or browser installation.

## Next Phase Readiness

- Package manifests are clean and explicitly released for controlled Playwright/axe setup.
- All unrelated dirty material has recovery evidence and remains withheld.
- Plan 15-02 may proceed once Node `22.13.x` is active or an equivalent isolated supported runtime is proven.

---
*Phase: 15-baseline*
*Completed: 2026-10-30*
