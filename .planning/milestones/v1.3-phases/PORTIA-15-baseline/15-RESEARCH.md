# Phase 15: Восстановление контроля, контракты и браузерный baseline — Research

**Researched:** 2026-10-30  
**Domain:** brownfield stabilization, Playwright visual/behavior contracts, owner-approved design evidence  
**Confidence:** HIGH for repository state and Playwright architecture; MEDIUM for the not-yet-provisioned role fixture environment

<phase_requirements>
## Phase Requirements

| ID | Locked requirement | Research support |
|---|---|---|
| STAB-BASE-01 | Зафиксировать текущие экраны, русские тексты, состояния и переходы; художественные изменения — только по решению владельца. | Слои current-state ledger, Figma current/proposed separation, immutable app-id/font/asset inventory and explicit owner gates. `[VERIFIED: .planning/REQUIREMENTS.md; components/portia-desktop.tsx:25-31,93-115; app/layout.tsx:3-12]` |
| STAB-BASE-02 | Коммитируемый Playwright-контур для visitor, participant, editor, promo reviewer и owner на PC/phone, включая motion on/off, без production mutation. | Role fixtures, five bounded browser projects, dedicated non-production Supabase prerequisite, mutation guard, external-only network fixtures. `[VERIFIED: .planning/REQUIREMENTS.md; .planning/research/STACK.md:125-131; .planning/research/ARCHITECTURE.md:286-319]` |
| STAB-BASE-03 | Утверждённые визуальные baselines для desktop/windows/Promotion/editor/spider/web/Vivian/phone при фиксированных данных, DPR, шрифтах и randomness. | Candidate-only capture lane, deterministic runtime fixture, manifest hashes and owner promotion ledger. `[VERIFIED: .planning/REQUIREMENTS.md]` |
| STAB-BASE-04 | Figma фиксирует текущий desktop/phone UI и motion contract; предложения отделены. | Page/frame contract below resolves the stale Impeccable typography and actual on/off motion behavior without changing product code. `[VERIFIED: .planning/research/FEATURES.md:14,53; .impeccable/surfaces/components-portia-desktop-tsx.md:20; lib/accent-boot.ts:7-10]` |
| STAB-BASE-05 | Unexpected exception, hydration warning, critical network/CSP and console failures block; expected refusals end in safe Russian UI. | Automatic diagnostics fixture with explicit per-test expected-failure declarations and redacted attachments. `[VERIFIED: .planning/REQUIREMENTS.md]` |
| STAB-BASE-06 | Every phase carries requirements → contract → plan → deterministic tests → browser/visual/a11y/security → owner UAT → summary/verification. | Evidence schema, traceability statuses and terminal closure gate below. `[VERIFIED: .planning/REQUIREMENTS.md]` |
</phase_requirements>

## Summary

Phase 15 must be planned as a control-recovery phase, not a product-fix phase. The present checkout is not a trustworthy starting baseline: branch `design/stage-1-desktop` is at `640aba9437f5c3e81a87e2a3f887ac1d3bd530a3`, is 174 commits ahead of its upstream, and has four tracked changes plus four untracked groups. In particular, `package.json` and `package-lock.json` contain an uncommitted `motion@^14.6.0` addition that is unused by source and conflicts with the locked “do not introduce Motion/Framer Motion” direction. `[VERIFIED: git status --porcelain=v2 --branch and git diff, 2026-10-30; .planning/research/SUMMARY.md:78]` The planner must put a manual ownership/disposition checkpoint before any package edit; it must never reset, absorb, or silently normalize this state.

The executable browser contract should use exact `@playwright/test@1.64.1` and `@axe-core/playwright@4.14.0`, with role fixtures independent from browser projects. `[VERIFIED: npm registry; CITED: https://playwright.dev/docs/test-projects; CITED: https://playwright.dev/docs/accessibility-testing]` Use a pinned Node 22 runtime, local production build, canonical desktop Chromium, Firefox desktop smoke, WebKit phone, Chromium phone smoke, and a separate Chromium DPR 1.25 geometry project. `[VERIFIED: package.json engines; VERIFIED: .planning/research/STACK.md:125-131; VERIFIED: .planning/research/ARCHITECTURE.md:302-319]` Do not mock PORTIA’s own `/api/**` routes and call the result E2E. Browser routing may stabilize Google/Roblox/media boundaries; authenticated role/RLS work needs a dedicated, seeded non-production Supabase project. `[VERIFIED: playwright-pro core-rules-and-patterns.md; VERIFIED: repository route architecture under app/api and lib/editor-access.ts:18-49]`

Visual files are candidates until a named owner approves their exact hashes. Playwright creates a missing golden on first screenshot assertion, so candidate generation and baseline comparison must be separate commands and directories. `[CITED: https://playwright.dev/docs/test-snapshots]` Figma approval is likewise a terminal manual gate. The current GSD configuration has `parallelization.skip_checkpoints: true`, therefore the plan must not rely on an automatically skippable inline checkpoint: owner approval must be a separate terminal plan/artifact and phase verification must reject closure while either approval ledger is open. `[VERIFIED: .planning/config.json]`

**Primary recommendation:** execute five rollback-isolated plans: (1) immutable state/ownership evidence, (2) test tooling after package ownership release, (3) deterministic role/device/diagnostic contracts, (4) candidate captures plus Figma current-state contract, and (5) owner approval, byte-for-byte promotion and clean-checkout rerun.

## Architectural Responsibility Map

| Capability | Primary tier | Secondary tier | Rationale |
|---|---|---|---|
| Current-state and dirty ownership ledger | Repository/GSD evidence | Owner | Git evidence is machine-captured; ownership and disposition are human decisions. `[VERIFIED: .planning/forensics/report-20261029-192309.md]` |
| Deterministic browser/runtime | Playwright test runner | Browser context | Runner pins Node/browser/build; context pins locale, timezone, DPR, clock, storage and randomness. `[CITED: https://playwright.dev/docs/emulation; CITED: https://playwright.dev/docs/clock]` |
| Visitor and participant behavior | Browser/client | Next API + non-production Supabase | Anonymous UI owns interaction; participant identity also crosses the `portia_promo_device` cookie and server data boundary. `[VERIFIED: lib/portia-device-binding.ts:3; app/api/promotion]` |
| Editor/reviewer/owner authorization | API/backend + Supabase | Browser UI | Server RPCs determine `canEdit`, `canManageEditors` and `openTabs`; localStorage is not authority. `[VERIFIED: lib/editor-access.ts:18-49; lib/portia-promotion-reviewer.ts:16]` |
| Google/Roblox/media stability | External fixture boundary | Browser | These are external dependencies and may be intercepted with deterministic fixtures; PORTIA routes remain real. `[VERIFIED: lib/portia-employees.ts; lib/portia-promotion-sheet.ts; components/portia-desktop.tsx:27-34]` |
| Console/network/hydration/CSP policy | Automatic Playwright fixture | Browser + Next server logs | Browser events and HTTP responses are aggregated per test; server output must also be retained. `[CITED: https://playwright.dev/docs/api/class-page; CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/securitypolicyviolation_event]` |
| Candidate visual capture | Pinned browser project | GSD evidence store | A deterministic runner produces candidates and manifests; it does not approve them. `[CITED: https://playwright.dev/docs/test-snapshots]` |
| Figma/current identity and baseline promotion | Owner/design contract | Repository snapshots | Only a human owner can declare candidate hashes and current-state frames authoritative. `[VERIFIED: .planning/ROADMAP.md Phase 15 acceptance gate]` |

