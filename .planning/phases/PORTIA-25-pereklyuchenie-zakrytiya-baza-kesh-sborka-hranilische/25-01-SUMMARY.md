---
phase: PORTIA-25-pereklyuchenie-zakrytiya-baza-kesh-sborka-hranilische
plan: 01
subsystem: api
tags: [supabase, security-definer, hmac, rpc, nextjs, access-gate]

requires:
  - phase: PORTIA-24
    provides: contentBodyFor (viewer redaction), viewerOf, no-store content answer, resolveGate
  - phase: PORTIA-21
    provides: portia_access_secrets row 'submit' and the signed-submit pattern (RLS21-01)
provides:
  - "expand migration 20261115000000: portia_content_read and portia_employees_read (SECURITY DEFINER, HMAC-signed by the server, editor bypass)"
  - "lib/server-read.ts: signServerRead, serverReadMessage, serverReadRpc, ServerReadError, readContentRow"
  - "GET /api/content reads the row through the signed RPC; redaction (contentBodyFor) unchanged"
  - "lib/gate-for-request.ts: editorAccessFor, gateDependencies, resolveGateFor shared by /api/content and /api/access/status (IN-04)"
affects: [25-03 employees route, 25-04 contract migration and offline harness, 25-07 owner checklist, 25-10 matrix and review]

actuals:
  tokens: 9300
  tasks: 2
  commits: 2

tech-stack:
  added: []
  patterns:
    - "Server-signed read RPC: HMAC-SHA256(secret 'submit', '<scope>-read-v1|<issuedAt>'), window 300 s back / 60 s ahead, editor passes by portia_can_edit()"
    - "Supabase clients are passed as arguments so server modules import under node:test without next/headers"

key-files:
  created:
    - supabase/migrations/20261115000000_portia_server_read_expand.sql
    - lib/server-read.ts
    - lib/server-read.test.ts
    - lib/gate-for-request.ts
  modified:
    - app/api/content/route.ts
    - app/api/access/status/route.ts
    - lib/content-response.test.ts
    - lib/access-gate.test.ts
    - lib/portia-canonical-parity.test.ts
    - tests/e2e/fixtures/data/expected-authz.json
    - supabase/fingerprint/expected/portia.fingerprint.json
    - lib/phase23-evidence.test.ts
    - lib/phase24-evidence.test.ts

key-decisions:
  - "Signature scope labels content-read-v1 and employees-read-v1 share the existing 'submit' secret; the label separates the domains from access-submit-v1, so no new secret and no new secrets-table row"
  - "Visitor calls the RPC with the public client plus signature; editor calls with the session client and p_issued_at 0, p_signature empty, so a missing PORTIA_ACCESS_SUBMIT_SECRET does not break an editor"
  - "Failure of the read (no secret, unauthorized, client error, bad reply shape) is one 503 'Данные временно недоступны.' with no-store; only the failure kind is logged"
  - "Phase 23/24 evidence checks are bounded to migration versions <= 20261114000000 (frozen history); newer migrations are covered by the Phase 25 matrix in plan 25-10"

patterns-established:
  - "Gate dependencies are assembled in one helper (resolveGateFor); routes create the session client and pass it in"

requirements-completed: []  # SEC-01 is only partly delivered here (plan frontmatter lists it); plans 25-03, 25-04, 25-07, 25-10 finish it and the live proof is BLOCKED, so it is not checked off in REQUIREMENTS.md

