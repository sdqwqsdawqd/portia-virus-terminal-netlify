---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 21
subsystem: content-classification-migration
tags: [migration, supabase, staging, d-36b, class-rename, forward-only]
requires: [20-20]
provides:
  - supabase/migrations/20261104000000_portia_rename_virus_classes.sql (data-only, idempotent, forward-only; nine D-35 pairs in viruses and recycledViruses)
  - pinned migration hash in lib/portia-canonical-parity.test.ts
  - offline tests (D-36) and guarded staging script (seed / verify / cleanup)
  - 20-CLASS-MIGRATION-EVIDENCE.md with reviewer verdict, owner decision, staging receipts, production status
affects: [supabase/migrations, lib/portia-canonical-parity.test.ts, lib/portia-class-migration.test.ts, scripts/phase20-class-migration-staging.mjs]
tech-stack:
  added: []
  patterns: [fixture-row verification on isolated staging, guarded runCli for read-only preflight (migration list, db push --dry-run)]
key-files:
  created:
    - supabase/migrations/20261104000000_portia_rename_virus_classes.sql
    - lib/portia-class-migration.test.ts
    - scripts/phase20-class-migration-staging.mjs
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-CLASS-MIGRATION-EVIDENCE.md
  modified:
    - lib/portia-canonical-parity.test.ts
key-decisions:
  - "Owner chose option a (rename only, D-38 text not touched); migration and hash unchanged after the decision."
  - "Preflight before push: migration list showed the three earlier versions applied on staging and db push --dry-run listed only 20261104000000 as pending, so the push could not apply the destructive overload-drop migration."
  - "Production is untouched and stays with the owner (status ОЖИДАЕТ ВЛАДЕЛЬЦА)."
requirements-completed: [STAB-CLASS-03]
status: complete
duration: ~35m (this continuation)
completed: 2026-11-04
actuals:
  tokens: 14000
  tasks: 3
  commits: 1
plan_head_before: bb223386aa10cea5c593314ecfe6852e1b77689f
plan_head_after: 08dfc4231e820ddac45af2c698198b5229f8109a
---

# Phase 20 Plan 21: Stored virus class rename migration (D-36b) Summary

A forward-only, data-only SQL migration rewrites the nine old class names to the new ones in `viruses` and `recycledViruses` of `public.portia_content`; it is pinned, tested offline, reviewed by supabase-rls-reviewer (PASS-WITH-NOTES, static), and by the owner's decision (option a) it was applied to the isolated staging project only, where a fixture row was rewritten correctly and cleaned up with residual 0. Production is left to the owner.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 (tracer) | Offline path: D-35 table, SQL migration, pinned hash, tests, review | 08dfc42 |
| 2 | Owner decision (checkpoint, blocking-human): option a, no parallel staging run | no commit (recorded in evidence) |
| 3 | Apply on isolated staging, record receipts | evidence file, in the final docs commit with this SUMMARY |

Single-repo commits before the final docs commit: 1 (measured from the persisted ledger). The final `docs(20-21)` commit follows this SUMMARY.

## Staging result

- Target attested by `phase16-staging.mjs attest` (`ATTESTED`, refHash `01d085e7b9f0`); `self-test-production-block` `{"checked":1,"blocked":1}`.
- Preflight: `migration list` showed 20261101000000, 20261101000100, 20261101000200 applied; `db push --dry-run` listed only `20261104000000_portia_rename_virus_classes.sql`.
- Read-only count: `portia_content` on staging had 0 rows, 0 values with U+0301 (no `main` row on staging).
- Receipts (runId `p20cls-20261104-a7k2`): seed ok (revision 1); push exit 0, all four versions Local = Remote; verify ok (revision 2, problems empty); cleanup ok, residual 0. Post-run dry-run: "Remote database is up to date."

## Deviations from Plan

None to the plan's logic. Two process notes:

- The supabase-rls-reviewer agent could not be run by the executor; the orchestrator ran it and its real verdict (PASS-WITH-NOTES, static only) replaced the executor's earlier self-check note in the evidence.
- The read-only preflight (`migration list`, `db push --dry-run`, a row/U+0301 count) was run through two throwaway helper scripts in the session scratchpad that import `resolveStagingTarget` and `runCli` from `scripts/phase16-staging.mjs` (so every guard applied); they are not committed.

## Limitations and BLOCKED items

- **LIMITATION:** staging had no `main` row, so "no old values left in main" is vacuous there. Behavior on real content and under a concurrent editor save (LOW-1) was not exercised on a live row; the reviewer judged it safe statically.
- **OWNER ACTION (open):** production application. Evidence status: ОЖИДАЕТ ВЛАДЕЛЬЦА. File and sha256 `0037b9303c9524920af5dc810e1d0efacdbc038dcfe535b50535b032c816a98c` are in the evidence file.
- **STAB-REL-07 stays open:** it covers the final release commit/state and carried risks for the whole release, which this plan alone does not prove; this plan contributes the honest production-pending entry.
- Pre-existing, unrelated: full `npm run lint` shows 62 problems (32 errors) outside this plan's files, unchanged since 20-20.

## Commands executed against remote systems (all via the guarded scripts, staging only)

`phase16-staging.mjs self-test-production-block`, `attest`, `push`; `supabase migration list` and `supabase db push --dry-run` through `runCli`; one read-only `db query` count on `portia_content`; `phase20-class-migration-staging.mjs seed`, `verify`, `cleanup`; `scan-evidence` on the phase directory (0 findings, local only). Production was never contacted; no .env file was opened or printed.

## Known Stubs

None.

## Threat Flags

None. No new endpoints, auth paths or schema changes; the migration is data-only.

## Self-Check: PASSED

- Migration file, test file, staging script, evidence file exist; migration sha256 matches the pinned `0037b930...a98c`.
- Commit 08dfc42 is an ancestor of HEAD; `git diff` of `lib/portia-canonical-parity.test.ts` against PLAN_BASE contains exactly one added line.
- `node --experimental-strip-types --test lib/portia-canonical-parity.test.ts lib/portia-class-migration.test.ts`: 15 pass, 0 fail.
- Evidence verification one-liner: `evidence ok`; `scan-evidence`: 0 findings.
