# Phase 19: Povyshenie, prilozheniya, redaktor, poisk i media - Pattern Map

**Mapped:** 2026-11-02
**Files analyzed:** 14 (new and modified)
**Analogs found:** 13 / 14
**Sources:** 19-CONTEXT.md, 19-UI-SPEC.md. No RESEARCH.md. Line numbers are from the working tree on 2026-11-02. All analog paths were checked as tracked files (`git ls-files` for lib/media-url.ts, lib/content-sync.ts, components/portia-desktop.tsx); the others are ordinary tracked source (no `.gsd` mirrors involved).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `lib/app-state.ts` + `lib/app-state.test.ts` (NEW: stale/fatal/denied reason catalog, stale-time formatter) | utility | transform | `lib/content-sync.ts` + `lib/media-url.ts` (+ `media-url.test.ts`) | role-match |
| `lib/search-index.ts` + `.test.ts` (NEW: allowlist index builder, normalization, no drafts/keys) | utility | transform | inline `searchResults` useMemo in `components/portia-desktop.tsx:1112-1143` (extract) | exact (extraction) |
| `lib/editor-save-status.ts` + `.test.ts` (NEW: status vocabulary, "N of M", conflict policy) | utility | transform | `lib/editor-changes.ts`, `lib/content-sync.ts` | role-match |
| `lib/image-upload.ts` (MOD: stricter signature/scheme/path) | utility | file-I/O | itself (12 lines) + `lib/image-upload.test.ts` | exact |
| `app/api/uploads/route.ts` (MOD: refusal texts) | route | file-I/O | itself (59 lines) | exact |
| `lib/media-url.ts` (MOD only if the URL contract widens) | utility | transform | itself + `lib/media-url.test.ts` | exact |
| `components/portia-desktop.tsx` (MOD: state shells, openApp from search, search-hit, media fallback) | component | request-response + polling | itself: `EmployeeImageInner` 1485-1497, `searchResults` 1112-1143, `openApp` 841-863, save/409 945-975 | exact |
| `components/portia-editor.tsx` (MOD: conflict panel, save-all partial, poll suppression) | component | CRUD | itself: `editor-save-status` 1386-1388, 409 path in desktop 955-960 | exact |
| `components/portia-promotion*.tsx` (MOD: safe states, confirmations) | component | request-response | `components/portia-promotion.tsx:431` (`.promotion-stale`) and `lib/portia-promotion-ui.test.ts` | exact |
| `app/api/promotion/{status,requests,banks,reviewer}/` (MOD) | route | request-response | existing routes plus `lib/portia-promotion-api.test.ts` | exact |
| `app/portia.css` (MOD: new state classes, `.search-hit`, icon rest rules) | config/style | n/a | `.promotion-stale` 1799, `.empty-state` 1691, `.personnel-image-skeleton` 413, `.editor-save-status` 480-482 | exact |
| `components/portia-desktop-shortcuts.tsx`, `components/portia-icons.tsx` (MOD for D-17) | component | n/a | animated rules at `app/portia.css:4-7, 1571-1610` | exact |
| Seed/teardown script for acceptance (NEW, D-01/D-03/D-04) | script | batch | `scripts/phase16-staging.mjs` wrapper + `supabase/teardown/` | role-match |
| D-17 and states Playwright specs (NEW) | test | e2e | `tests/e2e/visual/motion.spec.ts` | role-match |
| (none) Skeleton shell per app | component | n/a | reuse `.personnel-image-skeleton`; no generic shell exists | no analog |

## Pattern Assignments

### Pure logic modules in `lib/` with sibling test (app-state, search-index, editor-save-status)

**Analog:** `lib/content-sync.ts` (pure function plus a long "why" comment) and `lib/media-url.ts`.

Pure, no imports of server code (17 D-02/D-03: extracted modules do not know the server):
```ts
// lib/content-sync.ts (whole file, 4 lines)
export function acceptFetchedContent(revision: number, knownRevision: number, savesAtSend: number, savesNow: number): boolean {
  return savesAtSend === savesNow && revision > knownRevision;
}
```
Test style (`lib/media-url.test.ts:1-30`): `node:test` + `node:assert/strict`, import with explicit `.ts` extension, table-driven arrays, message = `JSON.stringify(input)`:
```ts
import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedMediaUrl, isLocalMediaPath } from "./media-url.ts";
const notLocal = ["//host/x.png", "/\\host/x.png", "/\t/host", ...];
test("isLocalMediaPath rejects ...", () => {
  for (const url of notLocal) assert.equal(isLocalMediaPath(url), false, JSON.stringify(url));
});
```
Rules: relative imports inside `lib/` use `./x.ts` (see `lib/editor-tabs.ts:1`: `from "./editor-changes.ts"`); types via `import type`. Node strip-types forbids enums and parameter properties, so use union types.

