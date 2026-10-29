# Technology Stack — v1.3 «Стабилизация PORTIA OS»

**Project:** PORTIA OS  
**Researched:** 2026-10-30  
**Research mode:** ecosystem / stabilization tooling  
**Overall confidence:** HIGH for repository state; MEDIUM-HIGH for proposed gates until they are exercised on the owner's PC, phone, and isolated Supabase staging

## Recommendation

Do not replace the application stack. Stabilize the existing Next.js 16 + React 19 + Supabase + Netlify system, make the current behavior reproducible, and add only three project-owned test tools:

1. `@playwright/test@1.64.1` for browser, visual, console/network, and role/device flows.
2. `@axe-core/playwright@4.14.0` for automated WCAG 2.2 AA checks inside Playwright.
3. `supabase@2.122.0` as a dev dependency for canonical migrations, local reset/preflight, and deployment to an isolated persistent staging branch.

Remove the uncommitted `motion@14.6.0` dependency. It is unused, was added outside an owning plan, and would create a second motion engine beside the existing CSS and `requestAnimationFrame` contracts. PORTIA's current motion is specialized, already accepted in earlier phases, and must first be frozen in Figma and Playwright before any animation abstraction is reconsidered.

The milestone should begin on the exact current production stack, capture the baseline, and only then perform a small patch-only dependency remediation. Do not combine dependency updates with architecture decomposition, desktop motion changes, or Promotion remediation.

## Repository Evidence: Implemented vs Proven

| Area | Already implemented / validated | Unproven or unresolved for v1.3 |
|---|---|---|
| Runtime | Next.js routes, React PORTIA OS, Supabase auth/RLS/RPC, Netlify build, current visual identity | No reason to redesign or migrate the runtime |
| Deterministic tests | `node:test` suite; audit records 584 tests with 583 passing and one intentionally skipped live test | Browser coverage is not mapped to requirements and roles |
| Browser checks | Historical Edge/CDP harnesses and an external `playwright-core@1.64.1` Firefox/WebKit harness exist in archived phase artifacts | No committed `playwright.config.ts`, project dependency, Page Objects, screenshot baseline, axe fixture, or repeatable release command |
| Promotion database | Guarded live test exists and checks deployed RPC inventory, RLS, atomic claim/binding, answer CAS, immutable client mode, and lease expiry | Mutating path has not run against an isolated project with service-role credentials; production deployment of the latest SQL is not proven |
| Design/motion | Strong existing PORTIA OS identity; owner previously accepted multiple desktop and wallpaper behaviors | No approved Figma state/motion contract; latest spider, Vivian, and shortcut changes remain outside a stable visual baseline |
| Security | Server auth, RLS/RPC hardening, headers, upload signature checks, and production dependency audit were reviewed | Codex Deep Security Scan never started, so it produced no findings and no pass; transitional CSP and deployed SQL still need verification |
| Dependencies | `npm audit --omit=dev` is clean | Full audit reports 4 high + 1 low development-only transitive findings; local Node 24.21.0 violates the repository's Node 22 engine |
| Motion package | Nothing | Dirty `package.json`/lockfile add `motion@14.6.0`, but no application file imports it |

## Exact Current Stack

### Runtime and build

