---
last_mapped_commit: 2904899037d4243c8433d9d16a88f21ce7f7fe18
last_mapped_at: 2026-11-01
---
# Testing Patterns

**Analysis Date:** 2026-11-01

Scope of this analysis: `app/`, `components/`, `lib/` only. The Playwright suite under `tests/` was not explored; its existence and npm scripts are noted from `package.json`.

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`). No Jest or Vitest is installed.
- Requires Node `>=22.13.0 <23` (`package.json` `engines`). Reference Node is 22.13.1.
- Runs TypeScript directly via `--experimental-strip-types`, so no transpile step is needed for unit tests.
- Config: none. The run is driven by the `test` script in `package.json`.

**Assertion Library:**
- `node:assert/strict`, imported as `assert`. Used in all 45 test files.

**Test structure helpers:**
- `import test from "node:test";` in most files (38 files).
- `import { describe, test } from "node:test";` in 5 files that group cases (`lib/portia-promotion-live.test.ts`, `lib/e2e-target-guard.test.ts`, `lib/phase15-visual-manifest.test.ts`, and similar). Use `describe` only when grouping is needed; most files stay flat.
- `t.mock` (the `TestContext` from `node:test`) is used in one place (`lib/portia-employees.test.ts`).

**Run commands:**

```bash
npm test                                                             # Unit tests: node --experimental-strip-types --test lib/*.test.ts
node --experimental-strip-types --test lib/window-geometry.test.ts   # One file
node --watch --experimental-strip-types --test lib/<file>.test.ts   # Watch one file (no watch script defined)
node --experimental-test-coverage --experimental-strip-types --test lib/*.test.ts  # Ad hoc coverage (not configured)
npm run check                                                        # npm test, then next build, then lint
npm run lint                                                         # ESLint over the project
npm exec tsc -- --noEmit                                             # Type check (tests are type-checked too)
```

**Other test scripts (from `package.json`, detailed suite under `tests/` not analyzed):**
- `npm run test:promotion-live`: runs `lib/portia-promotion-live.test.ts` against an isolated Supabase test project. Opt-in only.
- `npm run test:e2e:preflight` and `npm run test:e2e*`: Playwright suites (`playwright.config.ts`). They run a preflight first and need a readable data source; without one, data-backed lanes fail with `ENOTFOUND`.
- Project rule: never run `phase15-visual-manifest.mjs --verify` (default mode); it rewrites signed evidence. Use `--verify-promotion` only.

## Test File Organization

**Location:**
- Co-located in `lib/`, next to the module under test. No `__tests__/` folder and no test files in `app/` or `components/`.
- The `test` script matches only `lib/*.test.ts`. A test placed anywhere else will NOT run unless the script is changed.

**Naming:**
- `<module-name>.test.ts`, matching the source file: `lib/portia-promotion-api.ts` -> `lib/portia-promotion-api.test.ts`.
- Non-module tests use descriptive names: `lib/e2e-import-boundary.test.ts`, `lib/security-headers.test.ts`, `lib/phase15-visual-manifest.test.ts`.

**Current inventory (45 files):**
- Promotion domain (largest group): `lib/portia-promotion.test.ts`, `lib/portia-promotion-api.test.ts`, `lib/portia-promotion-db.test.ts`, `lib/portia-promotion-live.test.ts`, `lib/portia-promotion-notifications.test.ts`, `lib/portia-promotion-reviewer.test.ts`, `lib/portia-promotion-security.test.ts`, `lib/portia-promotion-sheet.test.ts`, `lib/portia-promotion-ui.test.ts`, `lib/portia-promotion-editor.test.ts`, `lib/portia-qualification.test.ts`, `lib/portia-qualification-ui.test.ts`, `lib/portia-device-binding.test.ts`.
- Editor domain: `lib/editor-access.test.ts`, `lib/editor-changes.test.ts`, `lib/editor-field-look.test.ts`, `lib/editor-history.test.ts`, `lib/editor-items.test.ts`, `lib/editor-shortcuts.test.ts`, `lib/editor-tabs.test.ts`.
- Content and desktop: `lib/portia-content-normalize.test.ts`, `lib/portia-employees.test.ts`, `lib/portia-desktop.test.ts`, `lib/content-limits.test.ts`, `lib/content-sync.test.ts`, `lib/broadcasts.test.ts`, `lib/format-fragments.test.ts`, `lib/rich-text-style.test.ts`, `lib/image-upload.test.ts`, `lib/media-url.test.ts`, `lib/request-json.test.ts`, `lib/portia-sql.test.ts`.
- Layout and visuals: `lib/accent-theme.test.ts`, `lib/wallpaper-web.test.ts`, `lib/window-geometry.test.ts`, `lib/panel-position.test.ts`, `lib/layout-hydration.test.ts`, `lib/security-headers.test.ts`.
- Phase 15 verification harness: `lib/e2e-actors.test.ts`, `lib/e2e-diagnostics.test.ts`, `lib/e2e-import-boundary.test.ts`, `lib/e2e-preflight.test.ts`, `lib/e2e-target-guard.test.ts`, `lib/e2e-visual-policy.test.ts`, `lib/phase15-visual-manifest.test.ts`.

**Structure:**

```
lib/
  portia-promotion-api.ts
  portia-promotion-api.test.ts
  portia-promotion-security.test.ts    # reads supabase/phase14_apply.sql and app/api/promotion/*/route.ts
  portia-promotion-ui.test.ts          # reads components/portia-promotion.tsx and app/portia.css
  window-geometry.ts
  window-geometry.test.ts
