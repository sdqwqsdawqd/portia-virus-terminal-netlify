# Architecture Research: PORTIA OS v1.3 Stabilization

**Project:** PORTIA OS
**Milestone:** v1.3 «Стабилизация PORTIA OS»
**Domain:** stabilization of an existing Russian Next.js 16 / React 19 / Supabase / Netlify desktop-style application
**Researched:** 2026-10-30
**Overall confidence:** HIGH for repository structure and sequencing; MEDIUM for final visual/performance thresholds until the owner approves the Figma and Playwright baselines

## Scope and Decision

This milestone should not redesign PORTIA OS or reimplement validated product behavior. The right architecture is a **modular monolith with explicit seams**, not a new application, state framework, design system, or service fleet.

Preserve the current rendered DOM, CSS class names, Russian copy, storage keys, API response shapes, Supabase workflow semantics, and visual identity while responsibilities are extracted behind compatible interfaces. Every refactor increment must be behavior-neutral until a separately approved stabilization task intentionally changes behavior.

The key architectural rule is:

> No structural change is accepted from unit tests alone. It must retain the approved Playwright behavior and visual baseline, and database-sensitive changes must also pass the isolated Supabase staging gate.

## Evidence: Implemented vs Proven

| Area | Already implemented and should be preserved | Unproven or unresolved for v1.3 |
|---|---|---|
| Desktop | Twelve applications, draggable/resizable/maximizable windows, taskbar ordering, shortcut persistence, settings, polling, assistant, wallpapers, spider, mobile layout | No committed Playwright suite; no approved visual/motion baseline; physical DPR 1.25 and phone acceptance incomplete |
| Editor | Revisioned content history, undo/redo, optimistic save, access projection, unsaved-close guard, formatter, employee editor, owner access manager | `portia-editor.tsx` remains 3,033 lines; most tab bodies and shared controls are coupled to one closure; no browser regression gate |
| Promotion UI | Public participant component and dedicated reviewer components already exist; ordinary and qualification flows are visibly separate | Full owner PC/phone UAT, authenticated reviewer browser proof, bank CRUD proof, and final live workflow acceptance are missing |
| Promotion server | Public and reviewer route groups, sheet parser, policy modules, device binding, typed command parsing, atomic RPC design, RLS-denied direct tables | Mutating concurrency/RLS run has not passed on an isolated project; deployed RPC signatures and latest helper hardening are not authoritatively reconciled |
| SQL | `portia_setup.sql`, Phase 12 apply/rollback script, Phase 14 owner apply script, static normalization/security tests | The repository snapshot and what was manually applied can drift; latest SQL hardening is not proven deployed; there is no immutable migration history directory |
| Media | Authenticated upload, 4 MB cap, declared MIME plus magic-byte check, UUID object paths, immutable one-year cache, eager active media and lazy background media | Arbitrary HTTPS media remains allowed by CSP; dimensions/pixel cost and GIF cost are not bounded; repeated media rendering/fallback logic is not centralized |
| Release | 584 deterministic tests in the latest audit, successful typecheck/build/lint, clean production dependency audit, security headers | No automated browser/a11y/visual gate, no managed Codex Security result, five dev audit findings, no staging-to-release rehearsal |

The v1.2 requirement checkboxes demonstrate implementation intent and deterministic coverage, not release proof. v1.3 should close evidence gaps rather than reopen the 49 Promotion requirements as greenfield design.

## Recommended Architecture

