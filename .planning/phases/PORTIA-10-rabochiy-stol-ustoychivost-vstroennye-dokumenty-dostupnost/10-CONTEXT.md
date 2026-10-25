# Phase 10: Рабочий стол: устойчивость, встроенные документы, доступность - Context

**Gathered:** 2026-10-25
**Status:** Ready for planning

<domain>
## Phase Boundary

The desktop (`components/portia-desktop.tsx`) stops crashing on empty or missing data; «Таблица», «Устав» and YouTube embeds run in `sandbox` with one shared permission set; document zoom (Ctrl+wheel) no longer sticks or swallows clicks, and its reset button announces the percent; the quest notice and virus list get correct roles and Escape; the Roblox portrait gets a tooltip; the settings storage key becomes one constant guarded by a test; side effects leave React state updaters; and Settings gains a «Свой» custom accent colour next to the four presets.

Requirements: ROB-01, ROB-03, SEC-03, ZOOM-01, ZOOM-02, A11Y-01, A11Y-02, TEST-01, THEME-01.

</domain>

<decisions>
## Implementation Decisions

### Carried forward (locked earlier, not re-asked)
- **D-01:** «Анимации: Выключены» keeps everything still (`html[data-motion="reduce"]`); anything new obeys it (Phase 9 D-03).
- **D-02:** The spider and Vivian take the accent colour; the spider's dark parts take the desktop background colour (Phase 9 D-07). A custom accent must reach them the same way the presets do.
- **D-03:** Content poll every 10 s while the tab is visible (03.2-07); desktop must tolerate content changing under an open window.

### Свой цвет акцента (THEME-01)
- **D-04:** «Свой» behaves exactly like a preset: it drives the whole theme, including the dark backgrounds, panels and lines (everything that uses `--accent-hue`), the bright accent tokens (`--teal`, `--teal-dim`, `--teal-soft`, `--desktop-glow`, `--desktop-grid`, `--desktop-base`, `--desktop-deep`) and the PNG filters (`--mark-filter`, `--assistant-filter`). All of these tokens are derived from the one picked colour.
- **D-05:** Unreadable picks are quietly corrected: keep the picked hue, clamp lightness and saturation into the range the presets live in, so text, frames and the spider stay visible. No warning is shown. A grey (no hue) pick still gets a usable accent.
- **D-06:** Placement: a 5th button «Свой» in Settings → «Цвет интерфейса», after the four presets. Its swatch shows the saved custom colour. Clicking it selects the custom accent and opens the picker below the row.
- **D-07:** The picker is exactly the editor's `CustomColorPicker` (`components/portia-editor.tsx`), reused (moved to a shared place if needed), with no added controls.
- **D-08:** Live preview: the whole desktop recolours while dragging; the value is saved when the drag ends or the picker closes.
- **D-09:** The custom colour is remembered when you switch to a preset; clicking «Свой» brings it back. «СБРОСИТЬ ДО ЗАВОДСКИХ» clears it along with the other settings.
- **D-10:** Stored per device in the existing desktop settings in localStorage (same object as the preset accent), not on the server.
- **D-11:** No flash on load: the head boot script (`lib/accent-boot.ts` `accentBootScript`) applies the custom colour before hydration, just as it does for presets today. The stored value is untrusted input: the boot script must validate it (e.g. a strict `#rrggbb` check) and never interpolate it into the script source (existing rule in that file).

### Пустые данные (ROB-01)
- **D-12:** Assistant tips: empty and whitespace-only tips are skipped; if no usable tip is left, the assistant shows no bubble. Nothing crashes when the list is empty or the chosen index is gone.
- **D-13:** If the tip in an open bubble disappears (deleted by another editor, seen through the 10 s poll), the bubble closes quietly; the next click picks a tip that exists.
- **D-14:** A window whose text is missing opens normally with an empty body (no placeholder note). `FormattedText` accepts missing text.
- **D-15:** General rule for the desktop: missing data never crashes a window; the missing piece renders empty and the rest of the window works.

### Подсказки (A11Y-02)
- **D-16:** Plain browser tooltips (`title`), like the rest of the site; no new tooltip component.
- **D-17:** The Roblox portrait link gets `title` «Профиль Roblox: {ник}» (same text as its `aria-label`). A portrait without a Roblox ID (not a link) gets no tooltip.
- **D-18:** Owner decision: the ≡ reorder handle in the editor gets **no** tooltip. This narrows A11Y-02 and success criterion 4 («и ручки ≡»): update REQUIREMENTS.md / ROADMAP.md wording to record the owner's decision rather than leaving it unmet silently. — **Reversibility:** reversible — adding a `title` later is one line.

