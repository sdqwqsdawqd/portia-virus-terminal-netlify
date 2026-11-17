---
phase: 15-baseline
plan: 04
subsystem: visual-evidence
tags: [playwright, figma, visual-candidates, motion, privacy]

requires:
  - phase: 15-baseline
    provides: deterministic browser fixtures and candidate-ready visitor states from plan 15-03
provides:
  - immutable candidate-only evidence for every Phase 15 visual state
  - editable CURRENT and PROPOSED Figma authority surface
  - exact candidate-to-Figma-to-snapshot mapping for all 58 rows
  - source-commit-aware manifest verification after later documentation commits
affects: [15-05-owner-approval, 18-desktop-motion, 19-promotion-proof, 20-applications]

tech-stack:
  added: []
  patterns: [candidate-before-golden, semantic editable Figma evidence, hash-bound frame mapping, explicit blocked-state cards]

key-files:
  created:
    - .planning/phases/PORTIA-15-baseline/evidence/15-FRAME-TEST-MAP.md
  modified:
    - scripts/phase15-visual-manifest.mjs
    - .planning/phases/PORTIA-15-baseline/evidence/15-VISUAL-CANDIDATES.md
    - .planning/phases/PORTIA-15-baseline/evidence/15-FIGMA-CONTRACT.md

key-decisions:
  - "Candidate PNGs remain evidence and are never promoted or embedded as flattened Figma deliverables before owner approval."
  - "The repository UI-SPEC remains normative because the current Plugin API exposes no native figma.spec authoring surface."
  - "The Starter three-page limit is represented losslessly as one CURRENT page with seven named sections plus separate PROPOSED and empty APPROVED pages."
  - "Privileged editor, Promotion and semantic-motion states remain explicit BLOCKED rows until isolated fixtures exist."

patterns-established:
  - "Every Figma CURRENT card maps to requirement, actor/state, project, candidate identity, exact node ID and intended snapshot."
  - "Figma evidence uses PORTIA-local variables, IBM Plex Mono and Golos Text; unrelated Material/iOS libraries are not mixed into the product identity."

requirements-completed: []
requirements-partial: [STAB-BASE-03, STAB-BASE-04]

duration: 38min
completed: 2026-10-30
---

# Phase 15 Plan 04: Visual Candidate and Figma Evidence Summary

**PORTIA now has a complete candidate-only visual inventory and an editable Figma comparison surface, while all golden promotion and owner verdicts remain intentionally pending for Plan 15-05.**

## Performance

- **Duration:** 38 min
- **Completed:** 2026-10-30T16:06:11+05:00
- **Tasks:** 3
- **Task commits:** 7

## Accomplishments

- Captured 23 deterministic sanitized PNG candidates and recorded 35 explicit BLOCKED states for a total inventory of 58.
- Preserved candidate source commit `4ec66b7d693c68546954aace3e104a8ba7da511b`, fixture/time/browser/device metadata and SHA-256 identity.
- Created [PORTIA OS — Phase 15 Baseline](https://www.figma.com/design/GEf7NB9v2GZN80cMzRvUVQ) under signer `Qloxz`.
- Built 58 editable `Evidence/Card` instances across CURRENT sections with local PORTIA colors, dimensions and typography.
- Added a visibly separate PROPOSED page for typography hierarchy, Full/Reduced/Off motion and deterministic state instrumentation.
- Verified that the APPROVED page contains zero child nodes and that CURRENT/PROPOSED contain no flattened full-UI images.
- Created an exact repository map from every candidate or blocker to its Figma node and future snapshot destination.

## Task Commits

1. **Task 1: Candidate-only capture pipeline** — `67e0902`, `ccc84f2`, `4ec66b7`, `d64c517`
2. **Task 2: Figma capability and owner authority** — `0d1fe40`
3. **Task 3: Editable Figma evidence and verified mapping** — `5c00bc7`, `63510fb`

## Evidence Inventory

| Category | Result |
|---|---:|
| Captured candidates | 23 |
| Explicit BLOCKED rows | 35 |
| Total mapped rows | 58 |
| Figma CURRENT instances | 58 |
| Figma image-filled nodes | 0 |
| APPROVED page child nodes | 0 |

The employee candidate is fully masked. Promotion evidence stores no nickname, private projection, reviewer note, qualification question, answer or key.

## Figma Authority

- File key: `GEf7NB9v2GZN80cMzRvUVQ`
- Work revision locator: MCP session `77cd90e1-9022-4a59-8906-de90227ad904`, validated 2026-10-30
- Signer selected: `Qloxz`
- Representative phone selected: Playwright iPhone 13, `390×844`, DPR `3`
- Repository UI authority: `15-UI-SPEC.md`
- Baseline approval: **PENDING**

## Verification

- `node --check scripts/phase15-visual-manifest.mjs` — PASS
- `node scripts/phase15-visual-manifest.mjs --verify` — PASS, 58 rows / 23 PNGs
- `node scripts/phase15-visual-manifest.mjs --verify-figma-map` — PASS, 58 mapped rows
- Repository map count — PASS, 23 captured + 35 blocked
- Figma structural validation — PASS, exact product fonts, no image fills, APPROVED empty
- Figma visual validation — PASS after correcting grid heights and BLOCKED status color

## Deviations from Plan

### Accepted Platform Variance

1. **Figma Starter permits only three pages**
   - The attempted nine-page structure was rejected by Figma before mutation.
   - Preserved all nine authority areas as seven named CURRENT sections plus separate PROPOSED and APPROVED pages.
   - An upgrade is required only if nine top-level pages are mandatory.

2. **No immutable Figma version ID is exposed**
   - Recorded the exact file key, session UUID, validation date and every node ID.
   - Repository hashes remain the immutable evidence authority.

### Auto-fixed Issues

1. **[Rule 1 - Bug] Evidence grids had fixed 100 px height**
   - Resized each grid from actual column bounds and expanded section bounds.
   - Revalidated the Applications composition visually.

2. **[Rule 1 - Bug] BLOCKED labels inherited CAPTURED green**
   - Applied the dedicated amber semantic token to all 35 blocked instance labels.
   - Post-fix visual screenshot passed.

3. **[Rule 1 - Bug] Persisted candidates were compared to documentation HEAD**
   - Verification now requires one shared candidate source commit and a matching set-ID prefix.
   - Later evidence commits no longer invalidate immutable candidate bytes.

## Open Gates

- The owner has confirmed the Figma destination, signer and representative phone, but has not yet issued per-hash APPROVED/REJECTED verdicts.
- Editor, reviewer, owner, private Promotion and several semantic motion states remain BLOCKED until isolated first-party fixtures exist.
- Physical PC DPR 1.25 and phone UAT remain Phase 22 gates.
- The Figma Starter MCP call quota was exhausted after successful validation; no additional Figma mutation is required for this plan.

## Next Plan Readiness

Plan 15-05 must present CURRENT and PROPOSED separately and obtain one explicit owner verdict for every captured hash. No snapshot may be promoted until that ledger is complete.

---
*Phase: 15-baseline*
*Completed: 2026-10-30*