```text
                         Verification plane
      GSD contracts -> Figma contract -> Playwright -> Security -> UAT
                                |
                                v
Browser
  PortiaDesktop (composition root only)
    ├─ desktop shell
    │   ├─ app registry (metadata and capabilities)
    │   ├─ window manager (pure transitions + lifecycle hook)
    │   ├─ window chrome / taskbar / shortcuts
    │   └─ settings and persistence adapters
    ├─ public app modules
    │   ├─ archive / employees / search / info / guide
    │   ├─ broadcasts / trash / settings / embedded documents
    │   └─ Promotion participant app (already separate)
    ├─ motion modules
    │   ├─ wallpaper + spider (already separate)
    │   └─ assistant / shortcut / window motion contracts
    └─ PortiaEditor (editor composition root)
        ├─ editor session (history, revision, permission projection, save/close)
        ├─ tab registry and tab feature modules
        ├─ rich-text subsystem
        ├─ employee and access modules
        └─ Promotion reviewer module (already separate)

Next.js route handlers (transport boundary)
  ├─ public content/employees/media
  └─ Promotion status/requests/test/reviewer/banks
          |
          v
Domain services and typed RPC adapter
  ├─ roster/sheet reader (read-only authority)
  ├─ promotion policy/projection/device binding
  └─ reviewer and bank commands
          |
          v
Supabase
  immutable migrations -> seed fixtures -> staging -> production
  RLS + atomic security-definer RPCs are the workflow write boundary
```

### Architectural invariants

1. `PortiaDesktop` remains the composition root, but does not own application implementations or window transition algorithms.
2. The app registry describes applications; it does not become a service locator or hold mutable React state.
3. The window manager owns window lifecycle only. Content, Promotion, editor history, and employee data remain outside it.
4. `PortiaEditor` owns one revisioned `PortiaContent` session. Employee and Promotion writes remain independent sessions and must not be folded into that revision.
5. Route handlers parse HTTP and map errors. Database transitions and concurrency guarantees remain in RPCs; browser state is never authoritative.
6. Supabase production is never a test fixture. Mutating proof runs only against the dedicated staging project.
7. Screenshot baselines are approval artifacts. They are updated deliberately, never automatically as a side effect of implementation.

## Desktop Decomposition

### Target boundaries

| Module | Responsibility | Must not own |
|---|---|---|
| `desktop/app-registry.ts` | Stable app IDs, labels, PORTIA paths, icons, default/minimum geometry, shortcut defaults, search visibility, mount policy | Window state, content, browser storage, React nodes with app-specific props |
| `desktop/window-state.ts` | Pure state and transitions: open, focus, begin/finish close, begin/finish minimize, maximize, geometry, lock | Timers, DOM reads, pointer events, content/editor rules |
| `desktop/use-window-manager.ts` | Exit timers, z-order allocation/renormalization, qualification lock orchestration, resize refit | App rendering, content fetching, visual markup |
| `desktop/portia-window.tsx` | Existing title bar, controls, drag/resize pointer handling, imperative painting during pointer move | Global window collection or app-specific behavior |
| `desktop/shortcuts.tsx` | Shortcut rendering, drag/drop, semantic hover contract | App content or window transitions beyond `open(appId, origin)` |
| `desktop/taskbar.tsx` | Ordering, focus/minimize requests, bounce presentation | Window reducer implementation |
| `desktop/persistence.ts` | Versioned parsing/writing of settings, shortcut positions, taskbar order | React rendering and default registry definitions |
| `desktop/data/*` hooks | Content polling/save, access, employees, notifications | Window geometry and app markup |
| `apps/*` | One public application view per module | Global desktop state; receive explicit view models and commands |

The current `appMeta`, `initialWindows`, `defaultShortcutLayout`, `windowMinimums`, preferred sizes, and `globalSearchAppIds` are fragments of one registry and should be consolidated. Keep application rendering in a separate typed `AppRenderer` switch because each app has different dependencies; forcing heterogeneous app props into registry metadata would create hidden coupling.

### Window manager design

Use a pure reducer or pure transition functions with events such as:

```typescript
type WindowEvent =
  | { type: "open"; app: AppId; origin?: OpenOrigin; geometry?: WindowGeometry }
  | { type: "focus"; app: AppId; z: number }
  | { type: "exit-start"; app: AppId; kind: "close" | "minimize" }
  | { type: "exit-finish"; app: AppId; kind: "close" | "minimize" }
  | { type: "toggle-maximize"; app: AppId }
  | { type: "geometry"; app: AppId; geometry: WindowGeometry }
  | { type: "lock-promotion"; locked: boolean; z?: number };
```

