---
last_mapped_commit: 2904899037d4243c8433d9d16a88f21ce7f7fe18
last_mapped_at: 2026-11-01
---
# Codebase Structure

**Analysis Date:** 2026-11-01

Scope of this map: `app/`, `components/`, `lib/` (106 files). Other top-level directories (`supabase/`, `scripts/`, `e2e/` or equivalent, `.planning/`, `.claude/`) are outside this pass.

## Directory Layout

```
portia-site/
├── app/                              # Next.js App Router: pages, layout, API route handlers
│   ├── page.tsx                      # "/" renders PortiaDesktop
│   ├── layout.tsx                    # <html lang="ru">, fonts, pre-hydration accent script
│   ├── globals.css, portia.css       # global and PORTIA-specific styles
│   ├── api/                          # JSON route handlers (force-dynamic)
│   │   ├── content/route.ts          # GET public content, PUT owner save (CAS on revision)
│   │   ├── access/route.ts           # GET current editor capabilities
│   │   ├── editors/route.ts          # editor account management
│   │   ├── employees/route.ts        # public roster read
│   │   ├── employees/editor/route.ts # owner profile writes
│   │   ├── uploads/route.ts          # image upload to storage bucket portia-media
│   │   └── promotion/                # banks, requests, reviewer, status, test
│   └── owner-login/                  # owner login page + server actions
├── components/                       # React client components (all "use client" shell/editor)
│   ├── portia-desktop.tsx            # Desktop shell and window manager (~2300 lines)
│   ├── portia-editor.tsx             # Content editor, loaded dynamically (~3000 lines)
│   ├── portia-promotion.tsx          # Promotion app window body
│   ├── portia-promotion-editor*.tsx  # Promotion editor (main, ordinary, qualification)
│   ├── portia-wallpaper*.tsx         # Wallpapers and spider animation
│   ├── portia-icons.tsx              # Icon and illustration set (PortiaIcon, PortiaIllustration)
│   └── custom-color-picker.tsx       # Custom accent picker
└── lib/                              # Domain logic, browser helpers, server Supabase clients
    ├── *.ts                          # Modules; each with a sibling *.test.ts (node:test)
    ├── supabase/                     # env.ts, server.ts (clients), proxy.ts (session refresh)
    └── (no subfolders otherwise)     # flat layout
```

Note: `app/` contains no `layout` for API groups and no `middleware`/`proxy` file inside this scope. The Supabase session helper `lib/supabase/proxy.ts` is consumed from a root file outside this map.

## Directory Purposes

**`app/`:**
- Purpose: Routing and HTTP boundary only. Keep business logic in `lib/`.
- Contains: `page.tsx`, `layout.tsx`, `route.ts` handlers, one `actions.ts`, global CSS.
- Key files: `app/layout.tsx`, `app/page.tsx`, `app/api/content/route.ts`, `app/api/access/route.ts`.

**`app/api/`:**
- Purpose: JSON endpoints consumed by the desktop and editor with `fetch`.
- Contains: One `route.ts` per resource. Each exports `GET`/`PUT`/`POST` and sets `export const dynamic = "force-dynamic"`.
- Pattern: Create the Supabase server client from `lib/supabase/server.ts`, resolve the user with `supabase.auth.getUser()`, check `getEditorAccess` from `lib/editor-access.ts`, return `noStoreHeaders()` or `publicCacheHeaders()` from `lib/portia-cdn.ts`.

**`components/`:**
- Purpose: All visible UI. Flat folder; file prefix `portia-` marks the feature.
- Contains: Named React function components. Feature-internal components are not split into files; they live at the bottom of the file that uses them.
- Key files: `components/portia-desktop.tsx` (shell), `components/portia-editor.tsx` (editor).

