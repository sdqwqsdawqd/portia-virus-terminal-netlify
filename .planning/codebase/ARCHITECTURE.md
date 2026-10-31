---
last_mapped_commit: 2904899037d4243c8433d9d16a88f21ce7f7fe18
last_mapped_at: 2026-11-01
---
<!-- refreshed: 2026-11-01 -->

# Architecture

**Analysis Date:** 2026-11-01

## System Overview

```text
┌──────────────────────────────────────────────────────────────────────┐
│                    Browser (single page: app/page.tsx)                │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │ PortiaDesktop  `components/portia-desktop.tsx`                  │  │
│  │  window manager (windows state, z, geometry, focus, exit timers) │  │
│  │  ┌───────────┐ ┌────────────────┐ ┌──────────────────────────┐  │  │
│  │  │ 11 App    │ │ PortiaEditor   │ │ PortiaPromotion          │  │  │
│  │  │ windows   │ │ (dynamic, ssr  │ │ `portia-promotion.tsx`   │  │  │
│  │  │ (inline)  │ │ false)         │ │                          │  │  │
│  │  │           │ │ `portia-editor`│ │                          │  │  │
│  │  └───────────┘ └───────┬────────┘ └──────────────────────────┘  │  │
│  └────────────────────────┼───────────────────────────────────────┘  │
│   lib/* pure domain + browser helpers (window-geometry, broadcasts,  │
│   editor-*, portia-content*, accent-*, localStorage keys)            │
└───────────────┬──────────────────────────────────────┬──────────────┘
                │ fetch /api/content, /api/access,     │ next/script
                │ /api/employees, /api/uploads         │ beforeInteractive
                ▼                                      ▼
┌──────────────────────────────────────┐   ┌──────────────────────────┐
│ Route handlers `app/api/**/route.ts` │   │ accentBootScript         │
│  force-dynamic, Supabase server      │   │ `lib/accent-boot.ts`     │
│  client, getEditorAccess()           │   │ (pre-hydration theme)    │
└───────────────┬──────────────────────┘   └──────────────────────────┘
                ▼
┌──────────────────────────────────────┐
│ Supabase (`lib/supabase/server.ts`)  │   proxy: `lib/supabase/proxy.ts`
│ tables: portia_content, editors, …   │   (session refresh, cookie `sb-*`)
│ storage bucket: portia-media         │
└──────────────────────────────────────┘
```

Single-page application. The whole visitor experience is one client component tree mounted from `app/page.tsx`. Server code exists only as thin JSON route handlers and the owner login action. There is no client router; "navigation" is window open/close inside `PortiaDesktop`.

## Pattern Overview

**Overall:** Client-rendered "desktop OS" shell (React 19 state machine) over a small Next.js App Router API layer and Supabase persistence.

**Key Characteristics:**
- One root client component owns almost all UI state: `PortiaDesktop` (`components/portia-desktop.tsx`, ~2300 lines, `"use client"`).
- Apps are not routes. `AppId` (`components/portia-desktop.tsx`, line 25) enumerates 12 apps; each is a window with state in `windows: Record<AppId, WindowState>`.
- Domain logic lives in pure, unit-tested modules in `lib/` (`*.test.ts` beside each, run with `node --experimental-strip-types --test`).
- Content is a single JSON document (`PortiaContent`) stored in Supabase row `portia_content` id `main`, with optimistic concurrency via `revision`.
- Public reads are CDN-cacheable; writes are authenticated and access-checked per request.
- Heavy editor code is code-split with `next/dynamic` (`ssr: false`); the desktop shell is always loaded.

## Layers

**Presentation shell (client):**
- Purpose: Desktop, taskbar, start panel, windows, shortcuts, wallpaper, assistant, toasts, boot screen.
- Location: `components/portia-desktop.tsx`, `components/portia-wallpaper.tsx`, `components/portia-wallpaper-spider.tsx`, `components/portia-icons.tsx`, `components/custom-color-picker.tsx`
- Contains: `PortiaDesktop` (named export), `AppWindow`, `DesktopIcon`, `DraggableDesktopIcon`, `GuideApp`, `EmbeddedDocument`, `QuestToast`, `PromotionRetakeToast`, `BootScreen`.
- Depends on: `lib/*` domain modules, `components/portia-editor.tsx` (dynamic), `components/portia-promotion.tsx`.
- Used by: `app/page.tsx` only.

