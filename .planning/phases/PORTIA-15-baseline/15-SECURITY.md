---
phase: 15
plan: 14
status: PASS-LOCAL-SCOPE
reviewed_commit: d6fe7e3730a3aaa07d0c24f0b09965c332e09489
reviewed_at: 2026-11-01
runtime: Node 22.13.1 / npm 10.9.2
findings:
  critical: 0
  high: 0
  medium: 2
  low: 5
  info: 3
blocked_lanes: 3
owner_acceptance_required: false
---

# Phase 15 Local Security Review

## Status

**Status: PASS for the repository-local scope defined below. Live, authenticated and mutating security behavior is BLOCKED and is NOT assured by this report.**

- Zero unresolved critical or high local findings. The only high-severity items found (four npm advisories) were fixed and verified (commit `d6fe7e3`).
- Nothing in this report is a Qloxz risk acceptance. No acceptance was needed or written.
- Three coverage lanes are BLOCKED (listed under Limitations). They are carried to named later phases, not passed.

## Coverage

Reviewed commit: `d6fe7e3730a3aaa07d0c24f0b09965c332e09489` on `design/stage-1-desktop`. Review was performed inline by the plan executor (no separate reviewer agent runtime), the same way `15-REVIEW.md` was produced.

| Area | What was covered | Method |
|---|---|---|
| API authorization | All 11 route handlers under `app/api/**` (access, content, editors, employees, employees/editor, uploads, promotion banks/requests/reviewer/status/test) and `proxy.ts` matcher | Manual cross-file read: auth check before data access, role (`canEdit` / `canManageEditors` / tab grants), body parsing, error disclosure |
| Authorization contracts (SQL) | `supabase/portia_setup.sql`, `phase12_apply.sql`, `phase14_apply.sql`: 69 `security definer` function definitions (the two apply scripts overlap `portia_setup.sql`) and 36 table definitions | Static script: every definer function sets `search_path`; every table has RLS enabled; every function in `portia_setup.sql` has `revoke ... from public` (apply scripts not separately checked); anon-callable function list; guard (`portia_has_tab_grant` / owner / editor checks) present in every authenticated mutation RPC |
| Device binding / Promotion | `lib/portia-device-binding.ts`, promotion routes, preview token HMAC use | Manual read plus existing unit tests |
| Uploads | `/api/uploads`, `lib/image-upload.ts`, storage bucket policies | Manual read: type allow-list, magic-byte match, 4 MB cap, UUID path, `upsert:false`; static policy read |
| Headers / CSP | `next.config.ts` | Manual read plus `lib/security-headers.test.ts` |
| Client exposure | Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `..._PUBLISHABLE_KEY` are referenced from client-reachable code; `PORTIA_PROMOTION_DEVICE_SECRET` is referenced only in `lib/portia-device-binding.ts` (server-only use via route handlers) | `git grep` |
| Service-role usage | No application, route, config or build code references a service-role credential. The only references are the doc line in `EDITING_GUIDE.md` ("do not use") and the opt-in env var name in `lib/portia-promotion-live.test.ts` (test is skipped unless an isolated mutation target is configured) | `git grep` |
| Tracked secrets | Tracked-file pattern scan for JWT-shaped tokens, `sb_secret_`, `sk_live/test`, AWS keys, PEM private keys, GitHub/Slack tokens: 0 matches. History scan (`git log --all -G`) for JWT / `sb_secret_` / service-role tokens: 0 matches. `.env.example` holds placeholders only (value lengths checked, values not printed). `.env.local` is git-ignored and was never read | `git grep`, `git log -G` |
| Unsafe sinks | `dangerouslySetInnerHTML`: 1 use, static `accentBootScript` constant. No `innerHTML`, `eval`, `new Function`, `document.write`. All outbound `fetch` targets are fixed hosts (Roblox, Google Sheets). Embedded frames: fixed allow-list, shared sandbox, CSP `frame-src` allow-list | `rg` / read |
| Phase 15 change set | 47 non-planning files plus 33 approved PNGs changed since base `dc02013`. Production-source delta is only two edits: one ARIA role (`components/portia-desktop.tsx`) and the `upgrade-insecure-requests` toggle (`next.config.ts`, see SEC-L5) | `git diff --name-only dc02013 HEAD` |
| Dependencies | Production audit and full (dev) inventory | `npm audit` |
| Prior review | All six `15-REVIEW.md` findings re-checked (see Carried-forward) | read |

## Commands and actual results

All run from the repository root with Node 22.13.1 first on `PATH`.

