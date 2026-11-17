---
phase: 15-baseline
plan: 11
subsystem: ui-authority
tags: [ui-review, visual-baseline, owner-verdict, motion]
requires:
  - phase: 15-10
    provides: immutable captured and blocked visual inventory
provides:
  - repository-native UI and motion authority without external design services
  - exact local map for 51 captured rows and 33 typed blockers
  - complete Qloxz verdict ledger with approved and rejected states separated
affects: [15-12, 15-13, phase-18]
tech-stack:
  added: []
  patterns: [local-contract-digest, exact-hash-owner-verdict, physical-uat-over-still-inference]
key-files:
  created: [.planning/phases/PORTIA-15-baseline/15-UI-REVIEW.md, .planning/phases/PORTIA-15-baseline/evidence/15-LOCAL-UI-CONTRACT.md]
  modified: [.planning/phases/PORTIA-15-baseline/evidence/15-FRAME-TEST-MAP.md, .planning/phases/PORTIA-15-baseline/evidence/15-VISUAL-APPROVAL.md, scripts/phase15-visual-manifest.mjs, lib/phase15-visual-manifest.test.ts]
key-decisions:
  - "Repository Markdown, immutable PNG bytes and executable verification replace external mutable design authority."
  - "Physical owner playback review overrides positive motion conclusions inferred from still screenshots."
  - "Nine defective shortcut, spider and web-wave rows remain rejected evidence owned by Phase 18."
requirements-completed: []
requirements-addressed: [STAB-BASE-03, STAB-BASE-04, STAB-BASE-06]
duration: 35min
completed: 2026-10-31
---

# Phase 15 Plan 11: Repository UI Authority Summary

**The UI baseline is now repository-owned and machine-checkable, with explicit owner approval for stable current frames and explicit rejection of defective motion.**

## Accomplishments

- Produced a six-pillar repository UI review and local UI/motion contract without Figma or Codex Security.
- Bound 84 stable identities to 51 exact captured rows and 33 typed blockers.
- Recorded Qloxz verdicts for every captured row; after selecting Firefox as the search-window authority and de-duplicating the identical WebKit phone frame in 15-12, 33 are approved and 18 rejected.
- Preserved still captures as evidence while rejecting the jerky/teleporting spider route, one-sided web wave and shifting/incomplete shortcut cycles.
- Routed the owner-directed shortcut artwork/motion rebuild, continuous neighboring-sector spider path and bounded window-content reflow to Phase 18.

## Task Commits

1. **Task 1: Build the repository-native UI authority bundle** — `73d61aa`
2. **Owner UAT correction: Record rejected motion baseline and Phase 18 requirements** — `7444efc`
3. **Task 2: Record exact owner verdicts** — `286917a`

## Verification

- `node scripts/phase15-visual-manifest.mjs --verify-ui-map` — 84 rows verified.
- `node scripts/phase15-visual-manifest.mjs --verify-approval` — all 51 captured rows covered; 33 blocked rows excluded.
- `node --test lib/phase15-visual-manifest.test.ts` — 16/16 passed.
- CURRENT and PROPOSED material remain separate.

## Owner Verdict

| Verdict | Rows | Disposition |
|---|---:|---|
| APPROVED | 33 | Eligible for exact-byte promotion in 15-12 |
| REJECTED | 18 | Immutable defect evidence; motion rows replace in Phase 18; non-Firefox search-window rows and one duplicate WebKit destination are superseded |
| BLOCKED | 33 | No verdict or promotion; recover in named later phases |

## Next Plan Readiness

Ready for 15-12 to promote only approved bytes. Rejected motion rows must remain absent from the approved snapshot set and cannot be converted into passing baselines.

---
*Phase: 15-baseline*
*Completed: 2026-10-31*