| Technology | Declared | Installed/locked | v1.3 decision |
|---|---:|---:|---|
| Node.js | `>=22.13.0 <23` | Local research shell: `24.21.0`; Netlify: `22.13.0` | Standardize every gate on **22.13.0**. The local 24.x runtime is unsupported for this repository. |
| npm | lockfile v3 workflow | npm `11.19.0` in the research shell | Keep npm and `package-lock.json`; do not switch package manager. Run remediation under Node 22.13.0 and use `npm ci` for gates. |
| Next.js | exact `16.4.2` | `16.4.2` | Baseline on 16.4.2; patch to 16.4.3 only in the dependency phase and only with the full gate. |
| React / React DOM | exact `19.2.6` | `19.2.6` | Keep 19.2.6 for v1.3; do not take the unrelated 19.3.1 update during stabilization. |
| TypeScript | exact `5.9.3` | `5.9.3` | Keep. Do not migrate to TypeScript 7 in this milestone. |
| ESLint | exact `9.39.4` | `9.39.4` | Keep major 9; do not migrate to ESLint 10. |
| `eslint-config-next` | exact `16.4.2` | `16.4.2` | Update together with Next to 16.4.3 in the patch-only phase. |
| Tailwind CSS / PostCSS plugin | exact `4.2.1` | `4.2.1` | Keep; the application identity is mostly in existing `app/portia.css`, and a 4.3 migration has no stabilization value. |
| `@supabase/supabase-js` | `^2.117.3` | `2.117.3` | Baseline as-is; target 2.118.0 in the isolated dependency phase. |
| `@supabase/ssr` | `^0.12.7` | `0.12.7` | Keep 0.12.7; it is current in the registry at research time. |
| `@netlify/functions` | `^6.0.2` | `6.0.2` | Baseline as-is; target 6.0.3 in the isolated dependency phase. |
| Netlify | `npm run build`, Node 22.13.0 | Existing `netlify.toml` | Keep deployment platform and current Next adapter behavior. |
| `node:test` | built into Node | Used by `npm test` | Keep for pure domain, reducer, API-helper, serialization, and SQL-contract-adjacent tests. Playwright complements it; it does not replace it. |

### Current scripts

| Script | Current behavior | v1.3 role |
|---|---|---|
| `npm test` | `node --experimental-strip-types --test lib/*.test.ts` | Fast deterministic gate; keep first in every phase. |
| `npm run test:promotion-live` | Opt-in Supabase live test with an explicit isolated-project mutation guard | Staging database gate; never point the mutating mode at production. |
| `npm run build` | Next production build | Required before browser acceptance. |
| `npm run lint` | ESLint with Next core-web-vitals + TypeScript | Required; warnings need a recorded disposition, not silent expansion. |
| `npm run check` | test → build → lint | Keep, but add an explicit `tsc --noEmit` step to the milestone release gate because it is not currently in this script. |

## Recommended Development Tooling

| Tool | Exact version | Purpose | Recommendation |
|---|---:|---|---|
| `@playwright/test` | **1.64.1** | E2E, cross-browser, screenshots, traces, controlled clock, browser-console/network gates | Add as an exact dev dependency. This matches the already-used external Playwright core version and is the current registry release at research time. |
| `@axe-core/playwright` | **4.14.0** | Automated accessibility checks in rendered states | Add as an exact dev dependency; run WCAG A/AA tags including `wcag22aa`. |
| `supabase` | **2.122.0** | Local stack, migrations, seed/reset, staging link/push, database tests/types | Add as an exact dev dependency. The npm package is `supabase`, not `@supabase/cli`. |
| Playwright HTML + JSON reporters | bundled with Playwright | Human evidence plus machine-readable gate ledger | Configure both; no extra reporter package. |
| Playwright visual comparisons | bundled with Playwright | `toHaveScreenshot()` and image diffs | Use directly; do not add `pixelmatch`, Percy, Chromatic, or Applitools. |
| Existing CDP performance harnesses | repository planning artifacts | Paint/frame diagnostics for specialized wallpaper motion | Preserve or migrate narrowly into a maintained test helper; do not introduce a second general browser framework. |

Planned installation commands (not executed by this research):

```powershell
npm install --save-dev --save-exact @playwright/test@1.64.1 @axe-core/playwright@4.14.0 supabase@2.122.0
npx playwright install chromium firefox webkit
```

Do not install browser binaries globally or keep `%LOCALAPPDATA%\portia-pw-tools` as the release mechanism. Browser revisions must be resolved by the committed Playwright version.

## Project Skills and Plugins

These are engineering workflow tools, not application dependencies. Their versions and outputs should be recorded in phase evidence, but they must not leak into the production bundle.

