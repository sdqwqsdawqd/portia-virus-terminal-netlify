# Phase 9: Целостность контента - Research

**Researched:** 2026-10-25
**Domain:** Next.js 16 / React 19 hand-styled desktop app: content sync, content normalisation, a rich editor, and CSS/SVG wallpaper animation
**Confidence:** HIGH for the content requirements (read from live code). MEDIUM for BG-01 (design is sound but frame-rate claims cannot be proven without a browser trace; no browser tooling was run in this session).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carried forward (locked earlier, not re-asked)**
- **D-01:** Limits are raised and shared by editor and server (one set of constants). At the limit the «+» button is disabled with a caption. The server never rejects and never truncates content over a limit (owner decision, REQUIREMENTS Out of Scope).
- **D-02:** Content poll stays every 10 s while the tab is visible (03.2-07). An unchanged revision must not produce a new `content` object (no `setContent`, no editor re-sync), so undo/redo survives; a newer revision from another device still arrives within ~10 s. See `acceptFetchedContent` in `lib/content-sync.ts` (currently `>=`).
- **D-03:** «Анимации: Выключены» keeps every wallpaper still and fully drawn (existing rule, `app/portia.css` `html[data-motion="reduce"]`). The new spider and cell motion must obey it too.

**Фон: паутина и паук (BG-01)**
- **D-04:** The current web sway (`web-sway`, a small rotation) reads as jerky side-to-side twitching and is replaced. The «Паутина» wallpaper (`radar`) gets a real spider walking on the web, drawn from the owner's SVG `.planning/phases/PORTIA-09-tselostnost-kontenta/09-spider.svg`.
- **D-05:** The spider walks along threads to a new point, stops for a few seconds, then walks on ("ходит и замирает"). While walking it sends visible waves along the threads it touches.
- **D-06:** Legs move as whole pieces, swinging from their base (alternating gait). The SVG has 8 separate leg groups (`Left_leg_1..4`, `Right_leg_1..4`) plus `Body`; legs are not split into segments, and the owner accepted that. The empty `Virus` group is ignored.
- **D-07:** Spider colours follow the theme: the teal parts (`cls-1`, `#00b396`) become the accent (`currentColor` / `--teal`); the near-black parts (`cls-2`) become the desktop background colour and follow it when the desktop colours change; the white parts (`cls-3`) become a pale accent tint. No hard-coded colours remain.
- **D-08:** Same silhouette as the boot spider (owner: «тот же силуэт»). Whether the boot screen also switches from its PNG to this SVG is Claude's discretion; it is not required.

**Фон: ДНК, гель, клетки (BG-01)**
- **D-09:** The DNA helix judders everywhere (PC and phone), not only at the loop seam. Fix the cause so the scroll is smooth on both; the likely suspect is translating the whole tall SVG (`.desktop-wallpaper-grid`, `helix-scroll`), but the researcher must confirm.
- **D-10:** Gel: the bands slowly creep down the lanes like real electrophoresis and fade back in at the top, plus a more visible glow than today's `gel-glow`.
- **D-11:** Cells are alive: the cells themselves drift slowly, change shape slightly and push their neighbours apart; the virus particles float between them (today only the particles spin, `particle-tumble`, and the group drifts a few px).
- **D-12:** Strength for every wallpaper: visible within 2–3 seconds of looking, but slow and calm, so reading is not disturbed.
- **D-13:** Same animation on every device, no reduced phone variant. A weak phone can turn animations off in Settings. It must still be smooth on the owner's PC and phone (success criterion 6).

**Лимиты (CONT-01)**
- **D-14:** Raise limits with a large margin. Invisible limits (rich-text runs per text, now 500; formatted-text keys, now 1000; text length 100 000; quest conditions 4000) go up ×10 or more, so they are practically never reached. Visible counts (table rows, now 100; blocks, now 100; subsections, now 50) go up ×2…×5. Exact numbers are Claude's choice, sized from the current live content with headroom.
- **D-15:** Visible limits show a counter only near the limit: from 80% a «180 / 200» counter appears next to «+»; at the limit «+» is disabled and captioned «МАКСИМУМ 200». Matches the existing «3 / 5» scientist-log pattern in `components/portia-editor.tsx`.
- **D-16:** If an invisible limit is reached anyway, the save still goes through whole (nothing is cut) and a clear warning near «СОХРАНИТЬ» names the field that is too large.
- **D-17:** Existing documents save whole; saving again without edits must not change the data.

**Квест: даты и «ВАЖНО» (CONT-04, CONT-06)**
- **D-18:** End date before start: the end field is highlighted in red with «Окончание раньше начала», and saving is blocked with a message to fix it. No automatic swap. This is an editor check; the server still does not reject (D-01). An already-stored bad quest is shown as is and flagged when opened in the editor.
- **D-19:** A news item changed to a quest loses `important`; quests never show «ВАЖНО» on the desktop. Changing back to news does not restore it; the editor sets it again. Undo of the type change still restores the full previous state.

**Странные данные (CONT-02, CONT-08)**
- **D-20:** A field of the wrong type: number or boolean becomes text (42 → «42»); object or array in a text field becomes an empty string. The other fields of the card are untouched. Applies on read and on save to news, quests and viruses (`normalizeBroadcasts`, virus normalize in `lib/portia-content-normalize.ts`).
- **D-21:** A card with a missing or empty id is kept and gets an id automatically, nothing is dropped. The id must be stable across reads (derived deterministically, e.g. from type and position), so a poll does not change it.
- **D-22:** Old cached content without `recycledViruses` must not crash the dossier diff (`lib/editor-changes.ts`); treat missing as empty.

### Claude's Discretion
- SYNC-01 mechanics (skip equal revisions; how the desktop and editor avoid re-render).
- CONT-03: permanent delete from Корзина removes `virus:<id>:*` / `recycle:<id>:content` formatting keys; restore keeps them. Implementation detail.
- CONT-05: undo/redo of a news↔quest change switches the «Сводка» tab to that card.
- CONT-07: correct quest status from the first render (lazy `today` init or equivalent).
- Exact Russian wording of new captions and warnings, in the existing short uppercase style.
- How the spider path, pauses and thread waves are implemented (CSS vs JS, SVG inlined vs imported), within D-03 and D-12.

### Deferred Ideas (OUT OF SCOPE)
None. Discussion stayed within phase scope. (The empty `Virus` group in the spider SVG may hint at a future idea; not part of this phase.) CONT-09 (`//host`) is Phase 12.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| BG-01 | Smooth wallpaper animation: helix and spider without judder, gel visibly moves, cells move and interact; verified by owner on PC and phone | Section "BG-01": current implementation, helix cause hypotheses, per-wallpaper approach, spider geometry/gait/pulses, reduced-motion wiring |
| SYNC-01 | 10 s poll leaves editor and desktop alone when revision unchanged | `acceptFetchedContent` `>=` is the defect; one-character fix plus test rewrite; why editor history resets |
| CONT-01 | Save never silently cuts text/guides/tables; shared raised limits; «+» disabled with caption | All `.slice`/`asText` caps located; constants plan; no-cut contract; UI derivation helpers; 2 MB body guard caveat |
| CONT-02 | Wrong-typed fields coerced on save and read; `title: {}` does not crash | `normalizeBroadcasts` / `normalizeVirus` spread unvalidated; coercion helper; cache read bypasses normalize |
| CONT-03 | Permanent delete removes formatting keys; restore keeps | Two delete handlers located; new helpers in `lib/editor-items.ts` |
| CONT-04 | News→quest loses `important`; quests never show «ВАЖНО» | Editor handler, normalize and desktop render all need the guard |
| CONT-05 | Undo/redo of type change switches Сводка to that card | `step()` does not touch `broadcastEditorTab`; reuse `revealBroadcast` |
| CONT-06 | End before start highlighted, save blocked | `save()` is called from 3 places: the guard must live inside `save()` |
| CONT-07 | Correct quest status from first render | `useState("")` for `today`; lazy init |
| CONT-08 | Old cache without `recycledViruses` does not crash dossier diff | `editor-changes.ts:76` spreads undefined; cache path skips normalize |
</phase_requirements>

## Summary

