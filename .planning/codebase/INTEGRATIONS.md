---
last_mapped_commit: 2904899037d4243c8433d9d16a88f21ce7f7fe18
last_mapped_at: 2026-11-01
---
# External Integrations

**Analysis Date:** 2026-11-01

## APIs & External Services

**Google Sheets (staff roster and promotion source):**
- One spreadsheet, sheet tab `Portia`, read as CSV via the gviz endpoint: `https://docs.google.com/spreadsheets/d/1IHAdgvHB27iW4s9aJe4L0GIpYrhS_R2EonUwugZIJww/gviz/tq?tqx=out:csv&sheet=Portia`.
  - Staff roster: `sheetCsvUrl` in `lib/portia-employees.ts` (around line 152). Fetched with `cache: "no-store"` and `AbortSignal.timeout(8_000)` (around line 380). CSV header row validated; throws `The Portia sheet headers have changed.` on drift. 34 numbered slots in rows 2-35.
  - Promotion access list: `accessCsvUrl` (`&range=B2:B35`) and promotion roster `promotionCsvUrl` (`&range=A61:E85`) in `lib/portia-promotion-sheet.ts`. Parsed with `loadSheetRows` (size-capped, throws `Promotion sheet response is empty or oversized.`); dates are Moscow calendar dates (UTC+03:00); duplicate nicknames and partial rows are rejected.
- SDK/Client: none (plain `fetch`).
- Auth: none. The sheet must be publicly readable.
- Embedded in the desktop UI as a sheet app: `components/portia-desktop.tsx` (around line 29) uses `/htmlview?widget=true&headers=false` and the plain sheet URL.

**Roblox (staff identity and avatars):**
- `https://users.roblox.com/v1/usernames/users` - nickname to user ID lookup, `resolveRobloxProfiles()` in `lib/portia-employees.ts` (around line 207).
- `https://thumbnails.roblox.com/v1/users/avatar-headshot?...` (420x420) and `.../v1/users/avatar?...` (720x720) - avatar images, 5-second timeouts (`lib/portia-employees.ts` around lines 219-220).
- Failures are logged (`PORTIA Roblox profile lookup failed`); the roster degrades gracefully using the stored `nickname`/`employee_id` in `portia_employee_profiles`.
- Profile links rendered as `https://www.roblox.com/users/<id>/profile` in `components/portia-desktop.tsx` (around line 1414).
- SDK/Client: none. Auth: none (public endpoints).

**Media embeds (display only, no API calls):**
- Giphy: `https://media.giphy.com/media/<id>/giphy.gif` built from pasted Giphy URLs in `components/portia-desktop.tsx` (around line 289) and `components/portia-editor.tsx` (around line 116). IDs must match `/^[a-z0-9]+$/i`.
- Klipy: one hard-coded Klipy page to static CDN GIF mapping in `components/portia-desktop.tsx` (around line 276).
- YouTube: `https://www.youtube-nocookie.com/embed/<id>` and watch URLs in `components/portia-desktop.tsx` (around line 1957) and `components/portia-editor.tsx` (around lines 2993-2996, input hints).
- Only `https://` URLs accepted for these embeds (`components/portia-desktop.tsx` around line 177).
- Google Fonts are fetched at build time by `next/font/google` (`app/layout.tsx`), not at runtime.

**External content links (iframes/links):**
- Charter document: `https://sdqwqsdawqd.github.io/S.E-Portia/` (GitHub Pages), defined in `components/portia-desktop.tsx` (around line 30) as an app with `src` and `external` URLs.

## Data Storage