## Locked Project Constraints

- Preserve Russian UI, current data and accepted limitations, app IDs `archive`, `employees`, `search`, `info`, `guide`, `promotion`, `settings`, `broadcasts`, `trash`, `sheet`, `charter`, `editor`, and the current Russian labels. `[VERIFIED: components/portia-desktop.tsx:25,103-115; .planning/PROJECT.md; .planning/REQUIREMENTS.md]`
- Preserve `Golos Text`, `IBM Plex Mono`, `IBM Plex Serif` with Cyrillic support, current color/semantic identity, current icon system and the PNG spider. `[VERIFIED: app/layout.tsx:3-12; .planning/research/SUMMARY.md:10,23]`
- The actual settings contract currently exposes motion `on|off`, defaults to `on`, and uses storage key `portia-desktop-settings-v1`; it is not the older proposed `system|on|off` contract. `[VERIFIED: lib/accent-boot.ts:7-10; components/portia-desktop.tsx:93-100]`
- The unreviewed Impeccable surface proposes Golos/Unbounded/JetBrains typography and therefore is evidence of a proposal, not current-state authority. `[VERIFIED: .impeccable/surfaces/components-portia-desktop-tsx.md:20; .planning/research/FEATURES.md:14]`
- No product bug fix, UI redesign, product-code instrumentation, production data mutation, broad dependency upgrade, `npm audit fix --force`, new test runner, screenshot SaaS, Storybook rewrite, Motion adoption or SVG spider belongs to this phase. `[VERIFIED: .planning/ROADMAP.md; .planning/research/SUMMARY.md:78]`
- Accepted risks in `PROJECT.md`, including the documented content-policy limitations, are to be recorded in the contract rather than silently “fixed” by Phase 15. `[VERIFIED: .planning/PROJECT.md:122-124]`

## Recommended Plan Decomposition and Rollback Boundaries

| Plan | Automatable work | Manual/owner work | Rollback boundary / exit gate |
|---|---|---|---|
| **15-01 Control ledger** | Capture HEAD/branch/upstream, `git status --porcelain=v2`, binary patch, untracked inventory and SHA-256 manifest; write environment and accepted-limitations evidence. | Assign owner/origin/disposition to every dirty path, especially `package*.json`, `.planning/HANDOFF.json` and `.planning/milestone.lock`. | Docs/evidence only. No package/product/config edits. Exit only when every dirty path is classified. `[VERIFIED: current git state, 2026-10-30]` |
| **15-02 Tooling bootstrap** | From an owner-released `package*.json`, install exact test packages, add Playwright config/tests-only support and scripts, install pinned browsers, prove `npm ci` in a disposable clean checkout. | Decide motion patch: remove outside this phase, preserve on another owner branch/commit, or explicitly defer. It must not be absorbed into Phase 15. | One isolated tooling commit; rollback that commit only. Never reset the pre-existing worktree. `[VERIFIED: git diff; .planning/research/SUMMARY.md:78]` |
| **15-03 Executable contracts** | Add role fixtures, four projects, deterministic init, external fixtures, diagnostics, POMs and behavior/a11y specs. Run existing unit/build/lint plus browser lanes. | Provision/identify a dedicated non-production Supabase project and test accounts; approve fixture dataset with no production secrets/PII. | Test-only files plus sanitized fixture data. Gate on no production target and no unexpected diagnostics. |
| **15-04 Candidate evidence + Figma** | Capture candidate PNGs/motion key states/a11y fingerprints and manifests; export a current-state inventory for Figma mapping. | In Figma, mark every frame `CURRENT` or `PROPOSED`, review phone/desktop/motion/rest/interruption states, reject identity drift. | Candidates remain outside snapshot assertion directories. No product fix follows from review in this phase. |
| **15-05 Approval and promotion** | Verify hashes, copy only approved bytes to snapshot paths, run comparison from clean checkout, produce traceability and verification summaries. | Sign Figma revision and each visual candidate set; explicitly reject or approve. | Baseline/evidence-only commit. Phase cannot close with `PENDING` entries. `[VERIFIED: .planning/ROADMAP.md Phase 15 acceptance gate]` |

## Standard Stack

### Core

| Tool/library | Exact version | Purpose | Why this phase uses it |
|---|---:|---|---|
| Node.js | `22.13.0` | Build/test runtime | It is the minimum exact runtime inside the repository’s locked `>=22.13.0 <23` engine range; pinning one value removes host drift. `[VERIFIED: package.json]` |
| npm | `11.19.0` | Lockfile install/commands | It is the currently available npm version and must be recorded with the baseline; clean-checkout `npm ci` is the reproducibility proof. `[VERIFIED: npm.cmd --version, 2026-10-30]` |
| `@playwright/test` | `1.64.1` | Browser runner, projects, fixtures, screenshots, traces | Exact requested version; official Playwright package; registry and slopcheck verified. `[VERIFIED: npm registry; CITED: https://playwright.dev/docs/intro]` |
| `@axe-core/playwright` | `4.14.0` | In-page accessibility scans | Exact requested adapter and official Playwright accessibility integration. `[VERIFIED: npm registry; CITED: https://playwright.dev/docs/accessibility-testing]` |
| Existing `node:test` | Node 22 built-in | Preserve deterministic unit/security tests | Current `npm test` runs `lib/*.test.ts`; this phase adds browser evidence rather than migrating runners. `[VERIFIED: package.json scripts]` |

### Supporting

| Existing component | Version/source | Purpose | Rule |
|---|---|---|---|
| Next/React application | `next@16.4.2`, `react@19.2.6` | Real local production server under test | Use `npm run build && npm run start`; do not instrument product code for tests. `[VERIFIED: package.json]` |
| Dedicated non-production Supabase | Owner-provisioned; version/URL pending | Real auth/RPC/RLS and seeded role state | Required for honest editor/reviewer/owner E2E; never point mutation-capable suites at production. `[VERIFIED: repository auth/data architecture; ASSUMED]` |
| Playwright HTML/JSON/JUnit and trace artifacts | Built into Playwright | Local diagnostics/evidence | No screenshot SaaS or extra reporter package. `[CITED: https://playwright.dev/docs/test-reporters; VERIFIED: .planning/research/SUMMARY.md:78]` |

### Alternatives Rejected

| Instead of | Rejected alternative | Reason |
|---|---|---|
| Real PORTIA route handlers | `page.route('**/api/**')` happy-path stubs | This only tests a browser fiction and violates the project skill rule to mock external systems, not the app under test. `[VERIFIED: playwright-pro core-rules-and-patterns.md]` |
| Built-in screenshots | Percy/Chromatic/Applitools/pixelmatch | Extra service/dependency and not locked stack. `[VERIFIED: .planning/research/SUMMARY.md:78]` |
| Existing `node:test` + Playwright | Jest/Vitest/Cypress/Selenium/Puppeteer migration | Unnecessary runner migration expands scope. `[VERIFIED: .planning/research/SUMMARY.md:78]` |
| Dedicated fixture data | Production database cleanup/reset | Violates no-production-mutation and rollback safety. `[VERIFIED: phase constraint]` |

**Installation after the 15-01 owner gate only:**

```powershell
npm.cmd install --save-dev --save-exact @playwright/test@1.64.1 @axe-core/playwright@4.14.0
npm.cmd exec -- playwright install chromium firefox webkit
```

