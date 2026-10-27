# Phase 9: Целостность контента - Pattern Map

**Mapped:** 2026-10-25
**Files analyzed:** 17 (new/modified)
**Analogs found:** 17 / 17 (all analogs are git-tracked source; `git ls-files` checked for the wallpaper, editor-items and route files; the rest are standard tracked `lib/`, `components/`, `app/` files)

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `lib/content-sync.ts` (modify, `>=` to `>`) | utility | request-response | itself | exact |
| `lib/content-sync.test.ts` (modify) | test | transform | itself | exact |
| `lib/portia-content-normalize.ts` (modify: constants, `textOf`, ids, no-cut) | utility | transform | itself (`asText`, `normalizeBroadcasts`, `normalizeVirus`) | exact |
| `lib/portia-content-normalize.test.ts` (modify) | test | transform | itself | exact |
| `lib/content-limits.ts` (new: `limitStatus`, `oversizeFields`) | utility | transform | `lib/broadcasts.ts` (small pure helpers) | role-match |
| `lib/content-limits.test.ts` (new) | test | transform | `lib/broadcasts.test.ts` | role-match |
| `lib/editor-items.ts` (add `removeRecycledVirus`, `removeRecycleFile`) | utility | CRUD | `removeBroadcast` in same file | exact |
| `lib/editor-items.test.ts` (modify) | test | CRUD | itself | exact |
| `lib/broadcasts.ts` (add `categoryChange`, `questDateError`) | utility | transform | `broadcastTabOf` / `questState` in same file | exact |
| `lib/editor-changes.ts` (modify, `?? []` at line 76) | utility | transform | itself | exact |
| `lib/wallpaper-web.ts` (new: web graph, Bezier sampling, walk planner, pulse model) | utility | transform | `webPaths()` + `seeded()` in `components/portia-wallpaper.tsx` | role-match |
| `lib/wallpaper-web.test.ts` (new) | test | transform | `lib/editor-items.test.ts` | role-match |
| `components/portia-wallpaper.tsx` (modify: Spider, per-cell `<g>`, gel bands) | component | event-driven (rAF) | itself | exact |
| `app/portia.css` (modify ~1276-1346, add `.editor-field-error`, `.is-invalid`) | config | n/a | itself (wallpaper block, `.employee-add-error`, `.scientist-log-actions`) | exact |
| `components/portia-desktop.tsx` (modify: poll, cache load, `today`, ВАЖНО) | component | request-response | itself | exact |
| `components/portia-editor.tsx` (modify: type change, delete handlers, `step`, `save`, limit UI, `Field`) | component | CRUD | itself | exact |
| `app/api/content/route.ts` (modify, body guard 2 MB) | route | request-response | itself | exact |

## Pattern Assignments

### `lib/content-sync.ts` (SYNC-01)

Whole file today (lines 1-4):
```ts
export function acceptFetchedContent(revision: number, knownRevision: number, savesAtSend: number, savesNow: number): boolean {
  return savesAtSend === savesNow && revision >= knownRevision;
}
```
Change `>=` to `>`; rewrite the leading comment ("equal is taken" becomes "equal is dropped, so a poll never swaps the content object and undo survives"). Test file: the test "the same revision is taken so a server-normalized copy still replaces the cache" (line 10-12) flips to `false`. Keep the `-1` reset test. Test style: `node:test`, `assert/strict`, import with `.ts` suffix.

---

### `lib/portia-content-normalize.ts` (CONT-01, 02, 04, 08)

**Analog:** itself. Current shapes to change:

`normalizeBroadcasts` (lines 85-97), spreads unvalidated, only fixes four fields:
```ts
.map((item) => ({
  ...item,
  important: item.important === true,
  startsAt: normalizeDay(item.startsAt),
  endsAt: normalizeDay(item.endsAt),
  conditions: typeof item.conditions === "string" ? item.conditions.slice(0, 4000) : "",
}));
```
Target: keep `...item`, then override `id` (text, else `broadcast-${index}`, unique in list, no `:`), `type` (only quest/task/news else "news"), `title`, `body` via new `textOf`, `published: item.published === true`, `important: item.type === "news" && item.important === true`, conditions without `.slice`. Need `(item, index)` in the map.

