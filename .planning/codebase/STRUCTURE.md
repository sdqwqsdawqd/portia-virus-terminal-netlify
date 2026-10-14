---
last_mapped_commit: e3941d4a097005a1674d3e9bc4d1e638aeda0846
last_mapped_at: 2026-10-12
---
# Codebase Structure

**Analysis Date:** 2026-10-12

## Directory Layout

```
site/                              # repository root (no src/ directory)
├── app/                           # Next.js App Router: pages, layout, route handlers
│   ├── api/                       # JSON route handlers
│   │   ├── access/route.ts        # GET current editor access
│   │   ├── content/route.ts       # GET public content, PUT owner/editor save
│   │   ├── editors/route.ts       # Owner-managed editor allowlist
│   │   ├── employees/route.ts     # GET roster, POST profile update
│   │   └── uploads/route.ts       # Editor file uploads
│   ├── owner-login/               # Login/sign-up page and server actions
│   │   ├── actions.ts
│   │   └── page.tsx
│   ├── globals.css                # Base styles
│   ├── portia.css                 # Desktop/editor styles
│   ├── layout.tsx                 # Root layout, fonts, metadata
│   └── page.tsx                   # Home: renders PortiaDesktop
├── components/                    # Client UI (all "use client" desktop/editor code)
│   ├── portia-desktop.tsx         # Public desktop and window manager (~1400 lines)
│   ├── portia-editor.tsx          # Editor UI, lazy-loaded (~1360 lines)
│   ├── portia-icons.tsx           # SVG icon set
│   └── portia-wallpaper.tsx       # Animated wallpaper
├── lib/                           # Framework-light domain and infrastructure code
│   ├── supabase/                  # Supabase client factories and session proxy
│   │   ├── env.ts
│   │   ├── proxy.ts
│   │   └── server.ts
│   ├── editor-access.ts           # Editor/owner checks via Supabase RPC
│   ├── portia-cdn.ts              # Cache headers and tag purge (Netlify)
│   ├── portia-content.ts          # Content types and default content
│   ├── portia-content-normalize.ts# Runtime normalization of content JSON
│   ├── portia-employees.ts        # Roster CSV parsing and profile merge
│   ├── window-geometry.ts         # Window size/position math
│   └── *.test.ts                  # Node test-runner unit tests
├── public/
│   └── assets/                    # Static images (logo, icons, assistant)
├── supabase/
│   └── portia_setup.sql           # Tables, RLS policies, portia_* functions
├── proxy.ts                       # Next.js request proxy (Supabase session refresh)
├── next.config.ts                 # Next.js config
├── netlify.toml                   # Netlify build settings (Node 22.13.0)
├── package.json                   # Scripts: dev, build, test, lint, check
├── tsconfig.json                  # TypeScript config (path alias "@/")
├── eslint.config.mjs              # ESLint flat config
├── postcss.config.mjs             # Tailwind v4 PostCSS plugin
├── .claude/launch.json            # Local launch configuration
├── .planning/codebase/            # Generated codebase analysis documents
└── README.md, EDITING_GUIDE.md, PRODUCT.md  # Project documentation
```

## Directory Purposes

**`app/`:**
- Purpose: Routes, layouts, and server-side HTTP surface
- Contains: `page.tsx`, `layout.tsx`, `route.ts` files, one `actions.ts` server-action module
- Key files: `app/page.tsx`, `app/layout.tsx`, `app/api/content/route.ts`

**`app/api/<name>/`:**
- Purpose: One folder per public endpoint; each contains only `route.ts`
- Contains: Exported `GET`, `PUT`, or `POST` functions, `export const dynamic = "force-dynamic"`
- Key files: `app/api/content/route.ts` (save with revision check), `app/api/employees/route.ts`

**`app/owner-login/`:**
- Purpose: Owner and editor authentication UI
- Contains: `page.tsx` (server component) and `actions.ts` (`"use server"` functions)
- Key files: `app/owner-login/actions.ts`

**`components/`:**
- Purpose: All interactive React UI
- Contains: Large client components plus small presentational files
- Key files: `components/portia-desktop.tsx`, `components/portia-editor.tsx`

**`lib/`:**
- Purpose: Shared logic used by routes and components
- Contains: Types, normalization, access checks, cache helpers, Supabase factories, and their tests
- Key files: `lib/portia-content.ts`, `lib/editor-access.ts`, `lib/portia-cdn.ts`

**`lib/supabase/`:**
- Purpose: Isolate all `@supabase/*` construction
- Contains: `server.ts` (cookie-aware and anonymous clients), `env.ts` (URL and publishable key), `proxy.ts` (session refresh)
- Key files: `lib/supabase/server.ts`

**`public/assets/`:**
- Purpose: Static images referenced by metadata and UI
- Contains: `portia-logo.png`, `portia-virus-icon.png`, `portia-assistant.png`
- Generated: No. Committed: Yes.