Do not move pointer-by-pointer geometry into React state. The existing `AppWindow` deliberately paints `left/top/width/height` directly while dragging and commits once at the end; retain that performance boundary. Keep the 900 px mobile cutoff, symmetric workspace bounds, qualification modal lock, editor unsaved-close handshake, reduced-motion exit timing, and icon/taskbar transform origins as contract tests.

Normalize z-indices when they approach the formatter layer instead of retaining the current acknowledged “about 930 switches” ceiling. This can be added only after the reducer parity suite is green.

### Safe extraction sequence for `portia-desktop.tsx`

1. **Freeze contracts first.** Capture public desktop, every app window, min/max/minimized states, desktop/phone layout, motion modes, settings persistence, console baseline, and keyboard names.
2. **Move declarations without changing behavior.** Extract `AppId`, metadata, geometry defaults/minimums, storage codecs, and existing pure helpers. Keep old imports and exact values.
3. **Extract leaf views one at a time.** Start with embedded documents, settings, broadcasts, search, and info; then archive/employees/trash. `GuideApp`, wallpaper/spider, and Promotion are already separate and should stay separate.
4. **Extract window chrome.** Move `AppWindow` unchanged, retaining its DOM and CSS classes. Verify drag on all eight edges, min/max/restore, mobile, and qualification lock.
5. **Introduce pure window transitions behind the existing handler API.** Keep `openApp`, `closeApp`, `minimizeApp`, `focusApp`, and `toggleMaximize` as compatibility adapters until parity passes.
6. **Extract taskbar, shortcuts, and persistence.** Migrate one persisted key at a time; continue reading current versioned keys. Do not reset user layouts during refactor.
7. **Extract content/access/employee hooks last.** Their race protection (`knownRevision`, `savesStarted`, edit counters, cached fallbacks) is subtle and should move only after shell behavior is stable.
8. **Reduce `PortiaDesktop` to composition.** It wires hooks, renderer, window manager, notifications, and motion surfaces; it should no longer contain application bodies.

Each numbered step is independently revertible. Do not combine a view extraction, CSS cleanup, and behavior fix in one increment.

## Editor Decomposition

### Preserve existing useful seams

The editor already has the correct foundations in `lib/`: history reducer, change classification, access-aware tab registry, content limits, item mutations, formatting logic, and tests. Keep these modules as the domain layer. Promotion is already mounted as a separate trusted tab and must not be pulled back into the main editor file.

### Target boundaries

| Module | Responsibility | Notes |
|---|---|---|
| `editor/use-editor-session.ts` | `PortiaContent` history, revision synchronization, dirty sections, save/discard/undo/redo, permission projection, close handshake | Extract after tab props are explicit; keep employee dirty state separate |
| `editor/editor-shell.tsx` | Tab strip, current tab, save chip/popover, global dialogs, formatter portal | No tab-specific form markup |
| `editor/editor-commands.ts` | Typed mutation/selection/formatter command interface passed to tab modules | Avoid a broad mutable context |
| `editor/primitives/*` | Field, group, collapsible card, order handle, table rows, image field, confirmation dialog, empty/loading states | Preserve class names and accessibility names |
| `editor/rich-text/*` | Formatted field, selection capture/restore, formatter panel, batch application | High-risk subsystem; move intact before internal cleanup |
| `editor/tabs/*` | Viruses, information, guide, broadcasts, recycle, search, assistant | One module per existing registry tab |
| `editor/employees/*` | Existing independent employee profile editor | It has its own dirty/save lifecycle |
| `editor/access/*` | Owner access manager | Owner-only and independent of content revision |
| `portia-promotion-editor*` | Existing Promotion reviewer workspace | Keep existing split; stabilize rather than recombine |

### Safe extraction sequence for `portia-editor.tsx`

1. Extract presentation primitives with exact markup/classes and add component-level Playwright coverage.
2. Move already self-contained `EmployeeProfilesEditor` and `EditorAccessManager` into feature modules without changing their fetch/save lifecycles.
3. Move the simplest content tabs first: search, assistant, broadcasts.
4. Move information and guide next; retain ID-based mutations and formatted-text cleanup from `lib/editor-items.ts`.
5. Move virus and recycle tabs last because they share selection, formatted keys, restore/delete behavior, and cross-section permission semantics.
6. Move the rich-text subsystem intact. Only after parity, consider smaller internal hooks for selection, panel placement, and batch formatting.
7. Extract `useEditorSession` after all consumers use a typed command interface. This exposes the true shell boundary and avoids a temporary “god context.”
8. Split CSS only after DOM parity. First colocate comments/ownership, then move rules without changing selector specificity or order.

