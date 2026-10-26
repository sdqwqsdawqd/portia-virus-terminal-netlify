# Phase 13: Приложение «Справочник» - Pattern Map

**Mapped:** 2026-10-27
**Files analyzed:** 11 (all modifications, plus tests; no new source file is strictly required)
**Analogs found:** 11 / 11 (cross-section card drag is a partial match, see No Analog Found)

All analog paths are git-tracked (`git ls-files lib components` confirmed; `app/portia.css` is tracked source).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `lib/portia-content.ts` (types `GuideBlock/GuideCard/GuideSection`, `guideSections` field, `portiaTextKey.guide*`, `defaultPortiaContent`) | model | transform | same file: `InfoBlock/InfoSection` (l.101-130), `portiaTextKey` (l.~181) | exact |
| `lib/portia-content-normalize.ts` (`normalizeGuideSections`) | utility | transform | same file: `normalizeInfoBlock/Subsection/Sections` (l.159-210), call at l.~321 | exact |
| `lib/editor-changes.ts` (`EditorSection` += `"guide"`, labels, `sectionOfKey`, `prefixSections`) | config/utility | transform | same file l.3-31 (the `info` entries) | exact |
| `lib/editor-tabs.ts` | config | request-response | `tabRegistry` l.12-15 | exact (likely no edit, see below) |
| `lib/editor-items.ts` (`removeGuideSection/Card/Block`, `moveGuideCard`) | utility | CRUD | same file `removeInfoSection/Subsection/Block` l.31-53 | exact |
| `components/portia-icons.tsx` (`"guide"` icon) | component | n/a | `info`/`charter` entries in `iconPaths` (l.59) | exact |
| `components/portia-desktop.tsx` (AppId, shortcut, window, search) | component | request-response + event-driven | `info` app: l.22, 47, 59-70, 115, 596, 1160-1197, 1336-1362 | exact |
| `components/portia-editor.tsx` (tab «Справочник») | component | CRUD | `tab === "info"` block l.1319-1390 | exact (one level fewer than Info + cross-parent drag) |
| `components/portia-editor.tsx` `OrderDragHandle` (cross-section) | component | event-driven | same component l.198-300 | partial |
| `app/portia.css` (`.guide-*`) | config | n/a | `.info-library`, `.info-block-photo/video`, `.global-result` l.261-270 | role-match |
| tests: `lib/editor-changes.test.ts`, `editor-items.test.ts`, `portia-content-normalize.test.ts`, `editor-tabs.test.ts` | test | n/a | same files (node:test + assert; e.g. editor-changes.test.ts l.27-30, 175-177; editor-items.test.ts l.61-75) | exact |

## Pattern Assignments

### `lib/portia-content.ts` (model)

**Analog:** same file, `InfoBlock`/`InfoSection` (l.101-130) and `portiaTextKey` (l.~181).

```typescript
export type InfoBlock =
  | { id: string; type: "text"; text: string }
  | { id: string; type: "table"; rows: { id: string; key: string; value: string }[] }
  | { id: string; type: "photo"; url: string }
  | { id: string; type: "video"; videoId: string };
...
export const portiaTextKey = {
  info: (sectionId: string) => `info:${sectionId}:body`,
  infoBlock: (blockId: string) => `info-block:${blockId}:text`,
```

Apply: add `GuideBlock` with types `heading{text}`, `text`, `table`, `photo{url,caption}`, `video`, `callout{label,text}`; `GuideCard{id,title,cover,blocks}`; `GuideSection{id,title,photo,cards}`. Add `guideSections: GuideSection[]` to `PortiaContent`. Text keys (D-02 callout body and text block are formatted): `guideBlock: (id) => \`guide-block:${id}:text\``. Use a prefix distinct from `info:`/`info-block:`: `sectionOfFormattedKey` matches by `startsWith`, so `guide-block:` does not collide. Photo captions and callout label are plain strings (not formatted). Add `guideSections: []` to `defaultPortiaContent` (D-00f).

### `lib/portia-content-normalize.ts`

**Analog:** same file l.159-210.

```typescript
function normalizeInfoBlock(value: unknown, subsectionId: string, index: number): InfoBlock[] {
  if (!isRecord(value)) return [];
  const id = typeof value.id === "string" && value.id ? value.id : `${subsectionId}-block-${index}`;
  switch (value.type) {
    case "text": return [{ id, type: "text", text: asText(value.text) }];
    case "table": { /* stable row ids with `seen` set, fallback `${id}-row-${rowIndex}` */ }
    case "photo": return [{ id, type: "photo", url: normalizeMediaUrl(value.url) }];
    case "video": return [{ id, type: "video", videoId: typeof value.videoId === "string" && youtubeIdPattern.test(value.videoId) ? value.videoId : "" }];
    default: return [];
  }
}
export function normalizeInfoSections(value: unknown): InfoSection[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => { if (!isRecord(item)) return []; const id = ...`info-${index}`; ...
```