All nine content requirements are small, local defects in code that already has the right helpers; nothing needs a new dependency. SYNC-01 is literally one operator (`>=` to `>` in `lib/content-sync.ts:3`): every poll builds a new `fetched` object, the desktop calls `setContent(fetched)`, and the editor's `sync` reducer action resets history whenever `content !== history.source` (`lib/editor-history.ts:62`). CONT-01/02/08 all live in `lib/portia-content-normalize.ts` plus the desktop's cached-content load path, which skips `normalizePortiaContent` entirely. CONT-03/04/05/06 are editor handlers that need a few lines each, with one trap: `save()` is invoked from the button, from Ctrl+S and from the close dialog, so the date-block guard must be inside `save()`.

BG-01 is the only part with real design risk. The wallpaper is a single generated SVG per kind. CSS keyframes animate SVG children (main-thread painted, not composited) except the helix, which animates the whole `<svg>` as one composited layer. The best-fit design: the spider is a small separate composited element (its own tiny `<svg>` in an absolutely positioned wrapper moved with `transform`), thread waves are a pool of short `<path>` overlays in the main SVG, gel bands creep via one shared keyframe plus per-band negative `animation-delay`, and cells become per-cell `<g>` groups animated with CSS `translate`/`scale`/`rotate`. The helix cause must be confirmed by a trace on the owner's devices (the planner's first task, as UI-SPEC already says); the tiled-percent translate fix is cause-independent and cheap.

Two findings change the contract and need the planner's attention: (1) the owner's SVG has **mislabelled leg group ids** (outer id `Right_leg_2` is geometrically the third right leg), so the UI-SPEC's gait groups must be assigned by geometry, not by id; (2) the plain guide `text` block has an **unlisted 20 000-character cap** (`lib/portia-content-normalize.ts:124`) that silently cuts text and is absent from the UI-SPEC limits table.

**Primary recommendation:** Order the plans BG-01 first (touches only `components/portia-wallpaper.tsx` and `app/portia.css`, extracts pure walk geometry into `lib/` for node tests), then a `lib/`-only plan (normalize, constants, helpers, tests), then `portia-desktop.tsx`, then `portia-editor.tsx`, strictly in sequence.

## Project Constraints (from CLAUDE.md)

No `./CLAUDE.md` exists (`.claude/` holds only `launch.json` and `worktrees`; `config.json` names `./.claude/CLAUDE.md`, which is absent). Conventions inferred from the live code and prior phases, treat as binding:
- No new dependencies; Next 16.4.2, React 19.2.6, TypeScript 5.9.3 (`package.json`). [VERIFIED: package.json]
- `lib/*.ts` files are imported by `node --experimental-strip-types`, so use `import type`, explicit `.ts` import suffixes between `lib` files, no enums or parameter properties. [VERIFIED: lib/content-sync.test.ts imports `./content-sync.ts`]
- UI text is short uppercase Russian for buttons/captions; comments in code are English, one line, "why" only.
- React Compiler lint rules from `eslint-config-next` are active: existing code wraps effect-time `setState`/`dispatch` in `window.setTimeout(..., 0)` (see `portia-editor.tsx:565-573`, `portia-desktop.tsx:450-480`). A new rAF loop must mutate refs/DOM, not call `setState` inside effect bodies.
- The OS `prefers-reduced-motion` is intentionally ignored; the visitor's «Анимации» setting alone sets `html[data-motion="full"|"reduce"]` (`lib/accent-boot.ts:4`). Only when the attribute is missing does the media query act (`app/portia.css:1286-1288`).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Wallpaper drawing and animation | Browser / Client | — | Pure client SVG/CSS; no server involvement |
| Spider walk (path choice, pulses) | Browser / Client (pure `lib/` module + one rAF loop) | — | Needs per-frame work; pure part is node-testable |
| Poll equal-revision skip | Browser / Client (`PortiaDesktop`) | — | Decision uses `knownRevision` ref and the fetched revision |
| Content normalisation (coerce, ids, no-cut) | API / Backend (`PUT`/`GET /api/content`) | Browser (cache read, editor) | The same pure function runs on the server and, for the cache path, on the client |
| Limit constants | Shared `lib/` | API and Browser import them | One set (D-01) |
| Limit UI, date check, save blocking | Browser (editor) | API does NOT enforce (D-01, D-18) | Editor-only by decision |
| Orphan formatting cleanup | Browser (editor draft helpers) | — | Mutates the draft; server stays non-destructive |
| Body-size guard | API (`route.ts:44`) | — | Only server-side ceiling that remains |

## Standard Stack

No new packages are required. Everything below is already installed.

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.4.2 | App/API routes | existing [VERIFIED: package.json] |
| react / react-dom | 19.2.6 | UI | existing [VERIFIED: package.json] |
| TypeScript | 5.9.3 | types, `tsc --noEmit` | existing [VERIFIED: package.json] |
| node:test + `--experimental-strip-types` | Node 22.13 on Netlify (`netlify.toml` `NODE_VERSION = "22.13.0"`), 24.21 locally | unit tests for `lib/*.test.ts` | existing test runner [VERIFIED: package.json scripts, netlify.toml] |

### Supporting (platform features, not packages)
| Feature | Purpose | When to Use |
|---------|---------|-------------|
| CSS individual transform properties (`translate`, `rotate`, `scale`) | wallpaper motion | already used (`helix-scroll`, `web-sway`, `cells-drift`) |
| `requestAnimationFrame`, `ResizeObserver`, `MutationObserver` | the single spider loop, size cache, `data-motion` changes | spider only |
| CSS `color-mix(in oklab, …)` | pale spider tint (UI-SPEC) | spider `cls-3` |
| Container query units (`cqw`, `cqh`) | viewBox-to-pixel mapping without JS | already used (`app/portia.css:1321`) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Hand rAF loop for the spider | CSS `offset-path` motion | Needs one path per walk and still needs JS to choose walks and drive pulses; one loop is simpler |
| Analytic Bézier sampling for thread position | `getPointAtLength` on the DOM path (UI-SPEC wording) | Analytic is exact for the known Q segments, has no DOM read, and is unit-testable under node. Prefer analytic. |
| Per-cell `<g>` SVG animation | Each cell as an HTML element with its own compositor layer | Cheaper per frame, much more code; keep as fallback only if the phone trace fails |

**Installation:** none.

**Version verification:** no packages were added, so no registry check applies.

## Package Legitimacy Audit

No external packages are installed in this phase. Packages removed due to SLOP: none. Packages flagged SUS: none.

## Architecture Patterns

### System Architecture Diagram

```
Poll (every 10 s, visible tab)                     Editor save (Ctrl+S / button / close dialog)
  fetchContent() ──GET /api/content──┐               save()  ──guards: dirty, saving, DATE-BLOCK(new)
        │                            │                 │ normalized=clone(draft)+trims
        │                  normalizePortiaContent      │ onSave -> PUT /api/content
        │                  (coerce, ids, NO CUT)  <────┘       │  (2 MB body guard, then normalizePortiaContent)
        ▼                            │
 acceptFetchedContent(rev > known)   │  CDN (s-maxage 300, purged on save)
   no  ─► return (no setContent)     │
   yes ─► setContent(fetched) ──► PortiaEditor effect [content,dirty,revision]
                    │                  └─ dispatch({type:"sync"}) ─► reducer: content === source ? keep : initHistory (undo wiped)
                    └─► localStorage cache ──(page load)──► normalizePortiaContent(cached)  [NEW; today only 2 sub-normalizers run]

Wallpaper (kind = radar | grid | gel | cells | quiet)
 DesktopWallpaper ─► .wallpaper-layer (container-type:size) ─► WallpaperArt <svg viewBox 1440x900 xMaxYMin slice>
   radar: static web <g> + dew + pulse pool <path>s (rAF) ; Spider = sibling HTML wrapper (composited, transform) + inline <svg>
   grid : 3-period tile, one composited layer, translate in % of own height
   gel  : per-band <path> + shared keyframe + negative delay
   cells: per-cell <g> (wall+nucleus), CSS custom-property keyframes, virions float
 html[data-motion="reduce"] -> CSS animation:none AND rAF loop never starts (also covers non-SVG spider wrapper)
```

