---
phase: 16-kanonicheskiy-supabase-staging-i-sql-istina
plan: 04
subsystem: infra
tags: [supabase, cli, npm, supply-chain, staging]
requires: []
provides:
  - supabase CLI 2.122.0 pinned exactly as a devDependency
  - supabase/config.toml with [db] major_version = 17
  - supabase/.gitignore (.branches, .temp)
affects: [16-05, 16-06, 16-07, 16-10]
actuals:
  tokens: 6000
  tasks: 3
  commits: 1
plan_head_before: bb423d140efe81b6babb787e12d600e9a415fb36
plan_head_after: 844fbf8ca600c3fac43fbb654e59e9c5bbb5e478
commits: 1
tech-stack:
  added: ["supabase@2.122.0 (devDependency, exact)"]
  patterns: ["exact-pin plus lockfile integrity for a CLI that will hold a DB URL", "init without link"]
key-files:
  created:
    - supabase/config.toml
    - supabase/.gitignore
  modified:
    - package.json
    - package-lock.json
key-decisions:
  - "D7: CLI version 2.122.0 approved by the owner and installed exactly (no ^/~)."
  - "D8: production and staging PG major are both 17; config.toml [db] major_version = 17."
  - "Repo is not linked to any project: no link, login or db reset was run; supabase/.temp/project-ref does not exist."
requirements-completed: [STAB-SEC-01, STAB-REL-04]
status: complete
---

# Phase 16 Plan 04: Pinned Supabase CLI and init without link Summary

The owner-approved Supabase CLI 2.122.0 is installed as an exact devDependency with lockfile integrity, `supabase init` produced `supabase/config.toml` (PG major 17) and `supabase/.gitignore`, and the repository stays unlinked from every project.

## Commits
- 844fbf8 chore(16-04): pin supabase CLI 2.122.0 and init config without link

## Owner checkpoint answers (Tasks 1 and 2, recorded as given, non-secret facts only)
- Task 1 (D7, CLI version): owner replied "approved 2.122.0" (2026-11-01).
- Task 2 (D1/D8, isolated project): project created on the Free plan; PG major production = 17, staging = 17 (they match, so the plan did not stop per D8); region eu-west-2 (London); Confirm email: on; expose new tables: off; secrets are stored in the owner's password manager; Branching / GitHub integration not enabled.
- No project ref, key, connection string or password is recorded in this SUMMARY or in any commit.

## Task 3 evidence
- Node 22.13.1 (reference build from the temp folder), npm 10.9.2.
- `package.json` devDependencies: `"supabase": "2.122.0"` (no range prefix).
- `package-lock.json`: `node_modules/supabase` version 2.122.0 with `integrity` present. 15 lock entries added (supabase, 8 `@supabase/cli-*` platform packages, `eciesjs`, `@ecies/ciphers`, `@noble/*`, `jose`); none of them carries `hasInstallScript`.
- `node_modules/supabase/package.json`: no `preinstall`/`install`/`postinstall`/`prepare` script (its scripts are developer build/test scripts only; bin is `dist/supabase.js`). The only `hasInstallScript` package in the lockfile is `unrs-resolver`, which was already present before this plan.
- `npx supabase --version` prints `2.122.0`.
- `npm audit` (no auto-fix): 16 moderate, 0 low, 0 high, 0 critical. No finding names a supabase package; the findings are in the existing eslint/minimatch dependency chain and were not touched. Not fixed (out of scope).
- `npx supabase init` was run with no flags: it is non-interactive by default (`--interactive` is the opt-in for IDE settings), so IDE settings were declined. Files created: `supabase/config.toml`, `supabase/.gitignore`, and the ignored `supabase/.temp/cli-latest` (a CLI version cache, covered by the `.temp` ignore rule, not committed). No other files.
- `supabase/config.toml`: `[db] major_version = 17` (already the init default, matches the owner answer). `project_id = "portia-site"` is a local label, not a remote ref.
- `supabase/.gitignore` contains `.branches` and `.temp`.
- `git diff --stat -- 'supabase/*.sql'` is empty. `supabase/.temp/project-ref` does not exist.
- Staged by explicit path only: package.json, package-lock.json, supabase/config.toml, supabase/.gitignore. No owner path was touched. No deletions in the commit.

## Verification (Node 22.13.1)
- `npm test`: 755 tests, 754 pass, 0 fail, 1 not run (pre-existing, same as 16-03).
- `npm exec tsc -- --noEmit`: clean. `npm run lint`: 0 errors, 18 pre-existing warnings.

## Deviations from Plan
None - plan executed exactly as written.

## Known Stubs
None.

## Threat Flags
None. T-16-SC mitigated (exact pin, lockfile integrity, no install scripts, audit recorded); T-16-11 mitigated (no secrets in files); T-16-12 mitigated (no link, `.temp/project-ref` absent).

## Self-Check: PASSED
- supabase/config.toml, supabase/.gitignore: found. Commit 844fbf8: ancestor of HEAD.
