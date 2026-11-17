---
last_mapped_commit: 2904899037d4243c8433d9d16a88f21ce7f7fe18
last_mapped_at: 2026-11-01
---
# Coding Conventions

**Analysis Date:** 2026-11-01

Scope of this analysis: `app/`, `components/`, `lib/` only. Files under `tests/` and `supabase/` were not examined here.

## Naming Patterns

**Files:**
- Kebab-case for every source file, almost always prefixed by domain: `lib/portia-promotion-api.ts`, `lib/portia-promotion-sheet.ts`, `lib/editor-access.ts`, `lib/e2e-target-guard.test.ts`, `components/portia-promotion-editor-main.tsx`, `components/custom-color-picker.tsx`.
- Next.js route files use framework names: `app/page.tsx`, `app/layout.tsx`, `app/api/<resource>/route.ts` (nested for promotion: `app/api/promotion/<action>/route.ts`), `app/owner-login/page.tsx`, `app/owner-login/actions.ts`. Root `proxy.ts` is the middleware-equivalent.
- Tests are co-located in `lib/` as `<module>.test.ts` (`lib/portia-promotion-api.test.ts` for `lib/portia-promotion-api.ts`). Component and route code has no co-located tests; their behavior is checked by reading their source from `lib/` tests (see TESTING.md).
- Stylesheets: `app/globals.css` (tokens and base) and `app/portia.css` (component classes).
- Support modules that exist only for the Phase 15 verification flow use a `phase15-` or `e2e-` prefix in `lib/` (`lib/phase15-visual-manifest.test.ts`, `lib/e2e-preflight.test.ts`).

**Functions:**
- camelCase for all functions. Exported React components are PascalCase function declarations, e.g. `export function PromotionIdentityGate` in `components/portia-promotion.tsx`, `export function PortiaDesktop` in `components/portia-desktop.tsx`.
- Route handlers are named exports `GET`, `POST`, `PUT`, `PATCH`, `DELETE` (`app/api/promotion/requests/route.ts` exports `POST`; `app/api/promotion/status/route.ts` exports `GET(request: Request)`).
- Route segments that must never be cached declare `export const dynamic = "force-dynamic";` above the handlers (every route under `app/api/`).
- Server actions are named exports in a `"use server"` file: `ownerLogin`, `editorSignUp`, `ownerLogout` in `app/owner-login/actions.ts`.
- Pure helpers may be `const` arrow functions when short (`const clone = (content: PortiaContent) => ...`), but module-level lib helpers are mostly `function` declarations: 160 `export function` declarations versus 22 `const ... = (...) =>` helpers across `lib/*.ts`.
- Module-internal helpers are not exported unless tests need them. Example: `normalizedWait` in `lib/portia-promotion-notifications.ts` is private; `parseRetakeLedger` is exported for tests.

**Variables and constants:**
- camelCase for variables and module constants. Configuration constants are camelCase, not SCREAMING_CASE: `maxLedgerEntries` in `lib/portia-promotion-notifications.ts`, `contentCacheTag` in `lib/portia-cdn.ts`, `defaultDesktopSettings` in `components/portia-desktop.tsx`.
- Exception: environment-variable names and a few test-only sentinels are SCREAMING_CASE strings (`PORTIA_PROMOTION_DEVICE_SECRET`, `PORTIA_PROMO_LIVE_CONFIRM`, `ISOLATED_TEST_PROJECT` in `lib/portia-promotion-live.test.ts`).
- localStorage keys are kebab-case with a version suffix: `"portia-desktop-settings-v1"`, `"portia-broadcasts-read-signature-v1"`. Bump the suffix when the stored shape changes.
- Cookie names are snake-case with a prefix: `deviceBindingCookie = "portia_promo_device"` in `lib/portia-device-binding.ts`.
- Lookup maps use `Record<Union, ...>` keyed by string-literal unions, e.g. `Record<AppId, WindowState>` in `components/portia-desktop.tsx`.
- Generated IDs use prefixes: `makeId = (prefix) => \`${prefix}-${Date.now().toString(36)}-${random}\`` in `components/portia-editor.tsx`; employee IDs derived from Roblox use `roblox-<n>` (`lib/portia-employees.ts`).
- Database RPC and table names use the `portia_` / `portia_promo_` prefix with snake_case, and RPC parameters use the `p_` prefix (`portia_promo_submit_request`, `p_nickname_key`) as seen in `lib/portia-promotion-live.test.ts`.

