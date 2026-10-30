# PORTIA OS browser baseline

This directory contains the Phase 15 Playwright contract. It preserves the current PORTIA OS identity; it is not a redesign lane.

## Supported runtime

- Node.js: `22.13.x` (the repository engine is `>=22.13.0 <23`).
- Playwright: `1.64.1`.
- axe Playwright adapter: `4.14.0`.
- Package manager: npm with the committed `package-lock.json`; use `npm ci` in a clean checkout.

Run `node --version` before package or browser commands. A different major version is not accepted as baseline evidence.

## Commands

```text
npm run test:e2e:smoke
npm run test:e2e
npm run test:e2e:candidates
npm run test:e2e:visual
```

Candidate capture and approved visual comparison are deliberately separate. None of these commands updates snapshots. Candidate images belong under `tests/e2e/visual-candidates/.runs/`; only owner-approved exact bytes may be copied to tracked snapshot locations.

## Projects

- `chromium-desktop`: 1440×900, DPR 1, canonical desktop lane.
- `chromium-dpr125`: 1440×900, DPR 1.25, owner-PC geometry lane.
- `firefox-desktop`: desktop behavior, diagnostics and accessibility smoke.
- `webkit-phone`: bounded iPhone candidate lane pending owner device approval.
- `chromium-phone`: bounded Android/Chromium smoke pending owner device approval.

Every project uses `ru-RU`, the Moscow timezone and dark color scheme. Actor fixtures are composed separately; the suite must not create a five-project-by-five-role cartesian matrix.

## Server and artifacts

Without `PORTIA_E2E_BASE_URL`, Playwright builds and starts the production Next.js server at `http://127.0.0.1:3000`. An external URL suppresses the local server only for an explicitly selected test target.

Authentication state, reports, traces, videos, screenshots on failure and run-specific candidates are ignored. Approved snapshots and signed Phase 15 evidence are intentionally trackable. Never attach raw headers, cookies, access tokens, private qualification answers or reviewer notes.

## Target safety

Visitor lanes are read-only and may use the local production server without staging credentials. Role lanes and any mutation-capable setup must call the fail-closed target guard in `fixtures/target-guard.ts` before navigation or fixture creation. Without a dedicated non-production project identity and explicit confirmation marker, those lanes are **BLOCKED**, not silently skipped as proof.

Mutation-capable setup requires all of the following:

- `PORTIA_E2E_MUTATION_CONFIRM=ISOLATED_TEST_PROJECT`.
- `PORTIA_E2E_TARGET_ENVIRONMENT=isolated-test`.
- `PORTIA_E2E_TARGET_ID` containing the 20-character Supabase project ref.
- `PORTIA_E2E_SUPABASE_URL` equal to the HTTPS root URL for that ref.
- `PORTIA_E2E_PRODUCTION_PROJECT_IDS` listing every known production ref; equality blocks setup.

Call `requireSafeMutationTargetFromEnvironment()` before browser navigation, authentication-state creation or database fixtures. Guard failures expose only a reason code and variable names. They never reflect a supplied URL, project ref, credential, token or cookie.
