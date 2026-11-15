---
phase: PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische
plan: 04
subsystem: database
tags: [supabase, rls, storage, migration, contract, emergency-rollback, e2e-harness]
status: complete

requires:
  - phase: PORTIA-25 plan 01
    provides: portia_content_read / portia_employees_read (expand migration 20261115000000), the 'submit' secret use
  - phase: PORTIA-25 plan 02
    provides: the editor select policy on storage.objects that Storage copy needs
  - phase: PORTIA-25 plan 03
    provides: employees list read through the signed function
provides:
  - "contract migration 20261115000100: DO guard, revoke select from anon x3, Editors can read ... x3, Editors can read PORTIA media, notify pgrst"
  - "supabase/emergency/20261115000200_portia_emergency_restore_anon_read.sql: not a migration, owner-only rollback of the anonymous read"
  - "expected-authz matrix and golden fingerprint after the contract (derived offline); contract hash pinned"
  - "offline harness stubs POST /rest/v1/rpc/portia_content_read instead of the forbidden anonymous table read"
affects: [25-07 owner checklist (apply order: expand, deploy, check, contract), 25-10 matrix freshness and supabase-rls-reviewer]

actuals:
  tokens: 6900
  tasks: 3
  commits: 3
plan_head_before: 23ec42e9ccf455fca45d4643464309d6f73917f7
plan_head_after: c513b89b37189b0fa4d4d62fed78d9955e2d294e
commits: 3

tech-stack:
  added: []
  patterns:
    - "Contract migration begins with a guard DO block that raises before any change if the expand functions or the 'submit' secret are missing"
    - "Emergency SQL lives in supabase/emergency/ (outside the migration CLI and the hash pin), first-line marker, storage listing only as comments"

key-files:
  created:
    - supabase/migrations/20261115000100_portia_closure_contract.sql
    - supabase/emergency/20261115000200_portia_emergency_restore_anon_read.sql
    - lib/phase25-contract.test.ts
    - lib/phase25-emergency.test.ts
  modified:
    - lib/portia-canonical-parity.test.ts
    - tests/e2e/fixtures/data/expected-authz.json
    - supabase/fingerprint/expected/portia.fingerprint.json
    - tests/e2e/harness/offline-supabase.cjs
    - lib/e2e-offline-supabase-harness.test.ts

key-decisions:
  - "outsider keeps the authenticated grant; the editor read policy filters rows, so the cell is rls-empty; anon is 42501"
  - "Editors read employees by portia_can_edit(), not portia_can_edit_tab('employees'): a closed tab limits writes through the API, not reads"
  - "Each policy is preceded by drop policy if exists for both the old and the new name, so the file can be run again"
  - "The offline-derived note for the golden fingerprint lives in the header of lib/phase25-contract.test.ts, not in the JSON (the golden has no free-text field and a new key could break the staging comparison)"

requirements-completed: []  # SEC-01 / SEC-05 are not checked off: nothing was applied, the anonymous refusal, the listing and the public GET are BLOCKED until an isolated staging project proves them; production is awaiting the owner

duration: about 20 min (not timed by a clock)
completed: 2026-11-15

coverage:
  - id: D1
    description: "Contract migration text: guard DO block first, three single-line anon select revokes below it, editor read policies on three tables and storage (bucket-scoped), nothing else, last line notify pgrst"
    requirement: SEC-01
    verification:
      - kind: unit
        ref: "lib/phase25-contract.test.ts (8 cases)"
        status: pass
    human_judgment: true
    rationale: "Text contract only. Execution on Postgres/RLS is BLOCKED until staging; production awaits the owner. supabase-rls-reviewer runs in plan 25-10."
  - id: D2
    description: "Permission matrix after replaying all migrations: anon 42501, outsider rls-empty, editors and owner allow for select of the three tables; storage read rls-empty for anon and outsider"
    requirement: SEC-01
    verification:
      - kind: unit
        ref: "lib/phase16-expected-authz.test.ts, lib/portia-migration-fingerprint.test.ts, lib/portia-canonical-parity.test.ts"
        status: pass
    human_judgment: true
    rationale: "Offline replay of SQL text; the golden policies and ACLs are derived from the migration, not captured on staging."
  - id: D3
    description: "Media listing closed for anon and outsider; bucket public, size, types and cache unchanged"
    requirement: SEC-05
    verification:
      - kind: unit
        ref: "lib/phase25-contract.test.ts#storage: the broad read policy goes, an editor-only one scoped to the bucket takes its place"
        status: pass
    human_judgment: true
    rationale: "Assumption A5 (public bucket serves an exact link without a select policy, listing is empty) is documentation, not a staging result: BLOCKED."
  - id: D4
    description: "Emergency file outside supabase/migrations/, marker on line 1, grant + Public can read policies restored, storage only commented, not pinned as a migration"
    requirement: SEC-01
    verification:
      - kind: unit
        ref: "lib/phase25-emergency.test.ts (6 cases)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Offline harness stubs the signed read path and no longer the anonymous table read; other .supabase.co requests still fail ENOTFOUND"
    requirement: SEC-01
    verification:
      - kind: unit
        ref: "lib/e2e-offline-supabase-harness.test.ts#with the flag only POST /rest/v1/rpc/portia_content_read ..."
        status: pass
    human_judgment: false
---

