# PORTIA OS browser baseline

This directory contains the Phase 15 Playwright contract. It preserves the current PORTIA OS identity; it is not a redesign lane.

## Supported runtime

- Node.js: `22.13.x`. This is an intentional Phase 15 pin (ROADMAP; reference evidence runtime 22.13.1) and is narrower than the `>=22.13.0 <23` engine range, which defines the application and Netlify runtime.
- Playwright: `1.64.1`.
- axe Playwright adapter: `4.14.0`.
- Package manager: npm with the committed `package-lock.json`; use `npm ci` in a clean checkout.

Run `node --version` before package or browser commands. The preflight rejects any Node outside `22.13.x` with the `node-version` code, and such a run is not accepted as baseline evidence.

The tracked preflight runs before Playwright discovery. The visitor checks load the same ignored local environment files as Next.js. The mutation target check reads only the shell environment, because Playwright workers do not load environment files. Both check only variable presence and shape. Errors print variable names and stable reason codes, never supplied values.

Clean-checkout PowerShell sequence:

```powershell
npm.cmd ci
npm.cmd run test:e2e:preflight
npm.cmd run test:e2e -- --retries=0
```

## Commands

```text
npm run test:e2e:smoke
npm run test:e2e
npm run test:e2e:candidates
npm run test:e2e:visual
npm run test:e2e:mutation
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

Mutation-capable setup requires all of the following, exported in the shell for `npm run test:e2e:mutation` (values that exist only in environment files are ignored by the mutation preflight):

- `PORTIA_E2E_MUTATION_CONFIRM=ISOLATED_TEST_PROJECT`.
- `PORTIA_E2E_TARGET_ENVIRONMENT=isolated-test`.
- `PORTIA_E2E_TARGET_ID` containing the 20-character Supabase project ref.
- `PORTIA_E2E_SUPABASE_URL` equal to the HTTPS root URL for that ref.
- `PORTIA_E2E_PRODUCTION_PROJECT_IDS` listing every known production ref; equality blocks setup.
- `PORTIA_E2E_ISOLATED_PROJECT_IDS` listing the explicitly authorized isolated refs; the target must be in this list.

Public visitor preflight also requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY`, same priority as `lib/supabase/env.ts`) and a 32+ character `PORTIA_PROMOTION_DEVICE_SECRET`. `.env.example` documents formats only. Keep actual values in ignored operator-local environment files.

Call `requireSafeMutationTargetFromEnvironment()` before browser navigation, authentication-state creation or database fixtures. Guard failures expose only a reason code and variable names. They never reflect a supplied URL, project ref, credential, token or cookie.