Helper style to copy (line 99): `const asText = (value: unknown, max: number) => (typeof value === "string" ? value.slice(0, max) : "");` and `isRecord` on the next line. Add `textOf` beside them (RESEARCH CONT-02 snippet); the `asText` cuts at lines 124, 129-130, 146 are what D-01 removes.

`normalizeVirus` (lines 175-188): same `...virus` spread, fixes only `infectedImage`, `mutations[].image`, `scientistLogs`. Extend with `textOf` on `id` (fallback `virus-${i}` / `recycled-${i}`), `code`, `name`, `status`, `external`, `physiology`, `ppu.*`, `classification.*`, `mutations[].{name,description}`, log `{id,title,scientist}`; non-object `ppu`/`classification` become empty records.

Derived-id naming already in file (lines ~121, 143, 154): `${parentId}-block-${index}`, `${sectionId}-sub-${index}`, `info-${index}`. Never use `:` in ids (formatted keys split on `:`).

Slices to remove (no-cut): lines 46 (`runs.slice(0,500)`), 57 (`100_000`), 67 (`slice(0,1000)`), 95 (`4000`), 124 (`20_000` to `MAX_BLOCK_TEXT = 200_000`), 129-130 rows (`100`), 144 (`100` blocks), 159 (`50` subsections). Keep: media URL 2048 (line 78), scientistLogs `slice(0, 5)` (D-25), key.length 240 drop (line 69). Export constants from this file (`MAX_TABLE_ROWS = 500`, `MAX_BLOCKS = 300`, `MAX_SUBSECTIONS = 150`, `MAX_RICH_RUNS = 5000`, `MAX_RUN_CHARS = 1_000_000`, `MAX_FORMATTED_KEYS = 10_000`, `MAX_CONDITIONS = 40_000`, `MAX_BLOCK_TEXT = 200_000`).

**Test pattern** (`lib/portia-content-normalize.test.ts`, imports lines 1-4): round-trip + idempotence idiom:
```ts
const once = normalizePortiaContent(structuredClone(defaultPortiaContent));
assert.ok(once);
assert.deepEqual(normalizePortiaContent(structuredClone(once)), once);
```
Rewrite "cut" tests as "kept whole": lines 21 ("oversized logs", logs stay 5), 70 ("capped at 4000"), 101 ("subsections and blocks are capped"), 135 ("beyond the caps are cut"). Add: `title: {}` to `""`, `42` to `"42"`, empty id gets `broadcast-<i>` stable on second pass, quest with `important:true` to `false`, news keeps `true` (existing tests at 44 and 58 must still pass), virus `ppu: null`.

---

### `lib/content-limits.ts` (new, utility, transform) and test

**Analog:** `lib/broadcasts.ts` (small pure, exported, commented-why functions, `import type` only). Code to write is given in RESEARCH ("Derived UI helpers"):
```ts
export type LimitStatus = "free" | "counter" | "full";
export function limitStatus(count: number, max: number): LimitStatus {
  if (count >= max) return "full";
  return count >= Math.ceil(max * 0.8) ? "counter" : "free";
}
```
Plus `oversizeFields(content): string[]` in document order, mapping `portiaTextKey` keys (`lib/portia-content.ts:178-189`) to labels. Imports must use `.ts` suffix (strip-types runner). Test copies `lib/broadcasts.test.ts` style.

---

### `lib/editor-items.ts` (CONT-03)

**Analog:** `removeBroadcast`, lines 14-18:
```ts
// A deleted item takes its stored formatting with it, so no orphan text stays in formattedText.
export function removeBroadcast(content: PortiaContent, id: string): void {
  content.broadcasts = content.broadcasts.filter((item) => item.id !== id);
  delete content.formattedText[portiaTextKey.broadcast(id)];
}
```
Add `removeRecycledVirus` (filter + delete keys with prefix `virus:${id}:`, trailing colon matters) and `removeRecycleFile` (filter + `delete content.formattedText[portiaTextKey.recycle(id)]`). Code in RESEARCH CONT-03. Imports already include `portiaTextKey`.