`npm ci`, browser install, `npm test`, `npm run build`, `npm run lint` and Playwright runs must occur under Node `22.13.0`, not the current host’s Node 24. `[VERIFIED: package.json engines; VERIFIED: node --version returned v24.21.0]`

## Package Legitimacy Audit

| Package | Registry | Age/download signal | Source repo | postinstall | slopcheck | Disposition |
|---|---|---|---|---|---|---|
| `@playwright/test@1.64.1` | npm | Established package; `103,997,198` weekly downloads at check time | `github.com/microsoft/playwright` | none reported | `[OK]` | Approved. `[VERIFIED: npm registry, 2026-10-30; CITED: https://playwright.dev/docs/intro]` |
| `@axe-core/playwright@4.14.0` | npm | Established package; `20,915,409` weekly downloads at check time | `github.com/dequelabs/axe-core-npm` | none reported | `[OK]` | Approved. `[VERIFIED: npm registry, 2026-10-30; CITED: https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright]` |

`slopcheck 0.6.1` returned `[OK]` for both names before its Windows install subprocess failed to locate an executable; registry/version/source/postinstall checks were run separately, and the repository status did not change. `[VERIFIED: slopcheck and git status command output, 2026-10-30]`

**Packages removed due to `[SLOP]`:** none.  
**Packages flagged `[SUS]`:** none.  
**Existing uncommitted package excluded from this phase:** `motion@^14.6.0`; it is an ownership issue, not an approved Phase 15 dependency. `[VERIFIED: git diff; .planning/research/SUMMARY.md:78]`

## Dirty-File Ownership and Current-State Ledger

Create `.planning/phases/PORTIA-15-baseline/evidence/15-CURRENT-STATE-LEDGER.md` and `15-DIRTY-OWNERSHIP.md`. Every row needs: exact path, tracked/untracked status, SHA-256 (or Git blob IDs for deletions), first-seen evidence, likely origin, owner, `KEEP/COMMIT-SEPARATELY/DISCARD-BY-OWNER/DEFER`, Phase-15 touch permission, recovery artifact, and blocking reason. This is the control contract, not a cleanup script.

Current rows that must be present:

| Path/group | Current state | Planning treatment |
|---|---|---|
| `.planning/HANDOFF.json` | Tracked deletion | Preserve; owner decides whether stale Phase 13 handoff is intentionally retired. `[VERIFIED: git status; .planning/forensics/report-20261029-192309.md]` |
| `.planning/milestone.lock` | Tracked modification | Preserve; do not let Phase 15 overwrite an unrelated stale session lock. `[VERIFIED: git status and diff; .planning/forensics/report-20261029-192309.md]` |
| `package.json`, `package-lock.json` | Tracked modifications adding `motion@^14.6.0` and transitive Framer Motion packages | Hard blocker for Playwright install until owner disposition. Do not merge test dependency edits into this diff. `[VERIFIED: git diff]` |
| `.planning/forensics/` | Untracked, includes requested source report | Preserve and classify as evidence; Phase 15 may cite but not absorb it silently. `[VERIFIED: git status]` |
| `.planning/milestones/v1.2-incomplete-research/` | Untracked group | Preserve, owner/classify; unrelated to Phase 15 implementation. `[VERIFIED: git status]` |
| `.planning/quick/261028-c9g-portia-promotion-1-8/` | Untracked plan | Preserve, owner/classify; it may explain Promotion state but is not a Phase 15 edit target. `[VERIFIED: git status]` |
| `.planning/ui-reviews/` | Untracked group | Preserve, owner/classify before adding new review evidence nearby. `[VERIFIED: git status]` |

Capture with read-only commands (`git rev-parse HEAD`, `git status --porcelain=v2 --branch`, `git diff --binary`, `git ls-files --others --exclude-standard`) and hash explicit files. Never run reset/checkout/clean/stash as an automated Phase 15 action. The clean-checkout proof must be made only after owner disposition, from the immutable recorded commit plus Phase 15 commits, without moving or deleting the original dirty files.

## Architecture Patterns

### System Architecture Diagram

```text
owner-approved fixture dataset + role accounts
                  |
                  v
dedicated non-production Supabase <------ Next production server (localhost)
        ^                                      ^          |
        | real auth/RPC/RLS                    | real /api | external fetch
        |                                      |          v
Playwright role fixture --> isolated context --> PORTIA UI --> Google/Roblox/media fixture boundary
        |                       |                    |
        | deterministic init    |                    +--> embedded frames are contract shells,
        | locale/time/DPR       |                         not live pixel baselines
        v                       v
diagnostics fixture ------> behavior/a11y/candidate captures
                                      |
                                      v
candidate manifest + hashes --> owner/Figma approval --> approved snapshots
                                                         |
                                                         v
                                                clean-checkout comparison
```

### Recommended Project Structure

```text
playwright.config.ts
tests/e2e/
├── fixtures/
│   ├── test.ts                    # merged role + deterministic + diagnostics fixtures
│   ├── actors.ts                  # visitor/participant/editor/reviewer/owner types
│   ├── deterministic.ts           # one init script, clock, storage, font/media readiness
│   ├── diagnostics.ts             # console/pageerror/response/requestfailed/CSP aggregation
│   └── external-routes.ts         # Google/Roblox/media only; never PORTIA /api
├── pages/
│   ├── desktop.page.ts
│   ├── promotion.page.ts
│   └── editor.page.ts
├── setup/
│   └── auth.setup.ts              # safe test accounts; writes only ignored .playwright/.auth
├── contracts/
│   ├── visitor.spec.ts
│   ├── participant.spec.ts
│   ├── editor.spec.ts
│   ├── promo-reviewer.spec.ts
│   ├── owner.spec.ts
│   ├── diagnostics-negative.spec.ts
│   └── accessibility.spec.ts
├── visual-candidates/
│   ├── desktop.spec.ts
│   ├── windows.spec.ts
│   ├── promotion.spec.ts
│   ├── editor.spec.ts
│   └── phone-motion.spec.ts
├── snapshots/                     # only owner-approved PNGs
└── data/
    ├── public-content.json
    ├── employees.json
    ├── promotion-public.json
    └── external-responses/
.playwright/.auth/                  # gitignored, never evidence
.planning/phases/PORTIA-15-baseline/evidence/
```

### Browser Projects: Bound the Matrix

| Project | Exact settings | Scope |
|---|---|---|
| `chromium-desktop` | Chromium bundled with Playwright 1.64.1; `1440x900`, DPR `1`, `ru-RU`, `Europe/Moscow`, dark scheme | Canonical behavior and all authoritative desktop PNG comparisons. `[VERIFIED: .planning/research/STACK.md:125; .planning/research/ARCHITECTURE.md:302-319]` |
| `firefox-desktop` | Firefox bundle; same CSS viewport/locale/timezone, DPR `1` | Behavioral smoke and diagnostics only; no authoritative pixel goldens. `[VERIFIED: .planning/research/STACK.md:127; .planning/research/ARCHITECTURE.md:302]` |
| `webkit-phone` | WebKit with an exact Playwright iPhone descriptor selected and recorded after owner confirms the representative phone | Primary phone touch/layout/input/Promotion behavior and approved phone candidates. Device choice remains an owner input. `[VERIFIED: .planning/research/STACK.md:128; CITED: https://playwright.dev/docs/emulation; ASSUMED]` |
| `chromium-phone` | Chromium with owner-recorded Android-style viewport/DPR/touch settings | Mobile browser-difference smoke for app/editor/media/Promotion; not a full role matrix. `[VERIFIED: .planning/research/STACK.md:129]` |
| `chromium-dpr125` | Chromium; `1440x900` CSS viewport, DPR `1.25`, otherwise identical to canonical | Geometry, web/spider/Vivian and motion key-state subset; separate snapshot suffix. `[VERIFIED: .planning/research/STACK.md:126; CITED: https://playwright.dev/docs/emulation]` |