**Content editor (client, owner only):**
- Purpose: Edit dossiers, guides, broadcasts, recycle bin, employees, access tabs, rich text formatting.
- Location: `components/portia-editor.tsx` (~3000 lines), `components/portia-promotion-editor*.tsx`, `components/portia-promotion-qualification-editor.tsx`
- Contains: `PortiaEditor` (named export, line 736), `EditorAccessManager`, `EmployeeProfilesEditor`, `FloatingTextFormatPanel`, field components, `ConfirmDialog`.
- Depends on: `lib/editor-*`, `lib/format-fragments.ts`, `lib/rich-text-style.ts`, `lib/content-limits.ts`, `lib/portia-employees.ts`, `lib/broadcasts.ts`.
- Used by: `PortiaDesktop` through `next/dynamic`, rendered inside the `editor` `AppWindow`, and only when `canEdit` is true.

**Promotion app (client):**
- Purpose: Staff promotion request flow (qualification, reviewer view, sheet).
- Location: `components/portia-promotion.tsx` (~440 lines), `lib/portia-promotion*.ts`, `lib/portia-qualification.ts`
- Depends on: `/api/promotion/*` routes via `lib/portia-promotion-api.ts`.
- Used by: `PortiaDesktop` (`promotion` window) and `components/portia-editor.tsx` (`PromotionEditor`).

**Pure domain / helpers (shared, no React except where noted):**
- Purpose: Geometry, content model, normalization, limits, broadcasts, accent theming, history, tabs, shortcuts, uploads, media URLs.
- Location: `lib/*.ts` (excluding `*.test.ts`)
- Contains: see Key Abstractions below.
- Depends on: Mostly self-contained. `lib/accent-boot.ts` imports `./accent-custom.ts` and embeds its source into an inline script.
- Used by: components and route handlers.

**API / persistence (server):**
- Purpose: Serve content, editor access, employees, uploads, promotion data; write content with revision checks.
- Location: `app/api/**/route.ts`, `lib/supabase/server.ts`, `lib/supabase/env.ts`, `lib/supabase/proxy.ts`, `lib/editor-access.ts`, `lib/portia-cdn.ts` and `lib/portia-promotion-api.ts`.
- Depends on: `@supabase/ssr`, `@supabase/supabase-js`.
- Used by: browser `fetch` calls from the desktop and editor.

**Auth (server actions):**
- Purpose: Owner login.
- Location: `app/owner-login/page.tsx`, `app/owner-login/actions.ts`
- Used by: owner only.

## Data Flow

### Primary Request Path (initial page load)

1. `app/layout.tsx` injects `accentBootScript` (`lib/accent-boot.ts`) with `strategy="beforeInteractive"`. It reads `localStorage["portia-desktop-settings-v1"]` and sets `data-accent`, `data-motion`, `data-spider`, `data-boot` on `<html>` before paint.
2. `app/page.tsx` renders `PortiaDesktop` with `defaultPortiaContent` (`lib/portia-content.ts`) as `initialContent`.
3. `PortiaDesktop` seeds state from cached content in `localStorage["portia-content-last-success-v1"]` (lines ~520-535), then calls `fetchContent()` which GETs `/api/content` (`app/api/content/route.ts`).
4. `GET /api/content` reads `portia_content` row `main` and normalizes with `normalizePortiaContent` (`lib/portia-content-normalize.ts`). Responses use `publicCacheHeaders` or `noStoreHeaders` from `lib/portia-cdn.ts`.
5. `acceptFetchedContent` (`lib/content-sync.ts`) drops any answer whose revision is not newer than the tab's known revision, or that was sent before a save started.

### Edit and Save Path (owner)