```

## Test Structure

**Import header (typical):**

```ts
import assert from "node:assert/strict";
import test from "node:test";
import { fitGeometry, resizeGeometry } from "./window-geometry.ts";
```

- Import the module under test with an explicit `.ts` extension and a relative path. Required by the strip-types runner.
- `node:` prefix for all built-ins (`node:fs`, `node:crypto`, `node:child_process`, `node:os`, `node:url`).
- Some modules import `@supabase/supabase-js` directly (`lib/portia-promotion-live.test.ts`), which is only acceptable in opt-in live tests.

**Suite Organization:**
- Flat list of `test("<behavior sentence>", () => { ... })` calls in most files. Use `describe` only for grouping in the larger harness files.
- Test names are full sentences describing observable outcomes, not method names. Examples from the codebase:
  - `"a save round-trip keeps every field"`
  - `"broken payloads are rejected instead of saved"`
  - `"promotion status distinguishes access outage, nickname absence, and promotion-roster outage"`
  - `"status restores the bound nickname from the exact HttpOnly device token"`
  - `"security regression: direct table access is denied and a reviewer without promo is rejected"`
- Keep this style. Prefix security checks with `security regression:` as in `lib/portia-promotion-security.test.ts`.

**Patterns:**
- Setup: build inputs inline in each test. Shared fixtures are module-level constants (`const minimum = { width: 680, height: 320 };`) or small helpers (`function sheet(rows: string[])` in `lib/portia-employees.test.ts`).
- Dependency-injection fixture builder (the standard for promotion API tests). A `dependencies(overrides)` helper returns a full dependency object plus a `calls` counter record so tests can assert both results and call counts (`lib/portia-promotion-api.test.ts`):

```ts
function dependencies(overrides: Partial<PromotionApiDependencies> = {}) {
  const calls = { resolve: 0, status: 0, submit: 0, submitInputs: [] as unknown[] };
  const deps: PromotionApiDependencies = {
    now: () => new Date("2026-10-27T00:00:00.000Z"),
    secret,
    loadAccessRoster: async () => accessRoster,
    resolveDevice: async () => { calls.resolve += 1; return { status: "ok", nicknameKey: "alice" }; },
    ...overrides,
  };
  return { deps, calls };
}
```

- Cloning shared fixtures before mutation: always `structuredClone(defaultPortiaContent)` (used in 7 test files) so tests do not leak state.
- Teardown: `after`/`before` hooks are used only in the live Supabase test (`lib/portia-promotion-live.test.ts`) and the `phase15-visual-manifest` harness. Unit tests are pure and need none. In `lib/portia-employees.test.ts`, `t.mock.restoreAll()` is called in a `finally`-style cleanup.
- Assertion pattern: multiple focused assertions per test are fine. Prefer `assert.deepEqual` for whole-object checks and `assert.equal` for single fields. Use `assert.match(value, /regex/, "message")` and `assert.doesNotMatch` for text checks, with a message argument where the failure needs context.
- Use the third argument of `assert.*` for a failure label when asserting table-driven rules: `assert.match(sql, new RegExp(...), \`${table} RLS\`)`.

## Source-Scan Tests (Important Pattern)

A large share of tests (about 20 files) do not execute components or routes. They read source text with `readFileSync` and assert on it. This is how UI copy, route wiring, RLS policy, and CSS rules are guarded.

**Where it is used:**
- UI copy and structure: `lib/portia-promotion-ui.test.ts`, `lib/portia-qualification-ui.test.ts`, `lib/portia-desktop.test.ts`, `lib/editor-field-look.test.ts`, `lib/layout-hydration.test.ts`.
- Route wiring and SQL policy: `lib/portia-promotion-security.test.ts` (checks `supabase/phase14_apply.sql` for RLS enable and revoke statements, and that routes call `requirePromotionReviewer`), `lib/portia-sql.test.ts`, `lib/portia-promotion-db.test.ts`.
- Import boundaries: `lib/e2e-import-boundary.test.ts` walks `app/`, `components/`, `lib/` and fails if production source matches `tests[\\/]e2e`.
- Headers: `lib/security-headers.test.ts`.

**Example (`lib/portia-promotion-ui.test.ts`):**

```ts
const source = readFileSync(new URL("../components/portia-promotion.tsx", import.meta.url), "utf8");

test("participant gate explains lookup binding ...", () => {
  assert.ok(source.includes("function PromotionIdentityGate"));
  assert.doesNotMatch(source, /(?:localStorage|sessionStorage)\.setItem\([^\n]*(?:nickname|checkedNickname)/i);
});
```

**Rules for new source-scan tests:**
- Anchor on a stable string the user sees or a code identifier, not on layout or formatting, so harmless reformatting does not break the test.
- Use `source.includes` for exact strings and `assert.match` for patterns. Keep regexes narrow.
- Prefer a behavioral unit test when the logic can live in a `lib/` function. Use a source scan only for things that cannot be imported, such as JSX structure, CSS rules, and SQL policy.

## Mocking

**Framework:** `node:test` `t.mock` only. No third-party mocking library.

**Patterns actually used:**
- Pure-function design is the primary approach. Modules take external inputs as parameters:
  - `rosterFromRows(rows, robloxProfiles, knownRobloxIds)` in `lib/portia-employees.ts` takes the Roblox lookup results as a `Map`.
  - `createPromotionApiDependencies(supabase, secret)` and the `PromotionApiDependencies` record in `lib/portia-promotion-api.ts` let tests swap every I/O call.
  - `fitGeometry` and `resizeGeometry` take `bounds` and `minimum` as arguments.
- `t.mock.method` is used for globals only, in `lib/portia-employees.test.ts`:

```ts
t.mock.method(globalThis, "fetch", async (url: string) => { /* return a fake Response */ });
t.mock.method(console, "error", () => {});   // silence and capture expected logs
t.mock.restoreAll();
```

**What to Mock:**
- Network: `globalThis.fetch` via `t.mock.method`, or better, a dependency object parameter.
- Supabase: inject a fake through the parameter (`loadEmployees(supabase: SupabaseClient)` already accepts a client). Do not install a global mock for Supabase.
- `console.error` only when the test deliberately triggers a logged failure path.
- Time: pass `now: () => new Date(...)` through the dependencies, as the promotion tests do with `"2026-10-27T00:00:00.000Z"`.

**What NOT to Mock:**
- Normalizers, the CSV parser, device token digests, and the cooldown math. Tests run them on real data, e.g. `parseCsv('a,"b, c","say ""hi""","two\nlines"\r\nlast')`.
- `structuredClone` and the `defaultPortiaContent` fixture.

## Fixtures and Factories

**Test Data:**
- Canonical content fixture: `defaultPortiaContent` exported from `lib/portia-content.ts`. Clone it and mutate:

```ts
const content = structuredClone(defaultPortiaContent);
content.viruses[0].infectedImage = "javascript:alert(1)";
```

- Promotion fixtures are typed literals with real Russian titles and ISO timestamps, e.g. `title: "Академик"`, `promotedAt: "2026-10-01T00:00:00.000Z"` (`lib/portia-promotion-api.test.ts`). Keep the names and types aligned with `lib/portia-promotion.ts`.
- Device-secret fixture: tests use a fixed string of at least 32 characters, for example `"test-secret-that-is-long-enough-for-device-binding"`. Never use a real secret.
- CSV input is built as a string with a header constant and `\r\n` joins (`sheet(rows)` in `lib/portia-employees.test.ts`). Keep the header in sync with the column names the roster code reads.
- Generated sequences use `Array.from({ length: N }, (_, index) => ...)`.
- Temporary files: `tmpdir()` from `node:os` is used in `lib/phase15-visual-manifest.test.ts`. Clean up any temp file you create.

**Location:**
- Fixtures are inline in each test file or exported from the module under test (`defaultPortiaContent`). No separate fixtures directory is used in `lib/`.

## Coverage

**Requirements:** None enforced. No coverage threshold, no coverage tool in `package.json`, no CI gate on coverage.

**View Coverage (ad hoc):**

```bash
node --experimental-test-coverage --experimental-strip-types --test lib/*.test.ts
```

**Practical coverage (by inspection):**
- Well covered by pure unit tests: `lib/portia-content-normalize.ts`, `lib/window-geometry.ts`, `lib/portia-employees.ts` (CSV, roster, IDs, profile fallback, sanitizing), `lib/portia-promotion-api.ts` (status and submit flows via injected dependencies), `lib/portia-promotion-notifications.ts`, `lib/portia-device-binding.ts`, `lib/editor-changes.ts`, `lib/editor-history.ts`, `lib/editor-tabs.ts`, `lib/editor-items.ts`.
- Covered only by source scan, so behavior is not executed: `components/portia-promotion*.tsx`, `components/portia-desktop.tsx`, `components/portia-editor.tsx`, and the Supabase-backed paths of `lib/portia-promotion-sheet.ts` (the database contract is checked by `lib/portia-promotion-db.test.ts` through source scans of `supabase/`).
- Not covered by any unit test in `app/` or `components/`: every route under `app/api/**/route.ts`, `app/owner-login/actions.ts`, `app/layout.tsx`, `app/page.tsx`, `proxy.ts`. Route behavior is only checked by the source-scan tests and by the promotion API tests that call the route-independent functions.
- `lib/supabase/*.ts` and `lib/editor-access.ts` have no direct unit tests.

## Test Types

**Unit Tests:**
- The bulk of the suite: one module per file, deterministic input, no network, no filesystem except source-scan reads.
- Good candidates for new unit tests: any new function in `lib/`, any new normalizer branch, any new promotion status mapping, any change to geometry or CSV rules.

**Source-Scan Tests:**
- Guards for UI copy, route wiring, SQL RLS policy, and import boundaries. See the section above.

**Opt-in Live Tests:**
- `lib/portia-promotion-live.test.ts` runs only when `npm_lifecycle_event === "test:promotion-live"` and the required env vars exist. Otherwise a placeholder test is skipped with a message:

```ts
test("live Promotion database verification is opt-in", { skip: "run npm run test:promotion-live against an isolated Supabase test project" }, () => {});
```

- Mutation probes require `PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY` and the confirmation `ISOLATED_TEST_PROJECT`. Never point these at production. Default to the read-only preflight (`PORTIA_PROMO_LIVE_CONFIRM=READ_ONLY_PREFLIGHT`).
- Rules from the project: do not run these against production Supabase, and do not record skipped or BLOCKED live runs as passes.

**Integration Tests:**
- None in-repo for Supabase-backed flows. RPC behavior and RLS are defined in `supabase/*.sql` and exercised only through the opt-in live test and source-scan checks.

**E2E Tests:**
- Playwright (`@playwright/test` 1.64.1), configured by `playwright.config.ts`. The suite lives under `tests/e2e/` (not analyzed here). Scripts: `npm run test:e2e:smoke` (`--grep @smoke` on `chromium-desktop`), `npm run test:e2e`, `npm run test:e2e:visual`, `npm run test:e2e:mutation`.
- Accessibility checks use `@axe-core/playwright` 4.14.0.
- Unit tests in `lib/e2e-*.test.ts` guard the E2E harness itself (preflight, target guard, actor and visual policy). `lib/e2e-target-guard.test.ts` imports `../tests/e2e/fixtures/target-guard.ts`, so `tests/e2e/fixtures` must stay importable as TypeScript.

## Common Patterns

**Round-trip assertion (normalizers):**

```ts
const once = normalizePortiaContent(structuredClone(defaultPortiaContent));
assert.ok(once);
assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
```

**Rejection of bad input (return `null`, do not throw):**

```ts
assert.equal(normalizePortiaContent(null), null);
assert.equal(normalizePortiaContent({ viruses: [] }), null);
```

**Status-tagged result checks:**

```ts
const unavailable = dependencies({ loadAccessRoster: async () => ({ status: "unavailable", reason: "network" }) });
assert.equal((await promotionStatus({ nickname: "Alice", token: null }, unavailable.deps)).status, 503);
assert.equal(missing.calls.status, 0);   // dependency was not called
```

**Sanitization / clamping:**

```ts
content.viruses[0].infectedImage = "javascript:alert(1)";
const normalized = normalizePortiaContent(content);
assert.ok(normalized);
assert.equal(normalized.viruses[0].infectedImage, "");
```

- Narrow with `assert.ok(value)` before accessing properties to satisfy TypeScript strictness in tests.

**Geometry and boundary checks:**

```ts
const fitted = fitGeometry({ x: 200, y: 100, width: 1120, height: 760 }, { width: 960, height: 600 }, minimum);
assert.deepEqual(fitted, { x: 8, y: 8, width: 944, height: 584 });
```

- Assert exact pixel values computed by hand from the margin of 8 and the minimum size.

**Async Testing:**
- Use `test("...", async () => { ... })` and `await` the call. Pass fake dependencies through the parameter. Roughly 78 async test cases exist, mostly in the promotion API and sheet tests.

**Error Testing:**
- Prefer returning `null` or a status tag and asserting on it.
- For thrown errors, use `assert.throws`. `rosterFromRows` in `lib/portia-employees.ts` throws `"The Portia sheet headers have changed."` when required columns are missing. Add an assertion when touching that code:

```ts
assert.throws(() => rosterFromRows(parseCsv('"x"\r\n'), new Map()), /headers have changed/);
```

- For config failures, assert the message: `requireSecret` in `lib/portia-device-binding.ts` throws for secrets shorter than 32 characters.

## Guidance for New Tests

- Add `lib/<module>.test.ts` beside any new `lib/<module>.ts` that has non-trivial logic (branches, parsing, clamping, persistence shape, status mapping).
- Import with `./<module>.ts` (explicit extension) and `node:test` / `node:assert/strict`.
- Inject dependencies as an object parameter, following `createPromotionApiDependencies`, and test with plain data. Use `t.mock.method` only for globals such as `fetch` or `console.error`, and call `t.mock.restoreAll()`.
- Use `structuredClone` on shared fixtures before mutating.
- Keep unit tests free of network and database I/O. Opt-in live checks belong only in the `test:promotion-live` path, against an isolated test project.
- Source-scan tests are acceptable for JSX copy, CSS, and SQL policy. Anchor them on user-visible strings or identifiers.
- If you want tests outside `lib/`, widen the `test` script glob in `package.json` first; otherwise they silently do not run.
- Before finishing, run `npm test` and `npm run lint`, then `npm exec tsc -- --noEmit`, or use `/portia-check` (`bash .claude/skills/portia-check/run.sh`), which also runs the visual manifest test. Report each step's real result.

---

*Testing analysis: 2026-11-01*