**Types:**
- Use `type` aliases, not `interface`. A grep of `app/`, `components/`, `lib/` finds zero `interface` declarations. Example: `export type PromotionWorkflowProjection = {...}` in `lib/portia-promotion-api.ts`.
- Union string literals instead of enums. Zero `enum` declarations. Example: `type DependencyResult<T> = { status: "ok"; projection: T } | { status: "unavailable"; reason?: ... }` in `lib/portia-promotion-api.ts`.
- Discriminated results use a `status` field (`"ok" | "unavailable"`, `"created" | "active" | "throttled"`). Model new fallible operations the same way; do not throw for expected outcomes.
- Derive types from data where possible: `type RosterEmployee = Omit<PortiaEmployee, EditableFields>` in `lib/portia-employees.ts`.
- Import type-only symbols inline with the `type` modifier: `import { type PromotionRequestKind } from "@/lib/portia-promotion";`.
- `as const` is used for literal result tuples and objects (32 files), e.g. `return { status: "unavailable", reason: "network" } as const;` in `lib/portia-promotion-sheet.ts`.
- `any` is not used in application code. Unknown input is typed `unknown` and narrowed (`parseRetakeLedger(raw: string | null)` parses to `unknown` and checks with `Array.isArray` and `typeof`).

## Code Style

**Formatting:**
- No Prettier or Biome config is present. Style is applied by hand and is consistent across files:
  - Double quotes for strings and JSX attributes (`placeholder="Введите ник Roblox из таблицы"`, `autoComplete="off"`). Single quotes appear mainly in test assertion strings that contain double quotes.
  - Semicolons at statement ends. Two-space indentation.
  - Trailing commas in multi-line object and argument lists.
  - Several related declarations are often packed on one line when they form a single record (`type Kind = ...;` lines, `{ status: "ok", ... }` literals). Lines regularly exceed 120 characters; do not reflow existing code just for style.
- Single-line guards without braces are the norm: `if (!user?.email) return noAccess;`, `if (error) redirect("/owner-login?error=invalid");`, `if (!body) return Response.json(...)`.
- Multi-statement one-liners are accepted for tiny handlers: `try { window.localStorage.setItem(key, value); } catch {}`.
- Object literal argument with inline arrow implementations is common in dependency-injection objects (see `dependencies()` in `lib/portia-promotion-api.test.ts`).

**Linting:**
- ESLint flat config in `eslint.config.mjs`: `eslint-config-next/core-web-vitals` plus `eslint-config-next/typescript`, wrapped in `defineConfig`. No custom rules.
- Ignores: `.next/**`, `out/**`, `next-env.d.ts`, and `.planning/**`.
- Run with `npm run lint`. Zero `eslint-disable` comments in `app/`, `components/`, `lib/`.
- TypeScript is `strict: true` (`tsconfig.json`), `isolatedModules: true`, `allowImportingTsExtensions: true`.

**Type-checking escape hatches:**
- None found in `app/`, `components/`, `lib/`. No `@ts-ignore`, `@ts-expect-error`, or `as any` outside CSS `calc()` strings.
- Casts happen at the JSON boundary and are followed immediately by validation: `JSON.parse(raw) as { content?: unknown; revision?: unknown }` in `app/api/content/route.ts`, `parseJsonObject(await request.text())` in `lib/request-json.ts`.

## Import Organization

**Order (observed):**
1. Node built-ins with the `node:` prefix (`node:assert/strict`, `node:crypto`, `node:fs`), only in `lib/` modules and tests. Browser or Next modules never import them.
2. Framework and third-party packages: `next/navigation`, `next/cache`, `next/headers`, `next/dynamic`, `react`, `@supabase/ssr`, `@supabase/supabase-js`, `@netlify/functions`.
3. Project modules via the `@/` alias from `app/` and `components/`, and for cross-folder imports from `lib/` (`lib/supabase/server.ts` imports `@/lib/supabase/env`).
4. Relative `./<module>.ts` imports inside `lib/` (see below).

