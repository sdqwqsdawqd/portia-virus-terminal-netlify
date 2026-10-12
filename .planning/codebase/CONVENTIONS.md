---
last_mapped_commit: e3941d4a097005a1674d3e9bc4d1e638aeda0846
last_mapped_at: 2026-10-12
---
# Coding Conventions

**Analysis Date:** 2026-10-12

## Naming Patterns

**Files:**
- Kebab-case for every source file, prefixed by domain in most places: `lib/portia-content.ts`, `lib/portia-content-normalize.ts`, `lib/portia-employees.ts`, `lib/window-geometry.ts`, `components/portia-desktop.tsx`, `components/portia-editor.tsx`, `components/portia-icons.tsx`, `components/portia-wallpaper.tsx`, `lib/supabase/server.ts`, `lib/supabase/proxy.ts`, `lib/supabase/env.ts`.
- Next.js route files use framework names: `app/page.tsx`, `app/layout.tsx`, `app/api/<resource>/route.ts`, `app/owner-login/page.tsx`, `app/owner-login/actions.ts`, root `proxy.ts`.
- Tests are co-located in `lib/` and named `<module>.test.ts`: `lib/portia-content-normalize.test.ts`, `lib/window-geometry.test.ts`, `lib/portia-employees.test.ts`.
- Stylesheets: `app/globals.css` and `app/portia.css`.

**Functions:**
- camelCase for all functions. Exported React components are PascalCase function declarations: `export function PortiaDesktop(...)` in `components/portia-desktop.tsx`, `export function PortiaEditor(...)` in `components/portia-editor.tsx`.
- Internal helper components are also PascalCase and live in the same file below the main export, e.g. `BootScreen`, `DesktopIcon`, `DraggableDesktopIcon`, `EmbeddedDocument`, `AppWindow` in `components/portia-desktop.tsx`; `OrderDragHandle`, `ClassificationField`, `FormattedTextarea`, `EditorAccessManager` in `components/portia-editor.tsx`.
- Route handlers are named exports `GET`, `PUT`, `POST`, `PATCH` (`app/api/content/route.ts`, `app/api/uploads/route.ts`, `app/api/employees/route.ts`).
- Server actions are named exports in a `"use server"` file: `ownerLogin`, `editorSignUp`, `ownerLogout` in `app/owner-login/actions.ts`.
- Pure helpers may be arrow functions when they are one-liners: `const escapeSearch = (value: string) => ...`, `const clone = (content: PortiaContent) => ...` in `components/portia-desktop.tsx` and `components/portia-editor.tsx`.
- Module-internal helpers are not exported unless tests need them. `normalizeRecycleFiles`, `normalizeRichText`, `normalizeMediaUrl` in `lib/portia-content-normalize.ts` are private; only `normalizePortiaContent` is exported.

**Variables and constants:**
- camelCase for variables. Module-level constants that are configuration or storage keys use camelCase too, not SCREAMING_CASE: `defaultDesktopSettings`, `initialWindows`, `appMeta`, `embeddedApps`, `broadcastReadStorageKey`, `contentCacheStorageKey`, `shortcutPositionsStorageKey` (`components/portia-desktop.tsx`).
- Cache and tag identifiers are camelCase strings: `contentCacheTag = "portia-content"`, `employeesCacheTag = "portia-employees"` in `lib/portia-cdn.ts`.
- localStorage keys are kebab-case strings with a version suffix: `"portia-desktop-settings-v1"`, `"portia-broadcasts-read-signature-v1"`, `"portia-desktop-shortcuts-v2"`. Bump the suffix when the stored shape changes.
- Lookup maps use `Record<Union, ...>` objects keyed by string-literal unions, e.g. `Record<AppId, WindowState>` in `components/portia-desktop.tsx`.
- Generated IDs use prefixes: `makeId = (prefix) => \`${prefix}-${Date.now().toString(36)}-${random}\`` in `components/portia-editor.tsx`; Roblox-derived employee ids are `roblox-<n>` (`lib/portia-employees.ts`).