Apply: `normalizeGuideSections(value)` with the same shape: non-array returns `[]` (old saves have no field), positional fallback ids, `asText` for all strings, `normalizeMediaUrl` for `photo`/`cover`/section `photo` (Phase 12 D-23), same table-row code (extract or copy), same youtube check. Add `heading` and `callout` cases. Never drop user text (D-00f). Wire in `normalizePortiaContent` next to `infoSections: normalizeInfoSections(candidate.infoSections)` (l.~321). Do NOT require the field in the `Array.isArray(candidate.infoSections)` guard at l.216, or old saves would be rejected.

### `lib/editor-changes.ts`

**Analog:** same file l.3-31.

```typescript
export type EditorSection = "viruses" | "info" | ...;
export const editorSections: EditorSection[] = ["viruses", "info", ...];
export const sectionLabels: Record<EditorSection, string> = { info: "Информация", ... };
export function sectionOfKey(key: string) { ... if (key === "infoSections") return "info"; ...
const prefixSections = { "info:": "info", "info-block:": "info", ... };
```

Apply: add `"guide"` to the type, `editorSections` (position decides tab order, put after `"info"`), `sectionLabels.guide = "Справочник"`, `if (key === "guideSections") return "guide"`, `"guide-block:": "guide"` in `prefixSections`. Without the prefix, `unclassifiedTextKeys` makes a restricted editor's save 400 (fail-closed). `Record<EditorSection,...>` forces TS errors at every other map, so grep `Record<EditorSection` and `EditorSection` consumers.

### `lib/editor-tabs.ts`

`tabRegistry` is built from `editorSections.map(...)`, so adding to `editorSections` registers the regular tab and the «Доступ» chip with no edit here. The comment at l.9-11 names this case. Verify `lib/editor-tabs.test.ts` fixtures that assert tab lists/count, and `components/portia-editor.tsx` l.32 `type EditorTab` (add `"guide"`).

### `lib/editor-items.ts`

**Analog:** l.31-53.

```typescript
export function removeInfoSection(content: PortiaContent, id: string): void {
  const section = content.infoSections.find((item) => item.id === id);
  content.infoSections = content.infoSections.filter((item) => item.id !== id);
  delete content.formattedText[portiaTextKey.info(id)];
  for (const sub of section?.subsections ?? []) for (const block of sub.blocks) delete content.formattedText[portiaTextKey.infoBlock(block.id)];
}
export function removeInfoBlock(content, subsectionId, blockId) { ...filter...; delete content.formattedText[portiaTextKey.infoBlock(blockId)]; }
```

Apply: `removeGuideSection` (cascade: delete `guideBlock` keys of every card block), `removeGuideCard(content, sectionId, cardId)`, `removeGuideBlock(content, cardId, blockId)`. Add `moveGuideCard(content, cardId, toSectionId, toIndex)` as one mutation so cross-section move is one undo step. Tests copy `editor-items.test.ts` l.61-75 style.

### `components/portia-icons.tsx`

**Analog:** `iconPaths` entries (e.g. `info: <>` at l.59), type `PortiaIconName`. Add `guide: <>…folder path…</>` on the 24px grid (stroke 1.75, `currentColor` supplied by the wrapper at l.133).

### `components/portia-desktop.tsx`

**Analog:** the `info` app. Touch points:
- l.22 `AppId` and l.47 `DesktopShortcutId`: add `"guide"`.
- l.59-70 `appMeta`: `guide: { label: "Справочник", path: "PORTIA://GUIDE", icon: "guide" }`.
- l.72 `initialWindows`, l.85 `createWindowGeometry`, l.115 `windowMinimums` (820x650 default, 560x420 min, copy `info` entries). All are `Record<AppId,...>`, so TS lists every spot.
- l.596 allowed-shortcut Set: `new Set<DesktopShortcutId>([... "info", ...])`, add `"guide"`. Also render a `<DesktopIcon app="guide" ...>` next to the `info` one (grep `app="info"`). `taskbarOrder` auto-includes via `Object.keys(appMeta)` (l.303, 627).
- Window, copy the `AppWindow` wrapper (l.1334-1362):
```tsx
<AppWindow app="info" state={windows.info} active={activeApp === "info"} onFocus={focusApp} onMinimize={minimizeApp} onMaximize={toggleMaximize} onClose={closeApp} onGeometry={updateWindowGeometry} className="utility-window info-window" meta="АРХИВ ЗНАНИЙ">
  {!contentReady ? <LoadingState label="Загрузка разделов…" /> : <div className="info-library"> ...
```
  Block renderers to reuse: text `<FormattedText className="info-document-copy" text=... document={content.formattedText[portiaTextKey.infoBlock(block.id)]} />`; table `<dl className="info-ledger info-classification">` rows filtered by `row.key || row.value`; video `<figure className="info-block-video"><iframe ... sandbox={embedSandbox} allow="..." allowFullScreen referrerPolicy="strict-origin-when-cross-origin" src={\`https://www.youtube-nocookie.com/embed/${block.videoId}\`} />`; photo `<figure className="info-block-photo"><img ... loading="lazy" decoding="async" referrerPolicy="no-referrer" />` (add `figcaption`, `onError`). Put the guide window in a new component (e.g. `GuideApp`) in the same file or a new `components/portia-guide.tsx` to keep state (view, openCardId, savedScrollTop, collapsed ids) local; `content` comes in as a prop so 10 s polling re-renders it (D-00d: effect that clears `openCardId` when card not found).