### Recommended Project Structure
```
lib/
├── portia-content-normalize.ts   # constants (limits) + coercion helpers + ids; no cutting
├── editor-items.ts               # + removeRecycledVirus, removeRecycleFile (formatting cleanup)
├── broadcasts.ts                 # + typeCategoryChange(prev,next) for CONT-05
├── content-limits.ts (new, tiny) # limitStatus(count,max), oversizeFields(content) -- pure, tested
├── wallpaper-web.ts (new)        # web graph, Bézier sampling, walk planner, pulse model -- pure, tested
components/
├── portia-wallpaper.tsx          # imports wallpaper-web.ts; Spider component; per-cell cellField
app/portia.css                    # wallpaper section 1298-1346 rewritten; .editor-field-error, .is-invalid
```

### Pattern 1: Pure module plus thin React shell (already the repo's pattern)
**What:** put geometry/decision logic in `lib/*.ts` (node-testable), keep the component to drawing and one effect. `lib/editor-items.ts` and `lib/editor-history.ts` are the model.
**When to use:** the web graph and walk planner, limit status, oversize detection, type-change detection.

### Pattern 2: Deterministic fallback ids with the existing naming style
**What:** `lib/portia-content-normalize.ts:121,143,154` already derive ids as `${parentId}-block-${index}`, `${sectionId}-sub-${index}`, `info-${index}`. Follow it: broadcasts `broadcast-${index}`, viruses `virus-${index}`, recycled viruses `recycled-${index}`. Never put `:` in a derived id, because `lib/editor-changes.ts:35-37` and `portiaTextKey` split formatted-text keys on `:`. Guarantee uniqueness inside the list (suffix on collision) so `updateById` stays unambiguous.

### Anti-Patterns to Avoid
- **Cutting in normalize "because the limit says so":** D-01/D-16/D-17 forbid it. Constants drive UI warnings, not `.slice`.
- **Putting the spider inside `.wallpaper-web`:** `app/portia.css:1307` styles every `path` descendant of `.wallpaper-web` (`stroke-dasharray: 1`, `opacity: .26`, `web-draw` animation). Spider paths would inherit it. Keep it a sibling.
- **Guarding save only on the button:** Ctrl+S and the close dialog bypass `disabled`.
- **Per-frame React state for animation:** no `setState` in the rAF loop.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Leg swing and gait | JS per-frame leg angles | CSS keyframes on each leg `<g>` (`rotate`, `transform-box: view-box`, fixed `transform-origin`) with `animation-play-state` toggled by a class | Zero JS per frame, trivially paused when stopped |
| Reduced motion | a second code path | existing `html[data-motion="reduce"]` rules plus one check at loop start | already the project's switch |
| Seeded randomness | new RNG | `seeded()` in `portia-wallpaper.tsx:71` | gives the same drawing every load |
| Orphan cleanup | scanning `formattedText` generically | explicit key builders from `portiaTextKey` plus prefix `virus:${id}:` | `lib/editor-items.ts` already deletes by builder |
| Tab jump to a card | new scroll/focus code | `revealBroadcast` ref + its effect (`portia-editor.tsx:702-710`) | already focuses the card field |
| Disabled button style | new CSS | `.primary-control/.secondary-control:disabled` (opacity .4) | `app/portia.css` rule at the controls block |
| Counter layout | new row | `.scientist-log-actions` | UI-SPEC reuse list |

**Key insight:** every fix is "reuse the existing helper at the one place that forgot it". The only new modules are small pure files so that behaviour is testable without a browser.

## Per-Requirement Findings

### SYNC-01 — poll must not reset undo history

**Defect.** `lib/content-sync.ts:3` — `return savesAtSend === savesNow && revision >= knownRevision;`. Equal revision is accepted, so `components/portia-desktop.tsx:383` `setContent(fetched)` runs every 10 s with a fresh object. The editor effect (`components/portia-editor.tsx:565-573`) dispatches `{ type: "sync", content }` when clean, and the reducer (`lib/editor-history.ts:61-62`) is `return action.content === state.source ? state : initHistory(action.content, clone);`, so a new object wipes `past`/`future`. The test `lib/content-sync.test.ts` line "the same revision is taken so a server-normalized copy still replaces the cache" encodes the old behaviour.

**Smallest fix.** Change `>=` to `>`. Rewrite the comment and that one test (equal now `false`); keep the `-1` reset test (after a 409 `knownRevision = -1`, so the next poll is accepted, `portia-desktop.tsx:932`). Nothing else changes: `setContentReady(true)` sits in `finally` (line 399) so the loader still ends on an equal answer; `setRevision`/`setActiveVirusId`/`setSelectedInfoId` are after the early return.

**Why the old reason for `>=` no longer applies.** It protected a cached copy from a newer normaliser. With CONT-02/08 the cached content goes through `normalizePortiaContent` at load (see below), so the cache is already in the current shape.

**Pitfalls.**
- Own save: `saveContent` sets `knownRevision.current = savedRevision` and `setContent(next)` (lines 939-940); `next` is the editor's `normalized` object, which the `saved` action also stores as `source` (`editor-history.ts:56-60`), so no reset. After the fix the next poll (equal) is skipped, which also removes today's reset 10 s after every save.
- Revision 0 (no DB row): equal to the initial `knownRevision`, so skipped; the default content stays. Correct.
- Dev (`next dev`) never purges the CDN copy; behaviour is unchanged.

**Verify.** Unit: updated `content-sync.test.ts`. Manual UAT (matches success criterion 1): open editor, edit a field, undo until clean (redo stack non-empty), wait 12 s, redo still works; then save from a second device and confirm the first tab updates within ~10 s.

### CONT-01 — limits raised, shared, never cut

**All caps found** (read this session, `lib/portia-content-normalize.ts` unless noted):

| Line | Quoted | Visible in editor? |
|------|--------|---------------------|
| 46 | `.runs.slice(0, 500)` | no |
| 57 | `text: run.text.slice(0, 100_000)` | no |
| 67 | `.slice(0, 1000)` (formatted-text keys) | no |
| 69 | `key.length > 240` drops the key | no (ids are `makeId`, short) |
| 78 | `value.trim().slice(0, 2048)` (media URL) | no; keep (URL sanity) |
| 95 | `item.conditions.slice(0, 4000)` | no |
| 124 | `asText(value.text, 20_000)` guide text block | **no, and absent from UI-SPEC table** |
| 129-130 | `.slice(0, 100)` rows; `asText(row.key, 500)`, `asText(row.value, 500)` | rows: no counter today; key/value: editor `maxLength={500}` (`portia-editor.tsx:1029-1030`) |
| 144 | `.slice(0, 100)` blocks | no |
| 146 | `asText(value.title, 300)` | editor `maxLength={300}` (`portia-editor.tsx:1017`) |
| 159 | `.slice(0, 50)` subsections | no |
| 182 | `virus.scientistLogs.slice(0, 5)` and `portia-editor.tsx:795` | yes, counter «n / 5» at `portia-editor.tsx:996` |

**Finding: plain guide text.** The text block's plain `text` is cut at 20 000 characters on every save, while its formatting (run text) is allowed 100 000. The UI-SPEC says the longest live run is 23 096 characters (2026-10-19 backup); a run that long cannot have been stored in a plain `text` field intact. Treat 20 000 as a limit to raise (suggest 200 000) and put in the shared constants. [ASSUMED] that the 23 096-char run belongs to a guide text block; the backup is outside git and was not opened.