coverage:
  - id: D1
    description: "GET /api/content reads the stored row for a visitor through portia_content_read with a server HMAC signature; the Phase 24 redaction is unchanged"
    requirement: SEC-01
    verification:
      - kind: unit
        ref: "lib/server-read.test.ts#readContentRow: a visitor is read by the public client with the server signature, the session client is untouched"
        status: pass
      - kind: unit
        ref: "lib/content-response.test.ts#исходник GET: шлюз, зритель, тело по зрителю, no-store на каждом ответе, публичного кэша нет"
        status: pass
    human_judgment: false
  - id: D2
    description: "Expand migration text: two SECURITY DEFINER functions, signature window and labels pinned to TypeScript, revoke before grant, additive, last line notify pgrst"
    requirement: SEC-01
    verification:
      - kind: unit
        ref: "lib/server-read.test.ts#portia_content_read: signed by the server (label, time window), editor passes without a signature, neutral refusal"
        status: pass
      - kind: unit
        ref: "lib/portia-canonical-parity.test.ts, lib/phase16-expected-authz.test.ts, lib/portia-migration-fingerprint.test.ts, lib/portia-sql.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Gate assembled by one helper in both routes; editor reads without a signature; a missing secret or refused read is a 503 without leaking the secret"
    requirement: SEC-01
    verification:
      - kind: unit
        ref: "lib/server-read.test.ts#readContentRow: a visitor without the secret is unavailable, nothing is sent, and the secret text never reaches the error"
        status: pass
      - kind: unit
        ref: "lib/access-gate.test.ts#status route keeps a missing session secret fail-closed and the view helper stays client-safe"
        status: pass
    human_judgment: false
  - id: D4
    description: "Live behavior of the two functions on Postgres (anonymous refusal, editor read, signature window) and that anon cannot read the tables"
    requirement: SEC-01
    verification: []
    human_judgment: true
    rationale: "BLOCKED: no database is available to the agent (D-03). The contract migration (plan 25-04) and the owner apply steps (25-07) prove it; this plan proves only SQL text and code."

duration: 55min
completed: 2026-11-15
status: complete
plan_head_before: 40f5d474498c3867426af2210da004e0cab2b255
plan_head_after: d175cd962eaf9cd90bf74c48aed98e71fd11abe5
---

# Phase 25 Plan 01: Server-signed content read Summary

**Visitors now get the content row from `portia_content_read`, a SECURITY DEFINER function that answers only a call signed by the site server with HMAC-SHA256 over `content-read-v1|<issuedAt>` (or an editor session), and both gate routes are built by one `resolveGateFor` helper.**

## Performance

- **Duration:** 55 min
- **Started:** 2026-11-15T17:15:00Z (approx.)
- **Completed:** 2026-11-15T18:12:00Z
- **Tasks:** 2 of 2 (Task 1 tracer, Task 2 auto)
- **Files modified:** 13 (4 created, 9 modified)

## Accomplishments

- Expand migration `20261115000000_portia_server_read_expand.sql` adds `portia_content_read` and `portia_employees_read`. It is additive: no `begin`/`commit`, no policy, no drop or alter, `portia_access_closure_enabled` untouched, `revoke all ... from public, anon, authenticated` above each grant, `set search_path = ''`, ends with `notify pgrst, 'reload schema';`.
- `lib/server-read.ts` signs the read for a visitor and calls the RPC with the public client; an editor calls with the session client and no signature. `ServerReadError` carries only `kind` (`unauthorized` or `unavailable`).
- `GET /api/content` order is now gate, viewer, `readContentRow`, `contentBodyFor`; a failed read answers 503 `{ error: "Данные временно недоступны." }` with `noStoreHeaders`, logging the kind only. PUT is untouched.
- `lib/gate-for-request.ts` replaces the copied `editorAccess` callback in `/api/content` and `/api/access/status` (closes IN-04 of Phase 24). The status route keeps its fail-closed 503 when the session secret is missing.
- Migration guards updated in the same commit as the new file: hash pin, `expected-authz.json` (6 roles, `allow`, source on the grant line, `p_issued_at: 0` and a zero signature as inert probe args), golden fingerprint (two function entries), Phase 23/24 evidence checks bounded to versions `<= 20261114000000`.
- Tests: `lib/server-read.test.ts` (19 cases) pins labels, the 300/60 window (compared with `ACCESS_SUBMIT_MAX_AGE_SECONDS` / `ACCESS_SUBMIT_MAX_AHEAD_SECONDS`), the editor bypass placed before the secret read, grants order, the `updated_by` projection, the RPC answers and fail-closed paths.

## Task Commits

1. **Task 1: tracer, signed read of the content row** - `e1958b1` (feat)
2. **Task 2: one gate helper, editor read without signature, no-secret refusal** - `d175cd9` (refactor)

