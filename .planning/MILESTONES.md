# Milestones

## v1.0 Доработка (Shipped: 2026-10-19)

**Phases completed:** 7 phases, 43 plans, 23 tasks (Phase 4 skipped by owner)
**Closeout:** override_closeout — no milestone audit; phases 1–03.3 verification stale
**Known verification overrides:** 2 newly acknowledged, 0 carried forward (debug `editor-field-font-wysiwyg` diagnosed; Phase 5 UAT diagnosed, 0 pending)
**Git:** 5aa1105 → 96c582f (2026-10-06 → 2026-10-19)

**Key accomplishments:**
- User's zoom/Dark Reader WIP landed as its own commit, embedded documents pinned to an absolutely positioned viewport so they fill the window at any zoom, and the legacy serif replaced by next/font IBM Plex Serif behind a `--serif` token.
- Drag handle reduced to a bare ≡ at the start of every sortable row, Корзина files and viruses open across the whole window (`is-viewing`), and the Roblox profile is reached only through the small portrait anchor.
- `metadata.other["darkreader-lock"]` changed from `""` to `"true"` so Next 16.3.4 emits the meta tag; verified in the production build head.
- Each editor text field now shares one CSS font rule with the site area that displays its text, via a typed `area` prop rendered as `data-area`; the БЕЛЫЙ/ЧЁРНЫЙ toggle no longer touches the font.
- One `--accent-hue` number per theme now drives 391 OKLCH tints and 27 glows in `app/portia.css`, CSS filter tokens recolour the spider and Vivian, and a whitelisted head script applies the saved accent before first paint.
- A static sketch board (02-SKETCHES.html, no script, no network) showed two variants of each new SVG in production geometry and all four accents; the user chose gel A, cells B, badge set B and lock A for plan 02-06.
- The interface now renders in self-hosted IBM Plex Mono with Cyrillic, long document texts keep Golos (new `--doc`) and scientist records Plex Serif, the two retired faces and weight 800 are gone, and Vivian got a centred Plex Mono 500 name label plus even saturation in every theme.
- A single motion language for PORTIA OS: windows zoom from icons and scale into the taskbar, documents print out, every app icon acts out its own hover, the taskbar hops and reorders by drag, data shows a loader only while it is actually loading, the web wallpaper keeps living — all switchable through a new «Анимации» setting that follows the system by default.
- The boot spider now waits for its image and descends while four terminal lines type under it, and Vivian became a character: she leaps on her own phrases, squashes harder (and finally shakes her head) as clicks annoy her, sulks turned away and grey, glances back before turning round, and perks up when hovered.
- Two lab wallpapers, a web that keeps living after it is spun, badges on every classification line and padlocks on scientist records; plus the checkpoint fixes: the restore that silently did nothing, and Vivian jittering under a cursor at her edge.
- Editor draft now lives in a pure undo-history reducer; a bottom bar names the unsaved sections, offers step undo, a confirmed discard in a native PORTIA dialog and the save, and tabs with unsaved edits carry an amber dot.
- Ctrl/Cmd+S saves and Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y step the shared history on any keyboard layout while the editor is the active window; closing with unsaved edits asks in a PORTIA dialog, reload warns, and the last two native confirm prompts are gone.
- At 900px and below every list + form section of the editor becomes list then full-width record with «← К списку», the header collapses so the tabs come first, and the format panel takes the keyboard's place with the selected text kept marked above it.
- Virus dossiers split into four tabs with amber unsaved dots (live and bin), and the ≡ reorder rebuilt as gel lanes: lit band, positions, midpoint hysteresis, edge autoscroll, arrow keys and one undo step per drag.
- The ≡ reorder drag now tracks the pointer on window, not through pointer capture, so one hold can go up and back down. Every row move slides over 160 ms with a per-row FLIP, and is skipped under reduced motion.
- Editors add a person outside the Google Sheet by Roblox nickname (typed Звание/Ранг/Позывной), the person is listed after the sheet staff with a «ВНЕ ТАБЛИЦЫ» mark, gets photo (link or upload), ratings and biography through the existing profile save, and can be removed; sheet employees cannot. The code works before the table exists.
- A «Информация» category now holds up to 50 ordered subsections made of text and «признак — значение» table blocks in any order, edited and reordered in the editor, opened from a tree on the desktop and found by global search; pre-03.3 flat sections normalize to `subsections: []` unchanged.
- Guides in «Информация» now mix text, tables, uploaded photos and YouTube videos in any order: an editor pastes a YouTube link (only the 11-character id is kept), readers play it inline from youtube-nocookie.com and can open it on youtube.com; photos go through the same /api/uploads path as other site images.
- The owner approved and applied the manual-employees SQL in production; adding, editing and removing people outside the sheet works live.

---