**Primary database - Supabase Postgres:**
- Provider: Supabase (Postgres, Auth, Storage, RLS, RPC).
- Connection: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` read in `lib/supabase/env.ts`. Only the browser-safe publishable key is used; no service-role key is read by the app runtime.
- Clients:
  - `lib/supabase/server.ts` - `createServerSupabaseClient()` (cookie-bound SSR client via `@supabase/ssr` and `next/headers`) and `createPublicSupabaseClient()` (cookie-less client for public reads).
  - `lib/supabase/proxy.ts` - session refresh called from `proxy.ts`.
- Tables accessed with `.from()`:
  - `portia_content` - site content JSONB with revision and `updated_by`. Used in `app/api/content/route.ts`.
  - `portia_editors` - approved editor emails. Used in `app/api/editors/route.ts` and `lib/editor-access.ts`.
  - `portia_employee_profiles` - biography, photo URL, knowledge rating, last-known nickname keyed by `employee_id`. Used in `lib/portia-employees.ts` and `app/api/employees/route.ts`.
- RPCs called with `.rpc()`:
  - Access: `portia_can_edit`, `portia_is_owner` (`lib/editor-access.ts`), `portia_editor_is_approved` (`app/owner-login/actions.ts`).
  - Promotion: `portia_promo_resolve_device`, `portia_promo_public_status`, `portia_promo_submit_request` (`lib/portia-promotion-api.ts`), `portia_promo_bank_state` and `portia_promo_bank_command` (`app/api/promotion/banks/route.ts`), `portia_promo_reviewer_state` (`app/api/promotion/reviewer/route.ts`).
- RLS is enabled. Public read policies exist for content, employee profiles and media; writes require `portia_can_edit()`. Promotion state is accessed through RPCs (see `supabase/phase12_apply.sql`, `supabase/phase14_apply.sql`).

**File Storage - Supabase Storage:**
- Bucket: `portia-media` (public read), accessed in `app/api/uploads/route.ts` via `storage.from("portia-media")`.
- Upload: editor session required; PNG/JPG/WEBP/GIF up to 4 MB, image signature checked (`imageExtensionFromSignature` in `lib/image-upload.ts`); stored at `recycle/<uuid>.<ext>` with `cacheControl: "3600"`; public URL via `getPublicUrl`.
- Storage policies: public read, editor-only insert/update/delete.

**Browser storage (client-side only):**
- `localStorage` / cookies used for UI state (window positions in `lib/panel-position.ts`, seen quests in `lib/broadcasts.ts`, retake ledger in `lib/portia-promotion-notifications.ts`). Values are parsed defensively.
- Promotion device binding cookie `portia_promo_device` (`lib/portia-device-binding.ts`, `deviceBindingCookie`); token digests keyed by `PORTIA_PROMOTION_DEVICE_SECRET`.

**Caching:**
- Netlify CDN via `@netlify/functions`:
  - `lib/portia-cdn.ts` builds `Netlify-CDN-Cache-Control` (`publicCacheHeaders(tag, seconds)`) with `Netlify-Cache-Tag`; `noStoreHeaders` for writes and per-user responses.
  - `purgeCacheTag(tag)` calls `purgeCache({ tags })` after saves. Tags: `portia-content` and `portia-employees`. Used in `app/api/content/route.ts` and `app/api/employees/route.ts`.
- Next.js: route handlers use `export const dynamic = "force-dynamic"`. `revalidatePath("/", "layout")` after login/logout in `app/owner-login/actions.ts`.
- Netlify Blobs and `netlify/functions/` are not present in the code scope; no Blobs package in `package.json`.

## Authentication & Identity

**Auth Provider - Supabase Auth (email and password):**
- Implementation: `@supabase/ssr` cookies; `getUser()` in route handlers and `app/owner-login/page.tsx`.
- Owner/editor login: `ownerLogin` server action in `app/owner-login/actions.ts` (`signInWithPassword`), then `getEditorAccess()` in `lib/editor-access.ts` checks `portia_can_edit` / `portia_is_owner`; non-editors are signed out.
- Editor sign-up: `editorSignUp` in `app/owner-login/actions.ts` checks `portia_editor_is_approved` (email must be approved first), enforces minimum password length 8, then `signUp`; non-approved users are signed out.
- Owner identity is defined in one place in the database: `portia_owner_email()` in `supabase/portia_setup.sql`.
- Editor management: `app/api/editors/route.ts` (GET, POST grant, PATCH, DELETE revoke) with `normalizeEditorEmail` from `lib/editor-access.ts`.
- Promotion reviewers: `requirePromotionReviewer` in `lib/portia-promotion-reviewer.ts` uses `supabase.auth.getUser()`.
- Session refresh: `proxy.ts` matches `/owner-login/:path*`, `/api/access`, `/api/editors`, `/api/uploads` and calls `updateSupabaseSession` (`lib/supabase/proxy.ts`). The public desktop `/` is excluded.
- Access check: `app/api/access/route.ts` returns the current user's editor access.
- Public promotion test/status flows are device-bound, not account-based: `lib/portia-device-binding.ts` (HMAC digests via `node:crypto`, coarse IP buckets, penalty minutes).

## Monitoring & Observability

**Error Tracking:**
- None detected (no Sentry, Datadog or similar in `package.json`).

**Logs:**
- `console.error` only, for example `PORTIA media upload failed` (`app/api/uploads/route.ts`), `PORTIA cache purge failed for <tag>` (`lib/portia-cdn.ts`), `PORTIA Roblox profile lookup failed` (`lib/portia-employees.ts`). Logs go to Netlify function logs.

**Security headers:**
- `lib/security-headers.test.ts` covers the header policy; the header source is outside this mapping scope.

## CI/CD & Deployment

**Hosting:**
- Netlify (`netlify.toml`: `npm run build`, Node `22.13.0`). Site is documented as Netlify-only because of cache-tag purging.

**CI Pipeline:**
- No `.github/workflows/` detected in the mapped scope. Netlify builds from the GitHub repo; PRs get preview deploys, `main` deploys to production (per `README.md`).
- Local verification: `/portia-check` (`bash .claude/skills/portia-check/run.sh`) or `npm run check` (tests, build, lint).
- Live Supabase/E2E lanes are gated by preflight scripts (`scripts/phase15-e2e-preflight.mjs`) and must target isolated test projects only.

## Environment Configuration

**Required env vars (names only; values not recorded):**
- `NEXT_PUBLIC_SUPABASE_URL` - required by `lib/supabase/env.ts`.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - required by `lib/supabase/env.ts` (`NEXT_PUBLIC_SUPABASE_ANON_KEY` accepted as fallback).
- `PORTIA_PROMOTION_DEVICE_SECRET` - required by `promotionDeviceSecret()` in `lib/portia-device-binding.ts` for promotion routes.

**Test/E2E-only env vars (not read by app runtime):**
- `PORTIA_E2E_*` and `PORTIA_PROMO_LIVE_*` (names listed in `.env.example`). Live promotion test `lib/portia-promotion-live.test.ts` references a service-role key variable name; this is test harness only and must never point at production.

**Not required by this codebase:**
- Supabase service-role key for the site runtime.
- Google Sheets or Roblox credentials (public endpoints).

**Secrets location:**
- Local development: `.env.local` in the project root (git-ignored). Contents not recorded.
- Production: Netlify project environment variables.
- Template: `.env.example` lists variable names with empty values.

## Webhooks & Callbacks

**Incoming:**
- None. Route handlers under `app/api/`: `access`, `content`, `editors`, `employees` (including `employees/editor`), `uploads`, `promotion/banks`, `promotion/requests`, `promotion/reviewer`, `promotion/status`, `promotion/test`. None are webhook receivers.

**Outgoing:**
- Read-only fetches to Google Sheets (CSV) and Roblox (users/thumbnails) APIs.
- Supabase calls (Auth, Postgres tables/RPC, Storage).
- Netlify CDN cache purge (`purgeCache` from `@netlify/functions`) after content and employee saves.
- No outbound notification channel (email, chat, push) was found in `app/`, `components/` or `lib/`. `lib/portia-promotion-notifications.ts` is a client-side ledger only.

---

*Integration audit: 2026-11-01*
