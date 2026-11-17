# Phase 26: Единый стиль сайта - Context

**Gathered:** 2026-11-16
**Status:** Ready for planning

<domain>
## Phase Boundary

The whole site reads as one PORTIA OS in style direction C (Phase 22): one corner rule via shared `--radius-*` tokens guarded by a test; the same buttons, plaques, fields and tabs on the desktop, in apps and in every editor tab; one editor-tab layout; close cross in the very corner of the window; a maximized window that uses the area without stretched controls or empty bands; redrawn classification icons (except «Способ распространения») after the owner picks a variant; compact «Информация» sections button on phone; one JS rule for shortcut labels at 521–900px; known axe findings fixed and contrast checked on all accents; the 2026-10-28 desktop regressions re-checked on current code and the live ones fixed (UI-02 … UI-11).

Out of boundary: new capabilities, palette/font/spacing/animation changes (direction C changes only radii and the look of buttons, plaques, tabs and windows), physical-device acceptance (Phase 27), Phase 25 gap closure (separate track).

</domain>

<decisions>
## Implementation Decisions

### Carried forward (locked earlier, not re-asked)
- Style direction **C** (owner, 2026-11-12, `22-STYLE-DIRECTION.md`): windows and dialogs soft 10px; editor tabs, buttons and fields sharp 0; plaques/status badges pill 999px (dots stay 50%); cards/list rows 7px. Values come from the table in `22-STYLE-DIRECTION.md`; tokens `--radius-*` already exist in `app/portia.css:80-85` at today's values.
- Only radii and the look of buttons/plaques/tabs/windows change; colours, fonts, spacing and animations stay.
- At most one redo per screen (D-71 8а).
- Visual changes are reported to the owner as text (no `review.html` galleries, no per-hash ledger, no Figma).
- Promotion template export classes `level-1..3` must not break; access levels use separate `access-level-*` classes.
- Never run `scripts/phase15-visual-manifest.mjs --verify` (default mode).
- If the phase adds SQL — `supabase-rls-reviewer`.

### Развёрнутое окно (UI-06)
- **D-01:** In a maximized window, lists (e.g. «Доступные записи» in global search, record lists) become an auto-fill grid of cards: as many columns as fit (2–4 on wide screens), one column in a normal-size window.
- **D-02:** Buttons keep their content width and never stretch. Text inputs are capped at a comfortable width (~640px). Editor forms switch to two columns where the window is wide enough.
- **D-03:** A maximized window differs from a normal one only in layout: the 8px inset from screen edges and the 10px window radius (direction C) stay as today (`.app-window.is-maximized`, `app/portia.css:260`).
- **D-04:** Audit scope = all windows and apps: every one is checked maximized on a wide screen and fixed under D-01/D-02.

### Иконки классификации (UI-07)
- **D-05:** 15 icons to redraw: groups danger, spread, escapeRisk, mind, appearance × 3 levels (`classificationIcon` in `components/portia-icons.tsx:131`); `route-*` («Способ распространения») untouched. Current icons are 24×24 line SVG.
- **D-06:** Variants are shown to the owner on ONE private claude.ai artifact page (not a repo gallery, not a hash ledger): all 15 icons per style on the site's dark background, link given in chat.
- **D-07:** Three styles are shown: **А** thin line like today but with a solid recognizable silhouette; **Б** filled with cut-outs (reads as a sign); **В** sign inside an emblem frame (rhombus or circle), like a department patch.
- **D-08:** Inside a group the three icons share one base shape; the level (1/2/3) is shown by a common mark — number of notches/dots.
- **D-09:** One round: the owner picks a style (А/Б/В); all 15 are drawn in it and the result is shown as text plus the same artifact page. A second showing only if something is clearly wrong (fits 8а). No drawing before the owner's pick — blocking owner checkpoint in the plan.