**`supabase/`:**
- Purpose: Database schema and access policies, applied manually in the Supabase SQL editor
- Contains: `portia_setup.sql`. Idempotent (`create table if not exists`, `drop policy if exists`).
- Key files: `supabase/portia_setup.sql`

**`.planning/codebase/`:**
- Purpose: Analysis documents consumed by GSD planning commands
- Generated: Yes (by mapper agents). Committed: Intended to be.

## Key File Locations

**Entry Points:**
- `app/page.tsx`: Public desktop
- `app/owner-login/page.tsx`: Owner login and sign-up
- `proxy.ts`: Request proxy and session refresh

**Configuration:**
- `next.config.ts`: Next.js options
- `netlify.toml`: Netlify build and Node version
- `tsconfig.json`: TypeScript, `@/*` alias to repository root
- `eslint.config.mjs`: Lint rules
- `package.json`: Dependencies and scripts
- `.env.example`: Documented env var names. `.env.local` exists but is not read here.

**Core Logic:**
- `lib/portia-content.ts`: Content model and defaults
- `lib/portia-content-normalize.ts`: Content validation
- `lib/portia-employees.ts`: Roster and profile logic
- `lib/editor-access.ts`: Permission checks
- `app/api/content/route.ts`: Content read and save

**Testing:**
- `lib/portia-content-normalize.test.ts`
- `lib/portia-employees.test.ts`
- `lib/window-geometry.test.ts`

**Database:**
- `supabase/portia_setup.sql`: Tables `portia_content`, `portia_editors`, `portia_employee_profiles`; functions `portia_owner_email`, `portia_is_owner`, `portia_can_edit`, `portia_editor_is_approved`

## Naming Conventions

**Files:**
- Kebab-case with a `portia-` prefix for domain modules: `portia-content.ts`, `portia-desktop.tsx`, `portia-cdn.ts`
- Next.js reserved names for routing: `page.tsx`, `layout.tsx`, `route.ts`, `actions.ts`
- Tests co-located in `lib/` as `<module>.test.ts`
- Infrastructure grouped under a folder when it has several files: `lib/supabase/`

**Directories:**
- Lowercase, kebab-case route segments: `app/owner-login/`, `app/api/editors/`
- Plural resource names under `app/api/`: `content`, `employees`, `uploads`

**Code identifiers:**
- Components: PascalCase with `Portia` prefix for domain components (`PortiaDesktop`, `PortiaEditor`), generic names for local helpers (`AppWindow`, `DesktopIcon`)
- Functions: camelCase (`getEditorAccess`, `normalizePortiaContent`)
- Cache tags and constants: camelCase (`contentCacheTag`, `employeesCacheTag`)
- Supabase tables and functions: snake_case with `portia_` prefix

## Where to Add New Code

**New public API endpoint:**
- Implementation: `app/api/<resource>/route.ts`
- Access check: call `getEditorAccess` from `lib/editor-access.ts` for any write
- Caching: use `publicCacheHeaders` or `noStoreHeaders` from `lib/portia-cdn.ts`
- Tests: pure parsing or validation in `lib/<name>.test.ts`

**New database table or policy:**
- Schema and RLS: append to `supabase/portia_setup.sql` (keep it re-runnable)

**New content field (virus, log, broadcast):**
- Type and default: `lib/portia-content.ts`
- Validation: `lib/portia-content-normalize.ts`, plus its test in `lib/portia-content-normalize.test.ts`
- UI: `components/portia-desktop.tsx` for display, `components/portia-editor.tsx` for editing

**New desktop application window:**
- Component: add an app component in `components/portia-desktop.tsx` following `AppWindow` usage
- Geometry: `lib/window-geometry.ts` (add a test in `lib/window-geometry.test.ts`)

**New editor feature:**
- Implementation: `components/portia-editor.tsx`; keep logic that can be pure in `lib/`

**New shared helper:**
- Shared logic: `lib/<name>.ts`
- Supabase-specific: `lib/supabase/`

**New page:**
- Route folder under `app/<route>/page.tsx`

**New static asset:**
- `public/assets/`

## Special Directories

**`.next/`:**
- Purpose: Next.js build output
- Generated: Yes. Committed: No (ignored; excluded from this map).

**`node_modules/`:**
- Purpose: npm dependencies
- Generated: Yes. Committed: No (excluded from this map).

**`.impeccable/`:**
- Purpose: Design tooling artifacts
- Excluded from this map by request.

**`.claude/`:**
- Purpose: Claude Code project settings (`launch.json`)
- Generated: No. Committed: Yes.

**`.planning/`:**
- Purpose: GSD planning state and generated codebase documents
- Generated: Yes. Committed: Yes.

---

*Structure analysis: 2026-10-12*
