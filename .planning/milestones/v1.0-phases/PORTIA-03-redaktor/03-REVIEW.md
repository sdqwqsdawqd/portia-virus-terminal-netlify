---
phase: PORTIA-03-redaktor
reviewed: 2026-10-14T00:00:00Z
depth: standard
files_reviewed: 9
files_reviewed_list:
  - app/portia.css
  - components/portia-desktop.tsx
  - components/portia-editor.tsx
  - lib/accent-boot.ts
  - lib/accent-theme.test.ts
  - lib/content-sync.test.ts
  - lib/content-sync.ts
  - lib/editor-items.test.ts
  - lib/editor-items.ts
findings:
  critical: 1
  warning: 3
  info: 7
  total: 11
status: issues_found
---

# Phase PORTIA-03: Code Review Report

**Reviewed:** 2026-10-14
**Depth:** standard (diff `caf0fae..HEAD`)
**Files Reviewed:** 9
**Status:** issues_found

## Summary

I checked these changes: the second-round fixes (ba7f0eb, 2562d28, b1fc81c) and plans 03-05 through 03-08, plus 2df187d and dd26f5b. `npm test` passed 82 of 82. `npx tsc --noEmit` is clean. `npm run lint` reports 0 errors and 13 warnings, all `@next/next/no-img-element`.

Verified as correct:
- **WR-01..03 fixes.** The Recycle fallback, the НЕ СОХРАНЯТЬ button disabled while saving, and the `editCount` clean check all work.
- **Drag tracking.** Window `pointermove` tracking works, because `holdTimer` stays non-null for the whole drag. This resolves the old IN-05.
- **Revision gate in normal runs.** No regression found. The cache is read before the first GET: both are `setTimeout 0` and the cache timer is registered first. The poll and save race is closed by `savesStarted`. The editor's `baseRevision` stays in step with `content` because the sync effect and the save path both set it.
- **CSS `:not()` selector list.** Selectors Level 4 complex `:not()` works in every target browser. Every `!important` reduced-motion override still wins (see IN-05 for why that is fragile).

The main defect is outside the 03-08 diff but in the class of bug 03-08 set out to fix. The open format panel, the image uploads, and the virus, mutation and recycled-virus handlers still write by a captured array index. A reorder or delete can therefore silently overwrite a different record (CR-01).

Three warnings concern the new revision gate's failure paths:
- a cache that is ahead of the server locks the tab out for good;
- a timed-out save turns into a false "someone else saved" conflict;
- the conflict banner cannot be cleared.

## Critical Issues

### CR-01: Virus, mutation and recycled-virus edits still write by captured index, so the format panel or an upload overwrites another record

**File:** `components/portia-editor.tsx:660-663`, `:889`, `:914-920`, `:936-939`, `:1366`, `:1159`, `:1587`

**Issue:** Commit 7c50bf0 moved broadcasts and info sections to `updateById`. Its own comment in `lib/editor-items.ts:3` says the reason: "a reorder shifts every index that a handler or the open format panel captured". The virus dossier was left on indices:
- `updateVirus` writes `next.viruses[selectedVirusIndex]`.
- The rich fields at 914-920 write `next.viruses[selectedVirusIndex].external`, `.physiology` and `.ppu[key]`.

The panel stores its `onCommit` closure at activation (`FormatTarget.onCommit`, called at 1587). Reordering viruses (the handle at 889) does not close the panel. Steps to reproduce on desktop:
1. Open virus B.
2. Select text in «Внешние характеристики» and open ✎.
3. Press ArrowDown on B's handle, or drag it.
4. Click a colour.

The stale closure writes B's text into whichever virus now sits at B's old index, and B's formatting goes to B's id key. The other virus's text is silently replaced, and the next save stores the loss.

The same applies to these paths:
- An `uploadImage` callback whose upload finishes after a reorder or after a virus is moved to Recycle.
- Mutations, both live (936-939) and in the recycled dossier (1366). They are keyed and formatted by index (`portiaTextKey.mutation(virusId, index)`, and `key={index}`). Deleting mutation 1 leaves its formatting at index 1. `replaceRichText` then paints that formatting onto the next mutation's text. With the panel open on a later mutation, the next commit writes into the wrong mutation.

