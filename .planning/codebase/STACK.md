---
last_mapped_commit: e3941d4a097005a1674d3e9bc4d1e638aeda0846
last_mapped_at: 2026-10-12
---
# Technology Stack

**Analysis Date:** 2026-10-12

## Languages

**Primary:**
- TypeScript (strict mode) - All application code: `app/`, `components/`, `lib/`, `proxy.ts`, `next.config.ts`, `eslint.config.mjs`. Configured in `tsconfig.json` (target ES2017, `moduleResolution: bundler`, `allowImportingTsExtensions: true`, path alias `@/*` to repo root).
- TSX/React - UI components: `components/portia-desktop.tsx`, `components/portia-editor.tsx`, `components/portia-icons.tsx`, `components/portia-wallpaper.tsx`, `app/page.tsx`, `app/owner-login/page.tsx`.

**Secondary:**
- CSS - Global and theme styles: `app/globals.css`, `app/portia.css` (Tailwind v4 entry via `@import "tailwindcss"` in `app/globals.css`).
- SQL (PostgreSQL dialect) - Supabase schema, RLS policies and storage bucket setup: `supabase/portia_setup.sql`.
- Markdown - Project docs written in Russian: `README.md`, `EDITING_GUIDE.md`, `PRODUCT.md`.

**Content language:**
- The UI and metadata are Russian-only (`<html lang="ru">` in `app/layout.tsx`). Russian copy is hard-coded in components and API error messages (for example `app/api/uploads/route.ts`).

## Runtime

**Environment:**
- Node.js `>=22.13.0 <23` (declared in `package.json` `engines`).
- Netlify build pins `NODE_VERSION = "22.13.0"` in `netlify.toml`.
- Node built-in test runner is used for unit tests (`node --experimental-strip-types --test`), so the test script needs Node 22 with type stripping.

**Package Manager:**
- npm (lockfile present: `package-lock.json`, lockfileVersion-based npm install).
- `.npmrc` sets `audit=false`, `fund=false`, `update-notifier=false`.

## Frameworks

**Core:**
- Next.js `16.3.4` - App Router with server components, route handlers (`app/api/*/route.ts`), server actions (`app/owner-login/actions.ts`) and the `proxy.ts` request hook (Next 16 replacement for `middleware.ts`). Config in `next.config.ts` (only `agentRules: false`).
- React `19.2.6` and React DOM `19.2.6` - UI rendering. Client components are marked with `"use client"` in `components/` and used through `next/dynamic` (`components/portia-desktop.tsx`).
- Next font loader - `next/font/google` in `app/layout.tsx` loads Golos Text, Unbounded and JetBrains Mono (self-hosted at build time, Cyrillic subset included).

**Styling:**
- Tailwind CSS `4.2.1` with `@tailwindcss/postcss` `4.2.1` - Configured in `postcss.config.mjs`.
- Hand-written CSS in `app/portia.css` (the main desktop/OS look uses CSS custom properties such as `var(--sans)` and `var(--teal)`).

**Testing:**
- Node built-in `node:test` and `node:assert/strict` - No external test runner. Test files: `lib/portia-content-normalize.test.ts`, `lib/portia-employees.test.ts`, `lib/window-geometry.test.ts`.

**Build/Dev:**
- `next dev` / `next build` / `next start` - Scripts in `package.json`.
- TypeScript `5.9.3` - Type checking only (`noEmit: true`), no separate build step.
- ESLint `9.39.4` with `eslint-config-next` `16.3.4` (`core-web-vitals` and `typescript` presets) - Config in `eslint.config.mjs`.
- `@types/node` `22.19.19`, `@types/react` `19.2.14`, `@types/react-dom` `19.2.3` - Type packages.

## Key Dependencies