# Phase 25 Plan 04: Contract migration, emergency file, offline harness Summary

**The contract migration `20261115000100` takes the anonymous select grant and the public read policies off the three data tables and the media bucket (editors keep read), refuses to run if the signed-read functions or the secret are missing, and an owner-only emergency file outside `supabase/migrations/` puts the anonymous read back. Nothing was applied to any database.**

## Accomplishments

- Tracer (SEC-01 / SEC-05): guard DO block as the first statement, three `revoke select on table ... from anon;`, `Editors can read PORTIA content / employee profiles / manual employees` (`to authenticated using ((select public.portia_can_edit()))`), `Editors can read PORTIA media` (bucket-scoped), `notify pgrst, 'reload schema';` last. The matrix replay gives anon `42501`, outsider `rls-empty`, editors and owner `allow`; storage read `rls-empty` for anon and outsider.
- The contract keeps the editor `select` policy on `storage.objects` that Storage `copy` needs (note from 25-02); it does not touch write policies, grants of `authenticated`, the bucket, `portia_access_closure_enabled`, `auth.` or `service_role`.
- Emergency file `supabase/emergency/20261115000200_portia_emergency_restore_anon_read.sql`: line 1 `-- НЕ ПРИМЕНЯТЬ БЕЗ АВАРИИ`, `grant select ... to anon` and `Public can read ...` policies for the three tables; the media listing only as commented lines. The migration CLI and the hash test do not see it.
- Offline harness (moved from 25-01): `POST /rest/v1/rpc/portia_content_read` of the invented project answers 200 `{"code":"ok","row":null}`; the old `GET /rest/v1/portia_content` stub is gone (the contract forbids that read). The result remains an offline stub, not data.

## Task Commits

1. Task 1 (tracer): `621efd4` feat(PORTIA-25-04): contract migration closes anon read of content and employees and the media listing (SEC-01, SEC-05)
2. Task 2: `1151aca` feat(PORTIA-25-04): emergency file restoring the anonymous read, outside the migrations (D-08)
3. Task 3: `c513b89` test(PORTIA-25-04): offline harness stubs the signed content read instead of the forbidden anonymous table read (D-68)

Tracer feedback gate: the task's `<verify>` suite (eight test files, 83 tests) passed after the commit content was final; the red-window gate (`lib/*.test.ts`, two skip patterns for the known 25-10 reds) passed with 2174 pass, 0 fail, 3 skipped; `tsc --noEmit` and ESLint on the touched files were clean. Tracer verified end-to-end, expanding.

## Verification

- `node --experimental-strip-types --test --test-skip-pattern="matrix freshness: the real matrix commit" --test-skip-pattern="migration coverage: the real matrix has exactly one row" lib/*.test.ts`: 2174 pass, 0 fail, 3 skipped.
- `node node_modules/typescript/bin/tsc --noEmit`: 0 errors. ESLint on the four new/changed code files: clean.
- Old migrations untouched: only `20261115000000_*` and `20261115000100_*` differ from the plan's base commit.

## Status of the live proofs (not passes)

| Item | Status |
|------|--------|
| Schema push / applying the contract or the emergency file | BLOCKED: owner step (25-OWNER-CHECKLIST.md, plan 25-07: expand, deploy, check, contract) |
| Anonymous refusal with the public key (`42501`), `rls-empty` for outsider on Postgres | BLOCKED until an isolated staging project; production: awaiting the owner (D-18) |
| Listing of `portia-media` closed, exact public GET still works (A5) | BLOCKED until staging |
| Golden fingerprint policies and table ACLs | derived offline from migration 20261115000100, not captured on staging |
| `supabase-rls-reviewer` on the new SQL and storage policy | plan 25-10 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Offline-derived note for the golden fingerprint placed in a test comment**
- **Found during:** Task 1
- **Issue:** the plan asks for a note next to the golden changes ("выведено офлайн ... на staging не снято"), but the golden JSON has no free-text field and a new top-level key could break the staging comparison.
- **Fix:** the note is in the header of `lib/phase25-contract.test.ts` and in this summary; the golden is unchanged in shape.
- **Files modified:** lib/phase25-contract.test.ts
- **Commit:** 621efd4

Otherwise the plan was executed as written. Small additions inside the plan's scope: `drop policy if exists "Editors can read ..."` before each `create policy` so the contract can be run again.

## Known Stubs

None. The harness stub (`row: null`) is an intentional offline stub already declared as such in the harness header and its test.

## Threat Flags

None beyond the plan's threat model (T-25-15 .. T-25-19 are mitigated in text; live proof BLOCKED).

## Notes for later plans

- 25-07: the checklist must say contract goes last, as its own `psql` file, only after the deployed site reads through the server; the DO guard also checks the secret.
- 25-10: matrix freshness/coverage tests stay red until then; this plan changes `supabase/*.sql` and storage policies, so the `supabase-rls-reviewer` run covers `20261115000100` too.

## Self-Check: PASSED

- FOUND: supabase/migrations/20261115000100_portia_closure_contract.sql
- FOUND: supabase/emergency/20261115000200_portia_emergency_restore_anon_read.sql
- FOUND: lib/phase25-contract.test.ts, lib/phase25-emergency.test.ts
- FOUND commits: 621efd4, 1151aca, c513b89 (ancestors of HEAD)
