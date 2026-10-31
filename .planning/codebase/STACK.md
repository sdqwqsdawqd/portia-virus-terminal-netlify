---
last_mapped_commit: 2904899037d4243c8433d9d16a88f21ce7f7fe18
last_mapped_at: 2026-11-01
---
# Technology Stack

**Analysis Date:** 2026-11-01

## Languages

**Primary:**
- TypeScript (strict mode) - All application code: `app/`, `components/`, `lib/`, `proxy.ts`. Configured in `tsconfig.json` (path alias `@/*` to repo root, `moduleResolution: bundler`, `allowImportingTsExtensions: true`).
- TSX/React - UI: `app/page.tsx`, `app/layout.tsx`, `app/owner-login/page.tsx`, `components/portia-desktop.tsx`, `components/portia-editor.tsx`, `components/portia-promotion.tsx`, `components/portia-promotion-editor*.tsx`.

**Secondary:**
- CSS - `app/globals.css` (Tailwind v4 entry via `@import "tailwindcss"`), `app/portia.css` (hand-written desktop/OS look using CSS custom properties such as `var(--sans)`, `var(--teal)`).
- SQL (PostgreSQL dialect) - Supabase schema, RPCs, RLS and storage policies: `supabase/portia_setup.sql`, `supabase/phase12_apply.sql`, `supabase/phase14_apply.sql`.
- Markdown - Project docs in Russian: `README.md`, `EDITING_GUIDE.md`, `PRODUCT.md`.

**Content language:**
- UI, metadata and API error messages are Russian (`<html lang="ru">` in `app/layout.tsx`; Russian strings hard-coded in components and route handlers such as `app/api/uploads/route.ts`).

## Runtime

**Environment:**
- Node.js `>=22.13.0 <23` (declared in `package.json` `engines`).
- Netlify build pins Node `22.13.0` in `netlify.toml`.
- Unit tests run on Node's built-in runner with type stripping (`node --experimental-strip-types --test`), so Node 22 is required for `npm test`.

**Package Manager:**
- npm with committed lockfile `package-lock.json`.
- `.npmrc` sets `audit=false`, `fund=false`, `update-notifier=false`.

## Frameworks

**Core:**
- Next.js `16.4.2` (`package.json`) - App Router, route handlers (`app/api/**/route.ts`), server actions (`app/owner-login/actions.ts`), and `proxy.ts` as the request hook (Next 16 replacement for `middleware.ts`).
- React `19.2.6` and React DOM `19.2.6` - UI. Client components are marked `"use client"`; heavy desktop is loaded via `next/dynamic` (see `components/portia-desktop.tsx` usage from `app/page.tsx`).
- `next/font/google` in `app/layout.tsx` loads Golos Text (`--font-golos`), IBM Plex Serif (`--font-plex-serif`) and IBM Plex Mono (`--font-plex-mono`), with `latin` and `cyrillic` subsets, `display: "swap"`.

**Styling:**
- Tailwind CSS `4.2.1` with `@tailwindcss/postcss` `4.2.1`.
- Hand-written CSS in `app/portia.css` and `app/globals.css`.

**Testing:**
- Node built-in `node:test` and `node:assert/strict`. No external runner. About 60 `*.test.ts` files in `lib/` (for example `lib/portia-promotion-api.test.ts`, `lib/portia-promotion-security.test.ts`, `lib/security-headers.test.ts`, `lib/phase15-visual-manifest.test.ts`).
- Playwright `1.64.1` (`@playwright/test`) and `@axe-core/playwright` `4.14.0` for E2E and accessibility checks (`playwright.config.ts`, `tests/e2e/`). E2E lanes need preflight env (`scripts/phase15-e2e-preflight.mjs`).

**Build/Dev:**
- `next dev` / `next build` / `next start` (`package.json` scripts).
- TypeScript `5.9.3` - type checking (`npm exec tsc -- --noEmit`).
- ESLint `9.39.4` with `eslint-config-next` `16.4.2` - flat config in `eslint.config.mjs`, run via `npm run lint`.
- `@types/node` `22.19.19`, `@types/react` `19.2.14`, `@types/react-dom` `19.2.3`.

## Key Dependencies

**Critical (runtime `dependencies` in `package.json`):**
- `next` `16.4.2` - Framework.
- `react` / `react-dom` `19.2.6` - UI runtime.
- `@supabase/supabase-js` `^2.117.3` - Supabase client: Auth, RPC, table access, Storage. Used in `lib/supabase/server.ts`, `lib/editor-access.ts`, `lib/portia-employees.ts`, `lib/portia-promotion-api.ts`, `lib/portia-promotion-reviewer.ts`, and `app/api/**`. Also `isAuthRetryableFetchError` in `app/api/access/route.ts`.
- `@supabase/ssr` `^0.12.7` - Cookie-aware server client: `createServerClient` in `lib/supabase/server.ts`, session refresh in `lib/supabase/proxy.ts`.
- `@netlify/functions` `^6.0.2` - `purgeCache` in `lib/portia-cdn.ts` for CDN cache-tag purge after saves.