**Test** (`lib/editor-items.test.ts`): reuse the `fixture()` (lines 6-...; `structuredClone(defaultPortiaContent)` then set fields) and add cases: prefix-collision `ab` vs `abc`, mutation key `virus:<id>:mutation:0:description` removed, other files' `recycle:` keys kept. Imports line 3 must list the new functions.

---

### `lib/broadcasts.ts` (CONT-05, CONT-06)

**Analog:** `broadcastTabOf` (lines 7-9) and `questState` (lines 19-23, takes `Partial<Pick<Broadcast,"startsAt"|"endsAt">>`). Add `categoryChange(from, to)` (RESEARCH CONT-05 snippet, uses `broadcastTabOf`) and `questDateError(item)`: `item.type === "quest" && !!item.startsAt && !!item.endsAt && item.endsAt < item.startsAt` (ISO strings compare directly, same assumption as `questState`). Test in `lib/broadcasts.test.ts`: equal dates valid, one date set valid, reversed invalid, task/news ignored.

---

### `lib/editor-changes.ts` (CONT-08)

Line 76: `const find = (content: PortiaContent) => [...content.viruses, ...content.recycledViruses].find(...)`. Change to `...(content.recycledViruses ?? [])`. Test in `lib/editor-changes.test.ts`: both copies with `recycledViruses` deleted must not throw (cast via `as unknown as PortiaContent` or `delete`).

---

### `lib/wallpaper-web.ts` (new) and test (BG-01)

**Analog:** `webPaths()` and `seeded()` in `components/portia-wallpaper.tsx` lines 12-41 and 71-74. The new module must reproduce the same geometry:
```ts
const center = [1180, 170]; spokes = 18;
angles = index/18*2PI + 0.11*sin(index*1.7);
reach(angle) = 980 + 120*sin(angle*3.1);
ring r (1..15): radius = 34 * ring ** 1.18, points at each spoke angle;
  segment i: Q sag next, sag = mid + (center - mid) * 0.08, mid = chord midpoint
```
Nodes `[ring][spoke]`; ring edge is the Q segment (analytic Bezier `(1-t)^2 P0 + 2(1-t)t C + t^2 P1`), spoke edge is a straight line. Refactor so `webPaths()` in the component imports the points from this module (one source, drawing and walking cannot drift). RNG:
```ts
function seeded(seed: number) {
  let state = seed;
  return () => (state = (state * 1664525 + 1013904223) % 4294967296) / 4294967296;
}
```
Move/export `seeded` to the lib (or re-implement identically; same seed gives same walk). Pure TS only (`import type`, `.ts` suffixes, no enums). Test style: copy `lib/editor-items.test.ts` (`node:test` + `assert/strict`); assertions per RESEARCH "Verify": 270 nodes, sampled edge points within 2 units of drawn path, target never previous node, 2-4 hops, pulse pool max 8, deterministic per seed.

---

### `components/portia-wallpaper.tsx` (BG-01)

**Analog:** itself. Header and conventions (lines 1-10):
```tsx
"use client";
// Desktop wallpapers drawn as SVG in currentColor, so they follow the interface accent.
import { useEffect, useState } from "react";
type Point = [number, number];
const round = (value: number) => Math.round(value * 10) / 10;
```
Drawing is one `<svg viewBox="0 0 1440 900" preserveAspectRatio="xMaxYMin slice">` per kind (grid uses `900 + HELIX_LOOP`). Rules to follow:
- Spider = sibling HTML wrapper `div` (will-change: transform) with its own `<svg viewBox="0 0 649.5 768">`, NOT inside `.wallpaper-web` (that selector styles every `path` descendant). Classes `wallpaper-spider-teal/-dark/-pale`; each path `stroke: none` + explicit fill.
- Leg groups assigned by geometry, not by id: outer `Right_leg_2-2` is leg 2, outer `Right_leg_2` is leg 3 (RESEARCH table).
- rAF loop mutates refs/DOM only, no `setState` (React Compiler lint). Existing effect idiom for unavoidable state writes: `window.setTimeout(..., 0)`.
- Motion gate: `document.documentElement.dataset.motion`; if missing, `matchMedia("(prefers-reduced-motion: reduce)")`; `MutationObserver` on `data-motion`; stop on `visibilitychange`, cancel in cleanup, clamp `dt` to 50 ms.
- `cellField()` (lines 106-161) must return per-cell records `{x,y,wall,nucleus,infected}` instead of merged strings; render `<g>` per cell, params through inline custom properties.
- Gel: bands share one keyframe with negative `animation-delay`; glow factors `band.weight * 2.2` to 3 and `band.opacity * 0.08` to 0.16 (lines ~204).