- Collapsed-section persistence (D-08): `desktopSettingsStorageKey` is `"portia-desktop-settings-v1"` (lib/accent-boot.ts:7); the load pattern at l.572 is `JSON.parse(window.localStorage.getItem(key) ?? "{}")` inside try/catch and write at l.728 `try { window.localStorage.setItem(...) } catch {}`. Use a separate key (UI-SPEC says "own key"), filter ids against current sections.
- Search (l.1160-1197): extend `items` union type with `"guide"` and
```tsx
...content.infoSections.flatMap((section) => [{ id: section.id, type: "info" as const, title: section.title, meta: "ИНФОРМАЦИЯ", body: section.body }, ...section.subsections.map((sub) => ({ id: sub.id, type: "info" as const, title: sub.title, meta: `ИНФОРМАЦИЯ · ${section.title}`, body: sub.blocks.map(...).join(" ") }))]),
```
  Apply: one item per card, `meta: \`СПРАВОЧНИК · ${section.title}\``, `body` = section title + all block text/rows/callout label+text/captions. The filter already searches `title meta body` (so the section name matches all its cards, D-15). `openSearchResult` branch: `else if (result.type === "guide") { setGuideOpenCardId(result.id); openApp("guide"); }`. Result row at l.1324 renders mark text per type (find where `INF` is chosen) - add `REF`.
- `EditorSection`/editor window flag gets nothing here.

### `components/portia-editor.tsx` (tab «Справочник»)

**Analog:** `tab === "info"` (l.1319-1390), helpers at l.946-952 (`infoTocItems`, `infoCardIds`, `jumpInfo`).