### `lib/search-index.ts` (extract from desktop)

**Analog:** `components/portia-desktop.tsx:101` and `1112-1143`.

Normalization to reuse verbatim (line 101):
```ts
const escapeSearch = (value: string) => value.toLocaleLowerCase("ru").replace(/ё/g, "е");
```
Item shape and allowlist already inline (1114-1115): `{ id, type: "virus"|"employee"|"info"|"guide"|"broadcast"|"file"|"app", title, meta, body, parts? }`. Existing source rows to move into the builder as an explicit per-source field list:
```ts
...content.broadcasts.filter((item) => item.published).map((item) => ({ id: item.id, type: "broadcast" as const, title: item.title, meta: broadcastType(item.type), body: item.body })),
```
Match logic to keep (1139-1142): filter on `escapeSearch(\`${title} ${meta} ${body}\`).includes(query)`, then reorder `parts` so the preview starts at the first matching block.
Notes for the planner:
- The `published` filter is currently only on broadcasts. D-13 needs the same check proved for every source, with a test that feeds draft/private fields and asserts absence.
- `recycleFiles` and `recycledViruses` rows (1137-1138) are the Trash behaviour UI-SPEC keeps as an assumption.
- Result click handler is `openSearchResult` at ~1145: it sets state (`setActiveVirusId`, `setOpenLog`) and calls `openApp(...)`. D-14 adds a `searchHit` id state that apps read to `scrollIntoView` plus `.search-hit`; the search window must not be closed or minimized there.

### `components/portia-desktop.tsx` openApp / window integration (D-14)

**Analog:** itself, lines 841-863. `openApp` already handles one-instance-per-app, bounce/nod when already open, cancels pending exit timers:
```ts
const openApp = (appId: AppId, origin?: OpenOrigin) => {
  if (qualificationLocked && appId !== "promotion") return;
  if (windowAppears(windows[appId])) bounceTaskbarEntry(appId); else if (!qualificationLocked) nodWindow(appId);
  ...
  setWindows((state) => ({ ...state, [appId]: openedWindow(state[appId], origin, workspaceBounds(), minimumWindowSize(appId), () => createWindowGeometry(appId, openCount)) }));
  focusApp(appId);
  setStartOpen(false);
```
Careful: `focusApp(appId)` brings the owner forward and `setStartOpen(false)` is harmless; do not add anything that closes the search window. `qualificationLocked` must still win.

### Stale / fatal / loading shells inside the 8 app bodies (D-05..D-08)

**Analog (stale banner style):** `components/portia-promotion.tsx:431`
```tsx
{stale && <div className="promotion-stale"><strong>Состояние временно не обновляется</strong><span>Показаны последние безопасные данные. Действия отключены до восстановления связи.</span></div>}
```
CSS to extend with a sticky variant, not copy hex (`app/portia.css:1799`):
```css
.promotion-stale { display: grid; gap: 4px; margin-bottom: 16px; padding: 12px 14px; border: 1px solid oklch(.58 .08 80 / .55); border-radius: 7px; background: oklch(.3 .04 80 / .18); color: oklch(.82 .07 80); font: 400 12px/1.45 var(--doc); }
```
Note the UI-SPEC says new rules may only use 11/13/16px, so the new banner class must override the 12px.

**Analog (empty states):** `components/portia-desktop.tsx:1255, 1304, 1360, 1382`:
```tsx
<div className="global-search-empty empty-state"><PortiaIllustration name="microscope" /><strong>Совпадений нет</strong><span>Измените запрос или выберите рекомендацию.</span></div>
```
Existing `LoadingState` is used at 1255 (`<LoadingState label="Загрузка досье…" />`); the spec asks for card-shaped skeletons instead, so extend it rather than add a new shell per app. The existing empty strings differ from the UI-SPEC catalog ("В базе пока нет вирусов" vs "В базе пока нет записей"; "Квестов и задач пока нет" vs "Заданий пока нет"), so those get edited in place.

**Analog (409 conflict plumbing):** `components/portia-desktop.tsx:955-960` sets `knownRevision.current = -1` and `setSaveState("conflict")`; server side `app/api/content/route.ts:64, 81` returns 409 with `conflictMessage`. The D-09 panel hangs off the existing `conflict` save state; poll acceptance stays `acceptFetchedContent` (`components/portia-desktop.tsx:325`).

### Skeleton + image fallback (D-15)