**Fix:** Do what 03-08 did for broadcasts, for the virus paths as well:
```tsx
const updateVirus = (updater: (virus: Virus) => void) => {
  const id = selectedVirus?.id;
  if (!id) return;
  changeDraft((next) => updateById(next.viruses, id, updater));
};
// rich fields: (next, text) => updateById(next.viruses, selectedVirus.id, (virus) => { virus.external = text; })
```
Apply the same change to the recycled-virus and recycle-file updaters. In addition:
- Call `setFormatTarget(null); setFormatterOpen(false)` in the virus `onMove`, or key mutations by a stable id.
- When a mutation is deleted, shift its `formattedText` keys down (or drop them), as `removeBroadcast` does.

## Warnings

### WR-01: A cached revision ahead of the server locks the tab out permanently, and reload does not help

**File:** `components/portia-desktop.tsx:398-404`, `:331-333`, `lib/content-sync.ts:3`

**Issue:** `knownRevision` is seeded from localStorage. Every GET with a lower revision is then dropped, forever. If the server's revision ever goes down, the tab is locked out. This happens when the `portia_content` row is reset or deleted (the insert path restarts at 1) or after a migration to a fresh project. In that case:
- every poll is ignored;
- the editor's `baseRevision` stays at the cached value, so every PUT returns 409;
- a reload re-seeds the gate from the same cache.

The only way out is to clear site data by hand. Before 382b8b6, the next poll healed this.

**Fix:** Let a conflict reset the gate, so the next poll is taken whatever its revision:
```ts
if (response.status === 409) {
  knownRevision.current = -1; // the server is authoritative after a conflict
  setSaveState("conflict");
  throw new Error("PORTIA content changed by another editor");
}
```
Optionally, also drop the cache's revision when it is far ahead of what the server reports.

### WR-02: A save that times out after the server committed now becomes a false conflict

**File:** `components/portia-desktop.tsx:138`, `:818-822`, `components/portia-editor.tsx:762-768`

**Issue:** The PUT uses `fetchWithTimeout` with its default of 6 s. The body can be up to 2 MB, and the server does auth, an upsert and a CDN purge. If the abort fires after the server committed revision R+1:
- the client shows ОШИБКА and keeps the draft dirty, with `baseRevision = R`;
- the next poll accepts R+1, but the dirty editor does not resync;
- the retry returns 409, and the owner is told someone else saved and to copy their edits and reload.

Before 03-08 the PUT sent the desktop's latest `revision`, so the retry succeeded. 03-08 made this path worse.

**Fix:** Give the PUT a realistic timeout, `fetchWithTimeout("/api/content", {...}, 30_000)`. Optionally, when a GET is accepted while the editor is dirty and its payload equals the last attempted save, adopt that revision as `baseRevision`.

### WR-03: The conflict banner cannot be cleared once the draft is clean

**File:** `components/portia-editor.tsx:829-833`, `components/portia-desktop.tsx:845`

**Issue:** 03-08 made a 409 the designed outcome for stale drafts, so this path is now common. After a 409, the owner presses ОТМЕНИТЬ (or undoes back to clean). The editor resyncs to the newest content and `baseRevision`. But `saveState` stays `"conflict"`: only a new `saveContent` call resets it, and `save()` returns early when clean. As a result, `barVisible` stays true and the bar keeps saying «КТО-ТО СОХРАНИЛ РАНЬШЕ — СКОПИРУЙТЕ ПРАВКИ И ОБНОВИТЕ СТРАНИЦУ» over a clean, current editor.

**Fix:** Show the conflict text only while there is something to rescue:
```tsx
const conflict = saveState === "conflict" && dirty;
const barVisible = dirty || saveState === "saving" || saveState === "saved";
const statusText = saveState === "saving" ? "СОХРАНЕНИЕ…" : conflict ? "КТО-ТО СОХРАНИЛ РАНЬШЕ — …" : ...;
```

## Info

### IN-01 (carried over): `::highlight(portia-format)` build warning is cosmetic

**File:** `app/portia.css:435`

**Issue:** Still present. `lightningcss` warns on every build. The rule works.

**Fix:** Add a comment that the warning is expected, or inject the rule from the component.

### IN-02 (carried over): shortcut listener edge cases

**File:** `components/portia-editor.tsx:776-800`