1. `fetchAccess()` GETs `/api/access` (`app/api/access/route.ts`) and calls `getEditorAccess` (`lib/editor-access.ts`). Result sets `canEdit`, `canManageEditors`, `openTabs`.
2. `PortiaEditor` (`components/portia-editor.tsx`) keeps history in a reducer over `PortiaContent` (`lib/editor-history.ts`, `historyReducer`) with `TYPING_PAUSE_MS` batching.
3. `saveContent` in `PortiaDesktop` (around line 1080) PUTs `{ content, revision: baseRevision }` to `/api/content`.
4. The route (`app/api/content/route.ts`, `PUT`) authenticates via `supabase.auth.getUser()`, checks `getEditorAccess`, validates against `lib/content-limits.ts` and `lib/editor-tabs.ts` (`contentRefusal`), then updates `portia_content` with `.eq("revision", baseRevision)` (compare-and-swap). A mismatch returns a conflict.
5. On success the route purges the CDN tag via `purgeCacheTag` (`lib/portia-cdn.ts`) and returns the new revision. The desktop sets `saveState` to `saved`, then `idle`.

### Window Open / Focus / Close Path

1. Icon or taskbar calls `openApp(appId, origin)` (`components/portia-desktop.tsx`, ~line 960). It sets `open`, `minimized`, `exiting`, `openOrigin`, and a `geometry` (`createWindowGeometry` or `fitGeometry`) in one functional `setWindows` update.
2. `focusApp(appId)` bumps `topZ` (a ref, not state) and writes `z` only if the window is not already top. `setActiveApp` marks the focused window.
3. Close and minimize go through `requestExit(appId, kind, force?)`. Unsaved editor edits intercept close (`editorDirtyRef` and `setEditorCloseRequest`). A timer (`exitTimers` ref, `WINDOW_CLOSE_MS` / `WINDOW_MINIMIZE_MS`) then calls `finishExit`, which sets `open:false` or `minimized:true`. A timer is used instead of `animationend` because hidden tabs may never fire that event.
4. Resize of the browser runs `fitGeometry` over every open window (`useEffect` on `resize`, under 900 px wide no geometry is applied).

### Secondary Flow: Employees Sync

1. `fetchEmployees` in `PortiaDesktop` calls `/api/employees` on mount and every 5 minutes (`employeeSyncTimer`). Results are cached under `portia-employees-last-success-v1`.
2. `/api/employees/editor` handles owner-side profile writes. `EmployeeProfilesEditor` in the editor calls `onEmployeeSaved`, which patches the cache via `patchEmployeesCache`.

### Secondary Flow: Content Polling

1. A 1 s clock timer and a visibility-gated sync timer run in one effect (`components/portia-desktop.tsx`, ~lines 560-575). The sync timer calls `fetchContent()` and, for editors only, `fetchAccess()`.

**State Management:**
- Window manager, desktop settings, shortcut positions, taskbar order: React `useState` inside `PortiaDesktop`, persisted to `localStorage` in effects (see the Storage Keys section below).
- Server-authoritative content: `content` + `revision` state in `PortiaDesktop`, with the editor's working copy in its own reducer.
- Global dirty flag from editor reported upward via `onDirtyChange` into `editorDirtyRef`.

## Window and App-Id Model

This section is the reference for the upcoming desktop and editor decomposition.

**App identity:**
- `type AppId` (line 25 of `components/portia-desktop.tsx`) is the single source of window identity: `archive | employees | search | info | guide | promotion | settings | broadcasts | trash | sheet | charter | editor`.
- `DesktopShortcutId` (line 50) is a separate union of icon ids. It omits `editor`, which has no desktop icon. Keep it in sync when adding a launchable app.
- `appMeta` (line ~134), `initialWindows`, `createWindowGeometry`'s `preferred` size map, and `windowMinimums` (line ~170) each enumerate the ids as a `Record<AppId, …>`, all in `components/portia-desktop.tsx`. Adding an app requires editing all four. TypeScript enforces completeness for the `Record` maps, not the order or the union in `globalSearchAppIds`.

**Window state (`WindowState`, line 37):**
- `open`, `minimized`, `maximized`, `z`, `geometry?`, `exiting?: "close" | "minimize"`, `openOrigin?` (icon or taskbar origin for the open animation).
- Geometry is `WindowGeometry` from `lib/window-geometry.ts`: `{ x, y, width, height }`.
- Geometry is held in React state only. It is not persisted. Each reopen after a close recomputes it with `createWindowGeometry(appId, openCount)` unless the window still has a remembered geometry from the same session.

