# Project Research Summary

**Project:** PORTIA OS v1.3 «Стабилизация PORTIA OS»
**Domain:** стабилизация существующего русскоязычного desktop-metaphor web application
**Researched:** 2026-10-30
**Confidence:** HIGH по состоянию репозитория и рекомендуемой последовательности; MEDIUM по release readiness до live staging и физической UAT

## Executive Summary

PORTIA OS — уже работающий фанатский портал в форме рабочего стола лаборанта, а не новый продукт, который нужно проектировать заново. В репозитории существуют Next.js/React shell, окна и приложения, редактор, поиск, медиа, Supabase auth/RLS/RPC и почти весь контур «Повышения». Стабилизационный milestone должен сохранить тёмно-бирюзовую PORTIA OS, русскую терминологию, IBM Plex Mono/Golos Text/IBM Plex Serif, ice/amber/red-семантику, currentColor SVG-иконки, PNG-паука, паутину и Вивьян. Главный вывод исследования: **наличие кода и зелёных deterministic-тестов не равно доказанному release contract**.

Рекомендуемый подход — modular monolith с явными seams и rollback-friendly branch-by-abstraction. Сначала фиксируются текущий commit, владельческие решения, Figma UI/motion contract и воспроизводимый Playwright baseline; затем создаётся каноническая цепочка Supabase migrations и изолированный staging; только после этого безопасно декомпозировать desktop/editor, исправлять окна и motion, доказывать Promotion и стабилизировать apps/search/media. Каждый increment обязан сохранять DOM semantics, CSS hooks, русские тексты, app IDs, storage keys, API shapes и данные, если отдельное утверждённое требование не разрешает изменение.

Критические риски — повторить смешанный scope Phase 14, принять неутверждённый screenshot за эталон, спутать mock/unit proof с RLS/concurrency proof, тестировать мутациями production, разойтись между Git SQL и deployed SQL, скрыть mobile regressions и заявить security scan/UAT, которые фактически не выполнялись. Они снимаются жёстким порядком зависимостей, отдельными exit gates, isolated staging, owner-approved Figma/visual baselines, committed Playwright, security evidence и финальной UAT на физическом ПК владельца (включая DPR 1.25) и телефоне.

## Evidence Boundary: What Is Proven and What Is Not

### Validated existing capabilities — preserve

- PORTIA OS shell: desktop, shortcuts, taskbar, settings, accent/wallpaper/icon/motion/spider preferences, windows and phone layout.
- Public apps and content flows: virus archive, employees, broadcasts/quests, information, guide, trash, embedded table/charter, settings, search and editor.
- Editor fundamentals: revisions, optimistic save/conflict protection, undo/redo, draft preservation, tab permissions, WYSIWYG formatting and separate employee/access workflows.
- Accepted product identity and decisions: Russian-only UI, current Cyrillic fonts, dark-teal electrophoresis language, PNG rather than SVG spider, no desktop «Сводка» widget, 34 employee slots, manual Promotion verdict and external evidence submission.
- Existing platform: Next.js routes, React UI, Supabase auth/storage/RLS/RPC design, Netlify build/CDN behavior, server headers and upload signature checks.
- Deterministic baseline reported by the audit: 584 Node tests, 583 passing and one intentionally skipped isolated-live test; typecheck/build/lint and production dependency audit were reported green.

These facts prove that the product and many contracts exist. They do **not** authorize redesign, framework replacement or a new product shell.

### Implemented but not release-proven — verify before redesigning

- Promotion’s 49-requirement participant/reviewer implementation, atomic claim/binding/CAS/lease logic, qualification timer, bank management, privacy projections and cleanup are covered by code/static tests, but the mutating isolated test and complete owner UAT have not passed.
- Latest desktop/window clamp, shortcut handoff, spider lifecycle/gait, web waves, Vivian brightness, qualification lock, search providers and bounded editor-list fixes have preflight evidence, but no approved visual/motion baseline and no complete physical-device acceptance.
- Role/RLS/RPC restrictions, security headers and CSP behavior have audit/static evidence, but deployed SQL parity, direct-table denial and concurrency are not proven on a fresh isolated environment.
- Mobile behavior has partial audit/browser evidence, but real phone keyboard/touch and complete Promotion/editor journeys remain unaccepted.