| Tool | Current evidence | Correct use in v1.3 |
|---|---|---|
| GSD | Project config already has `plan_check`, verifier, security enforcement, `auto_advance: false`, and blocking at high severity | Make every phase follow requirements → design contract where relevant → plan check → implementation → deterministic gate → Playwright/visual/a11y/security evidence → owner checkpoint. Set `parallelization.skip_checkpoints` to false for acceptance-bearing phases and enable phase research for staging, security, motion, and release work. |
| Playwright Pro skill | Installed skill version **2.1.0** | Use Init → Generate → Review/Coverage → Fix. Enforce semantic locators, web-first assertions, isolated fixtures, Page Objects, no `waitForTimeout`, traces on retry, and explicit flow coverage. |
| Figma plugin/skills | Figma plugin **17.0.0** by Figma, Inc. | Inspect existing conventions first; build the contract from current PORTIA screens/tokens; use variables/components/prototypes and Ready for Dev handoff. Do not generate a replacement visual language. |
| Codex Security | Plugin **0.1.32** | Threat model, standard scan, diff scan, deep scan, finding validation, attack-path analysis, patch-risk assessment, fix/verify, and final artifacts. Use scan reports as evidence; ordinary code review is not a substitute. |
| Impeccable | Repository hook enabled, max 5 findings / 8000 chars; existing desktop surface contract | Keep for focused UI review and existing identity context. It does not replace Figma owner approval or Playwright screenshots. |

The suggested Dropbox/Box/email/calendar/chat plugins are not needed for this milestone. Do not install collaboration connectors merely to satisfy the engineering gate; the required evidence belongs in the repository and the approved Figma file.

## Playwright Integration and Gates

### Project structure

```text
playwright.config.ts
tests/
  e2e/
    fixtures/          # console/network/a11y/staging role fixtures
    pages/             # PORTIA desktop, editor, Promotion page objects
    smoke/
    desktop/
    promotion/
    apps/
    visual/
    accessibility/
    performance/
  flows.json           # requirement/user-flow coverage map
  snapshots/           # committed, owner-approved canonical baselines
playwright/.auth/      # ignored storageState files; never commit sessions
```

Use Page Objects around user intent, not around every DOM node. PORTIA is a single desktop surface with many app windows, so the useful boundaries are `DesktopPage`, `WindowFrame`, `EditorPage`, `PromotionParticipant`, and `PromotionReviewer`. Prefer `getByRole`, `getByLabel`, and visible Russian names. Add `data-testid` only when animation geometry or duplicated visible labels make a semantic locator impossible.

### Browser/device projects

| Project | Coverage | Gate policy |
|---|---|---|
| `chromium-desktop` | Full public desktop, apps, editor, Promotion participant/reviewer, canonical visual snapshots at 1440×900 DPR 1 | Every implementation plan touching UI |
| `chromium-dpr125` | Window drag/resize, shortcut handoff, spider/web/Vivian geometry and long-session motion at DPR 1.25 | Desktop/window/motion phases and final release |
| `firefox-desktop` | Editor selection, keyboard, windows, core app and Promotion smoke | App/editor phases and final release |
| `webkit-phone` | iPhone descriptor, touch, portrait layout, keyboard/input, app/editor navigation, Promotion participant flow | Every mobile-affecting phase and final release |
| `chromium-phone` | Android-style mobile viewport and browser differences | App/editor/media/Promotion phases; may be smoke-only outside those areas |

Do not multiply every test across every project. Run critical behavior in Chromium, engine-sensitive editor/touch cases in Firefox/WebKit, and a small release smoke in all projects. Owner UAT on the physical PC/phone remains mandatory because emulation does not prove real drag feel, DPR 1.25 motion quality, mobile keyboard behavior, or visual taste.

### Required gate lanes