Do not merge employee, Promotion, and content dirty state into one reducer. The current independent persistence models are intentional: content uses a single revisioned row, employees use profile endpoints, and Promotion uses transactional RPCs.

## App Registry and Shared UI Primitives

### Registry recommendation

Use one authoritative metadata registry and one explicit renderer:

```typescript
type AppDefinition = {
  id: AppId;
  label: string;
  path: string;
  icon: PortiaIconName;
  shortcut?: { id: DesktopShortcutId; defaultPosition: ShortcutPosition };
  window: { preferred: Size; minimum: Size; className: string };
  search: boolean;
  mount: "while-open" | "persistent";
};
```

`editor` may remain without a desktop shortcut. Promotion should use persistent mounting while minimized if its qualification/heartbeat contract requires it; closing during an active qualification remains blocked by the existing lock. The registry should encode the mount decision, not infer it from labels or JSX order.

### Shared primitives recommendation

Create PORTIA-specific primitives, not generic design-system abstractions:

- `PortiaWindow`, `PortiaDialog`, `PortiaButton`, `PortiaField`, `PortiaTabs`, `PortiaEmptyState`, `PortiaLoadingState`, `PortiaMedia`.
- Keep semantic variants small: primary, secondary, danger; light/dark document surface; compact/standard controls.
- Preserve current CSS custom properties, accent behavior, fonts, and class hooks. Figma defines variants and motion states; React components enforce structure and accessibility.
- Do not wrap every `<div>` or create a universal schema-driven form. Extract only repeated contracts with at least two real consumers.

The Figma contract is the source for approved appearance and motion intent; the code registry is the source for application identity and geometry; Playwright screenshots are the rendered regression evidence. None should silently generate or overwrite the others.

## Promotion API, RPC, Staging, and Canonical SQL

### Keep the current trust boundaries

The current shape is sound and should be retained:

- Public `status`, `requests`, and qualification `test` routes use the anonymous Supabase client and return safe projections with `no-store`.
- Reviewer and bank routes use the cookie-aware server client and require the trusted `promo` grant.
- Google Sheet ranges remain read-only authorities for membership/current title/date.
- Direct access to Promotion tables remains revoked; public and reviewer mutations go through explicit RPCs.
- Concurrency-sensitive actions remain atomic in Postgres: first binding/admission, one active request, claim, preview confirmation, answer compare-and-set, lease expiry, close/history pruning.
- The service-role key exists only in isolated test orchestration. It must never enter the Next.js runtime or browser bundle.

### Tighten module boundaries without redesigning the workflow

Route handlers should contain only request parsing, auth/client selection, service invocation, and HTTP mapping. Introduce a typed `PromotionRpc` adapter around RPC names and response decoders so `reviewer/route.ts` and `banks/route.ts` no longer dispatch raw string tuples. Keep eligibility/projection/device/sheet logic in current domain modules.

Use explicit service methods:

```text
participant: status, submitRequest, startTest, heartbeat, answer, fail
reviewer: state, claim, release, reject, approveAssignment, grade, finalize
banks: state, preview, confirm, saveConfiguration, saveItem
owner: resetDevice, deleteRequest
```

This is an adapter around existing RPC behavior, not a second state machine in TypeScript.

### Canonical SQL decision

Adopt `supabase/migrations/` as the only deployable history.

1. Capture the current accepted schema as a baseline migration for new environments.
2. Reconcile the existing production project to that baseline once and record migration history.
3. Preserve `phase12_apply.sql` and `phase14_apply.sql` as historical/manual evidence; stop editing them after reconciliation.
4. Make every subsequent database change a new timestamped, forward-only migration.
5. Treat `portia_setup.sql` as a generated/current-schema snapshot for review or disaster recovery, not as a repeatedly edited production deployment script.
6. Run a drift check that rebuilds an empty local database from migrations and compares required tables/functions/grants/policies to the snapshot and RPC inventory.