Example from `app/api/promotion/requests/route.ts`:

```ts
import { noStoreHeaders } from "@/lib/portia-cdn";
import { promotionDeviceSecret, readDeviceToken } from "@/lib/portia-device-binding";
import { createPromotionApiDependencies, submitPromotionRequest } from "@/lib/portia-promotion-api";
import type { PromotionRequestKind } from "@/lib/portia-promotion";
import { parseJsonObject } from "@/lib/request-json";
import { createPublicSupabaseClient } from "@/lib/supabase/server";
```

**Path aliases:**
- `@/*` maps to the project root (`tsconfig.json` `paths`). Use it from `app/`, `components/`, and cross-folder `lib/` imports.

**Explicit `.ts` extensions inside `lib/`:**
- Modules inside `lib/` import their siblings with explicit extensions: `import { ... } from "./portia-promotion.ts";` (`lib/portia-promotion-api.ts`). This is required so the tests run under `node --experimental-strip-types`. Do not switch these to extensionless or `@/` imports inside `lib/`, or the test runner breaks.
- `app/` and `components/` use extensionless `@/` imports.

**Barrel files:**
- None. Every import points at the defining module.

## Error Handling

**API routes (`app/api/*/route.ts`):**
- Wrap the handler body in `try { ... } catch (error) { console.error("PORTIA <what failed>", error); return Response.json({ error: "<user message>" }, { status: 500 }); }`. Examples: `app/api/content/route.ts` (`PUT`), `app/api/uploads/route.ts` (`POST`), `app/api/employees/route.ts` (`GET`, `PATCH`).
- Promotion routes use a machine-readable `code` next to the Russian message, and always send `noStoreHeaders`:

```ts
return Response.json({ error: "Некорректные данные.", code: "invalid-request" }, { status: 400, headers: noStoreHeaders });
} catch (error) {
  console.error("PORTIA promotion request failed", error instanceof Error ? error.message : "unknown");
  return Response.json({ error: "Система повышения временно недоступна.", code: "promotion-unavailable" }, { status: 503, headers: noStoreHeaders });
}
```

- Check authorization first and return early with 403 before reading the body:

```ts
const access = await getEditorAccess(supabase, user);
if (!user || !access.canEdit) {
  return Response.json({ error: "У вас нет доступа к редактору." }, { status: 403 });
}
```

- Validate input explicitly: 400 for malformed bodies (`"Некорректная структура данных."`), 413 for size limits, 415 for unsupported media types (`app/api/uploads/route.ts`), 404 for missing records, 409 for optimistic-concurrency conflicts (`app/api/content/route.ts`), 502 for degraded upstream reads (`app/api/employees/route.ts`), 503 for promotion outages (`app/api/promotion/status/route.ts`).
- Parse request bodies through `parseJsonObject` from `lib/request-json.ts` rather than calling `JSON.parse` directly in new promotion code.
- Non-fatal side effects never fail the request: `purgeCacheTag` swallows and logs its own errors (`lib/portia-cdn.ts`).
- Inside a `try`, rethrow Supabase errors that should become 500s: `if (error) throw error;`.

**Promotion-domain results (`lib/portia-promotion-*.ts`):**
- Expected outcomes are returned, not thrown, as `status`-tagged unions (`"ok" | "unavailable"`, `"created" | "active" | "device-denied" | "throttled"`). The API layer maps them to HTTP codes (`lib/portia-promotion-api.ts`).
- Dependency results carry `reason` values (`"rpc-missing" | "database-error" | "invalid-response"`, `"network" | "http"`) so the UI can say what failed.
- Security-relevant configuration fails fast: `requireSecret` throws when `PORTIA_PROMOTION_DEVICE_SECRET` is shorter than 32 characters (`lib/portia-device-binding.ts`). Do not add a fallback value.

