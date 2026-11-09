# Phase 15 — Existing Pattern Map

**Purpose:** map Phase 15 evidence/test files to the closest repository analogs before planning. This document describes reuse; it does not authorize product changes.

## New File Families and Closest Analogs

| Planned file/family | Role | Closest analog | Reuse |
|---|---|---|---|
| `playwright.config.ts` | Browser projects, reporters, production web server | `package.json` scripts and Node 22 engine | Keep npm, local production build, exact versions and environment guard; no second package manager |
| `tests/e2e/fixtures/test.ts` | Composed automatic diagnostics and role fixtures | `lib/portia-promotion-live.test.ts` | Fail-closed environment guard, unique run namespace, cleanup discipline and explicit roles |
| `tests/e2e/fixtures/diagnostics.ts` | Console, pageerror, request, response, CSP ledger | `lib/layout-hydration.test.ts`, `lib/security-headers.test.ts` | Hydration warning and security-header invariants become rendered-browser assertions rather than source-only checks |
| `tests/e2e/fixtures/external-routes.ts` | Stable Google/Roblox/media responses | Existing boundaries in `lib/portia-employees.ts` and `lib/portia-promotion-sheet.ts` | Mock only upstream services; never mock PORTIA `/api/**` in contract E2E |
| `tests/e2e/pages/desktop.page.ts` | User-intent desktop/window methods | `components/portia-desktop.tsx`, `lib/window-geometry.ts` | Keep app IDs, Russian accessible names and current window behavior |
| `tests/e2e/pages/editor.page.ts` | Editor role/tab/save methods | `lib/editor-access.test.ts`, `lib/editor-history.test.ts`, `lib/editor-changes.test.ts` | Preserve server authority, revision/conflict and save-state semantics |
| `tests/e2e/pages/promotion.page.ts` | Participant/reviewer user-intent methods | `lib/portia-promotion-ui.test.ts`, `lib/portia-promotion-editor.test.ts` | Preserve separate ordinary/qualification flows and safe public projection |
| `tests/e2e/specs/*.spec.ts` | Behavior/a11y/diagnostic contracts | Existing `node:test` files under `lib/` | One behavior per test, requirement IDs in titles, semantic locators, web-first assertions |
| `tests/e2e/visual-candidates/*.spec.ts` | Candidate screenshots only | `15-RESEARCH.md` candidate protocol | Use `page.screenshot`; do not auto-create goldens |
| `tests/e2e/visual/*.spec.ts` | Approved screenshot comparisons | `15-UI-SPEC.md` promotion protocol | Use `toHaveScreenshot` only after exact-byte owner promotion |
| `tests/e2e/fixtures/data/*.json` | Sanitized deterministic upstream states | Existing test-local literal fixtures in `lib/*.test.ts` | No PII, secrets, live employee rows or answer keys in public artifacts |
| `evidence/*.md/json` | Immutable current-state and approval ledgers | `.planning/forensics/report-20261029-192309.md`, Phase 14 UAT/verification artifacts | Separate captured, automated-pass and manual-approved statuses |

## Existing Test Conventions to Preserve

### Node deterministic tests

- `node:test` plus `node:assert/strict` is the established unit/static contract runner.
- Tests import TypeScript directly through `--experimental-strip-types`.
- Source-inspection tests such as `lib/layout-hydration.test.ts` and `lib/portia-desktop.test.ts` remain useful as fast preflight, but Phase 15 must add rendered browser proof rather than replacing them.
- Pure geometry remains in `lib/window-geometry.test.ts`; Playwright should assert user-visible geometry without duplicating the math implementation.

### Live target safety

`lib/portia-promotion-live.test.ts` is the strongest safety analog:

- explicit opt-in lifecycle event;
- required environment inventory;
- exact mutation guard (`ISOLATED_TEST_PROJECT`);
- unique namespaced fixtures;
- non-production service credentials only in runtime environment;
- cleanup in terminal hooks;
- a skipped live suite is never reported as proof.