The present static test that normalizes Phase 14 function/table definitions across two mutable SQL files is useful, but it cannot prove what a remote project actually ran. Immutable migration history plus `supabase migration list` and live RPC/RLS tests closes that gap.

Use expand/contract for RPC changes: deploy a new compatible function/signature first, deploy the application adapter second, verify staging, then revoke/drop the old signature in a later migration. Rollback is a compensating migration or application rollback to the still-present old RPC, never an automatic destructive down script.

### Staging boundary

Use one long-lived Supabase staging project with its own URL, anon key, service-role secret, Auth users, storage bucket, and synthetic data. It must contain no production user/content copy.

- Build it from migrations, then seed deterministic synthetic owner, promo reviewer, non-promo editor, participant workflows, banks, and media.
- Add a dedicated staging copy of the roster sheet. Configure only its sheet ID server-side and validate it against the expected Google Sheets URL shape; production keeps the current sheet ID.
- Prefix every dynamic fixture with a run ID, as the existing live test already does, and delete it in teardown.
- Run the role matrix: anon, authenticated without editor access, regular editor without `promo`, promo reviewer, owner, service role.
- Run concurrent claim, concurrent first admission/device binding, answer CAS/idempotency, immutable mode, deadline/lease expiry, stale preview, RLS direct-table denial, cleanup/history cap, and media authorization.
- Run once from a fresh database and once as an upgrade from the reconciled baseline.

The existing `test:promotion-live` guard and fixture cleanup are the correct starting point. The mutating mode becomes a blocking staging gate, while `READ_ONLY_PREFLIGHT` remains an inventory check and must not be reported as concurrency/RLS proof.

## Playwright Architecture

### Recommended layout

```text
playwright.config.ts
tests/e2e/
  auth.setup.ts
  fixtures/
    portia-test.ts          # composed fixtures and expectations
    roles.ts                # owner/reviewer/no-promo contexts
    staging.ts              # run-scoped DB/media fixtures
    diagnostics.ts          # console, page errors, failed requests
  pages/
    desktop.page.ts
    window.page.ts
    editor.page.ts
    promotion.page.ts
    promotion-reviewer.page.ts
  specs/
    desktop-shell.spec.ts
    editor.spec.ts
    promotion-participant.spec.ts
    promotion-reviewer.spec.ts
    apps.spec.ts
    accessibility.spec.ts
    media.spec.ts
  visual/
    desktop.visual.spec.ts
    editor.visual.spec.ts
    promotion.visual.spec.ts
```

Page objects should model user surfaces, not mirror source files. `DesktopPage` opens apps and queries taskbar/shortcut/window state; `WindowPage` manipulates one named window; `EditorPage` selects tabs and owns save/dirty assertions; Promotion participant and reviewer objects remain separate.

Prefer role, label, text, and stable application IDs. Add `data-testid` only where PORTIA’s repeated icon/window markup has no unambiguous accessible locator. Do not use long CSS selectors tied to extraction paths.

### Fixtures and projects

- Use Playwright `test.extend` fixtures so setup/teardown is explicit and isolated.
- Use a setup project and ignored `storageState` files for owner/reviewer/no-promo roles. Never commit auth state.
- Use separate browser contexts when one test needs participant and reviewer concurrently.
- Add an automatic diagnostics fixture that fails on `pageerror`, unexpected console errors, unhandled failed API responses, and hydration errors.
- Use a worker-scoped staging seed only for immutable shared reference data; mutable workflow rows are test-scoped and run-ID-prefixed.
- Run behavioral smoke on Chromium, Firefox, and WebKit; keep the authoritative pixel baseline on one pinned Chromium/OS/font environment.
- Required viewports: desktop 1440×900, owner PC simulation at DPR 1.25, and a representative phone viewport. Physical PC/phone UAT remains a separate release gate.
- Capture trace on first retry and screenshot/video on failure. Retries diagnose flakiness; a test that only passes on retry is not release-ready.