**Types:**
- Use `type` aliases, not `interface`, throughout: `export type PortiaContent = {...}` in `lib/portia-content.ts`, `type WindowState = {...}` in `components/portia-desktop.tsx`. No `interface` declarations were found in the app code.
- Union string literals instead of enums: `type AppId = "archive" | "employees" | ...`, `type SaveState = "idle" | "saving" | "saved" | "error" | "conflict"`, `type ResizeEdge = "n" | "s" | ...` (`lib/window-geometry.ts`). No `enum` usage.
- Derive types from data where possible: `type RosterEmployee = Omit<PortiaEmployee, EditableFields>`, `type EmployeeProfile = Pick<PortiaEmployee, EditableFields>` in `lib/portia-employees.ts`.
- Import type-only symbols inline with `type` modifier: `import { ..., type PortiaContent, type RecycleFile } from "@/lib/portia-content";`.
- `any` is not used in application code. Unknown input is typed `unknown` and narrowed (see `normalizePortiaContent(value: unknown)` in `lib/portia-content-normalize.ts`).

## Code Style

**Formatting:**
- No Prettier or Biome config is present. Style is applied by hand and is consistent across files:
  - Double quotes for strings and JSX attributes.
  - Semicolons at statement ends.
  - Two-space indentation.
  - Trailing commas in multi-line object and argument lists.
  - Long one-line helpers are common. Components and lib modules routinely exceed 120 characters on a single line; do not reformat existing code to a narrower width just for style.
- Single-line `if` bodies without braces are the norm for guards: `if (!user?.email) return noAccess;`, `if (error) redirect("/owner-login?error=invalid");`.
- Multi-statement one-liners are used for tiny handlers: `try { window.localStorage.setItem(key, value); } catch {}` in `components/portia-desktop.tsx`.

**Linting:**
- ESLint flat config in `eslint.config.mjs`: `eslint-config-next/core-web-vitals` plus `eslint-config-next/typescript`, wrapped with `defineConfig`. No custom rules are added on top.
- Ignores: `.next/**`, `out/**`, `next-env.d.ts` (plus the CLI `--ignore-pattern dist --ignore-pattern .next`).
- Run with `npm run lint`. There are no `eslint-disable` comments in the codebase.
- TypeScript is `strict: true` (`tsconfig.json`). `npm run check` runs tests, build, and lint together.

**Type-checking escape hatches:**
- None found. No `@ts-ignore`, `@ts-expect-error`, or `as any`. Casts to concrete types are used at the JSON boundary, e.g. `JSON.parse(raw) as { content?: unknown; revision?: unknown }` in `app/api/content/route.ts`, then immediately validated.

## Import Organization

**Order (observed):**
1. Framework and third-party packages: `next/navigation`, `next/cache`, `next/dynamic`, `react`, `@supabase/supabase-js`, `@netlify/functions`.
2. Project modules via the `@/` alias: `@/lib/...`, `@/components/...`.
3. Relative imports only inside `lib/` and sibling test files (see below).

Example from `app/api/employees/route.ts`:

```ts
import { createPublicSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getEditorAccess } from "@/lib/editor-access";
import { employeesCacheTag, noStoreHeaders, publicCacheHeaders, purgeCacheTag } from "@/lib/portia-cdn";
import { loadEmployees, sanitizeEmployeeUpdate, saveEmployeeProfile } from "@/lib/portia-employees";
```

**Path aliases:**
- `@/*` maps to the project root (`tsconfig.json` `paths`). Use it from `app/`, `components/`, and cross-folder `lib/` imports (`lib/supabase/server.ts` imports `@/lib/supabase/env`).

**Explicit `.ts` extensions inside `lib/`:**
- Modules in `lib/` import their siblings with explicit extensions: `import { ... } from "./portia-content.ts";` (`lib/portia-content-normalize.ts`). This is required so the tests run under `node --experimental-strip-types`, and `tsconfig.json` sets `allowImportingTsExtensions: true`. Do not switch these to extensionless or `@/` imports, or the test runner breaks.
- Components and app code use extensionless `@/` imports.