Do not multiply five roles by five projects indiscriminately. Run visitor/participant on the relevant desktop/phone projects, role-sensitive authorization on canonical Chromium plus focused phone smoke where visible, and a small invariant subset on Firefox/DPR 1.25. Playwright projects are environment axes; actors are fixtures/contexts. `[VERIFIED: .planning/research/STACK.md:131; CITED: https://playwright.dev/docs/test-projects; CITED: https://playwright.dev/docs/auth]`

### Role Fixture Contract

| Actor | Isolation/state | Required seams | Production-mutation rule |
|---|---|---|---|
| `visitor` | Fresh anonymous context, no auth or participant cookie | Bundled initial content then real local API reads | GET/read-only. |
| `participant` | Fresh anonymous context with test-only `portia_promo_device` issued by non-production route flow | Promotion status/submit/refusal/retake states; fixed nickname and dataset | Writes only to dedicated fixture Supabase; unique namespace and cleanup there. `[VERIFIED: lib/portia-device-binding.ts:3]` |
| `editor` | Separate confirmed test account; `portia_can_edit=true`, restricted `openTabs` | Access endpoint, editor shell, allowed/closed sections, safe refusal | Fixture project only; do not reuse owner account. `[VERIFIED: lib/editor-access.ts:18-49]` |
| `promoReviewer` | Separate editor account with `openTabs` containing `promo` | Reviewer queue/status/decision authorization and privacy projection | Fixture project only. `[VERIFIED: lib/portia-promotion-reviewer.ts:16]` |
| `owner` | Separate confirmed owner account; `canManageEditors=true`, all registry tabs | Owner-only controls and authorization visibility; destructive actions need isolated seeded records | Fixture project only; never execute reset/delete against production. `[VERIFIED: lib/editor-access.ts:42]` |

Storage states go in `.playwright/.auth` and are gitignored; tests that modify shared server state require separate accounts or unique fixture records. `[CITED: https://playwright.dev/docs/auth]` If no safe Supabase target is available, visitor/read-only candidate work may proceed, but editor/reviewer/owner requirements remain `BLOCKED`, not “passed via mocks.”

### Determinism Fixture

Use exactly one `browserContext.addInitScript` so ordering is deterministic. It must run before navigation and: seed `Math.random`; provide deterministic test-only `crypto.getRandomValues`; install current PORTIA storage keys/settings; record the seed; and never be imported by `app/`, `components/` or `lib/`. Playwright documents that multiple init-script ordering is undefined. `[CITED: https://playwright.dev/docs/api/class-browsercontext]`

Use `page.clock.install({ time: ... })` before app timers are created, then advance time explicitly for transitions/polling. `[CITED: https://playwright.dev/docs/clock]` Set Playwright `locale: 'ru-RU'`, `timezoneId: 'Europe/Moscow'`, and set the web-server process `TZ=Europe/Moscow`; Promotion already formats Moscow dates explicitly while desktop clock/local strings otherwise inherit environment. `[VERIFIED: components/portia-promotion.tsx:35-40; components/portia-desktop.tsx:562,1407; CITED: https://playwright.dev/docs/emulation]`

Before any candidate image, wait for `document.fonts.ready`, decoded local images, the app’s explicit visible state, and stable external-fixture completion. Never use `waitForTimeout`; use role/text/label locators, web-first assertions and explicit clock advancement. `[VERIFIED: playwright-pro SKILL.md and core-rules-and-patterns.md; CITED: https://playwright.dev/docs/locators; CITED: https://playwright.dev/docs/test-assertions]`

### Page Objects and Semantic Locators

Page objects represent user-visible surfaces, not implementation classes. `DesktopPage` owns shortcuts/windows/taskbar; `PromotionPage` owns participant and reviewer controls; `EditorPage` owns editor tabs/save states. Keep assertions mainly in specs so requirement intent remains visible. `[CITED: https://playwright.dev/docs/pom]`

Prefer `getByRole`, `getByLabel`, and exact Russian `getByText`. Use `data-testid` only where the current canvas/illustration has no accessible user-facing hook, and add it only if the planner separately proves that a product-code change is permitted; Phase 15 should first use existing semantics/CSS only for non-interactive capture bounds. `[CITED: https://playwright.dev/docs/locators; VERIFIED: phase no-product-code constraint]`

### Diagnostics Failure Policy

Implement an automatic test-scoped fixture registered before navigation and evaluated once in `afterEach`; attach a redacted JSON ledger through `testInfo.attach` before failing. Automatic fixtures and attachments are supported Playwright patterns. `[CITED: https://playwright.dev/docs/test-fixtures]`

| Signal | Default policy | Explicit expected-case rule |
|---|---|---|
| `pageerror` | Any uncaught page exception fails. `[CITED: https://playwright.dev/docs/api/class-page]` | No blanket allowlist; a deliberate browser exception is not a valid safe refusal. |
| Console `error` | Fail. | An expected refusal must not emit a console error. |
| Console `warning` | Fail if hydration/CSP/security-related; otherwise fail unless an exact owner-reviewed allowlist row matches source, text regex, project, requirement, reason and expiry. | No prefix-only or global warning suppression. |
| Hydration | Match clear text and minified React hydration errors (including current production diagnostics); fail. React treats mismatches as bugs and variable date/random/locale are known causes. `[CITED: https://react.dev/reference/react-dom/client/hydrateRoot; CITED: https://react.dev/errors/418]` | None. |
| `requestfailed` | Fail first-party transport failures; external failures fail when the scenario requires that resource. | Expected offline/external degradation must be declared before the action and assert safe Russian UI. |
| HTTP response | Inspect responses because `requestfailed` does not fire for HTTP 4xx/5xx. Fail first-party 5xx and undeclared 4xx; apply scenario-specific policy to external responses. `[CITED: https://playwright.dev/docs/api/class-page]` | Declare exact method/path/status before action and assert the resulting Russian message/state. |
| CSP | Register `securitypolicyviolation` before app scripts; capture directive, disposition and redacted blocked origin; any undeclared violation fails. `[CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/securitypolicyviolation_event]` | Only an exact documented known violation may be temporarily allowlisted with owner/expiry. |
| Next server stderr/stdout | Retain per run; fail recognized uncaught/hydration/CSP/startup errors. | Redact secrets and cookies before evidence storage. |

The fixture must not throw asynchronously inside event handlers, because that can lose evidence and produce nondeterministic attribution. It should aggregate events and fail at teardown. `[VERIFIED: playwright-pro diagnosis-migration-and-ci.md]`

### Network and Mutation Boundaries

