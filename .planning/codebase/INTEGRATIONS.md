---
last_mapped_commit: e3941d4a097005a1674d3e9bc4d1e638aeda0846
last_mapped_at: 2026-10-12
---
# External Integrations

**Analysis Date:** 2026-10-12

## APIs & External Services

**Google Sheets (staff roster source):**
- Used to read the live personnel roster (sheet tab `Portia`, 34 numbered slots in rows 2-35).
- Endpoint: `https://docs.google.com/spreadsheets/d/<sheet-id>/gviz/tq?tqx=out:csv&sheet=Portia`, hard-coded as `sheetCsvUrl` in `lib/portia-employees.ts`.
- Fetched server-side with `fetch(..., { cache: "no-store", signal: AbortSignal.timeout(8_000) })`. Response must be OK; the CSV header row is validated and the code throws `The Portia sheet headers have changed.` if it drifts.
- SDK/Client: none (plain `fetch`), CSV parsed by `parseCsv` in `lib/portia-employees.ts`.
- Auth: none. The sheet must be publicly readable.
- Also embedded in the desktop UI as an iframe/"external" link: `components/portia-desktop.tsx` (`sheet` app entry, `htmlview?widget=true&headers=false` and the plain sheet URL).

**Roblox (staff identity and avatars):**
- Resolves nicknames to Roblox user IDs and avatars.
- `https://users.roblox.com/v1/usernames/users` - username lookup, called from `resolveRobloxProfiles()` in `lib/portia-employees.ts` (around line 81).
- `https://thumbnails.roblox.com/v1/users/avatar-headshot?...` and `https://thumbnails.roblox.com/v1/users/avatar?...` - avatar images (420x420 headshot and 720x720 full), fetched with 5-second timeouts in `lib/portia-employees.ts` (around lines 93-94).
- Failures are logged (`PORTIA Roblox profile lookup failed`) and the roster degrades gracefully: the stored `nickname`/`employee_id` in `portia_employee_profiles` keeps the profile reachable.
- Profile links are rendered as `https://www.roblox.com/users/<id>/profile` in `components/portia-desktop.tsx` (around line 874).
- SDK/Client: none (plain `fetch`). Auth: none (public endpoints).

**GIF / media providers (display only):**
- Giphy: `https://media.giphy.com/media/<id>/giphy.gif`, constructed from pasted Giphy URLs in `components/portia-desktop.tsx` (around line 185) and `components/portia-editor.tsx` (around line 52). Only IDs matching `/^[a-z0-9]+$/i` are accepted.
- Klipy: a single hard-coded mapping of a Klipy page URL to a static CDN GIF URL in `components/portia-desktop.tsx` (around line 172).
- Only `https://` URLs are accepted for these embeds (`components/portia-desktop.tsx` line 177).

**External content embeds (iframes/links):**
- Charter document: `https://sdqwqsdawqd.github.io/S.E-Portia/` (GitHub Pages), defined in `components/portia-desktop.tsx` (line 21) as an app with `src` and `external` URLs.

## Data Storage