**Barrel files:**
- None. Every import points at the defining module.

## Error Handling

**API routes (`app/api/*/route.ts`):**
- Wrap the handler body in `try { ... } catch (error) { console.error("PORTIA <what failed>", error); return Response.json({ error: "<user message>" }, { status: 500 }); }`. Examples: `app/api/content/route.ts` (`PUT`), `app/api/uploads/route.ts` (`POST`), `app/api/employees/route.ts` (`GET`, `PATCH`).
- Check authorization first and return early with 403 before reading the body:

```ts
const access = await getEditorAccess(supabase, user);
if (!user || !access.canEdit) {
  return Response.json({ error: "У вас нет доступа к редактору." }, { status: 403 });
}
```

- Validate input explicitly and return 400 (`"Некорректная структура данных."`), 413 for size limits, 415 for unsupported media types (`app/api/uploads/route.ts`), 404 for missing records, 409 for optimistic-concurrency conflicts (`app/api/content/route.ts`).
- Non-fatal side effects never fail the request: `purgeCacheTag` swallows and logs its own errors (`lib/portia-cdn.ts`).
- Inside a `try`, rethrow Supabase errors that should become 500s: `if (error) throw error;`.

**Read paths that fall back:**
- Public GET endpoints degrade rather than fail hard. `GET /api/content` returns `defaultPortiaContent` when the stored payload is invalid (`app/api/content/route.ts`). `GET /api/employees` returns `{ employees: [], degraded: true }` with status 502 on failure (`app/api/employees/route.ts`).
- Helper lookups log and return a safe value: `getEditorAccess` returns `noAccess` on RPC error (`lib/editor-access.ts`).

**Server actions (`app/owner-login/actions.ts`):**
- Report failures by redirecting with a query code, not by throwing: `redirect("/owner-login?error=invalid")`. The page maps codes to messages.

**Client components:**
- Swallow storage errors with empty catches around `localStorage` access, which can throw in private modes: `try { window.localStorage.setItem(...) } catch {}`.
- Use `try/catch` around `JSON.parse` of stored data and fall back to defaults (`components/portia-desktop.tsx`, `components/portia-editor.tsx`).
- Promise chains use `.catch(() => { if (active) setState("error"); })` with an `active` flag for cleanup (`components/portia-editor.tsx`).
- Save results are a typed state machine (`SaveState`), not thrown exceptions.

**Empty catch blocks:**
- `catch {}` (optional catch binding, no variable) is the accepted form for intentionally ignored errors. Use `catch (error)` plus `console.error` when the error matters to operators.

**Input normalization at trust boundaries:**
- Every value that enters from the network or from storage passes through a normalizer. Do not trust shapes: `normalizePortiaContent` in `lib/portia-content-normalize.ts` clamps lengths (`slice(0, 100_000)`, `slice(0, 500)`, `slice(0, 1000)`), bounds numbers (`Math.min(48, Math.max(10, ...))`), whitelists enum-like values (`["virus", "text", "image"].includes(...)`), and rejects unsafe URLs (only `https://` or `/` are kept by `normalizeMediaUrl`).
- Keep this pattern for any new persisted field: add a branch in the normalizer and a case in `lib/portia-content-normalize.test.ts`.

## Logging

**Framework:** `console` only. No logging library.

**Patterns:**
- Server logs use a fixed `"PORTIA <area> <verb> failed"` prefix so they can be grepped in Netlify logs: `"PORTIA content read failed"`, `"PORTIA media upload failed"`, `"PORTIA editor access lookup failed"`, `"PORTIA Roblox profile lookup failed"`.
- Log the raw error as the second argument: `console.error("PORTIA content save failed", error);`.
- Client code does not log; it sets UI state instead.
- Never log request bodies or session data.

## Comments