### Missing implementation or missing evidence — milestone work

- No committed `@playwright/test` suite, `playwright.config.ts`, page objects, role fixtures, requirement-flow map, visual baselines, axe fixture or repeatable browser release command.
- No owner-approved Figma UI/motion contract aligned with the current product; the existing Impeccable direction conflicts with some validated typography/motion facts and is not acceptance authority.
- No canonical immutable `supabase/migrations/` history and no proven fresh-reset plus upgrade path against dedicated staging.
- No mutating isolated Supabase proof for RLS/RPC/concurrency, authenticated reviewer/bank flows or current schema fingerprints.
- No evidence that the latest Phase 12/14 helper/search-path hardening is deployed to the target Supabase environment.
- No completed Codex Deep Security Scan: the previous scan never started, so there are neither findings nor a pass.
- No systematic app state matrix for loading/empty/populated/stale/error/permission-denied states, no approved performance budgets and no completed CSP media-host migration.
- No final owner PC/phone UAT; Phase 14’s ledger had 0 fully accepted scenarios, so archived `[x]` marks are implementation traceability, not v1.3 release acceptance.

Any item above that depends on deployed infrastructure, browser/device feel or owner judgment is marked **LIVE VERIFICATION REQUIRED** and must remain open until evidence exists.

## Key Findings

### Exact Stack and Tooling Decisions

Keep the application stack. Baseline the exact current behavior before dependency changes, then make only a separately gated patch update.

| Technology | v1.3 decision |
|---|---|
| Node.js | Standardize local and release gates on **22.13.0** (`>=22.13.0 <23`). The observed local 24.21.0 shell is unsupported for this repository. |
| npm | Keep npm, lockfile v3 and `package-lock.json`; use `npm ci`. Do not switch package manager. |
| Next.js / `eslint-config-next` | Baseline exact **16.4.2**; update together to **16.4.3** only in a dependency-only increment after browser baseline. |
| React / React DOM | Keep exact **19.2.6**. Do not take React 19.3 during stabilization. |
| TypeScript | Keep exact **5.9.3**. |
| ESLint | Keep exact **9.39.4**. |
| Tailwind/PostCSS | Keep exact **4.2.1**. |
| `@supabase/supabase-js` | Baseline installed **2.117.3**; target **2.118.0** only in the gated patch increment. |
| `@supabase/ssr` | Keep **0.12.7**. |
| `@netlify/functions` | Baseline **6.0.2**; target **6.0.3** only in the gated patch increment. |
| Netlify / Supabase | Keep both platforms. Add isolated Supabase staging; do not migrate hosting or BaaS. |
| `node:test` | Keep the existing suite for domain/API/helper/serialization contracts. Playwright complements it; it does not replace it. |

Add only these exact project dev dependencies:

- `@playwright/test@1.64.1` — E2E, role/device flows, console/network checks, traces, controlled clock and native visual comparisons.
- `@axe-core/playwright@4.14.0` — automated WCAG A/AA checks including WCAG 2.2 AA inside rendered states.
- `supabase@2.122.0` — local reset, ordered migrations, seed/database tests and isolated staging deployment.

Workflow tools remain outside the production bundle: Playwright Pro skill 2.1.0, Figma plugin 17.0.0, Codex Security 0.1.32 and the existing Impeccable review context.

**Do not introduce:** Motion/Framer Motion (remove the unused dirty `motion@14.6.0`), Cypress/Selenium/Puppeteer, Percy/Chromatic/Applitools/pixelmatch, Jest/Vitest migration, Prisma/Drizzle, another BaaS/database, Vercel, Netlify Blobs, Storybook/design-system rewrite, Code Connect/token-sync runtime, a new font/icon system, SVG spider, hardware-attestation claims, production-mutating tests, or major Next/React/TypeScript/ESLint/Tailwind upgrades. Do not use `npm audit fix --force`.