- `baseURL` must default to a loopback production server. Configuration must abort if host/env matches the known production Supabase or deployed site for any mutation-capable suite. `[VERIFIED: phase constraint; VERIFIED: repository environment architecture]`
- Add a browser request guard that rejects non-GET/HEAD requests outside loopback and the explicitly named fixture Supabase host. This is a second line of defense, not a substitute for server-env validation.
- Mock/stabilize only external Google Sheets gviz/embedded shell, Roblox users/thumbnails, and optional media providers. Do not baseline live Google Docs, GitHub Pages, YouTube, Giphy/Klipy pixels. `[VERIFIED: components/portia-desktop.tsx:27-34; lib/portia-employees.ts; lib/portia-promotion-sheet.ts; .planning/research/ARCHITECTURE.md:314]`
- Do not browser-mock `/api/access`, `/api/content`, `/api/employees` or `/api/promotion/**` in contract tests. Those are the application under test.
- Seed a sanitized fixed fixture dataset into the dedicated test database and namespace mutable records per worker; never include production participant answers, notes, email addresses or tokens.

## Candidate Visual and Owner-Promotion Contract

Candidate generation must use `page.screenshot()` into a run-specific evidence directory, not `expect(page).toHaveScreenshot()` against a missing golden. Playwright otherwise writes a new reference file on first execution. `[CITED: https://playwright.dev/docs/test-snapshots]`

Recommended candidate path:

```text
.planning/phases/PORTIA-15-baseline/evidence/visual-candidates/
└── <candidate-set-id>/
    ├── manifest.json
    ├── chromium-desktop/
    ├── chromium-dpr125/
    ├── webkit-phone/
    ├── a11y.json
    └── diagnostics.json
```

Each manifest row must include requirement ID, Git commit, dirty-ledger ID, test file/title, actor, state, fixture dataset revision, seed, fixed instant, Node/npm/Playwright/browser/OS, viewport, DPR, locale/timezone/TZ, color scheme, motion/spider/accent/wallpaper settings, font-ready proof, PNG SHA-256 and desired snapshot destination. `[VERIFIED: .planning/research/ARCHITECTURE.md:302-319]`

Capture at least: clean desktop; every important window open/minimized/maximized/rest state; Promotion participant gate/form/wait/result/safe errors and reviewer surface; editor shell/tab/save/error/closed-tab states; PNG spider/web/Vivian; and phone states. Static goldens use motion off/reduced and deterministic rest states. Motion-on evidence uses fixed clock advancement and key-state captures (start/key/end/rest/interruption), not a single arbitrary screenshot.

Create `evidence/15-VISUAL-APPROVAL.md` with candidate-set hash, individual PNG hash, `APPROVED/REJECTED/PENDING`, owner, timestamp, Figma frame/node and destination. Promotion copies the exact approved bytes; it must not recapture or run bulk `--update-snapshots`. After copying, run `toHaveScreenshot` comparisons in the pinned clean environment. This makes promotion reversible as a baseline-only commit and auditable by hash.

## Figma UI/Motion Contract

The Figma file is a manual deliverable, but the repository must retain its URL/file key, revision/version date, owner verdict and frame-to-test mapping in `evidence/15-FIGMA-CONTRACT.md`. `[VERIFIED: .planning/REQUIREMENTS.md STAB-BASE-04]`

Required pages:

1. `00 Evidence` — source commit, candidate hashes, viewport/DPR/accent/motion and screenshots.
2. `01 Foundations CURRENT` — actual colors, `Golos Text`, `IBM Plex Mono`, `IBM Plex Serif`, icon language, PNG spider.
3. `02 Components CURRENT` — control/window/shortcut/taskbar states including focus, hover, disabled, loading, empty, error and saving.
4. `03 Desktop CURRENT` — desktop, windows, spider/web/Vivian/search/settings across PC and phone.
5. `04 Apps + Editor CURRENT` — app IDs/labels and editor states.
6. `05 Promotion CURRENT` — participant/reviewer/owner-visible states without private answers or notes.
7. `06 Motion CURRENT` — actual `on/off` setting, start/key/end/rest, duration/easing, interruption and motion-off equivalents.
8. `07 PROPOSED — NOT BASELINE` — any desired future change, visually and structurally separated.
9. `08 APPROVED FOR BASELINE` — only owner-signed current frames linked to candidate hashes.

The stale Impeccable typography proposal and the old three-mode motion wording may be attached as historical references only. They cannot enter `CURRENT` without an explicit design-change decision, which is outside Phase 15. `[VERIFIED: .impeccable/surfaces/components-portia-desktop-tsx.md:20; .planning/research/FEATURES.md:14]`

## Accessibility Contract

Use a shared `AxeBuilder` fixture after each tested surface is deliberately revealed. Automated axe checks cover only a subset of accessibility issues, so their output is an automated contract, not an accessibility certification. `[CITED: https://playwright.dev/docs/accessibility-testing]`

Phase 15 must inventory current violations without fixing product code. Store a stable fingerprint (`rule id + impact + target + help URL`) and full redacted attachment. The executable gate fails on new/unapproved fingerprints and unexpected scan errors; known current fingerprints require an owner/technical disposition and expiry. Do not snapshot the entire raw axe result as a visual golden because it creates noisy, brittle diffs. `[CITED: https://playwright.dev/docs/accessibility-testing]`

## GSD Evidence and Traceability

Use the following evidence files; they are the planner’s required outputs, not optional notes:

```text
evidence/
├── 15-CURRENT-STATE-LEDGER.md
├── 15-DIRTY-OWNERSHIP.md
├── 15-ENVIRONMENT.md
├── 15-ROLE-DEVICE-STATE-MATRIX.md
├── 15-DIAGNOSTICS-ALLOWLIST.json
├── 15-A11Y-BASELINE.json
├── 15-FIGMA-CONTRACT.md
├── 15-VISUAL-CANDIDATES.json
├── 15-VISUAL-APPROVAL.md
├── 15-THREAT-MODEL-INPUTS.md
├── 15-TRACEABILITY.md
└── 15-VERIFICATION.md
```

Every evidence record needs: requirement IDs, immutable source commit, dirty-ledger ID, command/tool versions, environment/target, inputs/seed, result, artifact hashes/paths, automated status and manual-owner status. Use statuses `CAPTURED`, `AUTOMATED-PASS`, `MANUAL-APPROVED`, `BLOCKED`, `REJECTED`; never collapse “captured” or “test green” into owner approval.

`15-TRACEABILITY.md` maps every STAB-BASE requirement through contract section → plan/task → implementation files → deterministic/unit command → Playwright test → visual/a11y/security evidence → owner UAT → summary/verification. Phase verification must fail if a required link is blank or if Figma/visual status is `PENDING`. `[VERIFIED: .planning/REQUIREMENTS.md STAB-BASE-06]`

## Don't Hand-Roll

| Problem | Do not build | Use instead | Why |
|---|---|---|---|
| Browser runner/retries/traces/screenshots | Custom Puppeteer scripts or sleep loops | Playwright fixtures/projects/assertions/clock | Built-in isolation and web-first waiting reduce flake. `[CITED: https://playwright.dev/docs/test-fixtures; CITED: https://playwright.dev/docs/test-assertions]` |
| Accessibility engine | Custom DOM heuristics | `@axe-core/playwright` | Established rule engine, while still requiring manual review. `[CITED: https://playwright.dev/docs/accessibility-testing]` |
| Screenshot diff/promotion service | Homegrown pixel diff or SaaS | Playwright snapshots plus owner hash ledger | Keeps exact environment and approval in repository. `[CITED: https://playwright.dev/docs/test-snapshots]` |
| Auth/RLS simulator in browser | Fake `/api/access` and localStorage roles | Dedicated non-production Supabase and real routes | Browser state is not server authorization. `[VERIFIED: lib/editor-access.ts:18-49]` |
| Time polling | `waitForTimeout` | Web-first assertions and Playwright clock | Sleeps are nondeterministic and prohibited by project skill. `[VERIFIED: playwright-pro core-rules-and-patterns.md; CITED: https://playwright.dev/docs/clock]` |
| Random seed package | New dependency | One test-only init script | No extra package is needed; Playwright documents init-script seeding. `[CITED: https://playwright.dev/docs/api/class-browsercontext]` |
| CSP parser | Regex over console only | `securitypolicyviolation` event plus console/headers | The browser event exposes violated directive and blocked URI. `[CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/securitypolicyviolation_event]` |