### Порядок экранов и правило «одна переделка»
- **D-10:** A «screen» for the one-redo rule = each window/app and each editor tab separately («Справочник», «Повышение», «Пользователи» are three screens). A complaint redoes only that screen.
- **D-11:** Order: (1) tokens and shared elements — corners, buttons, plaques, fields, tabs, close cross in the corner (UI-02, UI-03, UI-05); (2) window frame and maximized layout (UI-06); (3) editor tabs to one layout (UI-04); (4) access/request screen and «Пользователи»; (5) phone — «Информация» and labels 521–900px (UI-08, UI-09); (6) icons after the owner's pick (UI-07), axe and regressions (UI-10, UI-11).
- **D-12:** Editor tabs get a NEW shared layout: record list on the left, form on the right, one action bar on top («Сохранить», «Отменить», status). All tabs including «Справочник», «Повышение», «Пользователи» use it. Owner emphasis: convenient buttons and design, better navigation between sections, the «Повышение» tab explicitly included.
- **D-13:** Both navigation problems are fixed: (a) section navigation inside a tab (e.g. Promotion branches/ranks/tasks, Справочник sections) with a clearly visible current section; (b) long forms and lists — the action bar with «Сохранить» stays visible while scrolling (sticky).

### «Информация» на телефоне (UI-08, phone only `max-width: 900px`)
- **D-14:** A thin bar above the article: «Разделы ▾» button on the left, current section name on the right. The bar scrolls away with the text (not fixed) and covers nothing. Desktop `.info-index` is unchanged.
- **D-15:** The list opens inline under the bar and pushes the article down (no overlay). After picking a section the list closes and focus returns to the button. Keyboard access, `aria-expanded`, current section and the subsections marker (`info-sub-marker`) stay available.
- **D-16:** Search hits while the list is closed: the button shows a count («Разделы ▾ · 3»); in the opened list sections with hits are highlighted as today (`data-search-hit`, 19-11).

### Снимки v1.3
- **D-17:** The approved v1.3 snapshots are frozen as history: snapshots and signatures stay in the archive but are no longer the reference for the current look. Phase 26 does not capture a new signed reference; changes are described as text and device acceptance is the owner's in Phase 27. — **Reversibility:** costly — tests and scripts that treat v1.3 snapshots as the current reference must be re-scoped to "historical", and re-establishing a signed reference later needs a new capture.

### Решения после исследования (owner, 2026-11-16, open questions from 26-RESEARCH.md)
- **D-18:** Colour swatches and the web/wallpaper pickers stay soft: `.swatch` uses the `round` role, `.setting-options > button` uses the `card` role (7px). They are an explicit exception to "controls = 0" in the corner rule and the radius test must allow exactly these.
- **D-19:** The maximized-window two-column rule (UI-SPEC R3) applies only to flat forms (viruses, staff, settings). `editor-card-columns` in a maximized window only gain more 340px columns (no `1fr` stretch); `--editor-card-width: 340px` stays.
- **D-20:** The contrast contract (≥4.5:1 for text) is checked only on `--bg` and `--panel` surfaces, for all accent presets. `--panel-2` is not part of the contract; the red preset palette is not changed.
- **D-21:** Guarding `components/portia-editor.tsx`: follow UI-SPEC — every edit to the editor is recorded as a byte-exact hunk in the `lib/format-launch.test.ts` edit registry; `SAMPLE_COMMIT` is NOT re-baselined. (A separate shell file `portia-editor-tab-shell.tsx` may still be used to keep hunks small, but every editor edit is registered.)
- **D-22:** Window close/control buttons are 46×46 everywhere, phone included (today the phone uses 44×44 in a 48px bar): phone controls become 46×46, cross flush in the top-right corner, no extra padding or frame around it.

### Claude's Discretion
- Shortcut label placement at 521–900px (UI-09): one JS rule, no immovable absolute labels, no scroll lock — mechanism is the planner's choice.
- Exact card size/gap for D-01 grid, the two-column breakpoint for D-02, the sticky action bar details for D-13 — decided in UI-SPEC and described to the owner as text.
- axe fixes (UI-10): contrast of `.eyebrow`, field hints, `small[title]`, accessible name of `.nested-editor-toggle`; contrast checked on all accents.
- Regressions (UI-11): verify on current code first; fix only live ones (symmetric window clamp left/right in `lib/window-geometry.ts`, shortcut label last-frame == static frame: sharpness, scale, position).
- How the radius guard test evolves from today's pinned count (`lib/style-tokens.test.ts`; `grep -c border-radius app/portia.css` = 131 now) to "no arbitrary radius outside tokens".