### Visual baseline policy

Use three layers of visual evidence:

1. **Current-state reference:** captured before refactoring and approved as “preserve.”
2. **Figma contract:** canonical variants, dimensions, states, and motion timings for windows, shortcuts, assistant, wallpaper/spider, and application shells.
3. **Rendered Playwright baseline:** committed screenshots of deterministic states in the pinned environment.

For still screenshots, force a known accent/wallpaper/content fixture, fixed clock/date, loaded fonts/media, and `data-motion="reduce"`; use Playwright screenshot styles or masks for unavoidable external/dynamic regions. Do not baseline live Google/YouTube iframe pixels.

Static screenshot assertions disable animations by default, so they do not prove motion. Motion gets a separate contract suite:

- assert full/reduced/off mode selection;
- assert start/end transform origin and settled state for open/close/minimize/shortcut handoff;
- seed randomness in tests by overriding `crypto.getRandomValues` before page load for spider routes;
- assert no frame-loop writes while hidden/off/settled where the implementation promises that;
- retain traces/video and owner approval for qualitative spider, web, assistant, and shortcut motion.

Never update snapshots automatically in the release command. A changed baseline requires a named design-contract change and owner approval.

## Media Pipeline

### Current boundary to retain

Uploads already enforce authenticated editor access, a 4 MB limit, MIME/signature agreement, UUID object names, public URLs, and immutable caching. Preserve this as the ingestion gate.

### Target pipeline

```text
Editor upload
  -> access policy for the edited area
  -> byte/type/signature/size validation
  -> dimension + pixel/frame budget validation
  -> optional static derivative/thumbnail generation
  -> immutable object path
  -> canonical media descriptor
  -> PortiaMedia renderer (priority/lazy/fallback/aspect ratio)
```

Centralize repeated `EmployeeImage`, `LoadingMedia`, `GuidePhoto`, and editor preview behavior behind a PORTIA-specific media component while keeping placement-specific dimensions. The component decides eager versus lazy loading, decode state, fallback, dimensions/aspect ratio, and approved source policy; it must not impose one crop on dossiers, mutations, guides, employees, and recycle files.

Migration should be additive:

1. Inventory all stored media URLs and classify local Supabase, approved external, missing, GIF, and oversized.
2. Introduce the shared renderer with the existing string URL contract and migrate one surface at a time.
3. Add upload metadata/derivatives for new files without rewriting old content.
4. Backfill or re-upload existing external media only after owner review.
5. Tighten `img-src`/`media-src` from broad `https:` to self, Supabase storage, and an explicit allowlist or same-origin proxy only after the inventory is clean.

Do not tighten CSP first; that would turn unresolved external URLs into broken content. Conversely, do not treat the current broad HTTPS policy as final release hardening.

Media release evidence should include no layout shift from known images, bounded bytes on phone, active-image priority only, lazy background collections, broken-media fallback, GIF behavior, storage authorization/listing policy, and cache headers for immutable UUID paths.

## Migration and Rollback Strategy

### Branch-by-abstraction rules

- Add the new module behind the current public interface.
- Route one consumer through it.
- Run deterministic, browser, visual, a11y, and console gates.
- Keep the old implementation until the new path is proven.
- Remove dead code in a later, separately reviewable increment.

### Rollback-friendly increments

| Change | Increment | Rollback |
|---|---|---|
| App registry | Add metadata registry, then consume metadata one field at a time | Restore old constants; no stored data changes |
| Window manager | Add pure transitions under existing handler names | Switch adapters back; retain old state shape until final cleanup |
| Desktop apps | Extract one leaf view with identical props/DOM | Re-inline that one view |
| Editor tabs | Extract one tab while keeping shared session in parent | Restore one import/body; history/data unchanged |
| Shared primitives | Migrate one repeated control family at a time | Return individual call sites to old markup |
| RPC contract | Add compatible new RPC/signature before app switch | Roll back app while old RPC remains granted |
| SQL | New immutable forward migration with assertions | Compensating migration; no destructive automated down migration |
| Media | Shared renderer accepts existing URLs before metadata is required | Revert individual surface; old URLs remain valid |
| Visual change | Separate commit tied to Figma contract and new baseline | Revert visual commit and baseline together |