```tsx
<EditorToc items={infoTocItems} onJump={jumpInfo} onAll={(open) => setAllOpen(infoCardIds, open)} />
{draft.infoSections.length === 0 && <div className="editor-empty">Разделов пока нет. Добавьте первый раздел кнопкой «+ ДОБАВИТЬ РАЗДЕЛ».</div>}
{draft.infoSections.map((section, index) => (
  <CollapsibleCard key={section.id} id={section.id} sortIndex={index} label={`РАЗДЕЛ ${String(index + 1).padStart(2, "0")}`} title={section.title} open={isOpen(section.id)} onToggle={() => toggleCard(section.id)}
    handle={<OrderDragHandle index={index} label={section.title || "раздел"} onMove={(from, to) => changeDraft((next) => moveArrayItem(next.infoSections, from, to))} />}
    actions={<div className="nested-editor-actions"><button type="button" onClick={() => { closeFormatterFor(...keys); changeDraft((next) => removeInfoSection(next, section.id)); }}>Удалить</button></div>}>
```
Block level (l.1338-1343): `<CollapsibleCard ... label={infoBlockHeads[block.type].title}>`; text via `FormattedTextarea area="info" ... formatKey onActivate={activateFormatter} onChange={(value, document) => changeFormattedText(key, value, document, (next, text) => updateById(...))}`; video `<YoutubeField videoId onChange>`; photo `<ImageEditorField label value placement="guide" maxHint uploadState onChange onUpload={(file) => uploadImage(file, (url) => changeDraft(...))} />`. Adders (l.1373-1376): `<button className="secondary-control limit-add" disabled={blocks.length >= MAX_BLOCKS} aria-describedby={...} onClick={() => { const id = makeId("block"); changeDraft((next) => { ...blocks.push({ id, type: "text", text: "" }); }); setOpen([id], true); }}>+ ТЕКСТ</button>`. Add-section (l.1389): `next.infoSections.push({ id, title: "НОВЫЙ РАЗДЕЛ", ... }); setOpen([id], true)`. Table editor with row ≡ at l.1344-1366 (`editTableRows`, `OrderDragHandle` per row): copy and re-point to guide lookup (`editTableRows` at ~l.166 uses `findInfo`, so write a guide-specific lookup `findGuide(sections, id)`).
Other edits: `type EditorTab` (l.32) and tab strip (`tabRegistry` driven, l.683, so the label arrives automatically); `DisplayArea` l.78 (used by `FormattedTextarea area`) add `"guide"` or reuse `"info"`; revert-on-close (l.764, `revertSections`) and `sectionLabels` usage (l.783) work once `editor-changes.ts` knows `guide`; check `revertSections` in `lib/editor-changes.ts` to include `guideSections` and `guide*` formattedText keys. Mirror the guidance line (find the info tab's hint paragraph). Two levels only: section > card > block (cards play the role of Info subsections; fields: `Field label="Заголовок раздела"`, `Заголовок карточки` with `maxLength={300}` as at l.1335).

### `OrderDragHandle` cross-section card move (partial)

**Analog:** l.198-300. Parent-bound rule to extend:
```tsx
const parent = button.current?.closest<HTMLElement>("[data-sort-index]")?.parentElement;
const row = document.elementsFromPoint(x, y).map((e) => e.closest<HTMLElement>("[data-sort-index]")).find((c) => c && c.parentElement === parent);
const target = Number(row?.dataset.sortIndex);
...
onMoveRef.current(indexRef.current, target); indexRef.current = target;
```
Plan: add an optional prop (e.g. `onMoveAcross?: (toGroup: string, toIndex: number) => void`) and a `data-sort-group` attribute on card lists; when the pointer row's parent differs but has the same `data-sort-group` kind, call it and set `indexRef`. Dragging in progress keeps the handle element alive only if React keeps the same key, so moving the card across parents remounts it (pointer capture already assumed lost; tracking is on `window`, see the comment "a downward swap re-inserts the dragged row and drops pointer capture"). Keyboard ArrowUp/ArrowDown handler lives lower in the same component (l.300+, not read). Existing `editor-history.ts` groups edits while `data-dragging` is set, so one `changeDraft` per move keeps Ctrl+Z at one step.

### `app/portia.css`

**Analog:** `.info-library`, `.info-block-photo/video`, `.info-document-copy`, `.global-result*` (l.261-270), `.nested-editor-card`, `.order-drag-handle`. Add `.guide-app` etc. using existing tokens (`--panel`, `--panel-2`, `--line`, `--teal`, `--teal-soft`); breakpoints 900 and 520; no keyframes (motion clamp is global).

## Shared Patterns

### Draft mutations and undo
**Source:** `components/portia-editor.tsx` `changeDraft((next) => ...)`, `lib/editor-history.ts`. Apply: every guide edit goes through `changeDraft`; deletes use the `lib/editor-items.ts` helpers and call `closeFormatterFor(...keys)` first.

### Formatted text
**Source:** `portiaTextKey` + `FormattedText` (view) / `FormattedTextarea` + `changeFormattedText` (edit). Apply: text and callout body blocks; key prefix must be registered in `prefixSections`.

### Per-tab access
**Source:** `lib/editor-changes.ts` + `lib/editor-tabs.ts` `contentRefusal`. Apply: the only code change is adding `guide` to `editorSections`/labels/key maps; server refusal and revert come free.

### Safe localStorage
**Source:** `components/portia-desktop.tsx` l.572 and l.728 (try/catch around read/write, validate ids against known set).

### Tests
**Source:** `lib/*.test.ts` using `node:test` + `assert` (`assert.deepEqual(changedSections(fixture(), draft), ["info"])`). Add: guide formattedText key marks `guide`; unknown-key fail-closed unaffected; normalize old content without `guideSections` yields `[]` and preserves callout/heading text; remove helpers delete formatting keys; cross-section move.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| cross-section drag in `OrderDragHandle` | component | event-driven | Existing handle only swaps within one parent (comment at moveTo); needs extension |
| `GuideApp` two-view navigator (grid view / card view with restored scrollTop, sticky back-bar) | component | request-response | `info` window has an index+document layout, not a replace-in-place navigator; use UI-SPEC "Interaction Contract" |
| Callout and heading block types | model | transform | New block types; follow the `text` block pattern |

## Metadata

**Analog search scope:** `lib/`, `components/`, `app/portia.css` (grep-targeted; `components/portia-desktop.tsx` 2005 lines and `portia-editor.tsx` 2854 lines read only at the cited ranges).
**Pattern extraction date:** 2026-10-27
