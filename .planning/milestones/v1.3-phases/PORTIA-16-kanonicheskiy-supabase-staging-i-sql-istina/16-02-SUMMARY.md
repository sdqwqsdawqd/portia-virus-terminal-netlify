---
phase: 16-kanonicheskiy-supabase-staging-i-sql-istina
plan: 02
subsystem: database
tags: [supabase, fingerprint, pg_catalog, comparator, rls-review]
requires: []
provides:
  - supabase/fingerprint/portia_schema_fingerprint.sql (single read-only SELECT, format portia-fingerprint-v1)
  - scripts/phase16-fingerprint-compare.mjs (extractFingerprint, canonicalize, sectionHashes, diffFingerprints, inventory, CLI)
  - static read-only proof of the SQL file in lib/phase16-fingerprint.test.ts
affects: [16-10, 16-11, 16-14]
actuals:
  tokens: 8500
  tasks: 3
  commits: 3
plan_head_before: 0df19096e3a4843b1367dd18ed97777eba426ee1
plan_head_after: d86098e7a49dfe3e142eaf8ebbc629511b0173bd
commits: 3
tech-stack:
  added: []
  patterns: ["pure comparator over canonicalised JSON", "static keyword/literal proof of a read-only SQL file"]
key-files:
  created:
    - supabase/fingerprint/portia_schema_fingerprint.sql
    - scripts/phase16-fingerprint-compare.mjs
    - lib/phase16-fingerprint.test.ts
  modified: []
key-decisions:
  - "No allow-list of expected differences in the comparator; production deltas are classified by a human in 16-14. Diffs touching only the privileged API role ACL entries are tagged `info` but stay a diff (exit 1)."
  - "pg_major or search_path mismatch is `comparable:false` (exit 2), never a diff or equality."
  - "A section that is null/absent on one side only is a diff (key `<section>`), never equality."
  - "Raw cron.job command is never emitted: only sha256 (CR stripped), an is-expected flag and username."
requirements-completed: [STAB-SEC-04]
status: complete
---

# Phase 16 Plan 02: Read-only pg_catalog fingerprint and offline comparator Summary

A single read-only SELECT now produces a deterministic `portia-fingerprint-v1` jsonb (extensions allowlist, API-role facts, schema and default ACLs, relations of every kind incl. dependent views and storage tables, columns, constraints, indexes, triggers, functions, all relevant policies, publications, bucket, cron), and a pure offline comparator diffs two outputs by section and key. Offline only: no Supabase contact, no live Postgres.

## Commits
- 4497dd6 feat(16-02): offline fingerprint comparator and CLI
- 5f7a260 feat(16-02): read-only pg_catalog fingerprint SQL with static read-only tests
- d86098e fix(16-02): fingerprint SQL review fixes (coverage, safety, false diffs)

## Verification (Node 22.13.1)
- `lib/phase16-fingerprint.test.ts`: 24/24 pass.
- `npm test`: 717 tests, 716 pass, 0 fail, 1 not run (not investigated, not in files of this plan).
- `npm exec tsc -- --noEmit`: clean. `npm run lint`: 0 errors, 18 pre-existing warnings.
- Comparator tests: key-order independence, one-ACL diff names only its section/key, one-sided keys, null-section vs object, pg_major and search_path incomparable, schema error, all accepted input shapes, CLI exit codes 0/1/2 and `--summary`.
- Static SQL tests: one statement starting with `with`; no DDL/DML/txn/`set`/`do`/`call`/`lock`/`notify`/`refresh` outside literals; exactly one `query_to_xml(` whose first argument is a single string literal; its payload is a single SELECT without forbidden words; function denylist (nextval, setval, set_config, pg_notify, pg_advisory, net.http, http_post, dblink, lo_import, lo_export, pg_read_file, pg_read_binary_file, pg_terminate_backend, pg_cancel_backend, cron.schedule, cron.unschedule, vault); no `attnum`/owner/extversion/password/whole-row output; one shared `aclexplode` with the fixed grantee filter; role facts and extension allowlist pinned; header carries the `begin read only; ... rollback;` operator instruction.

## SQL review (supabase-rls-reviewer): 1 high, several medium; all fixed