1. **Deterministic:** `npm ci`, `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
2. **Browser behavior:** critical public/editor/Promotion flows with isolated fixtures and no skipped critical cases.
3. **Console/network:** fail on uncaught `pageerror`, unexpected `console.error`, hydration errors, failed first-party requests, and unexpected first-party 5xx responses. Any allowlist entry must name the third-party source and reason.
4. **Visual:** `toHaveScreenshot()` for approved states only; owner reviews every baseline creation/update.
5. **Accessibility:** axe plus keyboard, focus order, focus visibility, accessible names, live-region behavior, zoom/overflow, and touch-target checks.
6. **Motion/performance:** controlled clock/seed checks, motion-off/reduced checks, geometry assertions, and measured frame/paint/long-task budgets on the real desktop.
7. **Live staging:** RLS/RPC/concurrency tests and authenticated browser flows against isolated Supabase staging.
8. **Owner acceptance:** explicit 31/40-scenario-style ledger on physical PC and phone; automated green status cannot close aesthetic or tactile checks.

### Visual baseline rules

- Generate and compare screenshots in the same OS, browser revision, fonts, viewport, DPR, color scheme, and motion mode. Playwright warns that host OS/hardware/settings affect rendering.
- The canonical PORTIA baseline should be one declared runner, initially the owner's Windows environment with Playwright 1.64.1 Chromium. If CI is introduced later, regenerate and approve a separate pinned CI baseline rather than mixing platforms.
- Seed random behavior and stable fixture data. Mock Google Sheets/Roblox as external services for deterministic browser tests, but do not mock PORTIA's own UI/API contract in end-to-end tests.
- Disable or freeze incidental animation for static screenshots. Test full motion in a separate project with `page.clock` installed before navigation; Playwright clock controls timers, `requestAnimationFrame`, and `performance`.
- Prefer window/app-region screenshots over giant whole-desktop snapshots when the contract is local. Keep a small number of whole-desktop identity snapshots.
- Never mass-run `--update-snapshots`. Every changed image needs a reason, Figma comparison, and owner approval. Missing snapshots must fail rather than silently becoming accepted baselines.
- Preserve dynamic content exclusions narrowly. Do not hide the spider, assistant, or application region that the test is supposed to protect.

### Accessibility gate

Run axe on every important revealed state, not only the initial desktop: open windows, menus, dialogs, editor tabs, Promotion errors, reviewer queues, empty/loading/error states, and phone navigation. Use:

```text
wcag2a, wcag2aa, wcag21a, wcag21aa, wcag22aa
```

Block new critical/serious violations. Existing exceptions, if any, need a fingerprinted ledger with owner, reason, and expiry; do not broadly exclude an application subtree. Automated axe checks are partial by design, so keyboard-only and manual screen-reader/zoom checks remain release evidence.

### Motion and media performance

- Preserve the existing `html[data-motion="full"|"reduce"]` contract and the system fallback when the attribute is absent.
- Functional E2E uses motion reduced/frozen; motion specs use an explicit clock and deterministic random seed.
- Validate that motion-off has zero running PORTIA animations and no spider loop; test tab visibility pause/resume and React effect cleanup.
- Keep transform/opacity animation on compositor-friendly layers. Existing evidence shows the gel rewrite reduced painting dramatically; a new abstraction must not reverse that result.
- Measure representative archive/reference/Promotion images, cache headers, preload only for active media, lazy background collections, fallback behavior, and CSP. Use Playwright resource timing and the existing Chromium trace technique; do not add Lighthouse as a hard dependency for this milestone.

## Figma UI/Motion Contract

Use Figma as the approval and handoff contract, not as a redesign exercise or runtime dependency.

### Required file structure

1. **00 Evidence** — current accepted desktop/phone screenshots with commit SHA, viewport, DPR, accent, and motion mode.
2. **01 Foundations** — existing PORTIA colors, typography, spacing, borders, shadows, window chrome, and accent modes derived from code.
3. **02 Components** — window states, taskbar item, shortcut states, buttons/fields, app list/empty/loading/error states, dialogs/toasts.
4. **03 Desktop contracts** — windows, icon handoff, spider/web, Vivian, wallpaper layers, search, settings.
5. **04 App/editor contracts** — archive, employees, broadcasts, information, guide, editor and mobile navigation.
6. **05 Promotion** — participant and reviewer states, separate qualification/task flows, errors, cooldown, timer, bank CRUD/preview.
7. **06 Motion** — state diagrams and annotated timelines for open/close/minimize/restore, shortcut transfer, spider gait/path/waves, web, Vivian, reduced/off behavior.
8. **07 Approved for dev** — only owner-approved frames/components, marked Ready for Dev with links to requirement IDs and Playwright snapshot names.

Use Figma variables for existing accent/theme tokens and component variants for state matrices. Record motion duration, easing, start/end geometry, transform origin, opacity/brightness, interrupt/cancel behavior, and full/reduced/off outcomes. A Figma prototype demonstrates intended sequencing, but it cannot prove the runtime spider physics or performance; those remain code + Playwright/trace + owner-UAT contracts.

The Figma workflow is: inspect current file/code conventions → import current evidence → model existing components/tokens → annotate states and motion → owner review → mark Ready for Dev → implement → compare Playwright screenshots and measured motion → owner accept. Do not use Code Connect, a token-sync package, Storybook, or generated replacement components in v1.3 unless a later scoped plan proves a need.

## Codex Security Gate

### Capabilities to use

| Capability | Milestone use |
|---|---|
| Threat model | Freeze trust boundaries for public visitor, participant device token, editor, promo reviewer, owner, Supabase service role, Google/Roblox, Netlify and storage. |
| Security diff scan | Run on each security-sensitive phase diff after deterministic tests; cover deleted files and follow changed behavior into supporting code. |
| Standard/deep repository scan | Run before release after architecture, Promotion, CSP, dependency, and SQL work have settled. |
| Finding discovery + validation + attack path | Distinguish exploitable issues from hypotheses; retain exact source evidence and unresolved coverage. |
| Patch risk + fix/verify | Require for auth, RLS/RPC, CSP, upload, device binding, concurrency, and migration fixes. |
| Finding tracking/write-up | Use only for confirmed findings that need durable remediation; do not turn every warning into product scope. |

### Managed-permission limitation

The forensic report is authoritative about the previous attempt: Deep Security Scan never started because the task had an unmanaged/unrestricted filesystem permission profile. Therefore there are **no deep-scan findings and no deep-scan pass** to carry forward.

Codex Security 0.1.32 expects deep workers to run under its reserved `codex_security_deep_scan_worker` permission profile and requires a Codex executable/host that supports permission-profile configuration and allowance checks. The correct response to an unsupported or policy-rejected profile is to run the scan from a supported managed Codex Security session or follow the administrator guidance. Do not weaken deny rules, select a broader sandbox, or label an ordinary review as a deep scan.

Release evidence must include the generated, sealed Codex Security `report.md`, `scan-manifest.json`, `findings.json`, and `coverage.json`, with incomplete coverage explicitly identified. An empty finding list is acceptable only after the scan completes and seals its artifacts.

## Supabase Staging and Live Tests

### Environment decision

Use a **persistent Supabase branch named staging** with its own database, Auth, API URL, anon/publishable key, service-role key, test users, and seed data. Supabase documents persistent branches as the branch type for staging/QA; branches are isolated and use separate credentials. If the account cannot provision persistent branches, create a separate hosted staging project, but never use production as the mutating test target.

Keep Netlify production unchanged. Playwright can run the local Next production build on port 3124 against staging credentials. A Netlify Deploy Preview is optional, not a release prerequisite; if it is later used, configure context-specific staging variables and never expose the service-role key to the browser/build output.

### Canonical SQL workflow

The repository currently has rerunnable owner-run files (`portia_setup.sql`, `phase12_apply.sql`, `phase14_apply.sql`) but no canonical `supabase/config.toml` + ordered `supabase/migrations/` chain. v1.3 should establish migrations without redesigning the schema:

1. Capture the accepted current schema as a reviewed baseline migration.
2. Convert later Phase 12/14 hardening into ordered, idempotent-forward migrations where appropriate; preserve owner preflight/rollback notes as operational runbooks.
3. Add non-sensitive staging seed data and role fixtures; never copy production identities, content, tokens, or storage objects by default.
4. Prove `supabase db reset` from zero locally.
5. Run database tests locally, then `supabase db push --dry-run` and `supabase migration list` against staging.
6. Apply to staging, run RLS/RPC/concurrency + browser gates, and compare schema/migration history.
7. Apply the exact reviewed migrations to production only at an owner checkpoint; perform read-only post-deploy inventory/smoke checks.

Do not use dashboard-only ad hoc SQL as the source of truth after this transition. Do not add Prisma, Drizzle, or another ORM/migration system.

### Existing live test contract

`lib/portia-promotion-live.test.ts` already contains the right safety boundary:

- Without direct invocation it skips and tells the operator to use an isolated test project.
- `READ_ONLY_PREFLIGHT` verifies 18 deployed RPC signatures with URL + anon key.
- Mutating mode requires URL, anon key, service-role key, and the exact guard `PORTIA_PROMO_LIVE_CONFIRM=ISOLATED_TEST_PROJECT`.
- Fixtures use a unique `__portia_live_*` prefix and clean up users, editors, requests, attempts, results, audit events, bindings, and buckets.
- Tests cover promo reviewer vs anon/non-promo access, parallel claim, atomic first binding/admission, answer CAS/idempotence, immutable client mode, and expired heartbeat lease.

Retain this test and add the missing staging evidence around it:

| Role/client | Required proof |
|---|---|
| anon participant | Safe status only; no banks, answers, reviewer identity, notes, or private table reads |
| authenticated user without editor row | No editor or promo access |
| approved editor without `promo` grant | Ordinary allowed tabs work; Promotion reviewer APIs remain denied |
| promo reviewer A/B | Concurrent claim has one winner; release/reject/delete/grade/finalize and bank CRUD obey ownership and grants |
| owner | Owner-only grants/reset/deployment gates work; owner flow does not mask reviewer-policy failures |
| service role | Used only by the test fixture/cleanup process; never placed in `NEXT_PUBLIC_*`, Playwright storage state, screenshots, traces, or reports |

Playwright authenticated reviewer flows should use disposable staging accounts created by setup and deleted in teardown. Use a unique worker/run namespace and serialize only the tests that intentionally race the same record. Google Sheets and Roblox remain external contract-smoke dependencies; deterministic staging tests should use controlled fixtures rather than depend on live third-party availability.

## Dependency Remediation

### Current findings

- `npm audit --omit=dev`: **0 vulnerabilities**.
- Full `npm audit`: **5 development-only transitive packages** — 4 high, 1 low (`@babel/core`, `brace-expansion`, `browserslist`, `js-yaml`, `zod`).
- `npm audit fix --package-lock-only --dry-run` proposed no changes in the current unsupported Node 24 shell. Do not interpret that as remediation.
- `npm audit fix --force` is explicitly rejected: it can cross tested framework/tooling boundaries and conflicts with the established exact Next pinning decision.

### Recommended sequence

1. Remove unused `motion` from `package.json` and regenerate only its lockfile removal under Node 22.13.0; keep that change independently reviewable.
2. Run `npm ci` under Node 22.13.0 and record the clean baseline audit/tree.
3. Add the exact test tools in their own tooling plan and capture Playwright baseline before runtime dependency updates.
4. In a dependency-only plan, update these compatible patches together with lockfile review:
   - `next` + `eslint-config-next`: **16.4.3**
   - `@netlify/functions`: **6.0.3**
   - `@supabase/supabase-js`: **2.118.0**
5. Keep React/React DOM 19.2.6, TypeScript 5.9.3, ESLint 9.39.4, Tailwind 4.2.1, and `@supabase/ssr` 0.12.7.
6. Refresh permitted transitives, inspect every lockfile change, rerun full and production audits, and run deterministic + Playwright + staging smoke gates.
7. If a dev-only advisory has no compatible fix, document exposure and wait for the upstream toolchain. Use an npm `overrides` entry only after proving peer compatibility and the complete gate; never force a major upgrade merely to make the audit count zero.

## Decision on `motion`

**Remove it now.** Confidence: HIGH.

Reasons:

- The diff is exactly one manifest entry plus 61 lockfile lines; no product source imports `motion` or `framer-motion`.
- Planning artifacts from earlier phases repeatedly identify it as an unrelated uncommitted change that must not be staged.
- Existing desktop motion uses CSS keyframes/individual transforms plus a specialized single `requestAnimationFrame` loop for the spider, with `ResizeObserver`, `MutationObserver`, visibility pause, seeded behavior, and frame-time clamping.
- PORTIA has a three-state user setting (`system / on / off`) mediated through `html[data-motion]`; Motion's generic reduced-motion setting would not replace that contract.
- Adopting Motion during decomposition would mix visual change, runtime dependency change, bundle change, and architectural refactor, which is precisely the failure mode v1.3 is intended to stop.

Motion is technically compatible with React 19 and offers `LazyMotion`/`m` for smaller bundles and reduced-motion support, but those capabilities do not solve a demonstrated current gap. If a future, separately researched feature needs layout/gesture animation that the platform implementation cannot maintain, evaluate the then-current Motion release in that feature's own phase. Do not keep a dormant package “for later.”

## Technologies and Migrations Not to Add

| Do not add/change | Reason | Use instead |
|---|---|---|
| Motion / Framer Motion in v1.3 | Unused dirty dependency; duplicates accepted CSS/rAF motion and increases regression surface | Existing CSS/rAF contracts + Figma + controlled Playwright clock |
| Next major, React 19.3, TypeScript 7, ESLint 10, Tailwind 4.3 | Unrelated migration risk during stabilization | Current versions plus narrowly gated patch updates only |
| Cypress, Selenium, Puppeteer as a second E2E stack | Duplicates browser infrastructure and evidence | Project-owned Playwright Test |
| Percy, Chromatic, Applitools, direct `pixelmatch` | Native Playwright screenshots are sufficient for this owner-reviewed project | `toHaveScreenshot()` with committed baselines |
| Jest/Vitest migration | Existing 584-test `node:test` suite is valuable and fast | Keep `node:test`; add Playwright only for browser layers |
| Prisma, Drizzle, another ORM/migrator | SQL/RLS/RPC are the security boundary; an ORM would obscure rather than validate it | Supabase CLI + ordered SQL migrations + database tests |
| A database/BaaS replacement | No evidence Supabase is the instability source | Isolated Supabase staging and canonical migrations |
| Production-mutating test runs | Unsafe and unnecessary | Disposable staging fixtures; production read-only post-deploy smoke |
| Netlify Blobs | Previously removed after runtime hangs | Existing Supabase Storage/media path and Netlify CDN behavior |
| Vercel or hosting migration | No demonstrated platform blocker | Existing Netlify deployment and headers |
| Storybook/design-system rewrite | Would expand scope and risk visual identity drift | Figma contract + small code primitives during scoped decomposition |
| Figma token-sync runtime or Code Connect rollout | Handoff can be completed without a new synchronization system | Variables/components/annotations + links to code/tests |
| New font/icon system or SVG spider | Explicit product constraints and accepted identity | Existing Cyrillic fonts, currentColor SVG icons, PNG spider |
| Hardware/device attestation claims | Browser token/UA/device signals cannot prove hardware identity | Treat binding as abuse resistance and test its documented limits |

## Recommended Gate Commands

The final scripts can be named during planning, but the release sequence should resolve to this order:

```powershell
npm ci
npm test
npx tsc --noEmit
npm run lint
npm run build
npx playwright test --project=chromium-desktop
npx playwright test --project=firefox-desktop --project=webkit-phone
npx playwright test tests/e2e/visual tests/e2e/accessibility
npm audit --omit=dev
npm audit
```

Then run the guarded Promotion live suite against staging, the Codex Security release scan in a supported managed session, and owner PC/phone UAT. A skipped live test, missing browser project, unapproved screenshot update, absent sealed security report, or pending owner scenario keeps the milestone open.

## Sources

### Repository evidence — HIGH confidence

- `.planning/PROJECT.md` — validated capabilities, v1.3 goals, constraints, accepted risks, exact visual identity.
- `.planning/forensics/report-20261029-192309.md` — dirty dependency evidence, missing Playwright suite, missing staging/UAT proof, security-scan blocker, architecture and visual-contract gaps.
- `.planning/milestones/v1.2-INCOMPLETE-ROADMAP.md` and `v1.2-INCOMPLETE-REQUIREMENTS.md` — implemented Promotion scope and unfinished proof/acceptance.
- `.planning/audits/2026-10-29-full-site-audit.md` — test/build/lint/audit results, CSP/dependency/staging/SQL risks.
- `package.json`, `package-lock.json`, `netlify.toml`, `next.config.ts`, `eslint.config.mjs`, `tsconfig.json` — exact runtime/tool versions and configuration.
- `lib/portia-promotion-live.test.ts` — current staging guard, role/RLS/concurrency test contract, fixtures and cleanup.
- `supabase/portia_setup.sql`, `supabase/phase12_apply.sql`, `supabase/phase14_apply.sql` — current owner-run SQL, RLS/RPC surface and migration gap.
- Archived Phase 9/10/11 browser and motion artifacts — accepted CSS/rAF motion, external Playwright core, CDP checks, and physical-device limits.
- Local skill/plugin manifests: Playwright Pro 2.1.0, Figma 17.0.0, Codex Security 0.1.32.

### Current official documentation — HIGH confidence

- [Playwright projects](https://playwright.dev/docs/test-projects) — browser/device project matrix.
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) — committed baselines, environment sensitivity, screenshot updates and tolerances.
- [Playwright clock](https://playwright.dev/docs/clock) — deterministic timers, `requestAnimationFrame`, `performance`, and time-dependent behavior.
- [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing) — `@axe-core/playwright`, state-specific scans, WCAG tags, attachments, and manual-testing limitation.
- [axe-core API tags](https://github.com/dequelabs/axe-core/blob/develop/doc/API.md) — WCAG 2.2 AA tag support.
- [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started) and [database testing](https://supabase.com/docs/guides/database/testing) — local reset, migrations and database/RLS tests.
- [Supabase branching](https://supabase.com/docs/guides/deployment/branching) and [managing environments](https://supabase.com/docs/guides/deployment/managing-environments) — isolated persistent staging, credentials, migrations and seed workflow.
- [Figma Dev Mode](https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode-in-Figma), [prototyping](https://help.figma.com/hc/en-us/articles/360040314193-Guide-to-prototyping-in-Figma), and [variable modes](https://help.figma.com/hc/en-us/articles/15343816063383-Modes-for-variables/) — Ready for Dev handoff, component inspection, annotations, interactions and token modes.
- [Motion accessibility](https://motion.dev/docs/react-accessibility), [LazyMotion](https://motion.dev/docs/react-lazy-motion), and [performance](https://motion.dev/docs/performance) — confirms technical capability, but does not establish a project need.
- [Netlify environment variables](https://docs.netlify.com/build/environment-variables/overview/) — deploy-context isolation if previews are later used.

## Confidence and Open Questions

| Topic | Confidence | Remaining validation |
|---|---|---|
| Keep current application stack | HIGH | Full v1.3 gate after each patch update |
| Remove `motion` | HIGH | Clean lockfile diff under Node 22.13.0 |
| Playwright/axe versions and architecture | HIGH | First committed suite and flake measurement on the owner machine |
| Supabase CLI + persistent staging branch | HIGH | Account capability, branch provisioning and clean migration replay |
| Browser matrix | MEDIUM-HIGH | Confirm owner's exact PC resolution/DPR, phone model and target browser before baselines are approved |
| Figma workflow | MEDIUM-HIGH | Existing Figma file/seat status and owner approval process are not yet recorded in the repository |
| Codex Security release gate | HIGH on workflow, MEDIUM on availability | Must be launched in a host/session that accepts the managed permission profile and produces sealed artifacts |
| Dependency patch targets | MEDIUM-HIGH | Re-run audit/outdated and lockfile resolution under Node 22.13.0 immediately before the dependency phase |

---
*Stack research for roadmap creation; no product code or dependency files were modified.*
