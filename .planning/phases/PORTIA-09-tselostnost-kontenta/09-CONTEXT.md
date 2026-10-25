# Phase 9: Целостность контента - Context

**Gathered:** 2026-10-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Content is never lost silently: the 10 s poll does not reset undo history, limits never cut text, permanent delete and type change leave no junk, odd stored data is coerced instead of crashing the site (SYNC-01, CONT-01..08). Plus the owner request BG-01: the desktop wallpapers animate smoothly and visibly — the **first plan of the phase**. CONT-09 (`//host`) is Phase 12, not here.

</domain>

<decisions>
## Implementation Decisions

### Carried forward (locked earlier, not re-asked)
- **D-01:** Limits are raised and shared by editor and server (one set of constants). At the limit the «+» button is disabled with a caption. The server never rejects and never truncates content over a limit (owner decision, REQUIREMENTS Out of Scope).
- **D-02:** Content poll stays every 10 s while the tab is visible (03.2-07). An unchanged revision must not produce a new `content` object (no `setContent`, no editor re-sync), so undo/redo survives; a newer revision from another device still arrives within ~10 s. See `acceptFetchedContent` in `lib/content-sync.ts` (currently `>=`).
- **D-03:** «Анимации: Выключены» keeps every wallpaper still and fully drawn (existing rule, `app/portia.css` `html[data-motion="reduce"]`). The new spider and cell motion must obey it too.

### Фон: паутина и паук (BG-01)
- **D-04:** The current web sway (`web-sway`, a small rotation) reads as jerky side-to-side twitching and is replaced. The «Паутина» wallpaper (`radar`) gets a real spider walking on the web, drawn from the owner's SVG `.planning/phases/PORTIA-09-tselostnost-kontenta/09-spider.svg`.
- **D-05:** The spider walks along threads to a new point, stops for a few seconds, then walks on ("ходит и замирает"). While walking it sends visible waves along the threads it touches.
- **D-06:** Legs move as whole pieces, swinging from their base (alternating gait). The SVG has 8 separate leg groups (`Left_leg_1..4`, `Right_leg_1..4`) plus `Body`; legs are not split into segments, and the owner accepted that. The empty `Virus` group is ignored.
- **D-07:** Spider colours follow the theme: the teal parts (`cls-1`, `#00b396`) become the accent (`currentColor` / `--teal`); the near-black parts (`cls-2`) become the desktop background colour and follow it when the desktop colours change; the white parts (`cls-3`) become a pale accent tint. No hard-coded colours remain.
- **D-08:** Same silhouette as the boot spider (owner: «тот же силуэт»). Whether the boot screen also switches from its PNG to this SVG is Claude's discretion; it is not required.

### Фон: ДНК, гель, клетки (BG-01)
- **D-09:** The DNA helix judders everywhere (PC and phone), not only at the loop seam. Fix the cause so the scroll is smooth on both; the likely suspect is translating the whole tall SVG (`.desktop-wallpaper-grid`, `helix-scroll`), but the researcher must confirm.
- **D-10:** Gel: the bands slowly creep down the lanes like real electrophoresis and fade back in at the top, plus a more visible glow than today's `gel-glow`.
- **D-11:** Cells are alive: the cells themselves drift slowly, change shape slightly and push their neighbours apart; the virus particles float between them (today only the particles spin, `particle-tumble`, and the group drifts a few px).
- **D-12:** Strength for every wallpaper: visible within 2–3 seconds of looking, but slow and calm, so reading is not disturbed.
- **D-13:** Same animation on every device, no reduced phone variant. A weak phone can turn animations off in Settings. It must still be smooth on the owner's PC and phone (success criterion 6).

### Лимиты (CONT-01)
- **D-14:** Raise limits with a large margin. Invisible limits (rich-text runs per text, now 500; formatted-text keys, now 1000; text length 100 000; quest conditions 4000) go up ×10 or more, so they are practically never reached. Visible counts (table rows, now 100; blocks, now 100; subsections, now 50) go up ×2…×5. Exact numbers are Claude's choice, sized from the current live content with headroom.
- **D-15:** Visible limits show a counter only near the limit: from 80% a «180 / 200» counter appears next to «+»; at the limit «+» is disabled and captioned «МАКСИМУМ 200». Matches the existing «3 / 5» scientist-log pattern in `components/portia-editor.tsx`.
- **D-16:** If an invisible limit is reached anyway, the save still goes through whole (nothing is cut) and a clear warning near «СОХРАНИТЬ» names the field that is too large.
- **D-17:** Existing documents save whole; saving again without edits must not change the data.