**Critical:**
- `@supabase/supabase-js` `^2.117.3` - Supabase client for auth, Postgres RPC/table access and Storage. Used in `lib/supabase/server.ts` (`createClient` for the public client), `lib/editor-access.ts`, `lib/portia-employees.ts`, and the route handlers under `app/api/`.
- `@supabase/ssr` `^0.12.7` - Cookie-aware Supabase server client for Next.js. Used in `lib/supabase/server.ts` (`createServerClient` with `next/headers` cookies) and `lib/supabase/proxy.ts` (session refresh in `proxy.ts`).
- `@netlify/functions` `^6.0.2` - Provides `purgeCache` in `lib/portia-cdn.ts` to purge Netlify CDN entries by cache tag after saves.
- `next` `16.3.4` - Framework (see above).
- `react` / `react-dom` `19.2.6` - UI runtime.

**Infrastructure:**
- `eslint` `9.39.4` and `eslint-config-next` `16.3.4` - Linting, run through `npm run lint`.
- `tailwindcss` `4.2.1` and `@tailwindcss/postcss` `4.2.1` - Styling pipeline.

**Notes on the dependency surface:**
- The runtime dependency list is intentionally small (5 packages). No state library, ORM, CSS-in-JS, or UI kit is used.
- No Netlify Blobs package is present in `package.json`, even though `README.md` describes a Netlify Blobs cache and hourly scheduled functions in `netlify/functions/`. That directory does not exist in the repository (see `.planning/codebase/CONCERNS.md` if generated).

## Configuration

**Environment:**
- Two public environment variables are read at runtime in `lib/supabase/env.ts`:
  - `NEXT_PUBLIC_SUPABASE_URL` - Supabase project URL (required).
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` - Supabase publishable key (required). `NEXT_PUBLIC_SUPABASE_ANON_KEY` is accepted as a fallback name.
- Missing values throw `Supabase environment variables are not configured.` from `getSupabaseConfig()`.
- Names are documented in `.env.example`. A local `.env.local` file exists in the project root; its contents are intentionally not recorded here.
- The README states the Service Role key is not used by this site and must not be added to public variables.
- Google Sheets and Roblox endpoints are hard-coded in code (no env vars). See `.planning/codebase/INTEGRATIONS.md`.

**Build:**
- `next.config.ts` - Minimal Next config (`agentRules: false`).
- `tsconfig.json` - Strict TS, `incremental: true`, `paths` alias `@/*`, `plugins: [{ name: "next" }]`.
- `eslint.config.mjs` - Flat config; ignores `.next/**`, `out/**`, `next-env.d.ts`.
- `postcss.config.mjs` - Tailwind v4 PostCSS plugin.
- `netlify.toml` - `command = "npm run build"`, Node 22.13.0.
- `.claude/launch.json` - Local dev server launch: `npm run dev -- -p 3123`.
- `.gitignore` - Ignores `.env*` (except `.env.example`), `.next`, `node_modules`, `*.tsbuildinfo`, `.netlify`, and Impeccable local state.

**Database schema and setup:**
- `supabase/portia_setup.sql` - Idempotent setup script for Supabase (tables `portia_content`, `portia_editors`, `portia_employee_profiles`, RPC helpers, RLS policies, and the `portia-media` storage bucket). Run from the Supabase SQL Editor.

## Platform Requirements

**Development:**
- Node.js 22.13.x (within `>=22.13.0 <23`).
- npm with the committed `package-lock.json`.
- A Supabase project with the schema from `supabase/portia_setup.sql` applied, and the two public env vars set locally.
- Outbound network access is needed at runtime for Supabase, Google Sheets, and Roblox APIs.

**Production:**
- Netlify (the README states the site only works on Netlify because of CDN cache-tag purging via `@netlify/functions`).
- Deploys from the GitHub repository's `main` branch; Pull Requests get preview deploys sharing the production Supabase database (per `README.md`).
- Requires the same two `NEXT_PUBLIC_SUPABASE_*` variables configured in Netlify environment settings.

---

*Stack analysis: 2026-10-12*