### Feature Priorities

**Must have for v1.3:** approved current-state/Figma contract; committed Playwright behavior/visual/a11y/console baseline; stable windows on desktop and phone; canonical Supabase migrations and isolated live proof; accepted Promotion participant/reviewer flow; parity-safe desktop/editor decomposition; app/editor state contracts; search handoff; media/performance evidence; security, dependency, accessibility and owner release gates.

**Differentiators to preserve:** the PORTIA OS desktop metaphor; in-world virus taxonomy and scientist logs; living web, PNG spider and Vivian; an editor that looks like the surface it edits; separate ordinary/qualification Promotion flows with manual reviewer decision.

**Defer / anti-features:** full redesign; a new user-facing unified app system; desktop «Сводка» widget; SVG spider; on-site Promotion evidence upload; automatic pass/fail; showing answer keys or specific mistakes; general shortcut rearrangement; accepted browser/iframe limitations unless the owner creates a new requirement.

### Architecture Approach

Use a modular monolith with `PortiaDesktop` and `PortiaEditor` as thin composition roots. Extract one seam at a time behind the current interface:

1. **Verification plane** — GSD traceability, owner-approved Figma, Playwright behavior/visual/a11y/console evidence, security scans and physical UAT.
2. **Desktop shell** — typed app registry, pure window transitions, lifecycle hook, unchanged window chrome, taskbar, shortcuts and versioned persistence.
3. **Public app modules** — archive, employees, search, info, guide, broadcasts, trash, settings, documents and the already separate Promotion participant app.
4. **Editor modules** — one revisioned content session, explicit typed commands, tab modules, rich text, separate employee/access sessions and the already separate Promotion reviewer workspace.
5. **Transport/domain boundary** — route handlers parse/auth/map HTTP; typed services/adapters call existing domain modules and atomic Postgres RPCs. Do not duplicate the Postgres state machine in TypeScript.
6. **Data plane** — immutable Supabase migrations, deterministic seed fixtures, isolated staging and production rollout by exact reviewed migration/checksum.
7. **Media boundary** — preserve current upload validation/cache behavior; centralize rendering incrementally, then tighten CSP after URL inventory and fallback proof.

Pointer-by-pointer drag/resize painting should remain outside React state and commit geometry at gesture end. Employee, content and Promotion persistence must remain separate. Shared primitives must be PORTIA-specific and piloted one family/app at a time, not a generic schema-driven rewrite.

### Critical Pitfalls and Prevention

1. **Mixed-scope mega-phase** — give every phase an exclusion list and independent evidence package; never combine database, global CSS, motion, dependency and business-flow changes.
2. **False confidence from deterministic tests** — map each requirement to its minimum evidence layer; RLS/concurrency require live staging, motion requires measured/browser/owner proof, and phone UX requires phone evidence.
3. **Unapproved visual baseline** — owner approves Figma states and candidate captures before screenshots become release baselines; never mass-update snapshots.
4. **Flaky browser suite** — fixed clock/locale/timezone/random seed/data, isolated run IDs and roles, semantic locators, observable waits, diagnostics on first failure; retries cannot convert a flaky test into a release pass.
5. **Production mutation or SQL drift** — fail closed on exact staging project ref; keep service role only in fixture orchestration; deploy ordered migrations to fresh and upgrade staging before owner-controlled production rollout.
6. **Refactor becomes rewrite** — preserve DOM/classes/IDs/storage/API and extract one leaf or transition seam per increment; behavior and visual parity are mandatory before deleting the old path.
7. **Motion passes tests but fails experience/performance** — approve start/key/end/rest states and full/reduced/off behavior in Figma; profile compositor/paint/long tasks and accept on the owner’s DPR 1.25 PC.
8. **Security overclaim** — browser token, UA and Client Hints are abuse-resistance signals, not hardware identity; mobile/desktop mode must never authorize protected data.
9. **CSP or media cleanup breaks content** — inventory URLs and run report-only policy before nonce/hash and allowlist/proxy enforcement.
10. **Planning evidence drifts again** — distinguish `implemented`, `automated-proof`, `live-proof` and `owner-accepted`; missing summary, blocked verification or unresolved high-severity evidence prevents closure.