Never combine schema migration, route rewrite, component extraction, and visual redesign in one plan. That would recreate the v1.2 mixed-scope verification failure.

## Release Gates

| Gate | Required evidence | Blocks |
|---|---|---|
| G0 — Baseline integrity | Dirty-file disposition, exact commit, current deterministic checks, current public/auth screenshots, browser console ledger | Any implementation work |
| G1 — Contract | Requirement trace, Figma UI/motion approval, threat/security delta, migration/rollback plan | Phase implementation |
| G2 — Deterministic | Unit/API/SQL contract tests, typecheck, lint, production build, production dependency audit | Browser verification |
| G3 — Browser | Playwright behavior on desktop/phone, role fixtures, console/network clean, accessibility scan, committed visual comparison | Phase acceptance |
| G4 — Live staging | Fresh migrations + seed, migration list, mutating Promotion RLS/concurrency suite, authenticated reviewer E2E, cleanup | Promotion acceptance and release |
| G5 — Security | Codex Security diff per phase; final managed deep scan; CSP/header/storage review; no unexplained production vulnerabilities | Release candidate |
| G6 — Owner UAT | Physical PC including DPR 1.25 drag/motion and authenticated reviewer; physical phone participant/editor flows; signed visual verdict | Release candidate |
| G7 — Release rehearsal | Staging deploy, backup/restore plan, migration expand/contract check, performance budgets, full gate rerun from clean checkout | Production approval |
| G8 — Production verification | Approved migration application, safe smoke checks, headers/assets/CDN verification, no console errors, evidence ledger closed | Milestone completion |

Accessibility should run as both automated scanning and task-focused keyboard checks. Automated scans do not replace focus order, drag alternatives, dialog focus return, mobile navigation, or the owner’s visual judgment.

## Compact Phase-Order Guidance

1. **Evidence and design contract** — reconcile the working tree; install/configure the project Playwright suite; capture current desktop/editor/Promotion references; approve Figma UI/motion states.
2. **Canonical Supabase staging** — introduce immutable migrations, dedicated staging and synthetic seeds; reconcile Phase 12/14 helpers; pass the mutating RLS/RPC/concurrency suite.
3. **Desktop shell decomposition** — registry, window state/hook, window chrome, leaf apps, taskbar/shortcuts/persistence, then data hooks; zero intentional visual change.
4. **Editor decomposition** — primitives, employee/access modules, tab modules, rich text, then session shell; zero intentional visual change.
5. **Desktop motion stabilization** — implement only approved Figma deltas for windows, shortcuts, assistant, wallpaper, spider, and web; collect deterministic checks plus owner motion evidence.
6. **Promotion proof** — close database/API findings, reviewer/bank UX, participant PC/phone paths, live browser workflow, cleanup, and owner acceptance after shell/editor boundaries are stable.
7. **Remaining apps and media** — common empty/loading/error/list limits, mobile navigation, search contracts, centralized media rendering, performance and CSP allowlist migration.
8. **Release verification** — full Codex Security, dependencies, a11y, console, visual, performance, staging rehearsal, physical UAT, production migration/smoke, and GSD ledger closure.

### Ordering rationale

- Baselines and Figma contracts must precede refactors or visual stabilization; otherwise “no regression” has no reference.
- Staging and canonical migrations must precede Promotion acceptance; read-only RPC inventory is not proof.
- Desktop/editor decomposition must precede final motion and Promotion UAT, or later structural work would invalidate acceptance.
- Promotion must be proven before broad per-app/media cleanup because it carries the highest unclosed data/security risk.
- CSP tightening follows media inventory/migration, not the reverse.
- Final security and release gates run after all code, SQL, visual, and media changes, from a clean checkout.

## Patterns to Avoid

### Replacing the monolith with a global context monolith

Moving every desktop/editor value into one context would keep coupling and increase rerenders. Prefer a small window manager, explicit app view models, typed editor commands, and independent data hooks.