**Pure geometry helpers (`lib/window-geometry.ts`):**
- `fitGeometry(geometry, bounds, minimum)`: clamps a frame into the workspace with an 8 px margin. Minimum size gives way to the screen on small viewports.
- `resizeGeometry(start, edge, dx, dy, bounds, minimum)`: edge or corner drag. The opposite side stays put.
- `dragGeometry(start, dx, dy, bounds)`: title-bar move. Y is clamped so the title bar stays visible (`bounds.height - 46`).
- `ResizeEdge` is `"n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw"`.
- These are pure. They do not read the DOM. `workspaceBounds()` in `components/portia-desktop.tsx` (line ~160) supplies bounds from `.workspace`.

**Focus and restore:**
- Active window: `activeApp` state. Focus is `focusApp`, which raises z by incrementing `topZ.current` (initial value 20). Windows initially sit at z 10 and archive at 11. The editor's format panel sits at z 950 (a comment at line ~1006 explains this).
- Window restore from minimized: `openApp` on a minimized window clears `minimized`, reassigns geometry through `fitGeometry`, and calls `bounceTaskbarEntry`.
- Fallback when the active window closes: `requestExit` picks the open, non-minimized, non-exiting window with the highest z, else `archive`.
- Qualification lock: while `qualificationLocked` is true, only `promotion` may be focused or opened (`focusApp`, `openApp`, `requestExit`, `toggleMaximize`).
- Editor close guard: `requestExit` for `editor` with unsaved edits does not close. It bumps `editorCloseRequest` and the editor shows its own dialog. The editor calls `onCloseApproved` (or passes `force`) to finish.

**Known constraints in window model:**
- `z` is a monotonic counter. A comment at line ~874 notes that after ~930 focus switches windows pass the format panel's z of 950. Renumbering is not implemented.
- Geometry fitting on `resize` uses `window.innerWidth <= 900` as the mobile cutoff. Below it, `createWindowGeometry` returns `undefined` and windows use CSS layout.

## Storage Keys (localStorage / sessionStorage)

All keys are listed so the decomposition does not orphan or rename them. Renaming drops visitors' saved state.

| Key | Store | Owner | Purpose |
|-----|-------|-------|---------|
| `portia-desktop-settings-v1` | localStorage | `lib/accent-boot.ts` (`desktopSettingsStorageKey`) | Accent, wallpaper, icon size, motion, spider. Read by head script and desktop. |
| `portia-boot-seen-v1` | sessionStorage | `lib/accent-boot.ts` (`bootSeenStorageKey`) | Marks boot screen as already played this tab session. |
| `portia-desktop-shortcuts-v3` | localStorage | `components/portia-desktop.tsx` (line 194) | Desktop icon positions. |
| `portia-taskbar-order-v1` | localStorage | `components/portia-desktop.tsx` (line ~197) | Taskbar app order after drag. |
| `portia-guide-collapsed-v2` | localStorage | `components/portia-desktop.tsx` (line 196) | Guide card collapse state. |
| `portia-broadcasts-read-signature-v1` | localStorage | `components/portia-desktop.tsx` (line 189) | Unread-broadcast signature. |
| `portia-quests-seen-v1` | localStorage | `components/portia-desktop.tsx` (line 190), parsed by `lib/broadcasts.ts` | Quest ids shown once. |
| `portia-content-last-success-v1` | localStorage | `components/portia-desktop.tsx` (line 191) | Last good content for offline or fast first paint. |
| `portia-employees-last-success-v1` | localStorage | `components/portia-desktop.tsx` (line 192) | Last good employees list. |
| `portia-format-panel-v1` | localStorage | `components/portia-editor.tsx` (line 2727) | Floating format panel offset, parsed by `lib/panel-position.ts`. |

Window geometry and z are not persisted.

## Key Abstractions

**`PortiaContent`:**
- Purpose: The whole editable site state (viruses, info, guide, broadcasts, recycle bin, scientist logs, rich text).
- Defined in: `lib/portia-content.ts` (`defaultPortiaContent`, `classificationOptions`, `findGuide`, `findInfo`, `portiaTextKey`).
- Normalized by: `lib/portia-content-normalize.ts`. Size bounded by `lib/content-limits.ts` (`MAX_BLOCKS`, `MAX_CONTENT_BODY_BYTES`).
- Pattern: Plain JSON object cloned on edit (`clone` in `components/portia-editor.tsx`).