**Read paths that fall back:**
- Public GET endpoints degrade rather than fail hard. `GET /api/content` returns `defaultPortiaContent` when the stored payload is invalid (`app/api/content/route.ts`). `GET /api/employees` returns `{ employees: [], degraded: true }` with status 502 on failure (`app/api/employees/route.ts`).
- Helper lookups log and return a safe value: `getEditorAccess` returns `noAccess` on RPC error (`lib/editor-access.ts`).

**Server actions (`app/owner-login/actions.ts`):**
- Report failures by redirecting with a query code, not by throwing: `redirect("/owner-login?error=invalid")`. The page maps codes to messages.

**Client components:**
- Swallow storage errors with empty catches around `localStorage` access, which can throw in private modes: `try { window.localStorage.setItem(...) } catch {}`.
- Wrap `JSON.parse` of stored data in `try/catch` and fall back to defaults (`components/portia-desktop.tsx`, `components/portia-editor.tsx`). Parsers accept `string | null` and return `[]` for missing or invalid data (`parseRetakeLedger` in `lib/portia-promotion-notifications.ts`).
- Promise chains use `.catch(() => { if (active) setState("error"); })` with an `active` flag for cleanup (`components/portia-editor.tsx`).
- Save results are a typed state machine (`SaveState`), not thrown exceptions.

**Empty catch blocks:**
- `catch {}` (optional catch binding, no variable) is the accepted form for intentionally ignored errors. Use `catch (error)` plus `console.error` when the error matters to operators.

**Input normalization at trust boundaries:**
- Every value that enters from the network or from storage passes through a normalizer. `normalizePortiaContent` in `lib/portia-content-normalize.ts` clamps lengths (`slice(0, 100_000)`, `slice(0, 500)`), bounds numbers, whitelists enum-like values, and keeps only `https://` or `/` URLs.
- Client-supplied timestamps are never trusted for promotion cooldowns or deadlines. This is enforced by a source-level test (`lib/portia-promotion-security.test.ts`).
- Keep this pattern for any new persisted field: add a branch in the normalizer and a case in the matching `*.test.ts`.

## Logging

**Framework:** `console` only. No logging library.

**Patterns:**
- Server logs use a fixed `"PORTIA <area> <verb> failed"` prefix so they can be grepped in Netlify logs. Current examples: `"PORTIA content read failed"`, `"PORTIA media upload failed"`, `"PORTIA editor access lookup failed"`, `"PORTIA employee sync failed"`, `"PORTIA promotion status RPC failed"`.
- Log the raw error as the second argument. Promotion code logs only `error.message` or `{ code: error.code }` objects, never full error objects that might carry request data: `console.error("PORTIA promotion status failed", error instanceof Error ? error.message : "unknown");`.
- Client code does not log; it sets UI state instead.
- Never log request bodies, tokens, device cookies, nicknames, or session data.

## Comments

**When to Comment:**
- Comments explain *why* a non-obvious decision exists, not what the code does. Examples: the CDN cookie reasoning in `lib/supabase/server.ts` (`// For CDN-cached public reads: never touches cookies, so no session can leak...`), the proxy matcher explanation in `proxy.ts`, and the `setAll` note about Server Components in `lib/supabase/server.ts`.
- Put a one-line comment above exported helpers that define a contract: `// Every save and every cached read passes through here: unknown input in, a complete PortiaContent out.` (`lib/portia-content-normalize.ts`).
- Comments are written in English. User-visible strings are in Russian (see Language below).

**JSDoc/TSDoc:**
- Used sparingly. Only `/** ... */` one-liners on exported geometry helpers in `lib/window-geometry.ts`. Not used for component props or route handlers.

## Function Design

**Size:**
- Lib modules are small and single-purpose (roughly 20 to 630 lines). Largest lib modules: `lib/portia-employees.ts` (~630 lines), `lib/portia-content.ts` (~475), `lib/portia-content-normalize.ts` (~400), `lib/portia-promotion-api.ts` (~355).
- Large UI files hold many small helpers and components together: `components/portia-editor.tsx` (~3030 lines), `components/portia-desktop.tsx` (~2320 lines). Follow that file's existing layout rather than splitting it unless the task requires it.