## Implications for Roadmap

Use **eight compact phases**, not another 19-plan catch-all. Each phase must be independently revertible and must not absorb work from the next row.

| Phase | Rationale and delivery | Features addressed | Mandatory exit gate / pitfalls avoided |
|---|---|---|---|
| **1. Recovery, contracts and browser baseline** | Reconcile dirty-file ownership without resetting user work; freeze exact commit/current behavior; resolve typography and motion-setting drift; create owner-approved Figma desktop/phone/state/motion contract; add committed Playwright/axe skeleton and candidate captures. | STAB-BASE-01..06, initial REL-02/03 | G0/G1: deterministic baseline, console ledger, role/device/state matrix, approved Figma contract and promoted snapshots. No product redesign, dependency patch or architecture extraction. |
| **2. Canonical Supabase staging and SQL truth** | Create immutable migration history, deterministic synthetic seed, dedicated staging, fresh-reset and upgrade paths; reconcile Phase 12/14 helpers and live function/grant/RLS manifest. | STAB-SEC-01/04/06, REL-04; Promotion data prerequisites | G4: guarded mutating live suite passes claim/binding/CAS/lease/RLS/cleanup with no production data. **LIVE VERIFICATION REQUIRED.** Avoid production fixtures and dashboard-only SQL. |
| **3. Reversible desktop/editor decomposition** | Under approved Playwright/visual parity, extract registry, pure window transitions, chrome/leaf apps, persistence and editor primitives/tabs/session one seam at a time. No intended UX change. | STAB-DESK-01..08, APP-07..10 | Every increment passes deterministic + desktop/phone behavior + visual + console/a11y parity; preserve storage/API/DOM contracts. Avoid giant-context rewrite and mixed CSS cleanup. |
| **4. Desktop, windows and living motion** | Fix only reproduced/approved defects in drag/resize/minimize, shortcuts, wallpaper/web, PNG spider gait/lifecycle, Vivian and motion modes; set measured budgets from baseline. | STAB-MOTION-01..08, DESK-02..06, REL-06 | Controlled clock/seed, full/reduced/off proof, DPR 1/1.25 geometry, long-session trace and owner physical-PC verdict. **LIVE VERIFICATION REQUIRED.** No Motion package or aesthetic improvisation. |
| **5. Promotion proof and narrow remediation** | Prove existing participant/reviewer workflows on staging before changing them; remediate only reproduced gaps in status/cooldowns, banks, ordinary/qualification flows, timers, privacy, claims, retake and cleanup. | STAB-PROM-01..15, REL-05 | Full role/direct-API matrix, two-reviewer races, PC + phone participant/reviewer Playwright, no leaked secrets, temporary fixtures cleaned, owner UAT accepted. **LIVE VERIFICATION REQUIRED.** |
| **6. Apps, editor, search and media stabilization** | Apply common evidence contracts without homogenizing UX: loading/empty/stale/error/access states, editor conflict/drafts/WYSIWYG, search provider-to-owner handoff, media priority/cache/fallback and phone behavior. | STAB-APP-01..10, SEARCH-01..04, MEDIA-01..06, A11Y-01..04 | Per-app desktop/phone matrix, authenticated editor journeys, search click-through, upload/network/cache evidence, measured baseline and owner phone spot-check. Avoid mass primitives/global CSS/media rewrite. |
| **7. Security, accessibility, CSP and dependency closure** | Run security diff/managed deep scan, close or waive confirmed findings, move CSP inventory → report-only → enforcement, triage dev advisories and perform the isolated patch-only dependency update. | STAB-SEC-02..06, MEDIA-07, A11Y-01..04, REL-01/03 | Sealed security artifacts or explicit release blocker; axe + manual keyboard/focus/zoom/touch; clean production audit; dev findings disposition; zero unexplained CSP/console errors. No `audit fix --force` or framework migration. |
| **8. Release rehearsal and owner acceptance** | Run everything from clean checkout and staging deployment; rehearse backup/rollback and migration expand/contract; apply exact owner-approved production migration; perform safe post-deploy probes and reconcile the GSD ledger. | STAB-REL-01..08 | G7/G8: all automated gates green without hidden retry pass; exact deployed migration evidence; physical owner PC/phone UAT accepted; no pending high-severity item; release/requirements/summaries/verification describe the same commit. **LIVE VERIFICATION REQUIRED.** |

