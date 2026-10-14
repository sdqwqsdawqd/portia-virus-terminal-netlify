---
last_mapped_commit: e3941d4a097005a1674d3e9bc4d1e638aeda0846
last_mapped_at: 2026-10-12
---
<!-- refreshed: 2026-10-12 -->

# Architecture

**Analysis Date:** 2026-10-12

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                 Browser (public desktop + owner editor)               │
│  `app/page.tsx` -> `components/portia-desktop.tsx`                    │
│  editor (lazy) -> `components/portia-editor.tsx`                      │
├───────────────────────────┬──────────────────────────────────────────┤
│  Next.js App Router pages │  Route handlers (REST-ish JSON API)       │
│  `app/layout.tsx`         │  `app/api/{content,employees,access,      │
│  `app/owner-login/*`      │          editors,uploads}/route.ts`       │
└───────────────┬───────────┴───────────────────┬──────────────────────┘
                │ server actions                 │
                ▼                                ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     Shared server libraries (`lib/`)                  │
│  content: `lib/portia-content*.ts`   employees: `lib/portia-employees.ts`│
│  access:  `lib/editor-access.ts`     cache:  `lib/portia-cdn.ts`        │
│  supabase clients: `lib/supabase/{server,env,proxy}.ts`               │
└───────────────┬──────────────────────────────────┬───────────────────┘
                ▼                                  ▼
┌────────────────────────────────┐   ┌──────────────────────────────────┐
│ Supabase (Postgres + Auth)     │   │ Netlify CDN / purgeCache          │
│ tables portia_content,         │   │ tags portia-content,              │
│ portia_editors, portia_employee_│   │ portia-employees                  │
│ profiles; RLS + portia_* RPCs  │   └──────────────────────────────────┘
│ defined in supabase/portia_setup.sql
└────────────────────────────────┘
```

## Pattern Overview

**Overall:** Single Next.js 16 App Router application (React 19, server-rendered shell with one large client-side "desktop" component). Data lives in Supabase; the public read path is cached by the Netlify CDN and invalidated by tag purge on writes.

**Key Characteristics:**
- Almost all UI state is client-side in two large components: `components/portia-desktop.tsx` (1392 lines, window manager, apps, public content) and `components/portia-editor.tsx` (1360 lines, owner/editor UI). There is no client state library; state is React hooks and context (`createContext` in `portia-editor.tsx`).
- The public site is fully static-looking content delivered through `GET /api/content` and `GET /api/employees`. Both use `force-dynamic` with `publicCacheHeaders()` so the CDN caches them and browsers revalidate.
- Authorization is enforced twice: in route handlers via `getEditorAccess()` (`lib/editor-access.ts`) and in Postgres via RLS policies and `portia_can_edit()` / `portia_is_owner()` functions in `supabase/portia_setup.sql`. The comment in `lib/editor-access.ts` states the database is the source of truth.
- Writes use optimistic concurrency: `PUT /api/content` only updates when `revision` equals the editor's base revision, otherwise returns 409 (`app/api/content/route.ts`).
- There is no `src/` directory; app code lives at the repository root (`app/`, `components/`, `lib/`).

## Layers

**Routing / Pages (App Router):**
- Purpose: Mount the public desktop and the owner login flow.
- Location: `app/page.tsx`, `app/layout.tsx`, `app/owner-login/page.tsx`
- Contains: Server components. `page.tsx` renders `PortiaDesktop` with `defaultPortiaContent` as `initialContent`. `layout.tsx` loads fonts (`next/font/google`) and global CSS (`app/globals.css`, `app/portia.css`).
- Depends on: `components/portia-desktop.tsx`, `lib/portia-content.ts`, `lib/supabase/server.ts`, `lib/editor-access.ts`
- Used by: Browser requests to `/` and `/owner-login`

**Route handlers (API):**
- Purpose: JSON endpoints for content, employee roster, editor access, editor management, and uploads.
- Location: `app/api/content/route.ts`, `app/api/employees/route.ts`, `app/api/access/route.ts`, `app/api/editors/route.ts`, `app/api/uploads/route.ts`
- Contains: `GET`/`PUT`/`POST` exports, each guarded by `getEditorAccess` for writes.
- Depends on: `lib/supabase/server.ts`, `lib/editor-access.ts`, `lib/portia-cdn.ts`, `lib/portia-content-normalize.ts`, `lib/portia-employees.ts`
- Used by: `components/portia-desktop.tsx` (`/api/content`, `/api/access`, `/api/employees`), `components/portia-editor.tsx` (`/api/uploads`, `/api/employees`, `/api/editors`)

**Server actions:**
- Purpose: Owner login, editor sign-up, logout from the login page.
- Location: `app/owner-login/actions.ts`
- Contains: Functions using `"use server"` that call Supabase auth, then `redirect()` or `revalidatePath()`.
- Depends on: `lib/supabase/server.ts`, `lib/editor-access.ts`
- Used by: `app/owner-login/page.tsx`

**Domain / content model (pure TypeScript):**
- Purpose: Types, defaults, and normalization of the viral database content.
- Location: `lib/portia-content.ts` (types `PortiaContent`, `Virus`, `ScientistLog`, `RecycleFile`, `RichTextDocument`; `defaultPortiaContent`), `lib/portia-content-normalize.ts` (`normalizePortiaContent`)
- Contains: Runtime validation of untrusted JSON before it is stored or served.
- Depends on: nothing app-specific
- Used by: API routes, the desktop, the editor

**Employee roster:**
- Purpose: Build the staff list from an external roster (CSV parsing and Roblox-keyed IDs) merged with editable profiles stored in Supabase.
- Location: `lib/portia-employees.ts`
- Contains: `parseCsv`, `rosterFromRows`, `employeeId`, `readEmployeeProfiles`, `loadEmployees`, `saveEmployeeProfile`, `sanitizeEmployeeUpdate`
- Depends on: `@supabase/supabase-js` `SupabaseClient` (passed in, not created here)
- Used by: `app/api/employees/route.ts`

**Infrastructure libraries:**
- Purpose: Supabase client construction, cache headers/purging, environment resolution.
- Location: `lib/supabase/server.ts` (`createServerSupabaseClient` with cookies via `next/headers`, `createPublicSupabaseClient` without cookies), `lib/supabase/env.ts` (`getSupabaseConfig`), `lib/supabase/proxy.ts` (`updateSupabaseSession`), `lib/portia-cdn.ts` (`publicCacheHeaders`, `noStoreHeaders`, `purgeCacheTag` via `@netlify/functions`)
- Depends on: `@supabase/ssr`, `@supabase/supabase-js`, `@netlify/functions`
- Used by: Route handlers, `proxy.ts`

**Presentation primitives:**
- Purpose: Icons, wallpaper, window geometry math.
- Location: `components/portia-icons.tsx`, `components/portia-wallpaper.tsx`, `lib/window-geometry.ts` (`fitGeometry`, `resizeGeometry`)
- Used by: `components/portia-desktop.tsx`

## Data Flow

### Public Page Load

1. Browser requests `/`; `app/layout.tsx` and `app/page.tsx` render, passing `defaultPortiaContent` as `initialContent` (`app/page.tsx`).
2. `PortiaDesktop` (`components/portia-desktop.tsx`) runs in the client, calls `fetchWithTimeout("/api/content")` (line ~279) and `/api/access` (line ~302) and, when relevant, `/api/employees` (line ~324).
3. `GET /api/content` (`app/api/content/route.ts`) reads `portia_content` row `id = 'main'` through the anonymous Supabase client, normalizes it with `normalizePortiaContent`, and falls back to `defaultPortiaContent` if no row exists. The response carries `publicCacheHeaders("portia-content", 300)`.
4. On Supabase error the handler returns 503 with `noStoreHeaders`; the CDN keeps its last good copy.

### Editor Save

1. Owner opens `/owner-login` (`app/owner-login/page.tsx`), signs in via `ownerLogin` server action (`app/owner-login/actions.ts`), and Supabase sets `sb-*-auth-token` cookies.
2. `PortiaDesktop` calls `/api/access`, and renders `PortiaEditor` (lazy import, `next/dynamic`) only when `canEdit` is true.
3. Save: `saveContent` in `components/portia-desktop.tsx` (line ~618) sends `PUT /api/content` with `{ content, revision }`.
4. `PUT` (`app/api/content/route.ts`) checks the user with `getEditorAccess`, rejects bodies over 2,000,000 characters, normalizes the content, and performs an insert (revision 0) or conditional update (`eq("revision", baseRevision)`).
5. On success it calls `purgeCacheTag("portia-content")` (`lib/portia-cdn.ts`) and returns the new revision. A stale revision yields 409 with a copy-your-edits message.

### Employee Roster

1. `GET /api/employees` calls `loadEmployees` (`lib/portia-employees.ts`), which merges roster rows with `portia_employee_profiles`.
2. Response is cached under tag `portia-employees` for 600 seconds when complete, 30 seconds when degraded (`app/api/employees/route.ts`).
3. Editor writes go to `POST /api/employees`, which uses `sanitizeEmployeeUpdate` then `saveEmployeeProfile`, then purges `portia-employees`.

### Session Refresh

1. `proxy.ts` (repository root, Next.js proxy hook) runs `updateSupabaseSession` (`lib/supabase/proxy.ts`) for `/owner-login/*`, `/api/access`, `/api/editors`, `/api/uploads` only.
2. It returns immediately when no `sb-*-auth-token` cookie exists; otherwise it calls `supabase.auth.getClaims()` to refresh cookies. Errors are swallowed so the public site still renders.

**State Management:**
- Server: stateless per request; persistent state only in Supabase and the Netlify CDN.
- Client: React `useState`/`useEffect`/`useRef` inside `PortiaDesktop` and `PortiaEditor`. The editor receives `content`, `saveState`, and callbacks as props and shares values through a context.

## Key Abstractions

**PortiaContent:**
- Purpose: Whole content document (viruses, scientist logs, broadcasts, recycle bin files, rich text).
- Examples: `lib/portia-content.ts` (type and `defaultPortiaContent`), `lib/portia-content-normalize.ts`
- Pattern: Plain typed object; always passed through `normalizePortiaContent` at trust boundaries.

**Revisioned row (`portia_content`):**
- Purpose: Single-row optimistic lock for the whole site content.
- Examples: `app/api/content/route.ts`, `supabase/portia_setup.sql` (table at line 4)
- Pattern: `revision` integer incremented on each save; conditional update as compare-and-swap.

**Access check:**
- Purpose: Single function answering "can this user edit / manage editors".
- Examples: `lib/editor-access.ts` (`getEditorAccess`)
- Pattern: Calls Supabase RPCs `portia_can_edit` and `portia_is_owner`; fails closed to `{ canEdit: false }`.

**Cache tags:**
- Purpose: Name CDN cache entries for targeted purge.
- Examples: `contentCacheTag` and `employeesCacheTag` in `lib/portia-cdn.ts`
- Pattern: `publicCacheHeaders(tag, seconds)` on reads, `purgeCacheTag(tag)` on writes.

**Supabase client variants:**
- Purpose: Choose between user-scoped (cookie) and anonymous clients.
- Examples: `createServerSupabaseClient` and `createPublicSupabaseClient` in `lib/supabase/server.ts`
- Pattern: Public reads never touch cookies, which keeps them CDN-cacheable.

## Entry Points

**Public site:**
- Location: `app/page.tsx`
- Triggers: GET `/`
- Responsibilities: Render the desktop with bundled default content; the client then fetches live content.

**Owner login:**
- Location: `app/owner-login/page.tsx` and `app/owner-login/actions.ts`
- Triggers: GET `/owner-login`, form submissions to server actions
- Responsibilities: Sign in or sign up, show editor status, log out.

**API routes:**
- Location: `app/api/*/route.ts`
- Triggers: Client `fetch` calls listed under Data Flow
- Responsibilities: Read/write content, roster, access, editors, uploads.

**Request middleware:**
- Location: `proxy.ts`
- Triggers: Requests matching its `config.matcher`
- Responsibilities: Refresh Supabase auth cookies only where needed.

**Tests (node test runner):**
- Location: `lib/*.test.ts`, run by `npm test` (`node --experimental-strip-types --test lib/*.test.ts`)

## Architectural Constraints

- **Threading:** Single-threaded Node.js runtime for route handlers under the Netlify Next.js runtime; the browser main thread renders the whole desktop.
- **Global state:** Module-level content constants `defaultPortiaContent` (`lib/portia-content.ts`) and cache tag strings (`lib/portia-cdn.ts`). The Supabase client is created per request, not as a singleton.
- **Hosting coupling:** `lib/portia-cdn.ts` imports `purgeCache` from `@netlify/functions`. Route handlers depend on Netlify CDN semantics for correctness of freshness; `netlify.toml` pins Node 22.13.0 and build command `npm run build`.
- **Circular imports:** None detected between `app/`, `components/`, and `lib/` in the files reviewed.
- **Proxy scope:** `proxy.ts` deliberately excludes `/` and `/api/content`, `/api/employees` so GETs stay cacheable and free of `Set-Cookie`; the content `PUT` relies on its own server client for cookies.
- **Missing scheduled job:** `README.md` describes an hourly sync in `netlify/functions/`, but no `netlify/` directory exists in this repository tree. The roster sync is therefore not present in this snapshot.

## Anti-Patterns

### Editing large client components in place

**What happens:** Desktop and editor logic is concentrated in `components/portia-desktop.tsx` and `components/portia-editor.tsx`, each over 1,300 lines.
**Why it's wrong:** Changes to one window or app affect a single large file with many closures, which makes review and testing hard. Only the pure helpers in `lib/` are unit-tested.
**Do this instead:** Move new pure logic (parsing, geometry, formatting) into `lib/` with a `*.test.ts` file, and keep components thin. Follow `lib/window-geometry.ts` as the model.

### Client-side access decisions without server verification

**What happens:** `PortiaDesktop` decides whether to render `PortiaEditor` from the `/api/access` response.
**Why it's wrong:** The UI decision is only cosmetic; enforcement must stay in the route handler and database.
**Do this instead:** Always call `getEditorAccess` in new write handlers, as `app/api/uploads/route.ts` and `app/api/editors/route.ts` do, and add RLS policies in `supabase/portia_setup.sql` for any new table.

## Error Handling

**Strategy:** Fail soft for public reads, fail closed for writes.

**Patterns:**
- Public reads return bundled defaults or `503` with `noStoreHeaders` on database errors (`app/api/content/route.ts`).
- Writes return explicit JSON errors with Russian messages: `403` (no access), `413` (too large), `400` (invalid structure), `409` (revision conflict), `500` (generic). See `app/api/content/route.ts`.
- `getEditorAccess` returns `noAccess` on RPC errors instead of throwing (`lib/editor-access.ts`).
- Cache purge failures are logged and ignored (`lib/portia-cdn.ts`).

## Cross-Cutting Concerns

**Logging:** `console.error` with a `PORTIA ...` prefix in route handlers (e.g., `app/api/content/route.ts`, `app/api/employees/route.ts`).
**Validation:** Runtime normalization of untrusted input: `normalizePortiaContent` (`lib/portia-content-normalize.ts`), `sanitizeEmployeeUpdate` (`lib/portia-employees.ts`), and body checks in route handlers.
**Authentication:** Supabase Auth with email/password (`app/owner-login/actions.ts`). Owner identity comes from `portia_owner_email()` in `supabase/portia_setup.sql`. Editors are approved by email in `portia_editors`.

---

*Architecture analysis: 2026-10-12*