| Command | Result |
|---|---|
| `npm test` (before) | FAIL: 636 tests, 634 pass, 1 fail, 1 skipped. Failure was `lib/e2e-visual-policy.test.ts` asserting 23 visual states while the Plan 15-12 policy declares 26 |
| `npm test` (after `90f86a9`) | PASS: 636 tests, 635 pass, 0 fail, 1 skipped |
| `npm exec tsc -- --noEmit` | PASS (exit 0) |
| `npm run build` | PASS (exit 0, Next 16.4.2, all routes compiled, Proxy middleware built) |
| `npm run lint` | PASS: 0 errors, 18 warnings (all `@next/next/no-img-element`, pre-existing) |
| `npm audit --omit=dev` | PASS: 0 vulnerabilities |
| `npm audit` (before) | 21 (1 low, 16 moderate, 4 high) |
| `npm audit` (after `d6fe7e3`) | 16 (0 low, 16 moderate, 0 high, 0 critical) |
| Tests after lockfile change | `npm test` 635 pass / 0 fail; tsc, build, lint re-run green on the updated tree |
| Tracked-secret scan | 0 matches (see above) |
| Service-role check | 0 occurrences outside doc and opt-in test env name |

Security-relevant automated suites included in `npm test`: security headers/CSP (`lib/security-headers.test.ts`), editor access and unconfirmed-email denial (SEC-01), shared frame sandbox (SEC-03), Promotion API/security/reviewer/db/sheet/notification tests, device binding, image signature upload, request-JSON parsing, content limits, media URL normalization, SQL contract tests (`portia-sql.test.ts`, `portia-promotion-db.test.ts`), and the E2E target-guard / actors / diagnostics / import-boundary unit suites.

Fixes made by this plan:

1. `90f86a9` `fix(15-14)`: `lib/e2e-visual-policy.test.ts` state count 23 to 26 (stale since Plan 15-12; test-only).
2. `d6fe7e3` `fix(15-14)`: lockfile-only `npm audit fix` (no `package.json` change). Cleared brace-expansion, browserslist, js-yaml and zod high advisories. All four were dev-only transitives of the ESLint toolchain.

## Findings and dispositions

Severity is the contextual severity for this application. Where npm labels an advisory higher, both are shown.

| ID | Severity | Boundary | Evidence | Disposition |
|---|---|---|---|---|
| SEC-H1 | High (npm) -> FIXED | Dependency, dev tooling | `npm audit`: brace-expansion, browserslist, js-yaml, zod high advisories (DoS class), all `dev` in lockfile, not in production audit | **Fixed and verified** in `d6fe7e3`; audit now 0 high |
| SEC-M1 | Medium | Public anon RPC `portia_editor_is_approved(text)` (`supabase/portia_setup.sql:179-207`, called from `app/owner-login/actions.ts:37`) | Granted to `anon`; returns true for the owner email or any email in `portia_editors`. Any visitor can test whether an email is an approved editor and confirm the owner email (the owner email is also literal in `portia_owner_email()`). No rate limit beyond Supabase defaults | **Open, owned by Phase 16** (SQL truth/RLS/RPC proof) with Phase 21 closure: make sign-up approval server-side/uniform-response or add rate limit. Not fixed here: it changes the live SQL contract and needs the isolated staging project to prove |
| SEC-M2 | Medium | Browser, CSP (`next.config.ts:10-11`) | `script-src 'self' 'unsafe-inline'` and `style-src 'self' 'unsafe-inline'`; `img-src https:`, `connect-src https: wss:` are wide. Reduces defense in depth if an HTML injection ever appears. No injection sink found (see Coverage) | **Open, owned by Phase 21** (CSP tightening: nonce/hash scripts, narrow connect/img) |
| SEC-L1 | Low | `/api/uploads` | `request.formData()` parses the whole body before the 4 MB `file.size` check; no Content-Length pre-check, no rate limit. Bounded by platform request limit; caller must already be an editor with an open tab | Open, **Phase 20** (media) |
| SEC-L2 | Low | Storage policy `Editors can upload PORTIA media` (`portia_setup.sql:1654-1659`) | Policy checks `portia_can_edit()` only, not tab grants and not the `recycle/` prefix, so an editor can write any path in the bucket by calling Storage directly with their own JWT. Same accepted class as D-11 | Open, **Phase 16** (storage policy proof) |
| SEC-L3 | Low | Cookie-authenticated mutations (`/api/content`, `/api/editors`, `/api/employees`, `/api/uploads`, `/api/promotion/*`) | No `Origin`/CSRF-token check. Mitigated: Supabase session cookies are `SameSite=Lax`, mutations are PUT/PATCH/DELETE or JSON POST, device cookie is `SameSite=Lax; HttpOnly; Secure` | Open, **Phase 21** (defense in depth: Origin allow-list) |
| SEC-L4 | Low | `lib/portia-device-binding.ts:255-259` | IP bucket trusts `x-forwarded-for` / `x-real-ip` when `x-nf-client-connection-ip` is absent. On Netlify the platform header is always set, so spoofing only applies off-platform | Open, **Phase 19** (Promotion proof) |
| SEC-L5 | Low | `next.config.ts:5` | `PORTIA_E2E_ALLOW_HTTP=1` removes `upgrade-insecure-requests` even in a production build. Test-only variable; HSTS is still sent. Must never be set in the Netlify environment | Open, **Phase 22** release rehearsal checklist: assert the variable is unset in production |
| SEC-I1 | Info | `app/api/promotion/banks`, `app/api/promotion/test` | No top-level `try/catch`; a missing `PORTIA_PROMOTION_DEVICE_SECRET` or Supabase outage yields a framework 500 (no secret or stack in body). Preview/confirm paths do not apply the 64 KB body cap that command paths do | Info, **Phase 19** |
| SEC-I2 | Info | Dev dependencies | 16 moderate advisories remain, all in the ESLint toolchain (`minimatch` ReDoS chain). `npm audit` offers only `eslint@4.0.0` / `eslint-config-next@0.2.4` (breaking downgrades). Not in production audit, not shipped, processes only repo-owned files | Info, **Phase 21** (re-audit when ESLint toolchain updates) |
| SEC-I3 | Info | Owner identity | Owner email is hard-coded in `portia_owner_email()`. It is already public repo content | Info, **Phase 16** |