---

### `app/portia.css` (BG-01, CONT-01, CONT-06)

**Wallpaper block (lines 1296-1346)**, patterns to follow/replace:
```css
html[data-motion="full"] .wallpaper-web { transform-box: view-box; transform-origin: 1180px 170px; animation: web-sway 24s ease-in-out 2.5s infinite; }  /* delete with @keyframes web-sway */
.desktop-wallpaper-grid { bottom: auto; height: calc(100% + 720 * max(100cqw / 1440, 100cqh / 900)); will-change: translate; }
html[data-motion="full"] .desktop-wallpaper-grid { animation: helix-scroll 90s linear infinite; }
@keyframes helix-scroll { to { translate: 0 calc(-720 * max(100cqw / 1440, 100cqh / 900)); } }
html[data-motion="full"] .wallpaper-gel-glow { animation: gel-glow 12s ease-in-out infinite alternate; }
html[data-motion="full"] .wallpaper-cells-particles { animation: cells-drift 36s ease-in-out infinite alternate; }
html[data-motion="full"] .wallpaper-particle { animation: particle-tumble 20s linear infinite; }
```
Always gate new keyframe usage with `html[data-motion="full"]`. Reduced rule at line 1281 (`html[data-motion="reduce"] :is(.desktop-wallpaper, .desktop-wallpaper *) { animation: none !important; }`) does NOT cover the HTML spider wrapper: add it to that selector. Helix: percent translate on a 3-period tile (RESEARCH "Helix judder" fix 1) and drop `backdrop-filter` from `.system-bar` (lines ~94-107) if the trace supports it.

**Editor classes:** disabled style already exists on `.primary-control/.secondary-control:disabled`. Counter row: reuse `.scientist-log-actions` (line ~577; muted 11px span). New `.editor-field-error`: copy `.employee-add-error` (line ~530: 11px/1.45, `overflow-wrap: anywhere`) with colour `#e07d74`, `margin-top: 4px`; `.editor-field.is-invalid input { border-color: var(--danger); }`. Savebar message goes in the status slot near `.editor-savebar-sections` (lines ~460-464, 503; warning colour, single-line ellipsis).

---

### `components/portia-desktop.tsx` (SYNC-01, CONT-02, 04, 07, 08)

**Analog:** itself.

Poll accept/set (lines ~372-392), keep the structure, the fix is in `acceptFetchedContent`; also swap the two partial normalisers for the shared function:
```tsx
const fetched = { ...payload.content, broadcasts: normalizeBroadcasts(payload.content.broadcasts), infoSections: normalizeInfoSections(payload.content.infoSections) };
if (!acceptFetchedContent(fetchedRevision, knownRevision.current, savesAtSend, savesStarted.current)) return;
knownRevision.current = fetchedRevision;
setContent(fetched);
```
`finally { setContentReady(true); }` must stay.

Cache load (lines ~455-458), replace with `normalizePortiaContent(parsed.content)`:
```tsx
if (isUsableContent(parsed.content)) {
  const cachedContent = { ...parsed.content, broadcasts: normalizeBroadcasts(...), infoSections: normalizeInfoSections(...) };
  setContent(cachedContent);
```
becomes `const cachedContent = normalizePortiaContent(parsed.content); if (cachedContent) { setContent(cachedContent); ...existing revision/selection lines }`.

CONT-07: line 288 `const [today, setToday] = useState("");` becomes `useState(() => localDateKey(new Date()))` (`localDateKey` from `lib/broadcasts.ts`; keep the 1 s tick).