### Folded Todos
- `.planning/todos/pending/2026-11-07-desktop-visual-overhaul.md` — close cross in the corner, one corner rule, maximized window uses the area (grid of «Доступные записи»), redraw icons after options, owner reminder 2026-11-14 about stretched buttons and unused space; the Phase 23 access screen is in scope. → D-01..D-12.
- `.planning/todos/pending/2026-11-03-info-phone-sections-toggle.md` (resolves_phase 26) — compact sections button on phone, must not steal taps or cover text. → D-14..D-16.
- `.planning/todos/pending/2026-10-28-stabilize-promotion-and-desktop-ui.md` — items 9 (asymmetric window clamp) and 10 (label jump at animation end) are UI-11; item 7 (Promotion editor controls not matching PORTIA) is covered by D-12/D-13. Promotion data/API items 1–6 and spider item 8 are not in this phase unless still live and purely visual.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Style direction and tokens
- `.planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-STYLE-DIRECTION.md` — direction C values table (the source of radii)
- `.planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-UI-SPEC.md` — token skeleton, radius census, existing building blocks
- `.planning/phases/PORTIA-22-vkladka-polzovateli-i-karkas-tokenov-stilya/22-CONTEXT.md` — D-12 (tokens, radius count pin)

### Scope and requirements
- `.planning/ROADMAP.md` § Phase 26 — goal, success criteria, constraints, acceptance gate
- `.planning/REQUIREMENTS.md` — UI-02 … UI-11
- `.planning/todos/pending/2026-11-07-desktop-visual-overhaul.md`
- `.planning/todos/pending/2026-11-03-info-phone-sections-toggle.md`
- `.planning/todos/pending/2026-10-28-stabilize-promotion-and-desktop-ui.md`

### Project rules
- `CLAUDE.md` — hard rules (owner paths, no `--verify` of the visual manifest, staging/production BLOCKED)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app/portia.css` (2607 lines): `:root` radius tokens at lines 80-85 (`--radius-window/-dialog/-control/-field/-plaque/-tab`); 131 `border-radius` declarations today; `app/portia-promotion-editor.css` has its own radii.
- `components/portia-icons.tsx`: `PortiaIcon`, `classificationIcon` map (line 131), `classificationIconFor`.
- `components/portia-desktop-window.tsx`, `lib/window-geometry.ts`: window frame, controls, clamp.
- `components/portia-desktop.tsx` (2273 lines): global search («Доступные записи», ~line 1979), `.info-index` sections.
- `components/portia-editor.tsx` (2465 lines) plus tab components: `portia-promotion-editor*.tsx`, `portia-users-tab.tsx`, `portia-template-builder.tsx`, `portia-editor-dossier.tsx`.
- `components/portia-access-gate.tsx`: access/request screen (Phase 23) — in scope.
- `components/portia-desktop-shortcuts.tsx`: shortcut labels (UI-09, UI-11).

### Established Patterns
- Tokens are plain `:root` CSS variables edited in place; `lib/style-tokens.test.ts` pins the radius declaration count and token-to-census consistency.
- Accent colours via `--accent-hue` / `--accent-chroma` oklch expressions — contrast must hold on every accent (`lib/accent-theme.test.ts`).
- Source tests (node:test) are the main guard; screenshots are not used as evidence in this milestone.

### Integration Points
- `.app-window.is-maximized` (`app/portia.css:260`) — maximized layout hooks in here.
- Phone breakpoint `max-width: 900px` for «Информация»; desktop `.info-index` untouched.
- Promotion export classes `level-1..3` vs access `access-level-*`.

</code_context>

<specifics>
## Specific Ideas

- Owner: «визуал полностью сайта изменить в лучшую сторону, чтобы он был как рабочий стол».
- Owner example: «Доступные записи» take a whole row each — lay them out left-right (grid).
- Owner reminder 2026-11-14: «улучшить кнопки, странное растяжение кнопок и неиспользование места когда экран на полной».
- Owner, this discussion: «сделать удобные кнопки и дизайн, улучшение перелистывания и разделов, вкладку повышения и т.д.»
- Phone sections button must not get in the way of taps or reading.

</specifics>

<deferred>
## Deferred Ideas

### Reviewed Todos (not folded)
- `2026-11-07-nick-access-request.md`, `2026-11-08-access-levels.md` — access features, delivered by Phases 23–25; only their screens' look is in scope here.
- `2026-10-28-stabilize-promotion-and-desktop-ui.md` items 1–6 (Promotion dates, requests, device binding, editor saving) and 8 (spider lifecycle) — behaviour, not style; out of this phase unless still live and purely visual.

None else — discussion stayed within phase scope.

</deferred>

---

*Phase: 26-Единый стиль сайта*