### Phase Ordering and Critical Dependencies

```text
Current-state inventory + dirty-file ownership
  → owner-approved Figma contract
  → committed Playwright/visual/a11y baseline
  → parity-safe desktop/editor decomposition
  → approved desktop/motion fixes

Canonical migrations + isolated Supabase staging
  → live RLS/RPC/concurrency proof
  → Promotion remediation and end-to-end acceptance

App/search/media inventory
  → media migration and measured baseline
  → CSP report-only then enforcement

All implementation streams settled
  → final security/dependency/a11y/performance gates
  → release rehearsal
  → physical owner PC/phone acceptance and production verification
```

Do not invert these dependencies: no decomposition before characterization, no visual baseline before owner approval, no Promotion acceptance before staging, no CSP enforcement before media inventory, no production migration before fresh/upgrade staging proof, and no milestone completion before physical UAT.

### Release Gates

| Gate | Required evidence | Blocks |
|---|---|---|
| **G0 Baseline integrity** | Exact commit, dirty-file ownership ledger, deterministic checks, current public/auth captures and console inventory | Any product implementation |
| **G1 Contract** | Requirement trace, Figma approval where visual, threat delta, migration and rollback plan | Phase implementation |
| **G2 Deterministic** | `npm ci`, `npm test`, `npx tsc --noEmit`, lint, production build, production audit | Browser acceptance |
| **G3 Browser** | Playwright role/device behavior, console/network, visual and accessibility evidence | Phase acceptance |
| **G4 Live staging** | Fresh/upgrade migrations, schema manifest, mutating Promotion RLS/RPC/concurrency and reviewer E2E | Promotion acceptance/release |
| **G5 Security** | Per-phase security diff; final managed deep scan; CSP/header/storage review and finding disposition | Release candidate |
| **G6 Owner UAT** | Physical PC including DPR 1.25 drag/motion/reviewer and physical phone participant/editor flows | Release candidate |
| **G7 Release rehearsal** | Clean-checkout rerun, staging deploy, backup/rollback, migration and performance evidence | Production approval |
| **G8 Production verification** | Exact approved migration, read-only/safe smoke, headers/assets/CDN/console checks, closed evidence ledger | Milestone completion |

### Research Flags

Phases that should use targeted phase research:

- **Phase 1:** existing Figma file/seat/ownership, export/revision policy, exact owner PC/phone/browser matrix, and final motion preference contract.
- **Phase 2:** Supabase branch/project availability, secret handling, canonical baseline migration/reconciliation and synthetic Google Sheet strategy.
- **Phase 4:** owner-device performance budgets, DPR 1.25 geometry and motion timing/quality thresholds.
- **Phase 7:** CSP nonce/hash propagation on Next/Netlify, external media allowlist/proxy choice, current advisory fixes and managed Codex Security availability.

Phases with sufficiently documented patterns to skip broad research and proceed with focused planning:

- **Phase 3:** extraction sequence, component boundaries and parity rules are explicitly documented.
- **Phase 5:** Promotion contracts, roles, races and live-test guard already exist; the work is proof-first remediation.
- **Phase 6:** app/editor/search/media behavior is inventoried; plan by surface and evidence matrix.
- **Phase 8:** use the defined gate ledger; research only a newly discovered deployment constraint.

## Confidence Assessment