### Registry-driven business logic

The registry may describe geometry and capabilities, but must not hide permission checks, Promotion state transitions, or editor save rules in metadata callbacks.

### TypeScript state machine duplicating Postgres

Client/domain code may validate commands and decode projections. It must not become a second authority for atomic workflow transitions already enforced by RPCs.

### Snapshot approval by threshold inflation

Do not raise pixel tolerances or mask whole windows to make a refactor pass. Stabilize dynamic inputs and investigate the diff.

### Editing historical SQL in place

Changing `phase14_apply.sql` after it has been manually run makes the repository look correct while remote state remains unknown. New changes require new migrations.

### CSP tightening before media migration

Blocking all external HTTPS media before inventory/backfill would create silent product regressions.

## Confidence Assessment

| Area | Confidence | Basis |
|---|---|---|
| Desktop/editor decomposition | HIGH | Direct inspection of 2,317-line desktop, 3,033-line editor, existing pure modules, current component seams, and forensic/audit evidence |
| App registry/window manager | HIGH | Current metadata/geometry/search/shortcut definitions are visibly duplicated in one file; extraction preserves established behavior |
| Promotion boundaries | HIGH | Direct inspection of routes, domain modules, RPC SQL, live-test harness, and v1.2 implementation record |
| Canonical migrations/staging | HIGH | Repository drift evidence plus current Supabase migration/environment guidance |
| Playwright fixtures/page objects | HIGH | Current repository has no suite; recommendation follows official fixture, auth, POM, project, and screenshot patterns |
| Visual/motion thresholds | MEDIUM | Architecture is clear, but reference images/timings require Figma and owner approval |
| Media transformation details | MEDIUM | Current ingestion/render paths are clear; exact derivative formats and budgets require asset inventory and phase-specific measurement |

## Sources

### Project evidence

- `.planning/PROJECT.md`
- `.planning/forensics/report-20261029-192309.md`
- `.planning/milestones/v1.2-INCOMPLETE-ROADMAP.md`
- `.planning/milestones/v1.2-INCOMPLETE-REQUIREMENTS.md`
- `.planning/audits/2026-10-29-full-site-audit.md`
- `components/portia-desktop.tsx`, `components/portia-editor.tsx`, `components/portia-promotion*.tsx`
- `lib/editor-*.ts`, `lib/portia-promotion*.ts`, `lib/portia-qualification.ts`, `lib/portia-device-binding.ts`
- `app/api/promotion/*/route.ts`, `app/api/uploads/route.ts`, `lib/media-url.ts`, `lib/image-upload.ts`
- `supabase/portia_setup.sql`, `supabase/phase12_apply.sql`, `supabase/phase14_apply.sql`
- `package.json`, `next.config.ts`, `.impeccable/surfaces/components-portia-desktop-tsx.md`

### Current official guidance

- [Playwright fixtures](https://playwright.dev/docs/test-fixtures) — isolated, composable setup/teardown and custom page-object fixtures (HIGH confidence)
- [Playwright authentication](https://playwright.dev/docs/auth) — setup projects, ignored storage state, and multiple-role contexts (HIGH confidence)
- [Playwright page object models](https://playwright.dev/docs/pom) — user-surface abstractions over locators and actions (HIGH confidence)
- [Playwright visual comparisons](https://playwright.dev/docs/test-snapshots) and [screenshot assertions](https://playwright.dev/docs/api/class-pageassertions) — deterministic baselines and animation handling (HIGH confidence)
- [Supabase managing environments](https://supabase.com/docs/guides/deployment/managing-environments) — local/staging/production flow with versioned migrations (HIGH confidence)
- [Supabase database migrations](https://supabase.com/docs/guides/local-development/database-migrations) — migration files as versioned schema history (HIGH confidence)
- [Supabase seeding](https://supabase.com/docs/guides/local-development/seeding-your-database) — reproducible test data after migrations (HIGH confidence)
- [Supabase deployment and branching](https://supabase.com/docs/guides/deployment) — separate staging/preview environments and migration validation (HIGH confidence)

---
*Architecture research for roadmap creation; no product code was modified.*
