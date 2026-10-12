---
last_mapped_commit: e3941d4a097005a1674d3e9bc4d1e638aeda0846
last_mapped_at: 2026-10-12
---
# Testing Patterns

**Analysis Date:** 2026-10-12

## Test Framework

**Runner:**
- Node.js built-in test runner (`node:test`). No Jest, Vitest, or other third-party runner is installed.
- Requires Node `>=22.13.0 <23` (`package.json` `engines`).
- Runs TypeScript directly via `--experimental-strip-types`, so no transpile or build step is needed for tests.
- Config: none. The run is driven entirely by the `test` script in `package.json`.

**Assertion Library:**
- `node:assert/strict` (imported as `assert`). Use `assert.equal`, `assert.deepEqual`, `assert.ok`, `assert.strictEqual` semantics via the strict module.

**Run Commands:**

```bash
npm test                 # Run all tests: node --experimental-strip-types --test lib/*.test.ts
npm run check            # Tests, then `next build`, then lint (the full gate)
npm run lint             # ESLint over the project (not tests-specific)
node --experimental-strip-types --test lib/window-geometry.test.ts   # Run a single test file
```

- No watch mode script is defined. Use `node --watch --experimental-strip-types --test lib/<file>.test.ts` for watch if needed.
- No coverage script or coverage tool is configured. `.gitignore` reserves `/coverage`, but nothing writes to it.

## Test File Organization

**Location:**
- Co-located in `lib/`, next to the module under test. There is no `__tests__/` folder and no top-level `tests/` folder.
- Only `lib/` is covered. Tests are picked up by the glob `lib/*.test.ts` in the `test` script; a test placed elsewhere (e.g. `components/` or `app/`) will NOT run unless the script is changed.

**Naming:**
- `<module-name>.test.ts`, matching the source file name: `lib/window-geometry.ts` -> `lib/window-geometry.test.ts`.

**Current files:**
- `lib/portia-content-normalize.test.ts` (4 tests)
- `lib/window-geometry.test.ts` (4 tests)
- `lib/portia-employees.test.ts` (4 tests)

**Structure:**

```
lib/
  portia-content-normalize.ts
  portia-content-normalize.test.ts
  window-geometry.ts
  window-geometry.test.ts
  portia-employees.ts
  portia-employees.test.ts
```

## Test Structure

**Import header (every test file uses this):**

```ts
import test from "node:test";
import assert from "node:assert/strict";
import { fitGeometry, resizeGeometry } from "./window-geometry.ts";
```

- Import with explicit `.ts` extension and a relative path. This is required by the strip-types runner.
- Import `test` as a default import from `node:test`.

**Suite Organization:**
- No `describe` blocks. Each file is a flat list of `test("<behavior sentence>", () => { ... })` calls.
- Test names are full sentences describing observable behavior, not method names:
  - `"a save round-trip keeps every field"`
  - `"broken payloads are rejected instead of saved"`
  - `"dragging the left edge keeps the right edge in place"`
  - `"the Roblox id keeps an employee's id stable across nickname changes"`
- Keep this style for new tests. Describe the outcome in plain language.

**Patterns:**
- Setup: build inputs inline in each test. Shared fixtures are module-level constants (`const minimum = { width: 680, height: 320 };` in `lib/window-geometry.test.ts`) or small helper functions (`function sheet(rows: string[])` in `lib/portia-employees.test.ts`).
- Cloning shared fixtures before mutation: always `structuredClone(defaultPortiaContent)` so tests do not leak state into each other.
- Teardown: none needed. Tests are pure functions with no I/O, timers, or global state.
- Assertion pattern: multiple focused assertions per test are fine. Prefer `assert.deepEqual` for whole-object checks and `assert.equal` for single fields.

**Round-trip and invariant tests:**
- Test normalizers for idempotence: `normalizePortiaContent(structuredClone(once))` must deep-equal `once` (`lib/portia-content-normalize.test.ts`).
- Test that invalid input returns `null` rather than throwing: `assert.equal(normalizePortiaContent(null), null);`.

## Mocking

**Framework:** None. No mocking library is installed and no `mock`, `spy`, or `stub` calls exist.

**Patterns used instead:**
- Pure-function design avoids the need for mocks. The modules that matter for tests take their external inputs as parameters:
  - `rosterFromRows(rows, robloxProfiles, knownRobloxIds)` in `lib/portia-employees.ts` takes the Roblox lookup results as a `Map` instead of calling the network. Tests pass `new Map([["oldname", { id: 42, avatarUrl: "", fullAvatarUrl: "" }]])`.
  - `withProfile(employee, index)` takes a prebuilt `ProfileIndex`. Tests construct the index literal inline.
  - `fitGeometry` and `resizeGeometry` take `bounds` and `minimum` as arguments rather than reading `window`.
- Follow this approach: when writing new logic, pass dependencies in as arguments so the test can supply plain data.