| Area | Confidence | Notes |
|---|---|---|
| Stack | HIGH | Exact repository/runtime versions and official tool guidance were inspected; patch targets must be rechecked under Node 22.13.0 immediately before update. |
| Features | HIGH for inventory; MEDIUM for acceptance | Existing capabilities and exclusions are well documented. Promotion, latest motion/window fixes and physical phone behavior still require live/owner proof. |
| Architecture | HIGH | Giant-component sizes, existing seams, route/RPC boundaries and safe extraction order are directly evidenced. Visual/performance thresholds remain owner-dependent. |
| Pitfalls | HIGH | Risks are corroborated by Phase 14 scope drift, repeated patch loop, skipped live test, SQL uncertainty and missing acceptance artifacts. |
| Release readiness | LOW-MEDIUM | Missing Playwright/Figma/staging/deep-scan/physical-UAT evidence is confirmed. This confidence is high about the gap, not about release correctness. |

**Overall confidence:** HIGH that this is the correct stabilization sequence; MEDIUM that implementation will meet release criteria until all live gates pass.

### Gaps Requiring Live Verification

- **Supabase capability and parity:** persistent branch versus separate project, credentials, migration history and live function/policy/grant fingerprints.
- **Promotion correctness:** mutating RLS/RPC/concurrency, reviewer authentication/bank CRUD, timers/offline/focus behavior, cleanup and no-secret payloads.
- **Owner hardware:** exact PC resolution/DPR/browser, phone model/browser, drag feel, mobile keyboard/touch, spider/web/Vivian/shortcut aesthetics and long-session performance.
- **Design authority:** final Figma owner/revision/storage process and resolution of current on/off motion UI versus earlier system/on/off intent.
- **Security:** managed environment capable of producing sealed Codex Security artifacts; absence of prior findings is not a pass.
- **CSP/media:** actual external host inventory, nonce/hash behavior through Next/Netlify and allowlist/proxy choice.
- **Dependencies:** current registry/advisory state and lockfile resolution under supported Node 22.13.0.
- **Production rollout:** exact migration checksum, owner checkpoint, backup/rollback note and safe post-deploy probes.

## Sources

### Primary project evidence — HIGH confidence

- `.planning/PROJECT.md` — validated capabilities, constraints, accepted risks and v1.3 goals.
- `.planning/forensics/report-20261029-192309.md` — dirty state, Phase 14 drift, missing live/UAT/security evidence and root-cause analysis.
- `.planning/research/STACK.md` — exact versions, tooling decisions, staging/security/Figma/Playwright gates and prohibited additions.
- `.planning/research/FEATURES.md` — status model, capability matrix, table stakes, differentiators and anti-features.
- `.planning/research/ARCHITECTURE.md` — modular-monolith boundaries, extraction order, migration/staging design and release gates.
- `.planning/research/PITFALLS.md` — failure modes, prevention gates and phase warnings.
- v1.2 incomplete roadmap/requirements/verification/UAT and the 2026-10-29 full-site audit — implementation traceability and unresolved acceptance.
- Current desktop/editor/Promotion/API/test/SQL/package configuration cited in the four research reports.

### Official guidance — HIGH confidence

- [Playwright projects](https://playwright.dev/docs/test-projects), [fixtures](https://playwright.dev/docs/test-fixtures), [authentication](https://playwright.dev/docs/auth), [page objects](https://playwright.dev/docs/pom), [visual comparisons](https://playwright.dev/docs/test-snapshots), [clock](https://playwright.dev/docs/clock) and [accessibility testing](https://playwright.dev/docs/accessibility-testing).
- [Supabase local CLI](https://supabase.com/docs/guides/local-development/cli/getting-started), [database migrations](https://supabase.com/docs/guides/local-development/database-migrations), [database testing](https://supabase.com/docs/guides/database/testing), [branching](https://supabase.com/docs/guides/deployment/branching) and [environment management](https://supabase.com/docs/guides/deployment/managing-environments).
- Figma Dev Mode, prototyping and variable-mode guidance cited in `STACK.md`.
- Netlify environment-variable guidance cited in `STACK.md`.

---
*Research completed: 2026-10-30*
*Ready for roadmap: yes — subject to the explicit live-verification gates above*