| ID | Sev | Subject | Disposition |
|----|-----|---------|-------------|
| C1 | HIGH | Only `%PORTIA%` storage policies fingerprinted; a foreign permissive policy on storage.objects/buckets would be invisible | FIXED: every policy on public portia_* tables, storage.objects and storage.buckets (shared `relset`); static test forbids `polname like` |
| S1 | M | Raw `cron.job.command` could embed a bearer key | FIXED: `command_sha256` (CR stripped), `command_is_expected`, `username`; test forbids a raw `'command'` output key |
| S2 | M | Static test too weak around `query_to_xml` | FIXED: exactly one call with a single literal argument; denylist of state-changing/exfil functions over the whole file |
| S3 | M | No defence-in-depth for production run | FIXED: header instructs `begin read only; ...; rollback;` (text only, not in the query); test |
| C2 | M | Only tables and sequences | FIXED: relkind r,S,v,m,p,f for portia_*, plus public views/matviews depending on portia_* tables (pg_rewrite/pg_depend); `reloptions`, `pg_get_viewdef`, ACL |
| C3 | M | storage.objects/buckets RLS and ACL absent | FIXED: in the relations section (RLS/FORCE flags, ACL) |
| C4 | M | Function selection by name only | FIXED: also any public function with `prosecdef` or `prosrc` mentioning `portia_` |
| C5 | M | No role facts | FIXED: anon, authenticated, authenticator and the admin-API role: `rolbypassrls`, `rolsuper`, memberships (names only). `pg_roles` allowed only via explicit columns; `rolpassword`, `pg_authid`, `pg_shadow` banned |
| C6 | L/M | Triggers not covered | FIXED: non-internal triggers on public portia_*: `pg_get_triggerdef` + `tgenabled` |
| C7/C8 | L | Schema and default ACLs | FIXED: `nspacl` for public and storage; `pg_default_acl` rows for schema public (creator role name:objtype) |
| C9 | L | Publications | FIXED: `pg_publication_tables` rows for portia_* |
| F1 | M | Full extension list gives false diffs | FIXED: allowlist (pg_cron, pgcrypto, pg_net, uuid-ossp, plpgsql) with presence flag |
| F2 | M | search_path-dependent text | FIXED: `search_path` emitted top-level; comparator returns `comparable:false, reason:"search-path"` |
| F3 | M | CRLF in function bodies | FIXED: hash of `replace(prosrc, chr(13), '')` (same for the cron command hash) |
| F4 | M | "Job invisible to role" read as "job missing" | FIXED (needs live proof): cron = `{present, visible, select_privilege, rls_filtered, jobs}`; jobs query runs only if SELECT is granted; header says which role must run it |
| F5 | L | Privileged API role ACL differs by project era | FIXED in comparator: such diffs listed under `info`, still in `diff`, exit semantics unchanged |
| F6 | L | proconfig order | FIXED: elements sorted `collate "C"` |
| F7 | L | Keep `+grant` suffix, ignore grantor | KEPT |
| P1 | - | Sketch bug in RESEARCH: `order by 1` for policy roles orders by a constant | FIXED (own finding): roles sorted by name |

Residual by design: a NULL-vs-object section is a diff; a hosted project may differ in default-ACL creator role names (reported, classified by a human).

## BLOCKED (not pass)
The fingerprint SQL has NEVER run on a live Postgres. Everything below stays BLOCKED until 16-10 (calibration, assumption A11) and 16-14 (production, owner-run):
- the whole query parses and runs on PG15/17 with and without `pg_cron` (no `cron` schema: the `cron.job` text lives only inside literals);
- `query_to_xml` + `xmltable` behave as expected and stay read-only (including inside `begin read only`);
- `pg_cron` version has `cron.job.username`; `has_table_privilege('cron.job','select')` as text argument resolves;
- SQL Editor role privileges (pg_roles columns, `pg_auth_members`, `pg_publication_tables`, `storage.buckets`) and RLS on `cron.job` for the runner role (`rls_filtered` heuristic ignores table-owner bypass);
- the real `search_path` of SQL Editor vs CLI and whether output of the two is identical;
- run time and output size, and PG18 `not null` constraint noise (excluded by `contype <> 'n'`).

## Deviations from Plan
- **[Rule 1] Extensions location**: `sections.extensions` (object keyed by name) instead of a top-level field, so the comparator treats all sections uniformly; `pg_major` and `search_path` stay top-level.
- **[Rule 1] Null section**: plan did not specify null-vs-object; implemented as a diff with key `<section>`.
- **[Rule 1] Sketch bug**: `order by 1` in RESEARCH policy-roles aggregate replaced by sort on the role name.
- Reviewer-driven scope growth (sections roles, schemas, default_acls, triggers, publications; `info` tagging; search_path gate) is beyond the original plan text; recorded above.
- Task 3: the reviewer ran via the orchestrator (the executor cannot spawn agents); fixes applied afterwards as instructed.

## Known Stubs
None.

## Threat Flags
None beyond the plan's register: T-16-04 (data/secret disclosure) mitigated by catalog-only output, hashed cron command and static tests; T-16-05 (false equality) by canonicalize, `collate "C"`, null-section diff, pg_major and search_path gating; T-16-06 (mutation) by single-statement static proof plus the read-only wrapper instruction.

## Self-Check: PASSED
Files `supabase/fingerprint/portia_schema_fingerprint.sql`, `scripts/phase16-fingerprint-compare.mjs`, `lib/phase16-fingerprint.test.ts` present; commits 4497dd6, 5f7a260, d86098e verified ancestors of HEAD; no owner paths staged.