Critical: 0. High: 0 unresolved. Medium: 2 (owned). Low: 5 (owned). Info: 3.

## Carried-forward items from `15-REVIEW.md`

| ID | Status |
|---|---|
| CR-01 (role lanes lack server-authorized actor sessions) | **Still open. BLOCKED coverage lane**, not a product vulnerability. Authenticated participant/editor/reviewer/owner proof requires a disposable Supabase environment. Owner: Phase 16 / 19. Keeps `STAB-BASE-02` Pending |
| WR-01 (mutation guard accepted unlisted production project) | Resolved: `tests/e2e/fixtures/target-guard.ts` now blocks when production/isolated project lists are missing, malformed, duplicate or overlapping |
| WR-02 (fixed diagnostic expiry date) | Resolved: expiry evaluated against real `new Date()` |
| WR-03 (clean command not self-bootstrapping) | Resolved by `scripts/phase15-e2e-preflight.mjs` |
| WR-04 (global pixel allowance) | Test-authority item, not security; bounded per-state policy in place (`visual-policy.ts`) |
| IN-01 (promotion verifier did not bind metadata) | Resolved by Plan 15-13 |

## Limitations

- **BLOCKED: authenticated runtime authorization.** No participant, editor, reviewer or owner session was exercised. Route guards and RPC guards were verified by reading and by unit tests with fakes, not against a live Supabase project. Owner: Phase 16, Phase 19.
- **BLOCKED: database behavior under RLS.** SQL was reviewed statically. Policies, grants and `security definer` bodies were not executed against Postgres. No mutation proof. Owner: Phase 16.
- **BLOCKED: staging, production, Netlify/CDN, physical devices.** Untested; explicitly outside local assurance. Owner: Phase 16, 21, 22.
- No live exploitation, fuzzing, penetration testing, load or rate-limit testing was done. No Supabase project (production or otherwise) was contacted by this review; `npm audit` queried the npm registry only.
- Static SQL checks are pattern-based and can miss logic flaws inside function bodies. Only the guard presence and grant surface were systematically checked; bodies of the highest-privilege RPCs were spot-read.
- Review was a single-pass inline read by the executor, not an independent second reviewer. Third-party code (Next, Supabase SDK) was not audited beyond `npm audit`.
- Plan path drift: `15-14-PLAN.md` names `lib/portia-promotion-server.ts` and `supabase/migrations/`; neither exists. The canonical SQL lives in `supabase/*.sql` and the server logic in `lib/portia-promotion-api.ts` / `lib/portia-promotion-reviewer.ts` and the route handlers; those were reviewed instead.
- This is local, point-in-time assurance for commit `d6fe7e3`. It makes no claim of whole-system security.

## Disposition

**Local security status: PASS (repository-local scope).** No critical or high local finding remains unresolved; no owner acceptance is required. Medium and low findings have owning phases. The BLOCKED lanes above remain BLOCKED and must not be read as passed.