## Common Pitfalls

### 1. Baseline poisoning from a dirty checkout
**What goes wrong:** Playwright/dependency edits become inseparable from unowned Motion and planning-state changes.  
**Prevention:** 15-01 owner disposition before package writes; exact patch/hash archive; rollback only Phase 15 commits. `[VERIFIED: current git status/diff]`

### 2. Calling a mocked PORTIA API “E2E”
**What goes wrong:** role UI passes while route authorization/RLS is never exercised.  
**Prevention:** real local Next routes plus dedicated non-production Supabase; external mocks only. `[VERIFIED: playwright-pro core-rules-and-patterns.md; VERIFIED: lib/editor-access.ts]`

### 3. Treating first screenshot creation as approval
**What goes wrong:** current rendering is silently accepted, including defects or dirty-state drift.  
**Prevention:** separate candidate command/directory, SHA-256 approval ledger, exact-byte promotion. `[CITED: https://playwright.dev/docs/test-snapshots]`

### 4. Host-dependent pixels
**What goes wrong:** Node 24, local timezone, font timing, browser revision or DPR produce irreproducible images.  
**Prevention:** Node 22.13.0, pinned Playwright browsers, Moscow TZ/ru locale, explicit DPR, fixed clock/seed and font/image readiness. `[VERIFIED: environment audit; CITED: https://playwright.dev/docs/emulation; CITED: https://playwright.dev/docs/test-snapshots]`

### 5. Overbroad diagnostic allowlists
**What goes wrong:** hydration, CSP or real server failures become permanent “known noise.”  
**Prevention:** exact source/text/project/requirement/reason/owner/expiry; expected failure declared before action and paired with Russian UI assertion.

### 6. Cross-role state leakage
**What goes wrong:** shared storage/account/participant records make authorization tests order-dependent.  
**Prevention:** isolated contexts, separate accounts, per-worker fixture namespace, no shared owner account. `[CITED: https://playwright.dev/docs/auth; CITED: https://playwright.dev/docs/test-fixtures]`

### 7. Capturing live iframe/media pixels
**What goes wrong:** Google/YouTube/GitHub/provider changes break unrelated baselines or expose external content.  
**Prevention:** assert shell/sandbox/loading behavior and use deterministic external fixtures; do not snapshot live inner pixels. `[VERIFIED: .planning/research/ARCHITECTURE.md:314]`

### 8. Shipping deterministic overrides
**What goes wrong:** seeded random/crypto or test credentials leak into production bundles.  
**Prevention:** keep all overrides under `tests/e2e`, inject only with Playwright context, and verify production source/build has no imports from test paths.

### 9. Confusing a11y inventory with compliance
**What goes wrong:** a green or baselined axe scan is presented as full accessibility proof.  
**Prevention:** state automated scope explicitly and retain manual keyboard/focus/zoom review for later requirements. `[CITED: https://playwright.dev/docs/accessibility-testing]`

### 10. Skipped owner checkpoints
**What goes wrong:** current GSD `skip_checkpoints: true` allows technical completion without design/baseline approval.  
**Prevention:** separate terminal owner-approval plan and verifier rule; no phase closure while signed artifacts are absent. `[VERIFIED: .planning/config.json; .planning/ROADMAP.md]`

## Code Examples

### Project axes without role cartesian explosion

```ts
// Source: https://playwright.dev/docs/test-projects and /docs/emulation
import { defineConfig, devices } from '@playwright/test';

const common = {
  baseURL: 'http://127.0.0.1:3124',
  locale: 'ru-RU',
  timezoneId: 'Europe/Moscow',
  colorScheme: 'dark' as const,
  trace: 'on-first-retry' as const,
};

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: true,
  retries: process.env.CI ? 1 : 0,
  projects: [
    { name: 'chromium-desktop', use: { ...common, browserName: 'chromium', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
    { name: 'firefox-desktop', use: { ...common, browserName: 'firefox', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 } },
    { name: 'webkit-phone', use: { ...devices['OWNER_APPROVED_IPHONE'], ...common, browserName: 'webkit' } },
    { name: 'chromium-phone', use: { ...devices['OWNER_APPROVED_ANDROID'], ...common, browserName: 'chromium' } },
    { name: 'chromium-dpr125', use: { ...common, browserName: 'chromium', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.25 } },
  ],
});
```

`OWNER_APPROVED_IPHONE` and `OWNER_APPROVED_ANDROID` are intentionally planning placeholders, not executable code; 15-01/owner must replace them with descriptors present in Playwright 1.64.1 and record their expanded values. `[ASSUMED]`

### Deterministic init and clock

```ts
// Sources: https://playwright.dev/docs/api/class-browsercontext and /docs/clock
await context.addInitScript(({ seed, settings }) => {
  let state = seed >>> 0;
  const next = () => ((state = (1664525 * state + 1013904223) >>> 0) / 0x1_0000_0000);
  Math.random = next;
  const originalCrypto = crypto.getRandomValues.bind(crypto);
  crypto.getRandomValues = ((array: ArrayBufferView) => {
    if (!ArrayBuffer.isView(array)) return originalCrypto(array);
    const bytes = new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(next() * 256);
    return array;
  }) as Crypto['getRandomValues'];
  localStorage.setItem('portia-desktop-settings-v1', JSON.stringify(settings));
}, { seed: 1501, settings: { accent: 'teal', wallpaper: 'radar', iconSize: 'standard', motion: 'off', spider: 'on', customAccent: '' } });

const page = await context.newPage();
await page.clock.install({ time: new Date('2026-10-30T09:00:00+03:00') });
await page.goto('/');
```

The crypto override is a test-only reproducibility device, not cryptography, and must never enter the product bundle. `[CITED: https://playwright.dev/docs/api/class-browsercontext]`

### Diagnostics aggregate

```ts
// Sources: https://playwright.dev/docs/api/class-page and
// https://developer.mozilla.org/en-US/docs/Web/API/Document/securitypolicyviolation_event
const issues: Array<Record<string, unknown>> = [];
page.on('pageerror', error => issues.push({ kind: 'pageerror', message: error.message }));
page.on('console', message => {
  if (message.type() === 'error' || message.type() === 'warning')
    issues.push({ kind: 'console', level: message.type(), text: message.text() });
});
page.on('requestfailed', request => issues.push({ kind: 'requestfailed', url: redact(request.url()), reason: request.failure()?.errorText }));
page.on('response', response => {
  if (response.status() >= 400) issues.push({ kind: 'http', status: response.status(), url: redact(response.url()) });
});
await context.addInitScript(() => {
  document.addEventListener('securitypolicyviolation', event => {
    (globalThis as unknown as { __portiaCsp: unknown[] }).__portiaCsp ??= [];
    (globalThis as unknown as { __portiaCsp: unknown[] }).__portiaCsp.push({
      effectiveDirective: event.effectiveDirective,
      disposition: event.disposition,
      blockedURI: event.blockedURI,
    });
  });
});
```