**Analog:** `EmployeeImageInner`, `components/portia-desktop.tsx:1488-1497`:
```tsx
const [loaded, setLoaded] = useState(false);
const [failed, setFailed] = useState(false);
const fallback = !src || failed;
if (!fallback) prioritizeImage(src);
return <div className={`personnel-image-loader${loaded ? " is-loaded" : ""}`}>
  <span className="personnel-image-skeleton" aria-hidden="true" />
  <img src={fallback ? "/assets/portia-logo.png" : src} ... onLoad={() => setLoaded(true)} onError={() => fallback ? setLoaded(true) : setFailed(true)} />
</div>;
```
Parent remounts by `key={props.src}` (line ~1485), which is the "no previous-record image" mechanism; extend with record id per UI-SPEC. Gaps vs D-15: fallback is the logo image without the caption "Изображение недоступно", no 15s slow timeout, no `isAllowedMediaUrl` pre-check (import from `@/lib/media-url`), always `loading="eager"` + `fetchPriority="high"` (STAB-MEDIA-03 wants lazy for offscreen). Skeleton CSS at `app/portia.css:413-415`; the shimmer there has no `data-motion` gate yet (UI-SPEC wants shimmer only in `full`).

### `lib/image-upload.ts` and `app/api/uploads/route.ts` (D-16)

**Analog:** the files themselves. Signature helper:
```ts
const startsWith = (bytes: Uint8Array, signature: readonly number[]) => signature.every((byte, index) => bytes[index] === byte);
export function imageExtensionFromSignature(bytes: Uint8Array): SupportedImageExtension | null { ... }
```
Route order to preserve (limits stay as-is): auth via `getEditorAccess` -> 403 text; `formData.get("file")` -> 400; type map -> 415; size 4 MB -> 413; read first 16 bytes and compare signature with declared -> 415 with `noStoreHeaders`; upload to `portia-media` at `recycle/${crypto.randomUUID()}.${ext}` -> `{ url }`; catch -> 500 "Не удалось загрузить изображение."
```ts
const detectedExtension = imageExtensionFromSignature(new Uint8Array(await file.slice(0, 16).arrayBuffer()));
if (!detectedExtension || detectedExtension !== declaredExtension) {
  return Response.json({ error: "Содержимое файла не соответствует формату изображения." }, { status: 415, headers: noStoreHeaders });
}
```
Observed gaps worth a test: WebP check `bytes.slice(8)` compares `WEBP` at offset 8 (correct but untested on a 12-byte buffer); only the 415 branch carries `noStoreHeaders` (the 403/400/413 branches and the 500 do not). Client-side network failure text ("Нет связи с сервером. Файл не загружен, текущая ссылка сохранена.") lives in the editor, not in this route. URL scheme/path checks reuse `lib/media-url.ts` (`isAllowedMediaUrl`, `isLocalMediaPath`).

### Editor save-status (D-10, D-12)

**Analog:** `components/portia-editor.tsx:1386-1388`:
```tsx
{statusText && <span className={`editor-save-status ${saveState}`}>{statusText}</span>}
...
{bodyMessage && <span className="editor-save-status error">{bodyMessage}</span>}
```
and the employee editor at 1800 (`saveStatus === "saving" ? "СОХРАНЕНИЕ…" : saveStatus === "saved" ? "СОХРАНЕНО" : ...`). The two use different vocabularies (uppercase vs sentence case), so the new `lib/editor-save-status.ts` should own one text mapping. CSS classes available (`app/portia.css:480-482`): `.editor-save-status`, `.saved`, `.error`, `.conflict`. No `partial` or `warning` class exists yet. Baseline-for-undo comment at `components/portia-editor.tsx:350` (revision of baseline) is the hook for the "Загрузить их версию" path.

### `components/portia-promotion.tsx` and `app/api/promotion/*` (STAB-PROM)

**Analog:** same files; tests are source-text assertions (`lib/portia-promotion-ui.test.ts:1-18`):
```ts
const source = readFileSync(new URL("../components/portia-promotion.tsx", import.meta.url), "utf8");
assert.ok(source.includes("ПРОВЕРИТЬ НИК"));
```
Use this style for UI copy checks (new confirmations "Оставить вопрос", "Не удалять", "Не снимать", "Не подтверждать"; no generic "Отмена"). Domain/API/DB/security/live test files sit next to it: `lib/portia-promotion-{api,db,security,reviewer,sheet,notifications,live,editor,ui}.test.ts`. Live tests are the staging proof entry point; they must stay BLOCKED when env is missing.

### D-17 icon rest = last keyframe

