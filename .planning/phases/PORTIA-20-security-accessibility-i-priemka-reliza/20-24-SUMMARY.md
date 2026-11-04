---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 24
subsystem: editor-notes-private-store
tags: [migration, supabase, rls, d-47, editor-notes, owner-gate, blocked-owner]
requires: [20-21]
provides:
  - supabase/migrations/20261104000100_portia_editor_notes.sql (table portia_editor_notes, RLS via portia_can_edit_tab, explicit grants, no delete); written and pinned, NOT applied anywhere
  - pinned migration hash in lib/portia-canonical-parity.test.ts
  - lib/editor-notes.ts pure helpers and D-47 tests (public projection has no note key)
  - app/api/content/notes/route.ts (GET/PUT, editor-only, open tabs only, revision CAS, no-store)
  - tests/e2e/specs/editor-notes.spec.ts (4 staging scenarios, BLOCKED until the table exists)
  - 20-EDITOR-NOTES-EVIDENCE.md (hash, real reviewer verdict, owner decision, BLOCKED staging, production pending)
affects: [supabase/migrations, lib/portia-canonical-parity.test.ts, lib/editor-notes.ts, lib/portia-content-normalize.ts, app/api/content/notes, tests/e2e/specs]
tech-stack:
  added: []
  patterns: [separate private store instead of the publicly readable portia_content, user-client queries so RLS applies, read-only guarded preflight before any push]
key-files:
  created:
    - supabase/migrations/20261104000100_portia_editor_notes.sql
    - lib/editor-notes.ts
    - lib/editor-notes.test.ts
    - app/api/content/notes/route.ts
    - tests/e2e/specs/editor-notes.spec.ts
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-EDITOR-NOTES-EVIDENCE.md
  modified:
    - lib/portia-canonical-parity.test.ts
    - lib/portia-content-normalize.ts
key-decisions:
  - "Owner chose option a (apply as-is, no hardening); the migration and hash e1866a5b...a5fd are unchanged. Reviewer suggestions (trigger, size check, full policy reset, revision cap) are deferred by the owner."
  - "The owner answered 'not sure / busy' on whether isolated staging is free, so no push, seed or any write against staging or production was run. Staging verification is BLOCKED (OWNER), not PASS."
  - "Read-only dry-run shows the only pending staging migration is 20261104000100, so a future push applies just this one."
requirements-completed: []
status: complete
duration: ~25m (this continuation)
completed: 2026-11-04
actuals:
  tokens: 30000
  tasks: 3
  commits: 2
plan_head_before: 89244de5a3b0b39722e6669d1fc689aaff2631d5
plan_head_after: 0f9c09b8b1f827a410394359fe903baf28c0a107
---

# Phase 20 Plan 24: Private editor notes store (D-47) Summary

Editor-section notes get their own table `public.portia_editor_notes` (RLS by `portia_can_edit_tab`, no anon rights, no delete) and an editor-only `/api/content/notes` route with revision compare-and-set and no-store; a D-47 test proves the public projection carries no `note` key. The migration is written, pinned, tested offline and statically reviewed, but applied nowhere: the owner chose "apply as-is" yet could not confirm that isolated staging is free, so staging checks are BLOCKED (OWNER) and production waits for the owner.

## Tasks

| Task | Name | Commit |
| ---- | ---- | ------ |
| 1 (tracer) | Offline D-47 path: migration, pinned hash, helpers, route, projection test | 35b86a4 |
| 2 | Owner decision (checkpoint, blocking-human): option a, push not authorized (staging availability unconfirmed) | no commit (recorded in evidence) |
| 3 | Staging spec, evidence; staging push NOT run | 0f9c09b (spec), evidence in the final docs commit |

Single-repo commits before the final docs commit: 2 (measured from the persisted ledger). The final `docs(20-24)` commit follows this SUMMARY.

## Verification results