**`EditorHistory<T>` and reducer:**
- Purpose: Undo/redo for the editor.
- Examples: `lib/editor-history.ts` (`historyReducer`, `initHistory`, `TYPING_PAUSE_MS`), used via `editorReducer` in `components/portia-editor.tsx` (line ~145).

**Editor tab registry:**
- Purpose: Dossier and editor tab ids, which tabs are open for an editor account, and content refusal rules.
- Examples: `lib/editor-tabs.ts` (`tabRegistry`, `openTabIds`, `closedSectionsOf`, `contentRefusal`), `lib/editor-changes.ts` (`changedSections`, `deniedSections`).

**Format fragments and rich text:**
- Purpose: Inline styled spans over plain text.
- Examples: `lib/format-fragments.ts` (`mergeFragments`, `pickCurrentRange`), `lib/rich-text-style.ts` (`applyRichTextStyle`, `resolveRange`).

**Broadcasts and quests:**
- Purpose: News, tasks, and quests with date gating and popups.
- Examples: `lib/broadcasts.ts` (`broadcastFeed`, `questState`, `questPopup`, `markQuestsSeen`).

**Accent theming:**
- Purpose: Accent palette derived from a custom hex color; the same function is embedded in the boot script.
- Examples: `lib/accent-custom.ts` (`deriveAccentTokens`, `accentTokenNames`), `lib/accent-boot.ts` (`accentBootScript`).
- Pattern: Build-time constant source is stringified into `<head>`. Never interpolate user values into that string.

**Promotion domain:**
- Purpose: Qualification, sheet, reviewer view, notifications.
- Examples: `lib/portia-promotion.ts`, `lib/portia-qualification.ts`, `lib/portia-promotion-sheet.ts`, `lib/portia-promotion-reviewer.ts`, `lib/portia-promotion-notifications.ts`, `lib/portia-promotion-api.ts`.

**Editor access:**
- Purpose: Map a Supabase user to `canEdit`, `canManageEditors`, `openTabs`.
- Examples: `lib/editor-access.ts` (`getEditorAccess`), used by every mutating route.

## Entry Points

**Web root:**
- Location: `app/page.tsx`
- Triggers: `GET /`
- Responsibilities: Renders `PortiaDesktop` with bundled default content.

**Root layout and boot script:**
- Location: `app/layout.tsx`
- Triggers: Every route render.
- Responsibilities: Fonts, `<html lang="ru">`, pre-hydration accent script, global CSS (`app/globals.css`, `app/portia.css`).

**Content API:**
- Location: `app/api/content/route.ts` (`GET`, `PUT`)
- Triggers: Desktop poll and save.
- Responsibilities: Public read and CAS write of `portia_content`.

**Access API:**
- Location: `app/api/access/route.ts`
- Triggers: Desktop sync when a session may edit.
- Responsibilities: Current editor capabilities. Network or 5xx auth errors are distinguished from logged-out to avoid unmounting the editor.

**Other API routes:**
- `app/api/employees/route.ts`, `app/api/employees/editor/route.ts`, `app/api/editors/route.ts`, `app/api/uploads/route.ts` (`portia-media` bucket), `app/api/promotion/{banks,requests,reviewer,status,test}/route.ts`.

**Owner login:**
- Location: `app/owner-login/page.tsx`, `app/owner-login/actions.ts`
- Triggers: Owner navigates to `/owner-login`.

**Session proxy (library, not a route in this scope):**
- Location: `lib/supabase/proxy.ts` (`updateSupabaseSession`). It is called from a root `middleware` or `proxy` file, which is outside the scope of this map. Only the anonymous short-circuit and the `sb-*-auth-token` cookie check are described here.

## Architectural Constraints