The actual fixture must redact query strings/tokens, merge CSP entries at teardown, match narrowly declared expectations, attach JSON, then fail once. It must not commit raw cookies, headers or auth state.

### Accessibility fingerprint

```ts
// Source: https://playwright.dev/docs/accessibility-testing
import AxeBuilder from '@axe-core/playwright';

const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
  .analyze();

const fingerprint = results.violations.flatMap(v =>
  v.nodes.map(n => ({ id: v.id, impact: v.impact, target: n.target, helpUrl: v.helpUrl })),
);
```

## State of the Art / Current-vs-Stale Contracts

| Stale or unsafe approach | Phase 15 current approach | Impact |
|---|---|---|
| Unreviewed Impeccable typography proposal | Current code/fonts and owner-approved Figma frames are authority | Prevents unintended identity redesign. `[VERIFIED: .planning/research/FEATURES.md:14]` |
| Proposed `system/on/off` motion wording | Record actual `on/off` behavior; place system-mode only under PROPOSED | Avoids silently rewriting settings semantics. `[VERIFIED: lib/accent-boot.ts:10]` |
| Manual screenshots from arbitrary host | Pinned project + manifest + hash + approval | Makes visual evidence reproducible. `[CITED: https://playwright.dev/docs/test-snapshots]` |
| Missing snapshots auto-created by test run | Candidate lane first, exact owner promotion second | Prevents accidental approval. `[CITED: https://playwright.dev/docs/test-snapshots]` |
| Browser-local fake roles | Real server routes and non-production Supabase roles | Exercises authorization boundaries. `[VERIFIED: lib/editor-access.ts]` |
| Console-only CSP/network checks | CSP event + console + response + requestfailed + server output | Covers both policy violations and HTTP/transport failures. `[CITED: https://developer.mozilla.org/en-US/docs/Web/API/Document/securitypolicyviolation_event; CITED: https://playwright.dev/docs/api/class-page]` |

## Assumptions Log

| # | Claim | Section | Risk if wrong |
|---|---|---|---|
| A1 | A dedicated hosted non-production Supabase project is the practical fixture solution because local Docker and Supabase CLI are absent. `[ASSUMED]` | Stack/roles/environment | Owner may prefer to provision local Docker+CLI; file/config tasks change, but production prohibition does not. |
| A2 | Node `22.13.0` and npm `11.19.0` will complete `npm ci` with the current lockfile. `[ASSUMED]` | Standard Stack | Must be proven in 15-02 before accepting environment contract. |
| A3 | The representative phone should be a Playwright WebKit device descriptor chosen by the owner. `[ASSUMED]` | Browser projects | Wrong descriptor makes phone baseline non-representative; owner decision blocks promotion. |
| A4 | Exact current axe fingerprints are not yet known and should be baselined rather than assumed zero. `[ASSUMED]` | Accessibility | If critical violations appear, they remain evidence and must be scheduled, not fixed silently in Phase 15. |

## Open Questions / Required Owner Inputs (RESOLVED)

1. **Who owns and what is the disposition of the existing `motion` patch?**
   - Known: it changes both package files, is unused by source and conflicts with locked Phase 15 stack. `[VERIFIED: git diff; .planning/research/SUMMARY.md:78]`
   - **RESOLVED:** Qloxz authorized removal of only the unused Motion dependency experiment; `15-DIRTY-OWNERSHIP.md` records the decision and the released package hashes.
2. **Which dedicated Supabase fixture target and test accounts are authorized?**
   - Known: Docker and Supabase CLI are missing locally; authenticated roles depend on real RPC/RLS. `[VERIFIED: environment audit; lib/editor-access.ts]`
   - **RESOLVED:** use a dedicated hosted isolated project, never production. The exact project/credentials remain runtime-only and are accepted only through the blocking attestation/preflight in `15-07-PLAN.md`.
3. **Which physical/representative phone is authoritative?**
   - Known: no device choice is locked in repository evidence. `[VERIFIED: repository research review]`
   - **RESOLVED:** Playwright iPhone 13 (`390×844`, DPR 3, WebKit) is the representative Phase 15 phone contract; Pixel 7 is Chromium phone smoke. Physical PC/phone UAT remains Phase 22.
4. **Who is the signing owner and what Figma file is authoritative?**
   - Known: no repository Figma file/link or signed revision exists. `[VERIFIED: .planning/research/FEATURES.md:53]`
   - **RESOLVED:** signer `Qloxz`, Figma file `GEf7NB9v2GZN80cMzRvUVQ`, revision/session and validation date are recorded in `15-FIGMA-CONTRACT.md` and `15-VISUAL-APPROVAL.md`.
5. **Which accepted diagnostic/a11y findings, if any, may be allowlisted temporarily?**
   - **RESOLVED:** only exact per-project Promotion first-visit rows are allowlisted with requirement, reason, owner and expiry; 15-08 switches expiry enforcement to the real runner wall clock. Every other event fails.

## Environment Availability

| Dependency | Required by | Available | Observed version/state | Plan/fallback |
|---|---|---:|---|---|
| Node 22.13.0 | All build/test work | ✗ | Host has `v24.21.0`, outside package engine | Provision exact Node 22.13.0 before 15-02; no nvm/fnm/Volta currently found. `[VERIFIED: command audit, 2026-10-30; package.json]` |
| npm | Lockfile/tool install | ✓ | `11.19.0`; PowerShell `npm.ps1` is blocked by execution policy, `npm.cmd` works | Use `npm.cmd` in Windows commands and record version. `[VERIFIED: command audit]` |
| Git | ledger/rollback | ✓ | `2.55.0.windows.5` | No fallback needed. `[VERIFIED: command audit]` |
| Playwright package/CLI | Browser suite | ✗ | Not in package and no global command | Install exact dev dependency after dirty-file gate. `[VERIFIED: package.json and command audit]` |
| Browser binaries | Projects | Partial/untrusted | A cache with revisions `chromium-1248`, `firefox-1555`, `webkit-2370` exists, but is not tied to 1.64.1 in this project | Run local package’s browser install; do not accept cache presence as version proof. `[VERIFIED: filesystem audit]` |
| `@axe-core/playwright` | Accessibility contract | ✗ | Not in package; lock has only an unrelated transitive `axe-core@4.11.4` | Install exact 4.14.0 adapter; do not treat transitive core as the adapter. `[VERIFIED: package-lock inspection]` |
| Docker | Local Supabase option | ✗ | Command absent | Use dedicated hosted non-production project or separately authorize provisioning. `[VERIFIED: command audit]` |
| Supabase CLI | Local fixture option | ✗ | Command absent | Same as above. `[VERIFIED: command audit]` |
| Figma file + signing owner | STAB-BASE-04/approval | ✗ | Not present in repository evidence | Manual blocking input; repository stores link/revision/verdict. `[VERIFIED: .planning/research/FEATURES.md:53]` |
| Owner-approved phone | Phone contract | ✗ | Not specified | Manual blocking input for phone baseline promotion. `[VERIFIED: repository research review]` |

**Missing dependencies with no safe fallback:** Node 22.13.0; a non-production Supabase role fixture; Figma file/signer; owner-selected phone for final promotion.  
**Work that can proceed before them:** read-only state ledger, visitor architecture, fixture schemas, candidate manifest format and draft Figma inventory.