- `node --experimental-strip-types --test lib/editor-notes.test.ts lib/portia-canonical-parity.test.ts`: 27 pass, 0 fail.
- `npm.cmd test`: 1250 tests, 1247 pass, 0 fail, 3 skipped (as before).
- `npm.cmd exec tsc -- --noEmit`: clean. ESLint on this plan's files: 0 errors. Full `npm.cmd run lint`: 62 problems (32 errors), all outside this plan's files, unchanged since 20-20.
- `playwright test tests/e2e/specs/editor-notes.spec.ts --list`: 4 scenarios, 20 tests across 5 projects.
- Evidence verification one-liner: `evidence ok`.
- `git diff` of `lib/portia-canonical-parity.test.ts` against PLAN_BASE: exactly one added line (the new hash); `app/api/content/route.ts`, `lib/portia-employees.ts`, `app/api/employees/route.ts` unchanged.
- Migration sha256 `e1866a5bf9e1095955384c8643e6d16d23864349822724a404e9d8433b3aa5fd` matches the pinned value.

## supabase-rls-reviewer

Run by the orchestrator (the executor cannot launch subagents). Verdict: PASS-WITH-NOTES, static only, no critical or high. Findings accepted by the owner and left unfixed: LOW-1 (`updated_by is null` passes), LOW-2 (direct PostgREST bypasses route limits), LOW-3 (`baseRevision + 1` uncapped), MEDIUM-4 (schema drift on a pre-existing differently shaped table or stray-named policies). Full text is in the evidence file. All live RLS behavior is BLOCKED.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] Strip a stored `note` key at the spread sites of `normalizePortiaContent`**
- **Found during:** Task 1 (the D-47 projection test)
- **Issue:** `normalizeBroadcasts` and the virus normalizer spread unknown fields of a record (`...item`, `...virus`), so a `note` stored in an old payload would leak into the public projection.
- **Fix:** a small `withoutNote` helper applied at those spreads (broadcasts, viruses, mutations, scientist logs); the D-47 test covers it.
- **Files modified:** `lib/portia-content-normalize.ts` (not listed in the plan's `files_modified`; it was not in the plan's prohibition list)
- **Commit:** 35b86a4

### Process notes

- The owner's decision was a mixed answer: option a for the migration, but staging availability unconfirmed, so the plan's Task 3 push branch was NOT executed. This is a deliberate owner-driven stop, not a failure.
- The read-only preflight (`attest`, `migration list`, `db push --dry-run`) ran through a throwaway script in the session scratchpad that imports `resolveStagingTarget`, `attest` and `runCli` from `scripts/phase16-staging.mjs` (all guards apply); it is not committed.
- `test:e2e:mutation` lists only roles and staging-authz specs, so `editor-notes.spec.ts` must be run by an explicit path after the migration is applied.

## Limitations and BLOCKED items

- **BLOCKED (OWNER):** staging application and all four e2e scenarios (save/read no-store; visitor and public key see nothing; closed tab; stale revision 409). Needs the owner to confirm a free staging, then `phase16-staging.mjs push` (dry-run shows only this migration pending), then the spec.
- **BLOCKED:** live RLS behavior and the route's 503 «Заметки временно недоступны.» path under an editor session (needs staging writes). A local HTTP check was not obtained: port 3000 held by the other session answered with an empty reply (curl exit 52); no own server was started.
- **OWNER ACTION (open):** production application. Status ОЖИДАЕТ ВЛАДЕЛЬЦА; file and sha256 are in the evidence file.
- **Deferred by the owner:** hardening (trigger for updated_by/updated_at/revision, `pg_column_size` check, policy reset plus shape assertion, revision cap).
- **Requirements:** STAB-EDIT-04 stays OPEN (no live proof). STAB-SEC-05 was already marked complete by earlier plans; this plan adds its static review and leaves live RLS BLOCKED.

## Commands executed against remote systems (guarded scripts, read-only, staging only)

`phase16-staging.mjs`-based `attest`, `supabase migration list` and `supabase db push --dry-run` through `runCli`. No push, no seed, no query writes, no teardown. Production was never contacted; no .env file was opened or printed.

## Known Stubs

None.

## Threat Flags

None beyond the plan's threat model (T-20-34, T-20-35, T-20-36 are mitigated in code; their live verification is BLOCKED as above).

## Self-Check: PASSED

- Migration, helpers, test, route, spec and evidence files exist; migration sha256 matches the pinned hash.
- Commits 35b86a4 and 0f9c09b are ancestors of HEAD.
- Evidence one-liner: `evidence ok`; no push or remote write was run.