**What to Mock:**
- Nothing is mocked today. If a future test must touch network or Supabase, inject a fake object through a parameter (as `loadEmployees(supabase: SupabaseClient)` already accepts a client) rather than installing a global mock.
- `global.fetch` is the one likely candidate if network code gets tested. `node:test` supports `mock.method(globalThis, "fetch", ...)` from `node:test` for that case.

**What NOT to Mock:**
- Do not mock the normalizers or the CSV parser. Tests exercise them directly with real data, e.g. `parseCsv('a,"b, c","say ""hi""","two\nlines"\r\nlast')`.
- Do not mock `structuredClone` or the default content fixture.

## Fixtures and Factories

**Test Data:**
- The canonical fixture is `defaultPortiaContent` exported from `lib/portia-content.ts`. Tests clone it with `structuredClone` and mutate the clone:

```ts
const content = structuredClone(defaultPortiaContent);
content.viruses[0].infectedImage = "javascript:alert(1)";
content.viruses[0].scientistLogs = Array.from({ length: 7 }, (_, index) => ({
  id: `log-${index}`, title: "", scientist: "", lockedLevel: 2, content: ["text"],
}));
```

- CSV input is built as a string with a header constant and `\r\n` joins: `const header = '"Номер","Никнейм сотрудника",...'` and `sheet(rows)` in `lib/portia-employees.test.ts`. Keep the header in sync with the column names `rosterFromRows` looks up.
- Generated sequences use `Array.from({ length: N }, (_, index) => ...)`.

**Location:**
- Fixtures are inline in each test file or exported from the module under test (`defaultPortiaContent`). There is no separate fixtures directory.

## Coverage

**Requirements:** None enforced. No coverage threshold, no coverage tool, and no CI gate on coverage.

**View Coverage:**

```bash

# Not configured. Node's built-in coverage can be used ad hoc:

node --experimental-test-coverage --experimental-strip-types --test lib/*.test.ts
```

**Practical coverage (by inspection):**
- Covered: `lib/portia-content-normalize.ts`, `lib/window-geometry.ts`, `lib/portia-employees.ts` (CSV parsing, roster building, ID stability, profile fallback, sanitizing).
- Not covered by any test:
  - All API routes in `app/api/*/route.ts` and the server action file `app/owner-login/actions.ts`.
  - `lib/editor-access.ts`, `lib/portia-cdn.ts`, `lib/supabase/*.ts`, `proxy.ts`.
  - `lib/portia-content.ts` beyond its use as a fixture (helpers like `createVirusRecycleFiles`, `scientistLogPlainText`, `cloneDefaultContent`).
  - Every component in `components/` (`portia-desktop.tsx`, `portia-editor.tsx`, `portia-icons.tsx`, `portia-wallpaper.tsx`).
- No end-to-end tests. No Playwright or Cypress config exists.

## Test Types

**Unit Tests:**
- Everything that exists is a unit test of a pure function in `lib/`. Scope: one module per file, deterministic input, no I/O.
- Good candidates for new unit tests: any new function in `lib/`, any new field added to the normalizer, any change to geometry or CSV rules.

**Integration Tests:**
- Not present. Supabase-backed flows (`portia_content` upserts with revision checks, `portia_can_edit` RPC) are untested in-repo. Their behavior is defined in `supabase/portia_setup.sql`.

**E2E Tests:**
- Not used. Manual verification is done through `npm run dev` on the port in `.claude/launch.json` (3123).

## Common Patterns

**Round-trip assertion (normalizers):**

```ts
const once = normalizePortiaContent(structuredClone(defaultPortiaContent));
assert.ok(once);
assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
```

**Rejection of bad input:**

```ts
assert.equal(normalizePortiaContent(null), null);
assert.equal(normalizePortiaContent({ viruses: [] }), null);
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

- Assert exact pixel values, computed by hand from the margin of 8 and the minimum size. Include the arithmetic in the test name or a comment when the number is not obvious.

**Async Testing:**
- No async tests exist yet. When needed, declare `test("...", async () => { ... })` and `await` the call. Pass a fake client through the parameter (see Mocking).

**Error Testing:**
- Prefer returning `null` and asserting on it (the codebase's style for invalid input).
- For thrown errors, use `assert.throws`. Example from the source that throws: `rosterFromRows` throws `"The Portia sheet headers have changed."` when required columns are missing. No test currently asserts this; add one when touching that code:

```ts
assert.throws(() => rosterFromRows(parseCsv('"x"\r\n'), new Map()), /headers have changed/);
```

## Guidance for New Tests

- Add a file `lib/<module>.test.ts` beside any new `lib/<module>.ts` that contains non-trivial logic (branches, parsing, clamping, persistence shape).
- Import with `./<module>.ts` (explicit extension) and `node:test` / `node:assert/strict`.
- Use `structuredClone` on shared fixtures before mutating.
- Keep tests free of I/O. If logic needs Supabase or `fetch`, split out a pure function that takes the data as arguments and test that.
- If you want tests outside `lib/`, widen the `test` script's glob in `package.json` first; otherwise they silently do not run.
- Run `npm run check` before finishing: it chains tests, `next build`, and lint.

---

*Testing analysis: 2026-10-12*