## Security Domain

### Threat-Model Inputs

Write `evidence/15-THREAT-MODEL-INPUTS.md` as structured inputs, not as invented findings.

| Field | Repository-specific input |
|---|---|
| Assets | Baseline integrity; product identity; editor/reviewer/owner sessions and grants; participant device token; Promotion public projections; private answers/notes/future questions/reviewer identity; fixture data; screenshots/traces/reports; Supabase credentials. `[VERIFIED: app/api, lib/editor-access.ts, lib/portia-device-binding.ts, .planning/PROJECT.md]` |
| Trust boundaries | Browser↔Next routes; Next↔Supabase; Next/browser↔Google Sheets/Roblox/media/embeds; test runner↔browser; runner/server↔fixture Supabase; candidates↔owner approval↔repository baseline. `[VERIFIED: repository architecture]` |
| Attacker capabilities | Anonymous user controls request body, nickname, browser storage/UA and can clear cookies; authenticated editor may lack promo tab; promo reviewer has narrower authority than owner; third parties may fail or return hostile content. `[VERIFIED: lib/portia-device-binding.ts; lib/editor-access.ts; lib/portia-promotion-reviewer.ts]` |
| Security objectives | No production mutation; no auth/secrets/private Promotion data in committed artifacts; server-side role truth; isolated role state; fail-closed target guard; redacted diagnostics; safe Russian refusals; owner-only baseline promotion. `[VERIFIED: phase requirements and repository access model]` |
| Explicit hypotheses to validate | Wrong env could mutate production; traces can leak auth; overbroad allowlist can hide failures; fixture/real drift can lie; unapproved snapshot updates can poison baseline; test seed code can leak into bundles. These are threats to test, not confirmed vulnerabilities. `[ASSUMED]` |

### Applicable ASVS Categories

| ASVS category | Applies | Phase-15 control |
|---|---:|---|
| V2 Authentication | yes | Separate confirmed non-production accounts; auth state ignored and never committed. `[CITED: https://playwright.dev/docs/auth]` |
| V3 Session Management | yes | Isolated contexts; no cross-role storage reuse; redact cookies/tokens from traces. `[CITED: https://playwright.dev/docs/auth]` |
| V4 Access Control | yes | Exercise real `/api/access`/route/RPC boundaries for editor/reviewer/owner; localStorage never grants a role. `[VERIFIED: lib/editor-access.ts]` |
| V5 Input Validation | yes | Negative browser cases assert exact status plus safe Russian state; Phase 15 records, not fixes, product behavior. `[VERIFIED: STAB-BASE-05]` |
| V6 Cryptography | yes | Do not hand-roll product crypto; seeded `crypto.getRandomValues` exists only in test context. `[VERIFIED: phase test architecture]` |
| V8 Data Protection | yes | Sanitize fixtures and artifact attachments; no private Promotion data/auth state in Git. `[VERIFIED: repository Promotion privacy requirements]` |
| V9 Communications | yes | Capture CSP/network failures and preserve current security headers without weakening them. `[VERIFIED: next.config.ts; lib/security-headers.test.ts]` |
| V14 Configuration | yes | Pin runtime/browser/environment and fail closed on production target. `[VERIFIED: package.json; phase constraint]` |

### Known Threat Patterns

| Pattern | STRIDE | Standard mitigation |
|---|---|---|
| Production mutation from wrong test env | Tampering | Explicit host/project allowlist, local baseURL, fixture-only accounts/data, non-GET guard. |
| Auth/cookie/private-data leakage in traces | Information disclosure | Ignored auth files, redaction, restricted artifact retention, no raw headers/cookies. `[CITED: https://playwright.dev/docs/auth]` |
| Role state reused across tests | Elevation of privilege | Separate accounts and isolated contexts. `[CITED: https://playwright.dev/docs/auth]` |
| Baseline replacement without owner | Tampering/repudiation | SHA-256 candidate manifest, named signer, exact-byte promotion and Git history. |
| External content breaks CSP or injects hostile pixels | Spoofing/information disclosure | CSP event capture, external fixtures, do not baseline live iframe pixels. |
| Test determinism code enters product | Tampering | Tests-only path, import-boundary check and production build verification. |

## Sources

### Primary — repository and authoritative docs (HIGH confidence)

- `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/PROJECT.md` — locked phase scope, decisions, accepted risks and acceptance gates.
- `.planning/research/{SUMMARY,STACK,ARCHITECTURE,FEATURES,PITFALLS}.md` — stabilization architecture and identified contract drift.
- `.planning/forensics/report-20261029-192309.md`, `.planning/audits/2026-10-29-full-site-audit.md` — prior state and audit evidence.
- `package.json`, `package-lock.json`, current Git status/diff and source grep — exact repository/runtime/dependency state.
- [Playwright projects](https://playwright.dev/docs/test-projects), [emulation](https://playwright.dev/docs/emulation), [fixtures](https://playwright.dev/docs/test-fixtures), [authentication](https://playwright.dev/docs/auth), [locators](https://playwright.dev/docs/locators), [page objects](https://playwright.dev/docs/pom), [assertions](https://playwright.dev/docs/test-assertions), [clock](https://playwright.dev/docs/clock), [snapshots](https://playwright.dev/docs/test-snapshots), [accessibility](https://playwright.dev/docs/accessibility-testing), [Page events](https://playwright.dev/docs/api/class-page), [BrowserContext init](https://playwright.dev/docs/api/class-browsercontext).
- [React hydrateRoot](https://react.dev/reference/react-dom/client/hydrateRoot) and [React error 418](https://react.dev/errors/418) — hydration mismatch policy.
- [MDN securitypolicyviolation](https://developer.mozilla.org/en-US/docs/Web/API/Document/securitypolicyviolation_event) — CSP event fields/behavior.
- [Deque axe Playwright adapter](https://github.com/dequelabs/axe-core-npm/tree/develop/packages/playwright) — official adapter source.
- Local `playwright-pro` skill and its requested reference files — repository test conventions, migration and CI rules.

### Registry/tool verification (HIGH confidence)

- npm registry checks on 2026-10-30 for versions, publish metadata, downloads, source repositories and postinstall fields.
- `slopcheck 0.6.1` verdicts for both proposed packages.
- Local environment command audit on 2026-10-30.

### Assumptions requiring owner confirmation (LOW until resolved)

- Hosted non-production Supabase as the fixture implementation.
- Exact owner phone/device descriptor.
- Exact Figma file/signing owner.
- Initial axe-fingerprint disposition.

## Metadata

**Confidence breakdown:**

- Standard stack: **HIGH** — exact versions checked against official docs, npm registry, postinstall metadata and slopcheck; installation is intentionally blocked by dirty-file ownership.
- Architecture: **HIGH** for Playwright, diagnostics, candidate/promotion and repository seams; **MEDIUM** for role infrastructure because the fixture Supabase target is not provisioned.
- Current-state/rollback: **HIGH** — based on Git porcelain, diff and forensics evidence captured 2026-10-30.
- Figma/phone approvals: **LOW until owner input** — no authoritative file, signer or device is present.
- Pitfalls/security inputs: **HIGH** where source-backed; threat hypotheses are explicitly marked assumptions rather than findings.

**Research date:** 2026-10-30  
**Valid until:** 2026-11-06 for package/browser/environment details; repository-specific findings remain valid only while HEAD and dirty-ledger hashes match.