**When to Comment:**
- Comments explain *why* a non-obvious decision exists, not what the code does. Examples: the CDN and cookie reasoning in `lib/supabase/server.ts` (`// For CDN-cached public reads: never touches cookies...`), the optimistic-lock rationale in `app/api/content/route.ts`, and the `proxy.ts` matcher explanation.
- Put a one-line comment above exported helpers that define a contract: `// Every save and every cached read passes through here: unknown input in, a complete PortiaContent out.` (`lib/portia-content-normalize.ts`), `/** Keeps a window fully inside the workspace; ... */` (`lib/window-geometry.ts`).
- Comments are written in English. User-visible strings are in Russian (see Language below).

**JSDoc/TSDoc:**
- Used sparingly. Only `/** ... */` one-liners on exported geometry helpers in `lib/window-geometry.ts`. Not used for component props or route handlers.

## Function Design

**Size:**
- Lib modules are small and single-purpose (24 to 226 lines). Large UI files are the exception: `components/portia-desktop.tsx` (about 1390 lines) and `components/portia-editor.tsx` (about 1360 lines) hold many small helpers and components in one file. Follow that file's existing layout rather than splitting it unless the task requires it.

**Parameters:**
- Prefer a single options-object param for component props, typed inline: `function EmbeddedDocument({ src, external, title }: { src: string; external: string; title: string })`.
- Use positional params for pure lib helpers with two or three arguments: `fitGeometry(geometry, bounds, minimum)`, `resizeGeometry(start, edge, dx, dy, bounds, minimum)`.
- Default parameter values are used for optional knobs: `knownRobloxIds: Map<string, number> = new Map()`.

**Return Values:**
- Lib helpers return plain objects or `null` for "invalid input" (`normalizePortiaContent` returns `PortiaContent | null`). Callers test with `if (!normalized || ...)`.
- Route handlers return `Response.json(...)` with explicit `headers` (see `lib/portia-cdn.ts`).
- Tuples are used for pairs in `Object.fromEntries` pipelines: `[[key, normalized] as const]`.

## Module Design

**Exports:**
- Named exports only. `export default` appears only where Next.js requires it (`app/layout.tsx`, `app/page.tsx`, `app/owner-login/page.tsx`).
- Lib modules export types and their functions together. Constants shared across modules (e.g. `defaultPortiaContent`, `contentCacheTag`) are exported next to the functions that use them.

**Client/server boundary:**
- Put `"use client";` as the first line of any component that uses hooks or browser APIs: `components/portia-desktop.tsx`, `components/portia-editor.tsx`. Server-only modules import `next/headers` or `@supabase/ssr` and must not be imported from client components.
- Heavy client-only UI is loaded with `next/dynamic` and `ssr: false`: `const PortiaEditor = dynamic(() => import("@/components/portia-editor").then((module) => module.PortiaEditor), { ssr: false, loading: () => ... })` in `components/portia-desktop.tsx`. Follow this pattern for any new large client-only panel.
- Server actions go in `actions.ts` next to the page that uses them and start with `"use server";`.

**Styling:**
- Global design tokens and base styles are in `app/globals.css`. Component styles are in `app/portia.css` as plain kebab-case class selectors (`.desktop-icon`, `.floating-text-format`, `.class-cell`, `.editor-field`, `.personnel-profile-head`). Components use `className` strings; no CSS modules or CSS-in-JS. Inline `style={{ ... }}` appears only for runtime-computed values (about 12 occurrences versus about 250 `className` uses).

**Icons:**
- Icons are inline SVG in `components/portia-icons.tsx`, keyed by the `PortiaIconName` union, using `currentColor` and a 24px grid with a single stroke weight.

**Language:**
- User-facing strings (UI labels, error messages returned from API routes, placeholders) are in Russian. Keep new user-facing text in Russian to match. Code identifiers, comments, and log messages are in English.
- Use `toLocaleLowerCase("ru")` for Russian search normalization (`escapeSearch` in `components/portia-desktop.tsx`) and `toLocaleLowerCase("en-US")` for email normalization (`normalizeEditorEmail` in `lib/editor-access.ts`).

**Barrel Files:** Not used.

---

*Convention analysis: 2026-10-12*