### Квест: даты и «ВАЖНО» (CONT-04, CONT-06)
- **D-18:** End date before start: the end field is highlighted in red with «Окончание раньше начала», and saving is blocked with a message to fix it. No automatic swap. This is an editor check; the server still does not reject (D-01). An already-stored bad quest is shown as is and flagged when opened in the editor.
- **D-19:** A news item changed to a quest loses `important`; quests never show «ВАЖНО» on the desktop. Changing back to news does not restore it; the editor sets it again. Undo of the type change still restores the full previous state.

### Странные данные (CONT-02, CONT-08)
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope
- `.planning/ROADMAP.md` — Phase 9 goal, success criteria 1–6
- `.planning/REQUIREMENTS.md` — BG-01, SYNC-01, CONT-01..08 (CONT-09 is Phase 12)
- `.planning/research/FEATURES.md` — per-finding code locations for 03.1-WR-04/07/08/09/12, IN-08, 03.2-WR-01, IN-04, IN-05, 03.3-WR-01

### Owner assets
- `.planning/phases/PORTIA-09-tselostnost-kontenta/09-spider.svg` — owner's spider, 8 leg groups + body, colours `cls-1`/`cls-2`/`cls-3` (see D-06, D-07)

### Earlier decisions
- `.planning/PROJECT.md` — Key Decisions and Known Limitations
- `.planning/phases/PORTIA-08-sotrudniki-bez-poter-na-ekrane/08-CONTEXT.md` — D-04 pattern (draft not replaced by a server answer), same behaviour expected from the content editor

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `components/portia-wallpaper.tsx`: all wallpapers as generated SVG in `currentColor`; `seeded()` RNG; `webPaths()` (web hub at 1180,170, 18 spokes, 15 rings) gives thread geometry the spider can walk on; `cellField()` builds Voronoi cells (static paths today, would need per-cell elements to move).
- `app/portia.css` ~1298–1346: wallpaper styles and keyframes (`web-sway`, `helix-scroll`, `gel-glow`, `cells-drift`, `particle-tumble`); `html[data-motion]` gates.
- `lib/content-sync.ts` `acceptFetchedContent`: the place to skip equal revisions.
- `lib/portia-content-normalize.ts`: all caps (`slice(0, 500)`, `100_000`, `1000`, `4000`, `100`, `50`) live here; becomes the home of shared limit constants.
- Scientist-log «+ ДОБАВИТЬ ЗАПИСЬ» with `disabled` and «n / 5» counter in `components/portia-editor.tsx` (~996): the pattern for D-15.

### Established Patterns
- Wallpaper motion runs only under `html[data-motion="full"]`; reduced motion shows the still drawing.
- Wallpaper crossfade keeps the outgoing layer's DOM for 500 ms (`DesktopWallpaper`).
- Server `PUT /api/content` runs `normalizePortiaContent`, so normalize must stay non-destructive (D-01, D-17).

### Integration Points
- `components/portia-desktop.tsx`: poll (`contentSyncMs`, ~380 `setContent(fetched)`), cached content load (~455), quest `today` state, «ВАЖНО» rendering.
- `components/portia-editor.tsx`: type change handler, recycle delete, undo `step`, `broadcastEditorTab`, add-buttons for rows/blocks/subsections.
- Hot files: `portia-desktop.tsx` and `portia-editor.tsx` are edited strictly in sequence. The wallpaper plan touches `portia-wallpaper.tsx` / `portia.css` only and can go first.

</code_context>

<specifics>
## Specific Ideas

- Owner on the web: today it is «дерганная и похоже совсем не анимированная кроме дерганий из стороны в сторону»; the new motion should not get in the way but be visible and clearly readable.
- The spider makes waves along the threads as it walks.
- Owner verifies BG-01 personally on PC and phone.

</specifics>

<deferred>
## Deferred Ideas

None. Discussion stayed within phase scope. (The empty `Virus` group in the spider SVG may hint at a future idea; not part of this phase.)

</deferred>

---

*Phase: 09-Целостность контента*
*Context gathered: 2026-10-25*