CONT-04 render (line ~1283): compute `const important = item.type === "news" && item.important;` and use it for both `" important"` class and `" · ВАЖНО"` suffix:
```tsx
<article className={`broadcast-card ${item.type}${item.important ? " important" : ""}${state ? ` state-${state}` : ""}`}><span>{broadcastType(item.type)}{item.important ? " · ВАЖНО" : ""}</span>
```

Save path (`saveContent`, ~924-940) comment "Up to 2 MB" must follow the D-23 guard change.

---

### `components/portia-editor.tsx` (CONT-01, 03, 04, 05, 06, D-26)

**Analog:** itself. Hot file, edit after the desktop plan.

**Type change (CONT-04)**, line ~1072-1079. Add one line:
```tsx
changeDraft((next) => updateById(next.broadcasts, broadcast.id, (item) => { item.type = type; if (type !== "news") item.important = false; }));
```

**Delete handlers (CONT-03, D-26)**, lines 642-648 and ~1198-1203. Template (`moveSelectedVirusToRecycle`, lines 620-641) shows the required panel reset:
```tsx
setFormatTarget(null);
setFormatterOpen(false);
changeDraft((next) => { ...; next.recycleOrder = recycleKeys(next); });
setSelectedRecycledVirusId(nextId);
showRecord(false);
```
Call `removeRecycledVirus(next, id)` / `removeRecycleFile(next, id)` inside `changeDraft`, keep `recycleOrder = recycleKeys(next)`, add the two panel resets to both. D-26: recycle-file button currently deletes with no dialog; route it through the same `ConfirmDialog` (`setDialog(...)`, dialog block ~1279-1340; virus delete copy ~1314 gets "вместе с оформлением").

**Undo/redo tab follow (CONT-05)**, `step()` lines 610-619; add before `dispatch`:
```tsx
const change = categoryChange(draft.broadcasts, target.broadcasts);
if (change) { revealBroadcast.current = { id: change.id, field: "type" }; setBroadcastEditorTab(change.tab); setTab("broadcasts"); }
```
Reveal effect (lines 702-710) returns early when `tab !== "broadcasts"` without clearing the ref, so `tab` must be set in the same step. For end-date jump extend `revealBroadcast` field type (line ~546) with `"endsAt"` and the selector ternary at line 706 with `[data-broadcast-ends]`; add `data-broadcast-ends` to the end-date input.

**Save guard (CONT-06, D-16)**, `save()` line 757 is also called by Ctrl+S (~822) and the close dialog (~1336), so the guard goes inside:
```tsx
const save = async (): Promise<boolean> => {
  if (!dirty) return true;
  if (draft.broadcasts.some(questDateError)) return false;   // new, first guard
  if (saveState === "saving") return false;
```
Also `disabled` on the «СОХРАНИТЬ» button (~1275) and a button-styled message in the `role="status"` paragraph (~1268-1271).

**Field error (CONT-06)**, `Field` at lines 2295-2297:
```tsx
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) {
  return <label className={`editor-field${wide ? " wide" : ""}`}><span>{label}</span>{children}</label>;
}
```
Add optional `invalid`/`error` props (`.is-invalid` class, error `<small id>` rendered as sibling after the label, input gets `aria-invalid` and `aria-describedby`). End-date field currently (line ~1089): `<Field label="Дата окончания"><input type="date" value={broadcast.endsAt} min={broadcast.startsAt || undefined} .../></Field>`.

**Limit UI (CONT-01, D-15)**, copy the scientist-log row exactly (line 996):
```tsx
<div className="scientist-log-actions"><button className="secondary-control" type="button" disabled={selectedVirus.scientistLogs.length >= 5} onClick={...}>+ ДОБАВИТЬ ЗАПИСЬ</button><span>{selectedVirus.scientistLogs.length} / 5</span></div>
```
Apply with `limitStatus(count, MAX_*)` to: «+ СТРОКА» (line ~1034, `rows.push({ key: "", value: "" })` inside `editTableRows`), the four block buttons «+ ТЕКСТ/ТАБЛИЦА/ВИДЕО/ФОТО» (lines ~1040-1043, disable together, one shared span), «+ ПОДРАЗДЕЛ» (line ~1047). Span always in DOM with `aria-live="polite"`, empty under 80%, `МАКСИМУМ {max}` at full, `{n} / {max}` between; each disabled button `aria-describedby` the span. Existing `maxLength={500}`/`300` on row key/value and title stay (editor-side). Invisible limits: `oversizeFields(draft)` drives one savebar span, no disable.