**Issue:** Still present:
- The listener is removed while a dialog or a close is pending, so Ctrl+S opens the browser's «Сохранить страницу».
- Ctrl+S on the Сотрудники and Доступ tabs saves the content draft, not the form on screen.
- `event.repeat` is not filtered.

**Fix:** As before.

### IN-03 (carried over): magic numbers and unguarded spread

**File:** `components/portia-editor.tsx:233-236` (`56`, `44`, `48`, `8` in `autoscroll`); `lib/editor-changes.ts:76` (`...content.recycledViruses`)

**Issue:** Still present.

**Fix:** Name the constants. Write `...(content.recycledViruses ?? [])`.

### IN-04 (carried over, extended): close-dialog rough edges

**File:** `components/portia-editor.tsx:1216-1240`, `:618-622`

**Issue:** Still present:
- If a save started with Ctrl+S succeeds while the close dialog waits, the dialog shows `Не сохранено: ` with an empty list.
- Disabling СОХРАНИТЬ drops keyboard focus out of the dialog.

New: `editCount` is bumped for every `changeDraft`, including no-op updates that the reducer discards (`JSON.stringify(next) === JSON.stringify(present)`). A no-op during a save (for example `updateById` on an id that is gone, or re-entering the same value) makes `clean` false. The dialog then stays up with nothing unsaved. This is the safe direction, but it is the same empty dialog.

**Fix:** As before: auto-approve when `closeAsked && !dirty && saveState !== "saving"`, and move focus to ОТМЕНА.

### IN-05: reduced-motion rule now ties in specificity with every `!important` override

**File:** `app/portia.css:1143`

**Issue:** `html[data-motion="reduce"] :not(.desktop-wallpaper, .desktop-wallpaper *)` has specificity (0,2,1), up from (0,1,1). That ties it with these overrides at 1245, 1246, 1258, 1264 and 1341:
- `html[data-motion="reduce"] .app-window { animation: fade-in 160ms … !important }`
- `.doc-open`
- `.content-fade`
- `.assistant-bubble`

They win only because they come later in the file. Moved above line 1143, the fade would silently become 0.01 ms, and `WINDOW_FADE_OUT_MS` would no longer match. Separately, the `::before`/`::after` branches use `:not(.desktop-wallpaper *)`, which, unlike the element branch, does not exclude `.desktop-wallpaper` itself.

**Fix:** Keep the old weight and one exclusion list:
`html[data-motion="reduce"] :where(:not(.desktop-wallpaper, .desktop-wallpaper *)), html[data-motion="reduce"] :where(:not(.desktop-wallpaper, .desktop-wallpaper *))::before, …`

### IN-06: the OS reduced-motion preference is ignored, and «Выключены» no longer stops ambient motion

**File:** `lib/accent-boot.ts:4-10`, `app/portia.css:1143-1200`, `components/portia-editor.tsx:172-173`

**Issue:** This was the owner's decision (2df187d, dd26f5b), so it is noted rather than graded. Visitors who set reduced motion in the OS now get the infinite wallpaper sway, drift and tumble animations by default. Even «Анимации: Выключены» keeps them running; only the «Чистый» wallpaper stops them.

The two remaining `prefers-reduced-motion` consumers contradict the new rule. These are the `html:not([data-motion])` fallback at 1146, which still zeroes transitions and the wallpaper, and the FLIP guard. They only matter if the head script never ran.

**Fix:** Consider making «Выключены» also pause the wallpaper (`html[data-motion="reduce"] .desktop-wallpaper * { animation-play-state: paused }`). Alternatively, label the setting so it is clear that the wallpaper keeps moving.

### IN-07: phone-panel and FLIP details

**File:** `components/portia-editor.tsx:837`, `:164-176`

**Issue:**
- `phonePanelOpen` reads `matchMedia("(max-width: 900px)")` during render and does not subscribe to it. After a rotation or resize across 900 px with the panel open, the rich fields keep (or lack) `inputMode="none"` until the next render.
- The FLIP starts every slide from the layout delta and ignores a slide still running. A fast multi-row drag makes a row jump before it slides.
- `ActiveFormatContext`'s value is a fresh object on every render.

**Fix:** Optional. Subscribe with `useSyncExternalStore` or a `change` listener. Call `row.getAnimations().forEach((a) => a.cancel())` before `animate`, or compute the start offset from `getBoundingClientRect`.

---

_Reviewed: 2026-10-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