**`lib/`:**
- Purpose: Pure TypeScript domain logic plus a few browser helpers and the Supabase clients. Each feature has a `<name>.ts` and `<name>.test.ts`.
- Contains: 60+ modules grouped informally by prefix: `accent-*`, `broadcasts`, `content-*`, `e2e-*`, `editor-*`, `format-fragments`, `image-upload`, `layout-hydration`, `media-url`, `panel-position`, `portia-*`, `request-json`, `rich-text-style`, `security-headers`, `wallpaper-web`, `window-geometry`.
- Key files: `lib/window-geometry.ts`, `lib/portia-content.ts`, `lib/portia-content-normalize.ts`, `lib/editor-tabs.ts`, `lib/editor-history.ts`, `lib/accent-boot.ts`.

**`lib/supabase/`:**
- Purpose: Supabase client construction. Supabase URL and publishable key lookup goes through `env.ts`.
- Contains: `env.ts` (`getSupabaseConfig`), `server.ts` (`createServerSupabaseClient`, `createPublicSupabaseClient`), `proxy.ts` (`updateSupabaseSession`).
- Do not place secrets or example values in this folder. Real `.env*` files are never read for this map.

## Key File Locations

**Entry Points:**
- `app/page.tsx`: Home page, renders `PortiaDesktop`.
- `app/layout.tsx`: Root layout and boot script.
- `app/api/content/route.ts`: Content read and write.
- `app/owner-login/actions.ts`: Owner login action.

**Configuration:**
- `lib/accent-boot.ts`: localStorage and sessionStorage key names and accent/motion/spider id lists shared by head script and desktop.
- `lib/supabase/env.ts`: Supabase URL and publishable key lookup.
- `lib/security-headers.test.ts` exists but no `lib/security-headers.ts` module is present in `lib/`; the header implementation is outside this map.

**Core Logic:**
- `components/portia-desktop.tsx`: Window manager (`openApp`, `focusApp`, `requestExit`, `finishExit`, `toggleMaximize`, `updateWindowGeometry`), content sync, settings, taskbar.
- `components/portia-editor.tsx`: `PortiaEditor` (line ~736), editor reducer, dossier and guide forms, `EditorAccessManager`, `EmployeeProfilesEditor`, `FloatingTextFormatPanel`.
- `lib/window-geometry.ts`: `fitGeometry`, `resizeGeometry`, `dragGeometry`, types `WindowGeometry`, `Bounds`, `ResizeEdge`.
- `lib/content-sync.ts`: `acceptFetchedContent` (poll acceptance rule).
- `lib/editor-access.ts`: Capability resolution from Supabase user.
- `lib/editor-tabs.ts`: Tab registry and `contentRefusal`.
- `lib/editor-history.ts`: Undo/redo reducer.
- `lib/portia-content-normalize.ts`: Defensive normalization of stored JSON.
- `lib/portia-promotion-api.ts`: Client calls to `/api/promotion/*`.

**Testing:**
- Co-located: every `lib/*.test.ts` sits beside its module. There is no `__tests__` directory and no `components/*.test.*` file in scope.
- Run: `npm test` (`node --experimental-strip-types --test lib/*.test.ts`).

## Naming Conventions

**Files:**
- Kebab-case, lowercase: `portia-desktop.tsx`, `window-geometry.ts`, `editor-access.test.ts`.
- Feature prefix `portia-` for product-specific modules. Generic helpers use no prefix (`request-json.ts`, `media-url.ts`, `content-limits.ts`).
- Test files: `<module>.test.ts` next to the module. Phase-specific tests use the phase name: `phase15-visual-manifest.test.ts`, `e2e-*.test.ts`.
- Route folders: `app/api/<resource>/route.ts`.

**Directories:**
- Lowercase, single word: `api`, `owner-login`, `supabase`.

**Identifiers:**
- Components: PascalCase function declarations, named exports for feature roots (`PortiaDesktop`, `PortiaEditor`, `PromotionEditor`).
- Pure helpers: camelCase function declarations or arrow constants (`fitGeometry`, `escapeSearch`).
- Storage keys: `const xxxStorageKey = "portia-...-vN"` at module scope, version suffix `-v1`, `-v2`, `-v3`. Bump the version to drop stored state.
- Union types for ids: `AppId`, `DesktopShortcutId`, `EditorTab`, `DossierTab`, `BroadcastTab`.
- Config constants: `MAX_*` and `*_MS` in SCREAMING_SNAKE_CASE (`MAX_BLOCKS`, `TYPING_PAUSE_MS`, `WINDOW_CLOSE_MS`).