**Primary database - Supabase Postgres:**
- Provider: Supabase (hosted Postgres with auth, storage, and RLS).
- Connection: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` read in `lib/supabase/env.ts`. Browser-safe publishable key only; the Service Role key is explicitly not used (`README.md`).
- Client: `@supabase/supabase-js` and `@supabase/ssr`:
  - `lib/supabase/server.ts` - `createServerSupabaseClient()` (cookie-bound SSR client via `next/headers`) and `createPublicSupabaseClient()` (cookie-less client for public reads, used by `app/api/content/route.ts` and `app/api/employees/route.ts`).
  - `lib/supabase/proxy.ts` - session refresh inside `proxy.ts`.
- Tables (from `supabase/portia_setup.sql`):
  - `public.portia_content` - site content as JSONB payload with `revision` and `updated_by`. Read by `app/api/content/route.ts`.
  - `public.portia_editors` - approved editor emails (lowercase-enforced). Managed by `app/api/editors/route.ts`.
  - `public.portia_employee_profiles` - editor-written biography, photo URL, knowledge rating and last-known nickname keyed by `employee_id`. Read/written in `lib/portia-employees.ts` and `app/api/employees/route.ts`.
- RPC functions called from code: `portia_can_edit`, `portia_is_owner` (`lib/editor-access.ts`), `portia_editor_is_approved` (`app/owner-login/actions.ts`).
- Row Level Security is enabled in the setup script; public read policies exist for content, employee profiles and media, and writes require `portia_can_edit()`.

**File Storage - Supabase Storage:**
- Bucket: `portia-media` (public bucket, created in `supabase/portia_setup.sql`, limited to PNG/JPEG/WEBP/GIF).
- Upload handler: `app/api/uploads/route.ts` - requires an editor session, accepts PNG/JPG/WEBP/GIF up to 4 MB, stores files at `recycle/<uuid>.<ext>` with `cacheControl: "3600"`, and returns the public URL via `getPublicUrl`.
- Storage policies: public read, editor-only insert/update/delete.

**Caching:**
- Netlify CDN (via `@netlify/functions`):
  - `lib/portia-cdn.ts` builds `Netlify-CDN-Cache-Control` headers (`publicCacheHeaders(tag, seconds)`) with `Netlify-Cache-Tag`, and `noStoreHeaders` for writes.
  - `purgeCacheTag(tag)` calls `purgeCache({ tags })` after saves. Cache tags: `portia-content` and `portia-employees`.
  - Used by `app/api/content/route.ts` and `app/api/employees/route.ts`.
- Netlify Blobs: described in `README.md` as a cache and fallback copy for the hourly roster and content, but no Blobs code or `netlify/functions/` directory exists in the repository. Treat as not implemented.
- Next.js data cache: route handlers are `export const dynamic = "force-dynamic"`; `revalidatePath("/", "layout")` is called after login/logout in `app/owner-login/actions.ts`.

## Authentication & Identity

**Auth Provider - Supabase Auth (email and password):**
- Implementation: Supabase Auth via `@supabase/ssr` cookies.
- Owner login: `ownerLogin` server action in `app/owner-login/actions.ts` (`signInWithPassword`), then `getEditorAccess()` in `lib/editor-access.ts` checks `portia_can_edit`/`portia_is_owner` RPCs; non-editors are signed out.
- Editor sign-up: `editorSignUp` in `app/owner-login/actions.ts` checks `portia_editor_is_approved` RPC (email must be approved by the owner first), enforces password length of at least 8, then calls `signUp`.
- Owner identity is set in exactly one place in the database: `portia_owner_email()` in `supabase/portia_setup.sql`.
- Editor access management: `app/api/editors/route.ts` (GET, POST to grant, DELETE to revoke) with `normalizeEditorEmail` from `lib/editor-access.ts`.
- Session refresh: `proxy.ts` matches `/owner-login/:path*`, `/api/access`, `/api/editors`, `/api/uploads` and calls `updateSupabaseSession` in `lib/supabase/proxy.ts`. The public desktop `/` is deliberately excluded.
- Access check endpoint: `app/api/access/route.ts` returns the current user's editor access.

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Datadog or similar SDK in `package.json`).

**Logs:**
- `console.error` only, e.g. `PORTIA media upload failed` in `app/api/uploads/route.ts`, `PORTIA cache purge failed for <tag>` in `lib/portia-cdn.ts`, `PORTIA Roblox profile lookup failed` in `lib/portia-employees.ts`. Logs go to Netlify function logs.

## CI/CD & Deployment

**Hosting:**
- Netlify, configured in `netlify.toml` (`npm run build`, Node 22.13.0). The README states the site only works on Netlify.

**CI Pipeline:**
- No CI config files detected in the repository (no `.github/workflows/`). Netlify builds from the GitHub repo: pull requests get preview deploys, `main` deploys to production (per `README.md`).
- Local verification script: `npm run check` (runs tests, build and lint, defined in `package.json`).

## Environment Configuration

**Required env vars (names only; values not recorded):**
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL. Required by `lib/supabase/env.ts`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Supabase publishable key. Required by `lib/supabase/env.ts`. (`NEXT_PUBLIC_SUPABASE_ANON_KEY` accepted as fallback.)

**Not required by this codebase:**
- Supabase Service Role key (explicitly excluded per `README.md`).
- Google Sheets and Roblox credentials (both public endpoints).

**Secrets location:**
- Local development: `.env.local` in the project root (present, git-ignored by `.gitignore` rule `.env*`). Contents not recorded in this document.
- Production: Netlify project Environment variables (per `README.md`).
- Template: `.env.example` lists the variable names with placeholders.

## Webhooks & Callbacks

**Incoming:**
- None. No webhook receivers are defined under `app/api/` (routes are `access`, `content`, `editors`, `employees`, `uploads`).

**Outgoing:**
- None beyond the read-only fetches listed above (Google Sheets CSV, Roblox users/thumbnails APIs) and Supabase calls.
- Netlify CDN cache purge (`purgeCache` from `@netlify/functions`) after content/employee saves.

---

*Integration audit: 2026-10-12*