**Contract that satisfies D-01, D-14, D-16, D-17 together** (this is a reading choice the planner should confirm, A1):
1. Define the constants once, exported from `lib/portia-content-normalize.ts`: UI-SPEC values `MAX_RICH_RUNS = 5000`, `MAX_RUN_CHARS = 1_000_000`, `MAX_FORMATTED_KEYS = 10_000`, `MAX_CONDITIONS = 40_000`, `MAX_TABLE_ROWS = 500`, `MAX_BLOCKS = 300`, `MAX_SUBSECTIONS = 150`, plus `MAX_BLOCK_TEXT = 200_000` (new, see above). Keep the editor-matched 500/300 field caps as named constants too (they already match `maxLength`).
2. `normalize*` stops slicing text, runs, keys, rows, blocks, subsections and conditions. It only coerces shape. (Server "never rejects and never truncates content over a limit".)
3. The editor imports the constants: visible limits drive the «+» disabled state and counter; invisible limits only drive the savebar warning.
4. Existing tests that assert cutting must be rewritten as "kept whole": `portia-content-normalize.test.ts` "unsafe media links and oversized logs are cleaned" (logs stay 5, see below), "quest dates … capped at 4000", "subsections and blocks are capped…" (the 20 000 text, the 300 title and 500 row cuts and the 50 count), "tables, blocks and rows beyond the caps are cut". Title/row `maxLength` stay editor-side.
5. Leave `scientistLogs` at 5 (visible, already UI-limited, not in D-14's list). Flag as A2.

**Derived UI helpers (pure, in `lib/content-limits.ts`):**
```ts
// Source: new; mirrors UI-SPEC "Visible limits: counter and caption (D-15)"
export type LimitStatus = "free" | "counter" | "full";
export function limitStatus(count: number, max: number): LimitStatus {
  if (count >= max) return "full";
  return count >= Math.ceil(max * 0.8) ? "counter" : "free";
}
```
Plus `oversizeFields(content): string[]` that returns field names in document order for the invisible limits. Formatted-text keys follow `portiaTextKey` (`lib/portia-content.ts:178-189`): `virus:<id>:external|physiology|ppu-*`, `virus:<id>:mutation:<i>:description`, `info:<id>:body`, `info-block:<id>:text`, `broadcast:<id>:body`, `recycle:<id>:content`, plus the fixed `search:`/`assistant:` keys, so a key-to-label map is small.

**Editor derivation points.** Rows: `portia-editor.tsx:1034` («+ СТРОКА»). Blocks: lines 1040-1043 (four buttons, disable together, one shared caption). Subsections: line 1047. The block edit helper `editTableRows` exists; do not add new mutation paths. Counter span always in DOM with `aria-live="polite"` and `aria-describedby` from each disabled button (UI-SPEC).

**Pitfall — the 2 MB body guard.** `app/api/content/route.ts:44` rejects `raw.length > 2_000_000` with 413 «Данные слишком большие.». With limits raised, this becomes the real ceiling, and the editor shows only a generic «ОШИБКА». `saveContent` carries a comment "Up to 2 MB" (`portia-desktop.tsx:924`). Options (Open Question 1): keep 2 MB and extend the savebar warning to cover `JSON.stringify(normalized).length > BODY_LIMIT` (same warning slot), or raise the guard (Netlify synchronous function payloads are commonly cited as 6 MB, [ASSUMED], verify before raising).

**Pitfall — D-17 idempotence.** Every coercion must be idempotent: `normalize(normalize(x))` deepEquals `normalize(x)`. The existing idempotence tests (`portia-content-normalize.test.ts` "stays idempotent …") already guard this; extend them to the new cases.

### CONT-02 / CONT-08 — odd data coerced, never crashes

**Defects.**
- `normalizeBroadcasts` (`portia-content-normalize.ts:87-97`) does `...item` then fixes only `important`, dates, conditions. `title`, `body`, `id`, `type`, `published` pass through unchecked. A `title: {}` reaches `{item.title || "БЕЗ НАЗВАНИЯ"}` at `portia-desktop.tsx:1283` and React throws "Objects are not valid as a React child".
- `normalizeVirus` (lines 175-188) spreads `...virus` and only fixes `infectedImage`, `mutations[].image`, `scientistLogs`. Strings, `ppu`, `classification` are unchecked.
- The cached-content load (`portia-desktop.tsx:456-458`) runs `isUsableContent` (does not require `recycledViruses`, lines 159-167) then only `normalizeBroadcasts` and `normalizeInfoSections`. `GET /api/content` already normalises (`route.ts:27`) so network content is covered once normalize is fixed; the cache is the unprotected path.
- `lib/editor-changes.ts:76` — `[...content.viruses, ...content.recycledViruses]` throws when `recycledViruses` is undefined (CONT-08). Other unguarded uses: `portia-editor.tsx:644` `draft.recycledViruses.find`, `:597`, `:1107`.

**Smallest fix.**
1. One helper in the normalize file:
```ts
// D-20: number/boolean -> text, anything else -> "" (never an object in a text slot)
const textOf = (value: unknown) =>
  typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : "";
```
2. `normalizeBroadcasts`: keep `...item` (nothing dropped, D-20 "other fields untouched"), then override `id` (D-21), `type` (only the three allowed values; else `"news"`), `title`, `body`, `published: item.published === true`, and keep the existing `important/startsAt/endsAt/conditions` lines. Items that are not objects are still dropped (existing test `important is a strict boolean and junk entries are dropped in order`).
3. `normalizeVirus`: coerce `id` (D-21), `code`, `name`, `status`, `external`, `physiology`, `ppu.{health,speed,abilities}`, each `classification.*`, `mutations[].{name,description}`, `scientistLogs[].{id,title,scientist}`; if `ppu`/`classification` is not an object use an empty record so desktop reads (`virus.ppu.health`) cannot throw. `lockedLevel`: finite number else keep current default behaviour (planner: confirm the desktop's fallback).
4. `desktop` cache load: replace the two partial normalisers with `normalizePortiaContent(parsed.content)`; if it returns `null`, ignore the cache. This also supplies `recycledViruses: []` and the other defaults (CONT-08).
5. `editor-changes.ts:76`: add `?? []` (belt and braces; D-22 names this file).
6. Optionally guard the unguarded editor reads with the same `?? []` where they take a draft that came straight from `content`.

**Ids (D-21).** Pattern 2 above. Stability across polls holds because the id depends only on the stored array position; after the first save the id is persisted. A numeric `id: 42` becomes `"42"` by the same `textOf` rule, a blank or whitespace id becomes derived. Reserved: the derived id must not equal an existing id in the same list.

**Pitfall.** A virus with a missing `id` currently produces formatted keys like `virus:undefined:external`; assigning an id at read does not migrate those keys. That is acceptable (nothing is lost, the formatting is simply not attached); mention in the plan's notes rather than build a migration.

**Verify.** Unit tests in `portia-content-normalize.test.ts`: `title: {}` to `""`, `title: 42` to `"42"`, missing/empty id gets `broadcast-<i>`, second normalise returns identical ids (idempotent), `important:true` on a quest (CONT-04) is cleared, virus with `ppu: null` ok. `editor-changes.test.ts`: `changedDossierTabs` with `recycledViruses` deleted from both copies must not throw.

### CONT-03 — permanent delete removes formatting

**Defects.** `portia-editor.tsx:642-648` `deleteSelectedRecycledVirus` only filters `recycledViruses`; the recycle-file delete button (`portia-editor.tsx:1198-1203`, «УДАЛИТЬ ЭТОТ ФАЙЛ») only filters `recycleFiles`. Orphans stay in `formattedText`, count toward the key cap and `sectionOfFormattedKey` (`editor-changes.ts:30-34`) mislabels `virus:*` orphans as «Корзина».

**Smallest fix.** Two functions in `lib/editor-items.ts`, in the style of `removeBroadcast`:
```ts
// Source: new, mirrors removeBroadcast (lib/editor-items.ts:15-18)
export function removeRecycledVirus(content: PortiaContent, id: string): void {
  content.recycledViruses = content.recycledViruses.filter((virus) => virus.id !== id);
  const prefix = `virus:${id}:`; // the trailing colon keeps "virus:ab:" from matching "virus:abc:"
  for (const key of Object.keys(content.formattedText)) if (key.startsWith(prefix)) delete content.formattedText[key];
}
export function removeRecycleFile(content: PortiaContent, id: string): void {
  content.recycleFiles = content.recycleFiles.filter((file) => file.id !== id);
  delete content.formattedText[portiaTextKey.recycle(id)];
}
```
Keep `next.recycleOrder = recycleKeys(next)` after each call as the handlers do now. Call `setFormatTarget(null); setFormatterOpen(false)` in both handlers, as `moveSelectedVirusToRecycle` does (`portia-editor.tsx:626-627`); otherwise the open format panel's stored commit writes the deleted key back (the repo already documents this at `:680-685`). Restore needs no change; it must not call these helpers.

**Copy.** Dialog text `portia-editor.tsx:1314`: add «вместе с оформлением» (UI-SPEC). The recycle-file button currently deletes with no confirmation; UI-SPEC only names the existing dialog, so leave that button's flow unchanged unless the planner wants parity (Open Question 4).

**Verify.** `lib/editor-items.test.ts`: delete removes `virus:<id>:*` including `…:mutation:0:description`, leaves a neighbour whose id is a prefix (`ab` vs `abc`), leaves `recycle:<id>:content` for other files; restore keeps keys (move to bin then back is a draft change and keys are untouched).

### CONT-04 — «ВАЖНО» only on news

**Defects.** Editor `portia-editor.tsx:1077` — `item.type = type;` (no `important` handling). Checkbox is `broadcast.type === "news"` only (`:1094`). Desktop `portia-desktop.tsx:1283` — `item.important ? " important" : ""` and `item.important ? " · ВАЖНО" : ""` for every type. `Broadcast["type"]` is `"quest" | "task" | "news"` (`lib/portia-content.ts:133`); `broadcastTabOf` maps everything except `"news"` to the quests tab (`lib/broadcasts.ts:7-9`), so tasks must also lose `important`.

**Smallest fix (three layers, all tiny).**
1. Editor: `item.type = type; if (type !== "news") item.important = false;`. Undo restores the whole previous object (history stores whole states), so D-19 "undo restores" holds; switching back does not set it (D-19).
2. `normalizeBroadcasts`: `important: item.type === "news" && item.important === true`. Existing test `normalizePortiaContent stays idempotent with old and new broadcasts` expects a news `important: true` to survive and a task to be `false`; both still pass.
3. Desktop render: `const important = item.type === "news" && item.important;` used for both class and suffix.

**Verify.** Unit tests for layer 2 (quest with `important: true` normalises to `false`; news keeps `true`). Layers 1 and 3 manual (editor type switch, desktop card).

### CONT-05 — undo/redo of a type change follows the card

**Defect.** `portia-editor.tsx:610-619` `step()` repairs selections and dispatches but never touches `broadcastEditorTab` (line 544) or `tab`. Undoing news-to-quest while the editor sits on the «Новости» sub-tab hides the card; if the user is on another top-level editor tab, nothing visible happens.

**Smallest fix.** A pure helper (testable, in `lib/broadcasts.ts`):
```ts
// Source: new; the first card whose tab category differs between two broadcast lists, or null
export function categoryChange(from: Broadcast[], to: Broadcast[]) {
  for (const next of to) {
    const before = from.find((item) => item.id === next.id);
    if (before && broadcastTabOf(before.type) !== broadcastTabOf(next.type)) return { id: next.id, tab: broadcastTabOf(next.type) };
  }
  return null;
}
```
In `step()` compute it from `draft.broadcasts` and `target.broadcasts`; if non-null: `revealBroadcast.current = { id, field: "type" }`, `setBroadcastEditorTab(tab)`, and `setTab("broadcasts")` (use `showTab("broadcasts")` only if `tab !== "broadcasts"`, because `showTab` resets `recordOpen`/preview state). The existing effect (`:702-710`) then focuses `[data-broadcast-type]`. For the scroll behaviour in UI-SPEC call `field.scrollIntoView({ block: "nearest", behavior: document.documentElement.dataset.motion === "full" ? "smooth" : "auto" })` after `focus({ preventScroll: true })`. Note the effect returns early when `tab !== "broadcasts"` without clearing the ref, so setting `tab` in the same step is required.

**Pitfall.** The id match is by id, so CONT-02's id derivation must run before this (ids are stable by D-21). Undo may also cross several non-type edits; the helper covers only the first type change, which matches "undo a type change".

### CONT-06 — end before start

**Defect.** `portia-editor.tsx:1089` only sets `min={broadcast.startsAt || undefined}` (picker hint, not enforced). Normalisation (`portia-content-normalize.ts:87-97`) does no ordering, and the desktop shows such a quest as `finished` forever (`lib/broadcasts.ts:18-21`).

**Smallest fix.**
- Pure `questDateError(item): boolean` — `item.type === "quest" && item.startsAt && item.endsAt && item.endsAt < item.startsAt` (ISO strings compare correctly; dates are strict `YYYY-MM-DD` after `normalizeDay`). Put it in `lib/broadcasts.ts` with tests.
- `Field` (`portia-editor.tsx:2295-2297`) gets optional `invalid`/`error` props (adds `.is-invalid` class and an error `<small id>` the input references via `aria-describedby`). Today `Field` wraps everything in a `<label>`, so the error line becomes part of the accessible label text unless it is rendered with `role`/`id` carefully; render the error as a sibling element after the `<label>` or use `aria-describedby` and accept the label inclusion. Planner decision.
- `const badQuests = draft.broadcasts.filter(questDateError)` computed in render.
- **Block inside `save()`** — `if (badQuests.length) return false;` as the first line after the `dirty` check. `save()` is also called by Ctrl+S (`:822`, via `actionsRef`) and by the «Закрыть редактор?» dialog button (`:1336-1340`), so only guarding the button is a bug. Also set `disabled` on the «СОХРАНИТЬ» button (`:1275`).
- Savebar message as a `<button>` in the `role="status"` paragraph (`:1268-1271`) that calls the same helper as CONT-05 to switch to «Сводка», select the quests sub-tab, set `revealBroadcast = { id, field: "endsAt" }`. `revealBroadcast`'s `field` type is `"title" | "type"` today (`:546`); extend it with a data attribute (`data-broadcast-ends`) on the end-date input, and extend the effect's selector ternary at `:706`.

**Pitfall.** The owner confirmed: block even for an already-stored bad quest (UI-SPEC). A saved but invalid quest blocks all other sections' saves until fixed, which is intended.

**Verify.** Unit: `questDateError` for equal dates (valid), only one date set (valid), reversed (invalid), `task`/`news` ignored. Manual: Ctrl+S with a bad quest does nothing and the message is visible.

### CONT-07 — correct quest status on first render

**Defect.** `portia-desktop.tsx:288` — `const [today, setToday] = useState("");`. `questState("", …)` returns `"upcoming"` for any dated quest (`"" < startsAt`). The clock effect calls `tick()` on mount (`:487-492`) which sets `today`, so the wrong value lasts only one render, but it is a real flicker whenever the quests UI renders before then.

**Smallest fix.** `useState(() => localDateKey(new Date()))` (`localDateKey` is already imported/defined in `lib/broadcasts.ts:12-15`). Hydration is safe: all windows start `open: false` (`portia-desktop.tsx:67-78`), so nothing on the server-rendered HTML depends on `today`; React state itself is not hydrated from HTML. The `!today` guards at `:537` and `:542` become always-true-on-client; they stay valid. Keep the 1 s `tick` for the midnight rollover.

**Verify.** Existing `broadcasts.test.ts` covers `localDateKey`/`questState`; the first-render claim is verified by reading plus a manual check (open the quests window straight after load). A held-out render test would need a DOM test harness that does not exist (`react-dom/server` plus `node --test` on a `.tsx` file is not supported by the strip-types runner), so this stays a manual check.

## BG-01 — Smooth wallpaper animation

### Current implementation (verified by reading)

- `components/portia-wallpaper.tsx` generates four drawings, each as one `<svg viewBox="0 0 1440 900" preserveAspectRatio="xMaxYMin slice">` (grid uses `900 + HELIX_LOOP`, line 187). Colour is `currentColor` of `.desktop-wallpaper` (`color: var(--teal)`, `app/portia.css:1305`).
- `webPaths()` (lines 12-41): hub `[1180, 170]`, 18 spokes with angle jitter `0.11 * Math.sin(index * 1.7)`, 15 rings at radius `34 * ring ** 1.18`; each ring is ONE closed path of 18 quadratic segments whose control point is the chord midpoint pulled 8% toward the hub. Crossings are exactly the ring's segment endpoints, so the walk graph is: node `(ring, spoke)`, edges along a spoke (radial segment) and along a ring (one Q segment). `webPaths()` returns only path strings today; the walk needs the points, so refactor it (or its twin in `lib/wallpaper-web.ts`) to export them.
- Motion today (`app/portia.css:1305-1346`): `web-sway` rotation on the whole web (24 s), dew twinkle, `helix-scroll` 90 s on the whole `<svg>`, `gel-glow` opacity on the glow group, `cells-drift` translate on the particle group, `particle-tumble` rotate on each virion. Reduced motion: `html[data-motion="reduce"] :is(.desktop-wallpaper, .desktop-wallpaper *) { animation: none !important; }` (line 1281).
- History: the helix was already moved to one composited layer in `de1f280 perf(03.1-03): composited seamless helix loop`, so the remaining judder is not the naive "animate paths" case.

### Helix judder (D-09): cause not confirmed here

I cannot run a browser trace in this session. Facts established by reading:
- Speed is 720 units per 90 s = 8 units/s (`app/portia.css:1322`), i.e. about 0.13 css px per 60 Hz frame at scale 1. Sub-pixel motion per frame is the worst case for snapping.
- Seam math is correct: the SVG box is `100% + 720*s` tall with `s = max(100cqw/1440, 100cqh/900)` and the slice scale equals `s` in both aspect cases (checked algebraically for H/900 ≥ W/1440 and the reverse), so a 720·s translate lands on an identical picture.
- The keyframe target uses container query units: `translate: 0 calc(-720 * max(100cqw / 1440, 100cqh / 900))` (line 1323). Whether Chromium keeps this on the compositor thread is [ASSUMED]; if it falls to the main thread, the desktop's 1 Hz `setClock`/`setToday` re-render of the 1 900-line `PortiaDesktop` (`:487-493`) would cause a visible hitch every second, which matches "judders on PC and phone".
- `.system-bar` is `background: oklch(.171 .016 var(--accent-hue) / 0.93)` with `backdrop-filter: blur(16px)` (`app/portia.css:94-107`). At 93% opacity the blur is nearly invisible, so removing it costs almost nothing visually and removes a per-frame re-sample of the moving layer.

**Plan task 1 (diagnosis, as UI-SPEC says):** a 10 s Performance trace on PC and on the owner's phone, checking (a) is the animation listed as compositor-driven, (b) long main-thread tasks every 1 s, (c) per-frame paint of the bar. MS Edge exists on this machine (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`) for a PC trace; Chrome is not installed. [VERIFIED: file listing]

**Cause-independent fixes, in order of cheapness** (apply what the trace supports):
1. Replace container-unit keyframes by a percentage: make the animated element `3 × period` tall (three stacked copies of the one-period drawing, viewBox `0 0 1440 720` each, or one SVG with three `<use>`), and animate `translate: 0 -33.3333%` (percent of its own box). 3 copies are needed because `2L ≥ H + L` (cover) holds only when `L ≥ H`, and `L = 720·s ≈ 0.8·H`. No `cq` unit inside the keyframe, a much smaller raster on high-DPR phones, and the loop seam is exact.
2. Drop `backdrop-filter` from `.system-bar` (keep a slightly higher background opacity).
3. Speed 12 units/s (60 s loop) per UI-SPEC; if the trace shows snapping, choose the speed so one frame moves a whole device pixel at the common DPRs, or keep `translate3d` with `will-change: transform`.

### «Паутина» (radar): spider walking on the web (D-04..D-08)

**The owner's SVG** (`09-spider.svg`, 17 286 bytes, `viewBox="0 0 649.5 768"`): classes `.cls-1 {fill: #00b396;}`, `.cls-2 {fill: #070707;}`, `.cls-3 {fill: #fdfdfd;}`; groups `Virus` (contains the empty `Virus-2`), eight leg groups with an inner same-named group each, and `Body` containing three-plus `cls-3` highlight paths and four `circle`s (`cls-2`). [VERIFIED: parsed this session]

**Finding: leg ids are inconsistent.** Computing path bounding boxes (control points included, approximate) gives:

| Outer group id | Inner id | y range | Real leg |
|----------------|----------|---------|----------|
| `Right_leg_1` | `Right_leg_1-2` | 0 to 320 | right 1 |
| `Right_leg_2-2` | `Right_leg_2-3` | 87 to 363 | right 2 |
| `Right_leg_2` | `Right_leg_3` | 356 to 619 | **right 3** |
| `Right_leg_4` | `Right_leg_4-2` | 415 to 768 | right 4 |
| `Left_leg_1..4` | `Left_leg_N-2` | 0-320, 87-364, 355-619, 415-768 | consistent |
Body: x 205 to 444, y 65 to 576 (centre about x 325). So the UI-SPEC gait list ("`Right_leg_2`, `Right_leg_4` …") must be assigned by geometry (order by y range), not by outer id. When inlining as JSX, rename the right-hand groups explicitly (`Right_leg_2-2` becomes leg 2, `Right_leg_2` becomes leg 3).

**Which end is the head:** not determinable from geometry alone (legs 1 reach y = 0, leg 4 reaches y = 768; the four body circles sit at y 352 to 368). UI-SPEC already says to decide from the render; do it with a throwaway render.

**Pivots.** Left legs extend to x ≈ 236 and 237 at the body side while the body begins at x ≈ 205; right legs start at x ≈ 412 to 436 while the body ends at 444. Pivot per leg = the point of the group nearest the body centre. Precompute these as constants (a one-off script), do not call `getBBox` at runtime.

**Colouring pitfalls.** `.desktop-wallpaper { fill: none; stroke: currentColor }` is inherited; every spider path needs `stroke: none` and an explicit fill. Rename classes (`wallpaper-spider-teal/-dark/-pale`) so the inlined `<style>` cannot leak. `fill: var(--desktop-base)` for `cls-2` works because `--desktop-base` is a `:root` custom property (`app/portia.css:17`, `59`).

**Architecture (recommended).**
- The spider is a sibling of the main `<svg>` inside `.wallpaper-layer`: an absolutely positioned wrapper `div` with `will-change: transform`, containing its own small inline `<svg viewBox="0 0 649.5 768">`. Moving the wrapper with `transform` costs no raster (compositor), whereas moving a `<g>` inside the big SVG re-rasters the old and new rectangles every frame, and SVG children cannot get their own compositor layer.
- Pixel mapping from viewBox units: `px = (x - 1440) * s + W`, `py = y * s`, `s = max(W/1440, H/900)` (xMaxYMin slice). Cache `W,H` with one `ResizeObserver` on the layer, never read layout in the loop. The rest pose can be placed by CSS alone with `cqw/cqh` (same units as `app/portia.css:1321`), so reduced motion needs no JS.
- Pulses are a pool of at most 8 short `<path>` overlays inside the main SVG (each about 120 units long, sampled polylines), not a dash window on the whole ring path: a ring path has a bounding box up to about 830 units, and updating a long path every frame invalidates a very large region of the full-screen layer. Short paths invalidate tiny regions.
- Walk geometry (pure, node-testable): build `nodes[ring][spoke]`, evaluate ring segments analytically: for a Q segment `B(t) = (1-t)²P0 + 2(1-t)tC + t²P1`, with `C` the sag control point from `webPaths()`; spokes are straight lines. This replaces `getPointAtLength` and makes "feet within 2 units of the thread" provable by a test.
- Rest crossing `(ring 5, spoke 3)` computes to about `(1313, 354)` (checked); it is visible on 390×844, 1366×768, 1920×1080 and 2560×1440. With the 40-unit margin, 80 crossings are visible on 390×844 and 136 on the desktop sizes (of 270), so the "fewer than 6 visible" fallback is a safety net, not a normal path.
- Loop control (`rAF`): start only when `kind === "radar"`, `document.visibilityState === "visible"` and motion is `full`. Resolve motion as `dataset.motion ? dataset.motion === "full" : !matchMedia("(prefers-reduced-motion: reduce)").matches` to mirror the CSS safety net; watch `data-motion` with a `MutationObserver` (it changes at runtime from `portia-desktop.tsx:706`). Clamp `dt` (for example to 50 ms) so a resumed tab does not teleport. Cancel the frame in the effect cleanup (React dev mounts effects twice).
- Legs: CSS keyframe `rotate` on each leg group with `alternate`, group B delayed by half a period, sign mirrored on the right, `animation-play-state` driven by an `is-walking` class on the wrapper. The existing reduced rule (`.desktop-wallpaper *`) does not cover a non-SVG sibling, so add the spider wrapper to the reduced-motion selector.
- Timeline from UI-SPEC applies unchanged (speed 36 u/s, 3-6 s pauses, 600 ms fade-in about 1.8 s after the web starts drawing, pulse model).
- `web-sway` is deleted: remove the keyframes (`app/portia.css:1316`) and the `html[data-motion="full"] .wallpaper-web` rule (`:1314`).

**Verify.** `lib/wallpaper-web.test.ts` (pure): graph has 270 nodes; sampled points on every edge lie on the drawn path within 2 units; target selection never returns the previous node, stays 2-4 hops, respects the visible-rectangle filter and the fallback; pulse pool never exceeds 8; same RNG seed gives the same walk. Then the owner's visual check.

### «Спирали ДНК» (grid)
See "Helix judder" above. Acceptance per UI-SPEC: 10 s trace on 60 Hz with no frame over 20 ms.

### «Гель» (gel)
- Bands today are static `<path>`s inside `<g mask="url(#wp-gel-mask)">` (`portia-wallpaper.tsx:199-206`); the mask fades the lower 45% of the gel.
- Cheapest creep: draw every non-ladder band at the lane top, share one keyframe (`from { translate: 0 0 } to { translate: 0 746px }`, user units because the element is inside the SVG), and encode each band's starting position as a negative `animation-delay = -(y - top) / 6` seconds. Duration `(bottom - top) / 6 ≈ 124 s`. Re-entry fade-in comes from a shared `opacity` keyframe on a per-band wrapper `<g>`, because the band's own `opacity` is set inline for its strength. Lane 0 (ladder) and its labels stay static. Lanes 3 and 4 add a lane-specific delay offset so the replicates do not move in lockstep.
- Glow: factors in lines 204 (`band.weight * 2.2`, `band.opacity * 0.08`) go to 3 and 0.16; `gel-glow` 12 s to 8 s (`app/portia.css:1332`).
- Cost caution: animating about 50 children inside a masked group repaints through the mask on the main thread each frame. Acceptable on a desktop; measure on the phone. Fallback lever: fewer animated bands, or move the mask to the wrapper layer in CSS.

### «Клетки» (cells)
- `cellField()` (lines 106-161) concatenates all walls into `walls`/`sick` and all nuclei into `nuclei`/`sickNuclei`. It must return per-cell records `{ x, y, wall, nucleus, infected }` (the `cellOf(site)` and nucleus strings already exist per site inside `sites.forEach`).
- Per-cell `<g>` with `transform-box: fill-box; transform-origin: center`. Pass seeded parameters through inline custom properties and keep one set of shared keyframes using `var()`, so the CSS stays small. Neighbour anti-phase per UI-SPEC (phase from the parity of the angle of the seeded position).
- Cost: this is the heaviest item. The cell field is about 1 200 units across, and CSS animation of SVG children is painted on the main thread. UI-SPEC already limits animation to the sharp-zone cells (about 60%) and says "reduce the count first, never the amplitude". If a phone trace still fails, the fallback is HTML-composited cells inside a `clip-path` plus radial `mask-image` container.
- Virions: replace the group-level `cells-drift` with per-virion drift plus the existing `particle-tumble` (`app/portia.css:1343-1346`).
- Keep `html[data-motion="reduce"]` coverage: all new elements are inside `.desktop-wallpaper`, so line 1281 already stops them.

## Common Pitfalls

### Pitfall 1: Guarding save on the button only
**What goes wrong:** Ctrl+S or the close dialog saves an invalid quest. **Why:** `save()` is called at `portia-editor.tsx:822` and `:1336-1340`. **Avoid:** the guard is the first statement of `save()`. **Warning sign:** the test "Ctrl+S with a bad quest" is skipped.

### Pitfall 2: Spider paths inherit web styling
**What goes wrong:** spider drawn dashed, faint and animating a draw-in. **Why:** `.wallpaper-web path` at `app/portia.css:1307`. **Avoid:** sibling placement; explicit `stroke: none`, `animation: none`, `stroke-dasharray: none`, own `opacity`.

### Pitfall 3: Mislabelled leg groups
**What goes wrong:** the gait pairs the wrong legs. **Avoid:** assign by y range (table above), not by outer id.

### Pitfall 4: Normalize that cuts again
**What goes wrong:** a later "tidy up" restores a `.slice`. **Avoid:** a test that a 600-run text, a 1 200-key map, 150 table rows and a 25 000-char guide block survive, and that normalize is idempotent.

### Pitfall 5: Derived ids containing `:`
**What goes wrong:** `virus:<id>:field` keys split wrongly (`editor-changes.ts:34-37`). **Avoid:** `-` only.

### Pitfall 6: Stale format panel after delete
**What goes wrong:** the open panel writes the deleted text key back. **Avoid:** `setFormatTarget(null)` plus `setFormatterOpen(false)` in both delete handlers.

### Pitfall 7: React Compiler lint in a new effect
**What goes wrong:** `react-hooks` errors on synchronous `setState` in an effect or reading refs during render. **Avoid:** DOM/ref mutation inside the rAF loop; wrap unavoidable state writes in `setTimeout(…, 0)` like the existing effects.

### Pitfall 8: rAF after unmount or while hidden
**Avoid:** cancel in cleanup; pause on `visibilitychange`; clamp `dt`; the crossfade keeps the leaving layer's DOM for 500 ms (`WALLPAPER_FADE_MS`), so the loop of the leaving spider may run 500 ms longer, which is harmless.

### Pitfall 9: The 2 MB body guard
See CONT-01.

## Code Examples

### Equal revisions are not news (SYNC-01)
```ts
// Source: lib/content-sync.ts:3 today reads `revision >= knownRevision`; change to strict.
export function acceptFetchedContent(revision: number, knownRevision: number, savesAtSend: number, savesNow: number): boolean {
  return savesAtSend === savesNow && revision > knownRevision;
}
```

### Lazy `today` (CONT-07)
```tsx
// Source: components/portia-desktop.tsx:288 today reads useState("")
const [today, setToday] = useState(() => localDateKey(new Date()));
```

### Cached content through the shared normaliser (CONT-02/08)
```tsx
// Source: replaces portia-desktop.tsx:456-458
const cachedContent = normalizePortiaContent(parsed.content);
if (cachedContent) { setContent(cachedContent); /* then the existing revision / selection repair lines */ }
```

### Counter and caption markup (D-15)
```tsx
// Source: pattern at components/portia-editor.tsx:996 (.scientist-log-actions)
const status = limitStatus(rows.length, MAX_TABLE_ROWS);
<div className="scientist-log-actions">
  <button className="secondary-control" type="button" disabled={status === "full"} aria-describedby={id} onClick={addRow}>+ СТРОКА</button>
  <span id={id} aria-live="polite" className={status === "full" ? "limit-caption" : undefined}>
    {status === "counter" ? `${rows.length} / ${MAX_TABLE_ROWS}` : status === "full" ? `МАКСИМУМ ${MAX_TABLE_ROWS}` : ""}
  </span>
</div>
```

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Server slices over-limit text (`.slice` caps) | Constants for UI only, normalize coerces shape and keeps content whole | Satisfies D-01/D-16/D-17 |
| Whole-web rotation `web-sway` | Static web plus a spider and thread pulses | D-04 |
| Animating SVG children for everything | Compositor-moved HTML layer for the spider and the helix; SVG child animation only where unavoidable (gel, cells) | Smoothness on phones |

**Deprecated/outdated:** the `>=` rationale in `content-sync.ts` comment and its test; the 20 000/100/50/500/1000/4000 caps in normalize; the idea (PROJECT.md Out of Scope: "SVG-паук вместо PNG") applies to the boot screen, which stays PNG (D-08); the wallpaper spider is a new, owner-supplied asset, not a conflict.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Reading of D-01/D-16/D-17 that normalize must stop cutting everywhere (constants drive UI only) | CONT-01 | If the owner expects the server to cap at the new large numbers, a bounded server cap is added; low cost either way |
| A2 | `scientistLogs` stay capped at 5 (visible, UI-limited, not in D-14) | CONT-01 | If the owner wants it raised, one more constant and tests |
| A3 | The 23 096-character run in the backup belongs to a guide text block, so the 20 000 plain-text cut is a live data-loss path | CONT-01 | If not, the 20 000 cap is still an unlisted silent cut, same fix |
| A4 | Netlify synchronous function payload ceiling is about 6 MB | CONT-01 | Raising the 2 MB guard past the platform limit would fail at the edge; verify before raising |
| A5 | Container-unit keyframes (`cqw`/`cqh`) may keep `helix-scroll` off the compositor thread, and the 1 Hz desktop re-render may hitch it | BG-01 | The trace decides; the percent-translate tile fix is safe regardless |
| A6 | Per-cell SVG `<g>` CSS animation (about 90 elements) holds 60 fps on the owner's phone | BG-01 | Fallback levers listed (fewer animated cells, HTML-composited cells) |
| A7 | Gel with about 50 animated children under an SVG mask is cheap enough | BG-01 | Same fallback approach |
| A8 | Path bounding boxes for the spider legs (control points included) are accurate enough to tell legs apart | BG-01 | Pivot constants must be re-measured; the id-mislabel finding itself is unaffected |

## Open Questions

1. **Server body ceiling (2 MB)**
   - Known: `route.ts:44` returns 413 above 2 000 000 characters; limits are being raised ×10.
   - Unclear: whether live content is anywhere near that; what the platform allows.
   - Recommendation: keep the guard, show the existing savebar warning when `JSON.stringify(normalized).length` approaches it, and decide separately whether to raise it (A4).

2. **Block text limit** — suggest `MAX_BLOCK_TEXT = 200_000`; add to the UI-SPEC table (it is missing there).

3. **Scientist-log cap** (A2) — confirm leave at 5.

4. **Recycle-file delete without confirmation** — the file delete (`portia-editor.tsx:1198`) has no dialog while the virus delete has one. UI-SPEC only edits the virus dialog copy. Confirm whether to add parity.

5. **Which end of the spider is the head** — decide from a render during implementation (UI-SPEC already says so).

6. **First reduced-motion rest pose for the spider** — drawn at the rest crossing with legs neutral; confirm legs' neutral = unrotated artwork.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | tests, build | yes | 24.21.0 local; Netlify 22.13.0 | — |
| npm / node_modules | all | yes | installed | — |
| MS Edge | PC performance trace | yes | `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` | owner's browser |
| Chrome | trace | no | — | Edge |
| Playwright / jsdom / vitest | UI tests | no | — | node unit tests for pure `lib/` code plus manual owner checks |
| Dev server | manual checks | yes | `.claude/launch.json` runs `npm run dev -- -p 3123` | — |
| Owner's phone | BG-01 acceptance | owner only | — | none (success criterion 6 is the owner's check) |

**Missing with no fallback:** none blocking planning. BG-01 frame-rate acceptance depends on the owner's devices.

## Validation Architecture

`workflow.nyquist_validation` is `false` in `.planning/config.json`, so this section is informational (requested by the orchestrator) rather than a gate.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` with `--experimental-strip-types`, tests in `lib/*.test.ts` |
| Config file | none (script in `package.json`) |
| Quick run command | `npm test` (same as `node --experimental-strip-types --test lib/*.test.ts`) |
| Full suite command | `npm test && npx tsc --noEmit && npx eslint app lib components && npm run build` (`npm run check` runs test, build and lint) |

**Baseline measured this session:** `npm test` 253 tests, 253 pass, 0 fail, about 0.5 s. `npx tsc --noEmit` clean (no output). `npx eslint app lib components` 0 errors, 14 warnings (all `@next/next/no-img-element`). `npm run build` not run here.

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SYNC-01 | equal revision dropped, newer taken, 409 reset still accepts | unit | `node --experimental-strip-types --test lib/content-sync.test.ts` | exists, rewrite one case |
| CONT-01 | nothing cut; idempotent; `limitStatus`; `oversizeFields` | unit | `node --experimental-strip-types --test lib/portia-content-normalize.test.ts lib/content-limits.test.ts` | normalize exists (rewrite 4 cases); `content-limits` new (Wave 0) |
| CONT-02 | wrong types coerced; ids derived, stable | unit | same normalize test file | extend |
| CONT-03 | delete removes `virus:<id>:*` and `recycle:<id>:content` only | unit | `node --experimental-strip-types --test lib/editor-items.test.ts` | exists, extend |
| CONT-04 | `important` cleared off news | unit (normalize) + manual (editor, desktop) | normalize test file | extend |
| CONT-05 | `categoryChange` | unit | `node --experimental-strip-types --test lib/broadcasts.test.ts` | exists, extend |
| CONT-06 | `questDateError` | unit + manual (Ctrl+S, message jump) | `lib/broadcasts.test.ts` | extend |
| CONT-07 | first-render state | manual | dev server | n/a (no DOM harness) |
| CONT-08 | `changedDossierTabs` with `recycledViruses` missing | unit | `node --experimental-strip-types --test lib/editor-changes.test.ts` | exists, extend |
| BG-01 | graph/Bézier/walk/pulse pool | unit | `node --experimental-strip-types --test lib/wallpaper-web.test.ts` | new (Wave 0) |
| BG-01 | 60 fps, no judder, reduced motion still | manual trace + owner check on PC and phone | Edge DevTools Performance; Settings > Анимации | n/a |

### Sampling Rate
- **Per task commit:** `npm test` (about 1 s) and `npx tsc --noEmit` (about 6 s).
- **Per wave merge:** add `npx eslint app lib components` (about 45 s).
- **Phase gate:** full suite plus `npm run build` green, then the owner's UAT (BG-01 on PC and phone; undo survives a 12 s wait).

### Wave 0 Gaps
- [ ] `lib/content-limits.ts` and `lib/content-limits.test.ts`
- [ ] `lib/wallpaper-web.ts` and `lib/wallpaper-web.test.ts`
- [ ] Update the five normalize tests that assert cutting and the equal-revision sync test
- [ ] No component/DOM test infrastructure exists; do not plan automated UI tests, plan manual UAT lines instead

## Security Domain

`security_enforcement` is enabled (`config.json`: `true`, ASVS level 1, block on high).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no (unchanged) | — |
| V3 Session Management | no | — |
| V4 Access Control | no (PUT already gated by `getEditorAccess`, `route.ts:36-41`) | unchanged |
| V5 Input Validation | yes | `normalizePortiaContent` on PUT and GET, plus now on the cache read; type coercion (D-20) |
| V6 Cryptography | no | — |

### Known Threat Patterns
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tampered `localStorage` content cache crashing or injecting through the desktop | Tampering / DoS | route the cache through `normalizePortiaContent` (closes the unprotected path) |
| Oversized body | DoS | keep the 2 MB request guard (`route.ts:44`) now that per-field caps no longer bound size |
| Non-string values reaching React children (`title: {}`) | DoS (site crash) | `textOf` coercion on read and save |
| Inline SVG injection | Tampering | the spider SVG is a static, repo-owned asset inlined as JSX; no runtime string-to-markup |
| Unbounded rendering work from huge stored arrays | DoS | accepted trade-off of D-01; bounded by the body guard |

## Sources

### Primary (HIGH confidence)
- Live repository files read this session: `lib/content-sync.ts` and test, `lib/portia-content-normalize.ts` and test, `lib/portia-content.ts`, `lib/editor-history.ts`, `lib/editor-items.ts`, `lib/editor-changes.ts`, `lib/broadcasts.ts`, `lib/accent-boot.ts`, `app/api/content/route.ts`, `components/portia-desktop.tsx` (poll, cache, save, render), `components/portia-editor.tsx` (history, save, handlers, forms), `components/portia-wallpaper.tsx`, `app/portia.css` (wallpaper, savebar, controls), `.planning/phases/PORTIA-09-tselostnost-kontenta/09-spider.svg`, `package.json`, `netlify.toml`, `.planning/config.json`.
- Commands run this session: `npm test` (253/253), `npx tsc --noEmit` (clean), `npx eslint app lib components` (0 errors, 14 warnings), a numeric check of web crossings and visibility, an SVG group/bbox parse.

### Secondary (MEDIUM confidence)
- `.planning/research/FEATURES.md` per-finding locations (its line numbers had drifted; all locations re-derived from live code).

### Tertiary (LOW confidence)
- Compositor behaviour of container-unit keyframes, SVG-child animation cost, and the Netlify payload limit: training knowledge, not verified in this session (A4 to A7).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH, no changes, versions read from `package.json`.
- Content requirements (SYNC, CONT): HIGH, defects located by reading and fixes reuse existing helpers.
- Wallpaper architecture: MEDIUM, sound design, performance unproven without a trace.
- Pitfalls: HIGH for save-path, id, style-inheritance and mislabelled-leg findings (all read directly).

**Research date:** 2026-10-25
**Valid until:** 2026-11-24 (stable repo; re-check line numbers if `portia-desktop.tsx` or `portia-editor.tsx` changed in Phase 8 follow-ups)