**Infrastructure (devDependencies):**
- `eslint` `9.39.4`, `eslint-config-next` `16.4.2`, `tailwindcss` `4.2.1`, `@tailwindcss/postcss` `4.2.1`, `typescript` `5.9.3`, `@playwright/test` `1.64.1`, `@axe-core/playwright` `4.14.0`.

**Notes on the dependency surface:**
- Runtime dependency list is intentionally small (5 packages). No state library, ORM, CSS-in-JS, UI kit or date library is used.
- Node built-ins used in app/lib code: `node:crypto` (device token digests in `lib/portia-device-binding.ts`), `node:fs`/`node:path`/`node:url` (mostly in tests and scripts).

## Configuration

**Environment (names only; values are never recorded here):**
- Read at runtime in `lib/supabase/env.ts` (via `getSupabaseConfig()`):
  - `NEXT_PUBLIC_SUPABASE_URL` - required.
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - required. `NEXT_PUBLIC_SUPABASE_ANON_KEY` accepted as fallback.
  - Missing values throw `Supabase environment variables are not configured.`
- `PORTIA_PROMOTION_DEVICE_SECRET` - read by `promotionDeviceSecret()` in `lib/portia-device-binding.ts`; keys HMAC digests for device binding and attempt buckets. Server-only; `requireSecret` rejects empty values.
- Test/E2E-only variables (not read by the app runtime): `PORTIA_E2E_TARGET_ID`, `PORTIA_E2E_TARGET_ENVIRONMENT`, `PORTIA_E2E_SUPABASE_URL`, `PORTIA_E2E_PRODUCTION_PROJECT_IDS`, `PORTIA_E2E_ISOLATED_PROJECT_IDS`, `PORTIA_E2E_MUTATION_CONFIRM`, `PORTIA_PROMO_LIVE_URL`, `PORTIA_PROMO_LIVE_ANON_KEY`, `PORTIA_PROMO_LIVE_SERVICE_ROLE_KEY`, `PORTIA_PROMO_LIVE_CONFIRM`. Names are listed in `.env.example` and used by `scripts/phase15-e2e-preflight.mjs` and `lib/portia-promotion-live.test.ts`.
- Local `.env.local` exists in the project root (git-ignored). Its contents are intentionally not read or recorded.
- Hard-coded (no env var): Google Sheet ID, Roblox API hosts, GitHub Pages charter URL (see `.planning/codebase/INTEGRATIONS.md`).

**Build:**
- `next.config.ts` - Minimal config (outside the mapping scope for this run; not re-read here).
- `tsconfig.json` - Strict TS, `paths` alias `@/*`, `plugins: [{ name: "next" }]`.
- `eslint.config.mjs` - Flat config.
- `postcss.config.mjs` - Tailwind v4 PostCSS plugin.
- `netlify.toml` - Build command `npm run build`, Node `22.13.0`.
- `.gitignore` - Ignores `.env*` (except `.env.example`), `.next`, `node_modules`, `*.tsbuildinfo`, `.netlify`.

**Database schema and setup (Supabase):**
- `supabase/portia_setup.sql` - Base idempotent schema: tables, RPC helpers, RLS, `portia-media` bucket. Run in Supabase SQL Editor.
- `supabase/phase12_apply.sql`, `supabase/phase14_apply.sql` - Later incremental migrations for promotion and related objects.
- Any change to `supabase/*.sql`, RLS, RPCs or storage policies requires the `supabase-rls-reviewer` agent (project CLAUDE.md).

## Platform Requirements

**Development:**
- Node.js 22.13.x (within `>=22.13.0 <23`). Machine default may be Node 24; the reference version is 22.13.1.
- npm with `package-lock.json`.
- Supabase project (isolated test project only for development) with schema applied and the two public env vars set locally.
- Outbound network access at runtime: Supabase, Google Sheets (gviz CSV), Roblox APIs.

**Production:**
- Netlify (CDN cache-tag purging via `@netlify/functions` requires it).
- Builds from the GitHub repository; `main` deploys to production.
- Requires `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `PORTIA_PROMOTION_DEVICE_SECRET` in Netlify environment settings.

---

*Stack analysis: 2026-11-01*