Phase 15 role fixtures should use the same fail-closed posture. Browser tests must refuse mutation when the Supabase target is absent, production-like or not explicitly confirmed.

### Security and hydration

- `lib/security-headers.test.ts` names the current browser-hardening contract.
- `lib/layout-hydration.test.ts` protects the prior raw-script/hydration regression.
- Playwright diagnostics should aggregate `console`, `pageerror`, failed requests, unexpected 4xx/5xx, hydration messages and `securitypolicyviolation`; attach a redacted JSON ledger before failing.
- Allowlist entries require exact source/text/project/requirement/reason/owner/expiry. No global warning suppression.

## Locator and Page Object Pattern

1. Prefer `getByRole` with the visible Russian name.
2. Then use `getByLabel`, visible text or placeholder.
3. Add a test ID only when the UI has no stable semantic handle; do not expose implementation class names to specs.
4. Page objects expose user intent (`openApp`, `openPromotion`, `saveEditor`) and centralize locators. Assertions remain in specs so requirement intent is visible.
5. No XPath, `{ force: true }`, raw sleep or `waitForTimeout`.

## Device and Actor Composition

Browser projects are environment axes; actor fixtures are authority/state axes.

- Projects: canonical Chromium desktop, Chromium DPR 1.25, Firefox desktop smoke, WebKit phone and Chromium phone smoke.
- Actors: visitor, participant, editor, promo reviewer and owner.
- Do not create the full 5×5 cartesian matrix. Run canonical role authorization in Chromium and only the UI-relevant phone/DPR/browser subset.
- Authentication state files and traces are ignored, redacted and never committed.

## Determinism Pattern

- One `BrowserContext.addInitScript` seeds random APIs and current PORTIA storage keys before navigation.
- Install Playwright clock before application timers; advance explicitly for polling/motion key states.
- Pin `ru-RU`, Moscow timezone, browser revision, viewport, DPR, color scheme and fixture revision.
- Await `document.fonts.ready`, local image decoding and semantic state assertions before capture.
- Keep all overrides under `tests/e2e`; production code may not import test support.

## Visual Evidence Pattern

1. Generate candidate PNGs into a run-specific evidence directory.
2. Write a manifest containing source commit, dirty-ledger ID, environment, actor/state, seed/time, viewport/DPR and SHA-256.
3. Owner records `APPROVED`, `REJECTED` or `PENDING` and Figma frame/node against each hash.
4. Copy only approved bytes into snapshot directories.
5. Run Playwright comparison from the pinned clean checkout.

This separates capture from approval and prevents the Playwright first-snapshot behavior from silently creating authority.

## Plan Boundaries

| Plan | Allowed files | Explicit exclusions |
|---|---|---|
| 15-01 Control ledger | Phase evidence/docs only | No package, config or product edits |
| 15-02 Tooling bootstrap | `package*.json` only after owner release, Playwright config, ignored artifact paths, test support | No product bug fixes; do not absorb `motion` patch |
| 15-03 Executable contracts | `tests/e2e/**`, scripts needed only for tests | No visual approval, no production mutation, no own-API mocks |
| 15-04 Candidate/Figma evidence | candidate specs and Phase evidence manifests | No approved goldens and no product fixes |
| 15-05 Approval/promotion | exact approved snapshots and signed evidence/traceability | No recapture during promotion; terminal owner checkpoint required |

## Security Threat Patterns for Every Plan

- Wrong environment mutates production → exact target guard and disposable fixtures.
- Auth/cookie/private answers leak into artifacts → redaction, ignored auth files and no raw headers.
- Unapproved screenshot poisons baseline → separate candidate lane, hashes and named signer.
- Test hook reaches production bundle → import-boundary/static test.
- External fixture hides own-app failure → intercept only named third-party hosts.
- Existing dirty files are overwritten → ownership ledger and explicit per-file touch permission.