---

### `app/api/content/route.ts` (D-23)

Lines 43-45:
```ts
const raw = await request.text();
if (raw.length > 2_000_000) return Response.json({ error: "Данные слишком большие." }, { status: 413 });
const body = parseJsonObject(raw);
```
Keep the guard shape (413 + Russian error); raise the number after verifying Netlify's request-body limit (cited ~6 MB, unverified). Export it as a named constant if the editor needs to pre-warn on `JSON.stringify(normalized).length` (rejected save must not be silent). Update the "Up to 2 MB" comment in `portia-desktop.tsx` `saveContent`.

---

## Shared Patterns

### Non-destructive normalize (D-01, D-17)
**Source:** `lib/portia-content-normalize.ts` (`normalizePortiaContent` is run by `PUT /api/content`, `GET /api/content` and now the desktop cache load).
**Apply to:** every change in that file. Coercion only, never `.slice` on user content; every rule idempotent (`normalize(normalize(x))` deep-equals `normalize(x)`); verified by the existing idempotence tests.

### Node-testable pure lib module
**Source:** `lib/editor-items.ts`, `lib/broadcasts.ts`, `lib/content-sync.ts`.
**Apply to:** `content-limits.ts`, `wallpaper-web.ts`, new helpers. `import type` for types, explicit `.ts` import suffixes, no enums/parameter properties, one-line English why-comments. Test: `import test from "node:test"; import assert from "node:assert/strict";`.

### Motion gating
**Source:** `app/portia.css` lines 1281, 1314-1346 and `lib/accent-boot.ts:4`.
**Apply to:** all new wallpaper animation: `html[data-motion="full"]` selectors for motion; the reduce rule must cover new non-SVG elements; OS `prefers-reduced-motion` only matters when the attribute is absent.

### Delete takes formatting with it
**Source:** `removeBroadcast` (`lib/editor-items.ts:14-18`); stale format panel reset (`portia-editor.tsx:626-627`, documented at ~680-685).
**Apply to:** both permanent-delete handlers.

### Editor edit path
**Source:** `changeDraft((next) => updateById(next.X, id, (item) => { ... }))`.
**Apply to:** all editor mutations; do not add new mutation paths (tables go through `editTableRows`).

### Ids
**Source:** `${parentId}-block-${index}`, `${sectionId}-sub-${index}`, `info-${index}` in normalize.
**Apply to:** `broadcast-${i}`, `virus-${i}`, `recycled-${i}`; no `:`; unique inside list.

## No Analog Found

| File / part | Role | Data Flow | Reason |
|---|---|---|---|
| rAF spider loop (walk planner, thread-wave pulse pool) in `portia-wallpaper.tsx` | component | event-driven | No existing rAF/JS-driven animation in the codebase; all current motion is CSS keyframes. Use RESEARCH architecture and UI-SPEC timeline |
| Inline owner SVG (`09-spider.svg`) with per-leg CSS gait | component | n/a | No existing inlined multi-group artwork; boot spider is a PNG. Use RESEARCH leg table and pivot notes |
| Per-cell `<g>` animation with CSS custom-property keyframes | component | n/a | Today walls/nuclei are merged paths; new structure from UI-SPEC |
| DOM render test for CONT-07 first-render status | test | n/a | No DOM harness (strip-types runner cannot run `.tsx`); manual check |

## Metadata

**Analog search scope:** `lib/`, `components/portia-wallpaper.tsx`, `components/portia-desktop.tsx`, `components/portia-editor.tsx`, `app/portia.css`, `app/api/content/route.ts`
**Files scanned:** ~14 (targeted reads and ranges; large components read by range)
**Pattern extraction date:** 2026-10-25