Plan metadata commit: see the docs commit that adds this file.

## Verification

- Tracer feedback gate: the Task 1 `<verify>` set (9 test files, 102 tests) re-run green and `tsc` clean before Task 2 started.
- Red-window full run (Node 22.13.1, the two matrix tests skipped by pattern as planned): 2121 tests, 2118 pass, 0 fail, 3 skipped (baseline 2104).
- `tsc --noEmit`: 0 errors. ESLint over the repository: 0 errors (17 pre-existing warnings in unrelated visual-candidate scripts).
- Nothing was applied to any database; no database CLI, `psql` or live suite was run; no `.env*` file was read.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `npm exec tsc` and `npm run lint` do not start on the temporary Node 22.13.1 install**
- **Found during:** Task 1 verification
- **Issue:** the npm bundled in `%TEMP%\portia-node-v22.13.1` fails with `Cannot find module 'node-gyp/bin/node-gyp.js'`, before TypeScript or ESLint run.
- **Fix:** ran the same tools directly with that Node: `node node_modules/typescript/bin/tsc --noEmit` and `node node_modules/eslint/bin/eslint.js` (the exact command of the `lint` script has `--ignore-pattern dist --ignore-pattern .next`; the run used the config defaults, with the same 0-error result). No package was installed.
- **Files modified:** none

**2. [Rule 1 - Bug] `readContentRow` typed with `Pick<Viewer, "editor">` rejected the `level` field callers pass**
- **Found during:** Task 1 `tsc`
- **Fix:** parameter typed as the full `Viewer`.
- **Commit:** `e1958b1`

**3. Golden fingerprint note not stored in the file**
- The plan asked to mark the two golden entries as "derived offline from the migration text, not captured on staging". The golden JSON has no free-text field (adding a key would change its canonical form), so the note lives here and in this summary only. The entries were computed with the same body-hash rule as `lib/portia-migration-fingerprint.test.ts`, and their ACL was copied from the `portia_access_resolve` entry (same grants). A staging fingerprint capture stays BLOCKED.

**4. Test order**
- The plan asked for RED first. The implementation and tests were written in one pass and run together; the first run caught two assertions of mine (editor check ordering against a `declare` line) and one type error. No separate RED commit exists.

5. **SEC-01 not marked complete.** `requirements mark-complete SEC-01` was run and then reverted (`.planning/REQUIREMENTS.md` restored by path), because the requirement says an anonymous caller cannot read content and roster with the public key, which this plan does not deliver or prove (contract migration is 25-04, live checks BLOCKED).

## Auth Gates

None.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register: the new RPC surface (`portia_content_read`, `portia_employees_read` callable by `anon`) is exactly T-25-01 and is mitigated in SQL by the signature gate. `portia_employees_read` has no caller yet (plan 25-03).

## Notes for the orchestrator

- **SQL changed:** `supabase/migrations/20261115000000_portia_server_read_expand.sql` is new, so the `supabase-rls-reviewer` run at the end of the phase (plan 25-10) must cover it. Risks to look at: the editor bypass through `portia_can_edit()` inside a definer function, `stable` volatility with the secret lookup, and the digest comparison.
- **Red window is open:** `lib/security-matrix.test.ts` "matrix freshness: the real matrix commit" and "migration coverage: the real matrix has exactly one row" are expected red until plan 25-10; run the full suite with the skip patterns from the plan.
- **Owner steps remain:** the migration is not applied anywhere; the secret row `'submit'` must exist before the functions answer a visitor. The statement "anonymous cannot read the tables with the public key" is NOT made here (contract migration is plan 25-04; live proof BLOCKED).
- **Offline harness** (`tests/e2e/harness/offline-supabase.cjs`) was not touched; plan 25-04 moves it to the RPC path. Until then the offline harness still stubs the table read, not the RPC, so a data-backed offline lane that reaches the content read is not covered (not run here).

## Self-Check: PASSED

- FOUND: supabase/migrations/20261115000000_portia_server_read_expand.sql, lib/server-read.ts, lib/server-read.test.ts, lib/gate-for-request.ts
- FOUND commits: e1958b1, d175cd9