**Parameters:**
- Prefer a single options-object param for component props, typed inline: `function EmbeddedDocument({ src, external, title }: { src: string; external: string; title: string })`.
- Use positional params for pure lib helpers with two or three arguments: `fitGeometry(geometry, bounds, minimum)`.
- Side-effecting lib operations take a dependency object so tests can replace it. Example: `createPromotionApiDependencies(supabase, secret)` returns a `PromotionApiDependencies` record, and handlers accept `deps` as their second argument (`lib/portia-promotion-api.ts`). Follow this for any new network or database call.
- Default parameter values are used for optional knobs: `knownRobloxIds: Map<string, number> = new Map()`, `createToken?: () => string`.

**Return Values:**
- Lib helpers return plain objects or `null` for "invalid input" (`normalizePortiaContent` returns `PortiaContent | null`). Callers test with `if (!normalized || ...)`.
- Route helpers return `{ status, body, setCookie? }` records that the route translates into `Response.json(...)`; Set-Cookie is attached only in the route file (`app/api/promotion/requests/route.ts`).
- Tuples are used for pairs in `Object.fromEntries` pipelines: `[[key, normalized] as const]`.

## Module Design

**Exports:**
- Named exports only. `export default` appears only where Next.js requires it (`app/layout.tsx`, `app/page.tsx`, `app/owner-login/page.tsx`).
- Lib modules export types and their functions together. Constants shared across modules (e.g. `defaultPortiaContent`, `contentCacheTag`) are exported next to the functions that use them.

**Client/server boundary:**
- Put `"use client";` as the first line of any component that uses hooks or browser APIs. Every file in `components/` that uses state or effects has it (for example `components/portia-promotion.tsx`, `components/portia-promotion-editor.tsx`, `components/portia-desktop.tsx`, `components/portia-wallpaper.tsx`).
- Server-only modules import `next/headers`, `@supabase/ssr`, or `process.env` secrets, and must not be imported from client components. Keep secrets (`PORTIA_PROMOTION_DEVICE_SECRET`) in server-only paths: `lib/portia-device-binding.ts` is used only by route files and server-side lib code.
- Heavy client-only UI is loaded with `next/dynamic` and `ssr: false`: `const PortiaEditor = dynamic(() => import("@/components/portia-editor").then((module) => module.PortiaEditor), { ssr: false, loading: () => ... })` in `components/portia-desktop.tsx`. Follow this pattern for any new large client-only panel.
- Server actions go in `actions.ts` next to the page that uses them and start with `"use server";`.

**Styling:**
- Global design tokens and base styles are in `app/globals.css`. Component styles are in `app/portia.css` as plain kebab-case class selectors (`.desktop-icon`, `.promotion-binding-note`, `.employee-add-error`, `.formatted-rich-input`).
- Theme values use CSS custom properties driven by accent variables, e.g. `oklch(.926 calc(.011 * var(--accent-chroma)) var(--accent-hue))`. About 720 lines in `app/portia.css` use `var(--`. Use these tokens for new colors instead of hard-coded values.
- Components use `className` strings; no CSS modules or CSS-in-JS. Inline `style={{ ... }}` appears only for runtime-computed values.

**Icons:**
- Icons are inline SVG in `components/portia-icons.tsx`, keyed by the `PortiaIconName` union, using `currentColor` and a 24px grid with a single stroke weight.

**Language:**
- User-facing strings (UI labels, error messages returned from API routes, placeholders, calendar dates) are in Russian. Keep new user-facing text in Russian. Code identifiers, comments, and log messages are in English.
- Dates shown to users use the Moscow timezone and the `ru-RU` locale: `Intl.DateTimeFormat("ru-RU", { dateStyle: "long", timeZone: "Europe/Moscow" })` in `components/portia-promotion.tsx`.
- Use `toLocaleLowerCase("ru")` for Russian search normalization (`escapeSearch` in `components/portia-desktop.tsx`) and `toLocaleLowerCase("en-US")` for nickname and email keys (`normalizedWait` in `lib/portia-promotion-notifications.ts`, `normalizeEditorEmail` in `lib/editor-access.ts`).

**Barrel Files:** Not used.

---

*Convention analysis: 2026-11-01*