### Встроенные документы и масштаб (SEC-03, ZOOM-01, ZOOM-02)
- **D-19:** One shared `sandbox` permission set for «Таблица», «Устав» and YouTube. If a frame needs more on some device (owner's PC or phone check), add only the specific `allow-*` flag it needs; the frame stays sandboxed and the existing «Открыть» link remains as a backup. Dropping sandbox is not an option.
- **D-20:** YouTube keeps fullscreen working (`allowFullScreen` stays).
- **D-21:** Owner decision, changes ZOOM-01 wording: Ctrl zooms everywhere; on a Mac, Cmd zooms too. The Windows key (Meta on Windows/Linux) never zooms. Update the ZOOM-01 text in REQUIREMENTS.md accordingly. The overlay must still clear when the modifier is released or the window loses focus, and must never block clicks or scrolling inside the document.
- **D-22:** The zoom reset button announces only the current percent (e.g. «125%») to screen readers.

### Claude's Discretion
- ROB-03: how localStorage writes and `setWindows` move out of state updater functions.
- TEST-01: where the single settings-key constant lives (`portia-desktop-settings-v1` is today repeated inside `accentBootScript` and in the desktop) and how the boot test catches a mismatch.
- A11Y-01: Escape closes the quest notice without focus (document-level listener), the correct roles for the notice, and `option` roles in the virus list (`role="listbox"` today).
- The exact colour maths for D-04/D-05 (OKLCH is already used across `app/portia.css`) and how the PNG filter values are computed from the hue.
- The exact sandbox flag list, verified in a browser.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` § Phase 10 — goal and 6 success criteria
- `.planning/REQUIREMENTS.md` — ROB-01, ROB-03, SEC-03, ZOOM-01, ZOOM-02, A11Y-01, A11Y-02, TEST-01, THEME-01 (A11Y-02 and ZOOM-01 wording to be amended per D-18, D-21)
- `.planning/PROJECT.md` — Key Decisions table (sandbox for embedded pages, quest notice is non-blocking)

### Prior phase decisions
- `.planning/phases/PORTIA-09-tselostnost-kontenta/09-CONTEXT.md` — D-03 motion rule, D-07 spider colours follow the accent

### Codebase maps
- `.planning/codebase/CONVENTIONS.md`, `.planning/codebase/TESTING.md`, `.planning/codebase/CONCERNS.md`

No external specs; requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `CustomColorPicker` (`components/portia-editor.tsx` ~2170): the editor's custom colour picker, to be reused for «Свой» (D-07).
- `accentIds`, `accentBootScript`, `motionModes` (`lib/accent-boot.ts`): preset list and the pre-hydration head script that reads `portia-desktop-settings-v1`.
- `lib/accent-theme.test.ts`: checks every theme defines the accent tokens and PNG filters, that hues match, and that the spider/Vivian land on the accent hue. Extend it for the custom accent.
- `SettingGroup` (`components/portia-desktop.tsx` ~1874) renders the «Цвет интерфейса» row with `.swatch` icons.
- `EmbeddedDocument` (`components/portia-desktop.tsx` ~1502): iframe, zoom steps, the Ctrl-held overlay (`document-app-zoom-layer`), wheel listener.

### Established Patterns
- Presets are CSS blocks `html[data-accent="…"] { --teal…; --accent-hue…; --mark-filter…; --assistant-filter… }` in `app/portia.css` (~1035); most surfaces use `oklch(L C var(--accent-hue))`. A custom accent sets the same tokens inline on `document.documentElement` (and in the boot script).
- localStorage access is wrapped in try/catch throughout the desktop.
- Native `title` tooltips are already used in about 9 places.

### Integration Points
- YouTube iframe in info blocks (`components/portia-desktop.tsx` ~1256) and `EmbeddedDocument` iframe (~1542) both get the shared sandbox set.
- Assistant bubble (~1340) reads `content.assistantAdvice[assistantTipIndex]`.
- Quest toast (~1781) `role="status"` with an Escape handler only on the element; virus list (~1168) `role="listbox"`.

</code_context>

<specifics>
## Specific Ideas

- «Свой» sits after «Тревога» as the 5th option; its swatch is the saved colour.
- Owner checks the sandboxed embeds on PC and phone (success criterion 2).

</specifics>

<deferred>
## Deferred Ideas

None; discussion stayed within phase scope.

</deferred>

---

*Phase: 10-Рабочий стол: устойчивость, встроенные документы, доступность*
*Context gathered: 2026-10-25*