**Analog:** `app/portia.css` lines 4-7 and 1571-1610. Selector convention (every rule repeats this prefix):
```css
html:not([data-motion="off"]) :is(.desktop-icon.is-icon-animating .desktop-icon-symbol, .start-panel > button.is-icon-animating .start-panel-icon)[data-icon="info"] .icon-info-lines > :nth-child(1) { stroke-dasharray: 16; animation: icon-info-line 560ms 30ms var(--ease-out) both; }
```
Confirmed suspects named in UI-SPEC: `stroke-dasharray: 16` (info lines, 1590-1592) and `32` (sheet 1605, editor 1610) are set only inside the animating selector, so removing `is-icon-animating` drops the dash state. Animation fill modes differ: `both`/`backwards` vs none on `search`, `employees`(first), `charter`(2), `sheet`, `trash`, `editor`; with no fill, the end frame is not held but that is harmless if keyframe end equals rest. Rest rules go in a selector without `html:not([data-motion="off"])` or `is-icon-animating`, scoped by `[data-icon="..."]` on both hosts. Keyframes stay untouched; artwork in `components/portia-icons.tsx` stays untouched (18 D-01). Do not rename `data-icon` ids or `icon-*` hooks.

### Playwright / visual candidates for D-17 and states

**Analog:** `tests/e2e/visual/motion.spec.ts:1-30`: page-object (`DesktopPage`), `test` from `../fixtures/test`, pinned to project `chromium-desktop` via `test.skip(...)`, `page.clock.runFor(50)` polling loop `advanceUntil`. Candidates only go to `tests/e2e/visual-candidates`; do not run `phase15-visual-manifest.mjs --verify`, do not touch `tests/e2e/visual/__screenshots__`.

### Acceptance seed / shift / teardown (D-01, D-03, D-04)

**Analog:** `scripts/phase16-staging.mjs` (guarded wrapper, target guard, env-only keys), `supabase/teardown/`, `supabase/migrations/`. I did not read the wrapper body: the project guard hook blocks commands that mention staging scripts with chaining, so its exact allowed invocation form and any exported helpers should be read by the planner/executor directly (`Read`, not shell). Also check `lib/portia-promotion-live.test.ts` for the existing marker/cleanup conventions before inventing a "temporary" tag. Any `supabase/*.sql` change needs `supabase-rls-reviewer`.

## Shared Patterns

### Node-testable pure logic first
**Source:** `lib/content-sync.ts`, `lib/media-url.ts`, `lib/*.test.ts`. Put branching logic (state reasons, time formatting, conflict policy, index allowlist, signatures) in `lib/*.ts`; components only call it. Run with `npm test`.

### Motion only through `html[data-motion]`
**Source:** `lib/accent-theme.test.ts:320-325` asserts no `prefers-reduced-motion`/`matchMedia` in the boot script and CSS. New CSS must gate with `html[data-motion="full"]` / `:not([data-motion="off"])` and use `--motion-*`, `--ease-*` tokens.

### Fail-closed, no technical detail in Russian error text
**Source:** `app/api/uploads/route.ts` (fixed Russian strings, `console.error` server-side only), `components/portia-desktop.tsx:955-966` (server error string only shown if `typeof body?.error === "string"`).

### Cache headers
**Source:** `lib/portia-cdn.ts` `noStoreHeaders`, applied on responses that carry URLs or private state.

### Auth guard for editor/reviewer routes
**Source:** `app/api/uploads/route.ts:15-21`:
```ts
const supabase = await createServerSupabaseClient();
const { data: authData } = await supabase.auth.getUser();
const access = await getEditorAccess(supabase, authData.user);
if (!authData.user || !access.canEdit || access.openTabs.length === 0) return Response.json({ error: "У вас нет доступа к загрузке." }, { status: 403 });
```
Tab access model: `lib/editor-tabs.ts` (`tabRegistry`, `trusted` kind for `promo`, `openTabIds`).

## No Analog Found

| File | Role | Reason |
|---|---|---|
| Per-app skeleton shapes (`.skeleton-block`) | component | Only the image skeleton exists; card/row-shaped skeletons are new (build on `.personnel-image-skeleton`) |
| Conflict panel with "Ваши правки" `<details>` and copy buttons | component | No side-by-side draft preservation exists; only the `conflict` save state |
| Search keyboard model (Ctrl/Cmd+K, arrows) | hook | Not found in `portia-desktop.tsx` greps; `lib/editor-shortcuts.ts` is the closest style reference for pure shortcut logic. Also still [PROPOSED], needs owner approval |

## Metadata

**Analog search scope:** `lib/`, `components/`, `app/api/`, `app/portia.css`, `scripts/` (names only), `tests/e2e/`.
**Not read (constraint):** `.env*`, owner paths, `scripts/phase16-staging.mjs` body, `supabase/` SQL.
**Pattern extraction date:** 2026-11-02