- **Threading:** Single-threaded browser main thread for all UI. Server route handlers are stateless per request. No workers.
- **Global state:** `PortiaDesktop` state is component-local. Module-level mutable state: `editKeys` `WeakMap` in `components/portia-editor.tsx` (line 148). `topZ` is a ref, not module-level. No Redux or Zustand.
- **Circular imports:** Not checked. `components/portia-editor.tsx` imports `components/portia-promotion-editor`, and `components/portia-desktop.tsx` imports `components/portia-promotion`; no cycle was observed among these two files.
- **Desktop/editor coupling:** The editor receives everything through `Props` (lines 37-59 of `components/portia-editor.tsx`): content, revision, save callback, dirty and close handshake, employee callbacks. It has no direct access to the window manager. Keep this boundary when decomposing.
- **Dynamic import:** The editor is loaded with `next/dynamic` and `ssr: false`. Any new editor dependency must not be imported from the desktop shell eagerly.
- **Client-only persistence:** All `localStorage` access is guarded by `try/catch`. Any new key must follow that pattern.
- **Content revision CAS:** Writes must pass `baseRevision` and use the `.eq("revision", …)` update. Do not bypass.

## Anti-Patterns

### Parallel per-app records

**What happens:** `AppId` is enumerated in at least four places in `components/portia-desktop.tsx`: `appMeta` (~line 134), `initialWindows` (~line 118), the `preferred` size literal inside `createWindowGeometry` (~line 140), and `windowMinimums` (~line 170), plus `DesktopShortcutId` (line 50) and `globalSearchAppIds` (~line 152).
**Why it's wrong:** Adding or renaming an app is a multi-site edit. The `Record<AppId, …>` maps catch missing keys, but `DesktopShortcutId` and `globalSearchAppIds` do not.
**Do this instead:** Keep one registry per concern and derive the rest from it when the decomposition happens. Do not add a fifth copy.

### Window state and geometry in one component

**What happens:** `PortiaDesktop` (~2300 lines) owns windows, z-order, exit timers, settings, content sync, broadcasts, quests, promotion toast, taskbar drag, search, and assistant.
**Why it's wrong:** Every state change re-renders the whole tree; `setWindows` callbacks fan out across many apps.
**Do this instead:** Extract a window-manager hook (the `focusApp`, `openApp`, `requestExit`, `fitGeometry` set) and keep it returning pure window state. Use the `lib/window-geometry.ts` functions as is.

### Timer-based exit state with `setTimeout` in multiple places

**What happens:** `exitTimers`, `bounceTimers`, `saveStateTimer`, `suppressTaskbarClick` timeouts are all managed by refs in `PortiaDesktop`.
**Why it's wrong:** Cleanup is repeated by hand; the comment at line ~1044 ("a late timer must never act on a stale render") shows the risk.
**Do this instead:** Keep the functional `setWindows` update pattern used by `finishExit`.

## Error Handling

**Strategy:** Errors are contained per window or per request. Client falls back to cached content. Server returns explicit JSON error codes.

**Patterns:**
- Client `fetchWithTimeout` wraps `fetch` for `/api/content` and `/api/access`. On failure the last good cache is kept.
- Route handlers use `parseJsonObject` (`lib/request-json.ts`) for body validation and return 4xx for bad input. A revision mismatch on `PUT /api/content` surfaces as the desktop `saveState` value `conflict`.
- Auth failures on `/api/access` are not converted to `canEdit: false` unless the session is definitively logged out.
- Supabase config errors on the proxy are swallowed so the public site still renders from bundled defaults.

## Cross-Cutting Concerns

**Logging:** `console` only in client code paths. Not centralized.
**Validation:** Server-side via `lib/content-limits.ts`, `lib/portia-content-normalize.ts`, `lib/image-upload.ts` (signature-based extension check), `lib/media-url.ts`. Client-side mirrors the same limits in the editor.
**Authentication:** Supabase Auth via `@supabase/ssr` cookies. Authorization per route through `getEditorAccess` (`lib/editor-access.ts`). Promotion reviewer checks in `lib/portia-promotion-reviewer.ts`.
**Caching and headers:** `lib/portia-cdn.ts` (`publicCacheHeaders`, `noStoreHeaders`, `contentCacheTag`, `purgeCacheTag`). Security headers: only `lib/security-headers.test.ts` exists in scope; the implementation lies outside `app/`, `components/`, `lib/` and was not analyzed.

---

*Architecture analysis: 2026-11-01*