**Dom and CSS hooks:**
- `data-*` attributes on `<html>` and elements: `data-accent`, `data-motion`, `data-spider`, `data-boot`, `data-taskbar-app`.

## Where to Add New Code

**New Desktop App (window):**
- Add the id to `AppId` (`components/portia-desktop.tsx`, line 25), and to `appMeta`, `initialWindows`, the size map in `createWindowGeometry`, `windowMinimums`, and `globalSearchAppIds` if searchable. Add a `DesktopShortcutId` entry if it has an icon.
- Render an `<AppWindow app="..." state={windows.x} ...>` block in the desktop JSX (the window list starts near line 1369).
- Put the app body in `components/portia-<name>.tsx` if it exceeds ~200 lines. Keep inline if it is a small reader view (as `GuideApp` is).
- Tests for any pure logic: `lib/portia-<name>.test.ts`.

**New Pure Helper or Domain Rule:**
- Implementation: `lib/<name>.ts` (flat). Test: `lib/<name>.test.ts`.
- Do not import React or `window` in `lib/` modules unless they are explicitly browser helpers (`accent-boot.ts`, `rich-text-style.ts` are the existing examples).

**New Editor Section or Field:**
- Form UI: `components/portia-editor.tsx`, next to the matching `*Editor` or `FormattedTextarea` usage.
- Validation limit: `lib/content-limits.ts`. Tab mapping: `lib/editor-tabs.ts`. Change detection: `lib/editor-changes.ts`.
- Content shape: `lib/portia-content.ts` (type) and `lib/portia-content-normalize.ts` (normalization), with test in `lib/portia-content-normalize.test.ts`.

**New API Route:**
- `app/api/<resource>/route.ts`. Copy the pattern from `app/api/content/route.ts` (force-dynamic, server client, `getEditorAccess`, `noStoreHeaders`).
- Request body parsing: `lib/request-json.ts` (`parseJsonObject`).

**New Window Geometry Behavior:**
- Pure math only in `lib/window-geometry.ts` with tests in `lib/window-geometry.test.ts`.
- Wiring (refit on resize, pointer handlers) stays in `components/portia-desktop.tsx` (`AppWindow` props `onGeometry`).

**New Persistent Browser State:**
- Add a versioned key constant (`-v1`) at module scope. Wrap every read and write in `try/catch`. Document it in ARCHITECTURE.md's storage table.

**Utilities / Shared Components:**
- Icons: `components/portia-icons.tsx`.
- Colour pickers and accent: `components/custom-color-picker.tsx`, `lib/accent-custom.ts`.

## Special Directories

**`.planning/codebase/`:**
- Purpose: Generated analysis documents for GSD commands.
- Generated: Yes (by `/gsd-map-codebase`).
- Committed: Yes, by the orchestrator. This map does not commit.

**`app/api/`:**
- Purpose: Server routes only.
- Generated: No.
- Committed: Yes.

**`lib/*.test.ts`:**
- Purpose: Unit tests with `node:test` and `--experimental-strip-types`. Several import `supabase` modules but run without network.
- Generated: No.
- Committed: Yes.

## Large Files (Decomposition Targets)

| File | Lines (approx.) | Role |
|------|-----------------|------|
| `components/portia-editor.tsx` | ~3030 | Editor shell, all dossier/guide/broadcast/recycle/employee forms, format panel, access manager |
| `components/portia-desktop.tsx` | ~2320 | Desktop shell, window manager, sync, toasts, guide and document viewers, `AppWindow` |
| `lib/portia-employees.ts` | ~630 | Employee model and merge rules |
| `lib/portia-content.ts` | ~475 | Content model and default data |

---

*Structure analysis: 2026-11-01*
