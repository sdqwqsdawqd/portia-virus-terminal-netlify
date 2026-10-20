# Feature Landscape: v1.1 «Закрытие замечаний» (review-debt inventory)

**Domain:** Fix milestone for an existing Next.js 16.4.2 + Supabase + Netlify app (PORTIA OS). No new features; every item is an open v1.0 review finding.
**Researched:** 2026-10-19 (code state = working tree at HEAD d40c8b5; `npm test` 202/202 pass)
**Confidence:** HIGH for status/evidence (each finding re-read against current code), MEDIUM for complexity (estimates), LOW only where marked "not verifiable here" (browser/DB behaviour).

## Method and totals

Sources: `01-REVIEW`, `03.1-REVIEW`, `03.2-REVIEW`, `03.3-REVIEW`, `05-REVIEW` (+ DISPOSITION files) under `.planning/milestones/v1.0-phases/`. Each finding was checked by reading the cited code. Line numbers below are CURRENT (several reviews cite stale numbers).

- 55 findings listed once each: 01 (7), 03.1 (22), 03.2 (9), 03.3 (8), 05 (9 incl. the deferred WR-05).
- Status: **1 fixed** (01-CR-01), **3 partly fixed / stale-in-part** (03.1-WR-07, 01-IN-01, 01-IN-02), **5 stale or accept-as-is candidates** (05-IN-01, 05-IN-02, 05-IN-04, 03.2-IN-02, 03.2-IN-03 second half), **46 still present** (remaining rows, incl. 05-IN-05 which is unverifiable here). Details per row.
- Not in any review file but found while verifying (add to scope or log, your call): `PUT /api/content` does `JSON.parse(raw)` unguarded (`app/api/content/route.ts:42`, bad JSON gives 500, `null` body throws); `POST /api/editors` has the same `request.json()` (`app/api/editors/route.ts:33`). Same fix as 03.1-IN-06.
- The 03.2 review mentions old WR-02 (`normalizeBroadcasts`), WR-03 (`markQuestsSeen` pruning), IN-02 (date validation) as "not re-reviewed". Verified: `markQuestsSeen` pruning IS fixed (`lib/broadcasts.ts:59-61`, test `broadcasts.test.ts:101`). The other two are the same as 03.1-WR-07 and 03.1-IN-08 and are tracked there. They are not new rows.

Legend. Severity: reviewer's label (C/W/I). Complexity: S = under 15 lines in one place, M = one file plus a test or two call sites, L = several files, a decision, or untestable without a device/DB. ID format `phase-ID`.

## Categories (the roadmap grouping)

| Cat | Name | Findings |
|-----|------|----------|
| A | Employee saves (data loss, concurrency) | 03.1-WR-01, WR-02, WR-03, WR-05, WR-06; 03.2-WR-02, WR-03, WR-04; 03.3-WR-02, WR-03, WR-04, IN-01, IN-02 |
| B | Content sync & normalization | 03.1-WR-04, WR-07, WR-08, WR-09, WR-12, IN-08, IN-03, IN-02; 03.2-WR-01, IN-02, IN-05; 03.3-WR-01 |
| C | Robustness (crashes, 4xx vs 5xx) | 03.1-WR-10, IN-06, IN-09; 03.3-IN-03 |
| D | Security | 03.1-WR-11, IN-10, IN-07; 03.3-IN-04 |
| E | Editor and format panel | 05-WR-01, WR-06, IN-02, IN-05, IN-06; 03.2-IN-04; 01-IN-02 |
| F | Embedded docs zoom | 01-WR-01, WR-02, WR-03, IN-03 |
| G | A11y and copy | 01-IN-01; 03.1-IN-04, IN-05; 03.2-IN-01, IN-03 |
| H | Tests, docs, housekeeping | 03.1-IN-01; 05-IN-01, IN-03, IN-04, WR-05 (deferred); 01-CR-01 (close as fixed) |

(Cross-listed items sit in their primary category above; the master table is authoritative.)

## Master table

### Phase 01 (7)

| ID | User-visible effect | Status | Evidence | Sev | Cx | Cat |
|----|--------------------|--------|----------|-----|----|-----|
| 01-CR-01 | Dark Reader recolours the site (meta tag not emitted) | **FIXED** (plan 01-03) | `app/layout.tsx:21` `"darkreader-lock": "true"`; built `.next/server/app/index.html` contains the meta (01-03-SUMMARY, and my grep of `.next`) | C | - | H (close, no code) |
| 01-WR-01 | Ctrl+wheel zoom of «Устав»/«Таблица» stops working once the user clicked inside the document (browser zooms the whole tab) | Present | `portia-desktop.tsx:1496-1503` key listeners on parent `window` only; iframe keys never reach it | W | L (feasibility limit, see F) | F |
| 01-WR-02 | Holding Win/Cmd raises the overlay that blocks clicks and scrolling in the document | Present | `portia-desktop.tsx:1497` (`ctrlKey \|\| metaKey`), `:1514` | W | S | F |
| 01-WR-03 | Zoom overlay can stay stuck (lost keyup) and swallows Ctrl+click/scroll | Present | `portia-desktop.tsx:1497-1503`, `:1526` (`ctrlHeld && <div className="document-app-zoom-layer">`), css `portia.css:1535` | W | M | F |
| 01-IN-01 | Roblox profile link is an unlabelled portrait for mouse users | **Partly fixed**: `aria-label="Профиль Roblox: …"` exists, no `title` tooltip | `portia-desktop.tsx:1195` | I | S | G |
| 01-IN-02 | Drag handle: quick click does nothing, no hint | **Partly fixed**: keyboard alternative exists (ArrowUp/Down, `aria-keyshortcuts`); no `title`, still 170 ms hold | `portia-editor.tsx:~269` (`aria-keyshortcuts`), `:~290` (`170`), `:~295` | I | S | E |
| 01-IN-03 | Screen reader never hears the zoom percentage | Present | `portia-desktop.tsx:1531` `aria-label="Сбросить масштаб"` hides `{zoom}%` | I | S | F |

### Phase 03.1 (22)

| ID | User-visible effect | Status | Evidence | Sev | Cx | Cat |
|----|--------------------|--------|----------|-----|----|-----|
| 03.1-WR-01 | During a Supabase hiccup every visitor sees empty bios and «—» ratings for up to 5 min, and the good local cache is overwritten | Present | `portia-desktop.tsx:419-427` applies and caches any non-empty degraded payload; `portia-employees.ts:77-80` `acceptsRoster` ignores `profilesRead` | W | M | A |
| 03.1-WR-02 | A save that lacks `biography`/`photoUrl` silently erases the stored bio and photo (API contract inconsistent with ratings) | Present | `portia-employees.ts:437-442` (missing string becomes `""`); no test for it | W | M | A |
| 03.1-WR-03 | Saving a profile can fail with «Сотрудник не найден» (or time out ~18 s) when Roblox/Sheets are slow, though the employee is valid | Present | `api/employees/route.ts:37-40` calls `loadEmployees` (sheet + Roblox users + thumbnails) just to find the id | W | L | A |
| 03.1-WR-04 | Every 10 s poll replaces `content`; editor's clean-state sync wipes undo/redo history | Present (same fix as 03.2-WR-01) | `portia-desktop.tsx:362` `setContent(fetched)` with no equal-revision skip | W | S/M | B |
| 03.1-WR-05 | After the editor fixes a broken photo URL the profile keeps showing the logo until reload | Present | `portia-desktop.tsx:1379-1388` `failed`/`loaded` never reset; parent key is only `selectedEmployee.id` (`:1190`) | W | S | A |
| 03.1-WR-06 | «СОХРАНЕНО» timer is not cleared: a second save within 1.8 s flips to idle mid-request, employee switch allowed during PATCH, answer overwrites next employee's draft | Present | `portia-editor.tsx:1463` raw `setTimeout`, no ref/cleanup | W | S | A |
| 03.1-WR-07 | Rich text silently cut at 500 runs / 1000 keys; broadcasts/viruses spread unvalidated (a `title: {}` crashes every visitor) | **Partly fixed**: `infoSections` now fully validated by `normalizeInfoSections` (03.3, `normalize.ts:245`). Still present: caps at `:46` (500 runs) and `:67` (1000 keys), `normalizeBroadcasts` spreads `...item` (`:91`), virus `...virus` (`:176`) | W | M | B |
| 03.1-WR-08 | Hard-deleting a recycled virus / recycle file leaves orphan `formattedText` keys (count toward the 1000 cap, mislabel diff section) | Present | `portia-editor.tsx:642-648` (`deleteSelectedRecycledVirus`), `:1201` (recycle file delete); `lib/editor-items.ts` has no `removeRecycled*` | W | S | B |
| 03.1-WR-09 | A news item changed to quest keeps hidden `important:true`, shows «ВАЖНО» on the quest with no way to clear it | Present | editor type handler `portia-editor.tsx:1075-1083` (only sets `type`); checkbox only for news `:1094`; reader `portia-desktop.tsx:1265` shows for any type | W | S | B |
| 03.1-WR-10 | If the advice list shrinks while the bubble is visible, `undefined` text throws and the whole desktop goes blank | Present | `portia-desktop.tsx:1115` no `?? fallback`; `FormattedText` `:1782-1787` `run.text.length` | W | S | C |
| 03.1-WR-11 | Editor access trusts JWT email without confirmed-email check; anon RPC tells anyone whether an email is an approved editor; with «Confirm email» off, anyone can sign up as an approved editor | Present (SQL unchanged; no `email_confirmed` anywhere in code) | `supabase/portia_setup.sql:48-97`; `lib/editor-access.ts` | W | L (owner applies SQL) | D |
| 03.1-WR-12 | Cached content from before `recycledViruses` existed throws in the dossier diff | Present | `lib/editor-changes.ts:76`; `isUsableContent` (`portia-desktop.tsx:147-155`) does not require the field | W | S | B |
| 03.1-IN-01 | Settings storage key is a literal in 3 places; boot test can't detect drift | Present | `accent-boot.ts:10`, `portia-desktop.tsx:541`, `:682` | I | S | H |
| 03.1-IN-02 | `//host/x.png` accepted as a "local path" | Present | `portia-employees.ts:437`, `portia-content-normalize.ts:79`, `portia-editor.tsx:~78`, `portia_setup.sql:22` | I | S | B |
| 03.1-IN-03 | A 35th employee on the sheet is silently dropped | Present | `portia-employees.ts:91` `staffRowsEnd = 35`, `:190` | I | S | B |
| 03.1-IN-04 | A11y: Escape on toast works only if focused; `role="status"` holds buttons; listbox without option roles | Present (overlaps 03.2-IN-01) | `portia-desktop.tsx:1763`, `:1157` | I | S | G |
| 03.1-IN-05 | Joke/empty strings in the editor UI | Present | `portia-editor.tsx:1258` («дружок пирожок»), `:1840` («не добавляй всякой фигни ок?»), `:1790` empty `<small>` | I | S | G |
| 03.1-IN-06 | Bad/`null` JSON to PATCH gives 500 instead of 400 | Present | `api/employees/route.ts:33` | I | S | C |
| 03.1-IN-07 | Embedded documents have no `sandbox` | Present | `portia-desktop.tsx:1524` (`<iframe src=… referrerPolicy=…>` no sandbox) | I | S | D |
| 03.1-IN-08 | Quest with end date before start is never active and silently so | Present | `portia-editor.tsx:~1090` only `min=`; `normalize.ts:88-96` no swap/clear | I | S | B |
| 03.1-IN-09 | Side effects (localStorage, `setWindows`) inside React state updaters | Present (works today because idempotent) | `portia-desktop.tsx:393-415`, `:717` | I | M | C |
| 03.1-IN-10 | Public table exposes `updated_by`/`nickname`; owner email committed; storage listing open | Present | `portia_setup.sql:49`, `:155-162`, `:243-248` | I | L (owner applies SQL) | D |

### Phase 03.2 (9)

| ID | User-visible effect | Status | Evidence | Sev | Cx | Cat |
|----|--------------------|--------|----------|-----|----|-----|
| 03.2-WR-01 | Same as 03.1-WR-04, plus toast effect re-runs and desktop re-renders every 10 s | Present | `portia-desktop.tsx:362` | W | S/M | B |
| 03.2-WR-02 | A CDN-cached roster without rating keys (or an old degraded copy without `profilesRead`) lets the editor save null ratings over stored ones | Present | `portia-editor.tsx:1421` checks `=== false` only; `profileOf` maps missing to `null` (`portia-employees.ts:~46-55`) | W | S | A |
| 03.2-WR-03 | Text typed while a save is in flight is discarded | Present | `portia-editor.tsx:1457` `setDraft(profileOf(payload.employee))`; inputs not in a disabled `fieldset` | W | S | A |
| 03.2-WR-04 | Each save writes all six ratings, so concurrent editors overwrite each other's untouched ratings | Present | `portia-editor.tsx:1446` `changes: draft` | W | M | A |
| 03.2-IN-01 | Same as 03.1-IN-04 (toast Escape/role) | Present (duplicate fix) | `portia-desktop.tsx:1763` | I | S | G |
| 03.2-IN-02 | «New quest in 10 s» not guaranteed when CDN purge fails | **Mostly stale**: purge failure is already logged (`lib/portia-cdn.ts:21-26`); only the `shortcut:` comment (`portia-desktop.tsx:38`) lacks one line | I | S | B |
| 03.2-IN-03 | Toast comment overstates placement; owner sees toast over own editor | **Half stale**: toast-over-editor is an explicit owner decision (STATE: 03.2-07 «toast also shows while the editor is open»). Remaining: soften CSS comment near `portia.css:~474` | I | S | G |
| 03.2-IN-04 | Undo/redo of a news-to-quest type change leaves the Сводка editor on the wrong tab; card vanishes | Present | `portia-editor.tsx:610-619` `step` does not touch `broadcastEditorTab` (`:544`) | I | S | E |
| 03.2-IN-05 | First render briefly shows every dated quest as «upcoming» (empty `today`) | Present | `portia-desktop.tsx:276` `useState("")`; `lib/broadcasts.ts:18-21` | I | S | B |

### Phase 03.3 (8)

| ID | User-visible effect | Status | Evidence | Sev | Cx | Cat |
|----|--------------------|--------|----------|-----|----|-----|
| 03.3-WR-01 | Guide content over 50 subsections / 100 blocks / 100 table rows is dropped on save with no warning | Present | `portia-content-normalize.ts:129,144,159` `.slice`; editor has no matching limit (no `infoLimits`) | W | M | B |
| 03.3-WR-02 | After a failed manual-employee read, those people vanish from the Personnel window and from the device cache | Present (same code path as 03.1-WR-01) | `portia-employees.ts:~358` `complete = … && manual.ok`; `portia-desktop.tsx:419-427` | W | M | A |
| 03.3-WR-03 | Detail save is non-atomic (profile then details), and a row deleted meanwhile shows «база данных ещё не обновлена» | Present | `api/employees/route.ts:46-52`; `portia-employees.ts:~410-418` zero rows maps to `pending-database` | W | M | A |
| 03.3-WR-04 | If the roster is empty (sheet down, or last person removed) there is no «+ ВНЕ ТАБЛИЦЫ» button, so nobody can be added | Present | `portia-editor.tsx:~1578` early `return <div className="editor-empty">` before the add button (`~1618`) | W | S/M | A |
| 03.3-IN-01 | Manual employee shows nickname casing as typed, not Roblox's | Present | `portia-employees.ts` `addManualEmployee`, `RobloxProfile` has no `name` | I | S | A |
| 03.3-IN-02 | Duplicate `text` helper; `details: {}` wipes title/rank/callsign | Present | `portia-employees.ts:~397`, `~403-409` | I | S | A |
| 03.3-IN-03 | Bad JSON to POST/DELETE gives 500 | Present | `api/employees/route.ts:69` (POST), `:102` (DELETE) | I | S | C |
| 03.3-IN-04 | YouTube iframe has no `sandbox`; delete-403 branch matches Russian substring «таблицы» | Present | `portia-desktop.tsx:1245` (no sandbox); `portia-editor.tsx:~1650` `includes("таблицы")` | I | S | D |

### Phase 05 (9, incl. deferred)

| ID | User-visible effect | Status | Evidence | Sev | Cx | Cat |
|----|--------------------|--------|----------|-----|----|-----|
| 05-WR-01 | Phone: pressing ГОТОВО with no known selection puts a default caret at 0, next ✎ targets the first word | Present | `portia-editor.tsx:1908-1915` `finish()` focuses even when `target.selection` is null | W | S/M | E |
| 05-WR-06 | The teal underline target cue is faint on the light preview field (~2.1:1) | Present, **needs a visual check** | `portia.css:516` rgba(desktop-glow,.9); light field `portia.css:599` (`#f3f1e9`) | W | S | E |
| 05-IN-01 | `event order:` tests drive a hand-written event list, not component wiring | Accept-as-is per reviewer; optional boundary test (`at === ownUntil + 400`) | `rich-text-style.test.ts:162-220` | I | S | H |
| 05-IN-02 | Own-input window can stay open/close early in rare sequences | **Accept** (follows D-05 design; reviewer: "None required") | `rich-text-style.ts:146-151` | I | - | E (close, no code) |
| 05-IN-03 | Stale CSS comment + two imports from `rich-text-style` | **Half fixed**: comment resolved (`portia.css:515`). Import merge open | `portia-editor.tsx:23-24` | I | S | H |
| 05-IN-04 | Disposition record says WR-02 plainly «fixed» while the 17 px «M» preset jump is deferred | Doc-only; not a code issue | disposition file; the 17 px jump is the PROJECT.md out-of-scope row «Пресеты размера панели…» | I | S | H (close with note) |
| 05-IN-05 | `text-decoration` thickness in `::highlight` may fall back to a 1 px hairline in some browsers; none where Highlight API is missing | **Not verifiable here**: owner approved 05-07 steps 1-5 on PC and phone (05-07-SUMMARY) | `portia.css:516` | I | - | E (close with owner approval, or add Safari/Firefox check) |
| 05-IN-06 | «No fill in marker» guarantee is only a one-off plan check | Present | no test reads the `::highlight` rule; existing CSS tests (`accent-theme.test.ts:8`, `editor-field-look.test.ts:5`) already `readFileSync` portia.css, so adding one is 5 lines | I | S | E |
| 05-WR-05 (deferred) | `matchMedia("(max-width: 900px)")` duplicated; dragged panel place not re-clamped when storage blocked | Present (duplication confirmed: `portia-editor.tsx:402,875,910,1896,1910,1944,1963`); re-clamp half not verified | W | S/M | H or E (deferred in v1.0; decide in/out) |

## Table stakes for v1.1 (what users must be able to rely on after the milestone)

This is a fix milestone, so «features» are behaviours. Each lists the expected behaviour once fixed.

### A. Employee saves
| Behaviour | Source | Expected behaviour once fixed |
|-----------|--------|--------------------------------|
| Saves never erase untouched fields | 03.1-WR-02, 03.2-WR-04, 03.2-WR-02 | Editor sends only changed keys; server treats a missing key as «unchanged» for bio, photo and ratings alike. A save from an old/degraded cached roster is refused with a clear «Обновите страницу» message |
| Typing during a save survives | 03.2-WR-03 | Fields are disabled (fieldset) while «СОХРАНЕНИЕ…», or the server copy only replaces the draft if it is unchanged since send |
| Save does not depend on Roblox/Sheets uptime | 03.1-WR-03, 03.3-WR-03 | A valid employee saves even if Roblox is down; no 404 for a valid id; a deleted-meanwhile row says so; details failure still reports that the profile was saved |
| «СОХРАНЕНО» timing is safe | 03.1-WR-06 | One save at a time; employee switch blocked until it ends; timer cleared |
| Outage never blanks the public Personnel window | 03.1-WR-01, 03.3-WR-02 | A degraded answer keeps previously known bios/ratings/photos and manual people and does not overwrite the localStorage cache |
| Photo URL fix is picked up at once | 03.1-WR-05 | `key={src}` or reset state |
| Add manual employee even from an empty roster | 03.3-WR-04 | «+ ВНЕ ТАБЛИЦЫ» is visible with no selection |
| Roblox canonical casing; `details:{}` doesn't clear | 03.3-IN-01/02 | cosmetic / latent |

### B. Content sync and normalization
| Behaviour | Source | Expected |
|-----------|--------|----------|
| Polling is invisible to the editor | 03.1-WR-04, 03.2-WR-01 | Unchanged revision = no new object: undo/redo survives, no 10 s re-render |
| Nothing is cut silently | 03.1-WR-07, 03.3-WR-01 | One policy for both: shared limit constants; the editor disables «+» buttons at the limit (50/100/100) and shows rich-text size; server answers 400 over the limit instead of `.slice` |
| No junk left behind | 03.1-WR-08, WR-09, IN-08 | Permanent delete removes `virus:<id>:*` and `recycle:<id>:content` keys; type change away from news clears `important`; end-before-start is cleared/swapped with a hint |
| Old cached content doesn't crash | 03.1-WR-12 | `?? []` |
| Local-path validation exact | 03.1-IN-02 | `/^\/(?!\/)/` in 3 TS places + SQL `not like '//%'` |
| 35th employee noticed | 03.1-IN-03 | stop at empty number/«Сотрудников:» or log |
| No first-render quest flicker | 03.2-IN-05 | lazy init of `today` or `questState("")` = active |

### C. Robustness
| Behaviour | Source | Expected |
|-----------|--------|----------|
| Desktop never white-screens on odd data | 03.1-WR-10, 03.1-WR-07 | fallback tip; `text ?? ""` in `FormattedText`; string coercion in `normalizeBroadcasts` and virus normalize; items without non-empty string `id` dropped |
| Bad JSON gives 400 | 03.1-IN-06, 03.3-IN-03 (+ content PUT, editors POST) | one helper `readJson(request)` returning null, 400 «Некорректные данные.» |
| Pure state updaters | 03.1-IN-09 | side effects moved to effects/refs |

### D. Security
| Behaviour | Source | Expected |
|-----------|--------|----------|
| Only confirmed emails can edit | 03.1-WR-11 | SQL helpers join `auth.users` with `email_confirmed_at is not null` (**owner applies SQL**; ship it as a clearly marked migration block in `portia_setup.sql` + a note that «Confirm email» must stay on). In code (verifiable): also reject `user.email_confirmed_at == null` in `getEditorAccess` |
| No yes/no oracle for anonymous | 03.1-WR-11 | stop granting `portia_editor_is_approved` to `anon` (check what sign-up flow calls it before revoking: dependency, see Pitfalls) |
| Public tables don't leak internals | 03.1-IN-10 | view or column grants without `updated_by`; drop storage `select` policy if listing unused; owner email not hard-coded (deploy setting) |
| Embedded pages sandboxed | 03.1-IN-07, 03.3-IN-04 | charter/sheet: `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"` (no top-navigation); YouTube: `allow-scripts allow-same-origin allow-presentation allow-popups`. Must be checked live that «Таблица» (Google viewer) and «Устав» still load and Ctrl-zoom/+/- still work |
| No text-matching on error strings | 03.3-IN-04 | 403 body carries `code: "sheet"` |

### E/F. Editor, format panel, embedded zoom
| Behaviour | Source | Expected |
|-----------|--------|----------|
| ГОТОВО on phone never retargets to the first word | 05-WR-01 | with no known selection, no `focus()`, or mark the focus read as not-own |
| Target cue visible on light field | 05-WR-06 | darker teal (e.g. rgba(0,150,132,.95)) after a look at `preview-light`; guarded by 05-IN-06 test |
| Undo/redo follows the card | 03.2-IN-04 | `step` switches `broadcastEditorTab` |
| Drag handle explains itself | 01-IN-02 | `title="Удерживайте и перетащите (или стрелки ↑↓)"` |
| Ctrl+wheel zoom | 01-WR-01/02/03 | Win/Cmd do not raise the overlay (`ctrlKey` only); overlay cannot get stuck (`onPointerMove` without `ctrlKey` hides it; also hide on `visibilitychange`); Ctrl+click works. **WR-01 has a hard platform limit**: events over a cross-origin iframe never reach the parent, so the reviewer's «pointermove on the overlay» fix cannot work while the pointer is over the frame. Recommend: accept the limitation, document it with a `shortcut:` comment, rely on +/− buttons; optional spike: refocus the parent on `mouseenter` of the frame (steals keyboard-scroll focus from the document, so owner should choose) |
| Zoom % announced | 01-IN-03 | `aria-label={\`Сбросить масштаб, сейчас ${pct}%\`}` |

### G. A11y and copy
Toast: `role="region"` + `aria-label`, Escape listener on `document` while shown (03.1-IN-04 + 03.2-IN-01 one change); drop `role="listbox"` on the virus list or add `option`/`aria-selected`; remove joke copy and the empty `<small>` (03.1-IN-05); `title` on the Roblox portrait link (01-IN-01); soften toast CSS comment (03.2-IN-03).

## Differentiators
None. By definition this milestone adds no user-facing features. The only user-visible «new» things are warnings/limit hints (guide size, quest dates, rich-text size).

## Anti-Features (explicitly do NOT build)

| Anti-feature | Why avoid | Instead |
|--------------|-----------|---------|
| Optimistic revision check for employee edits | PROJECT.md accepts «последняя запись побеждает» (AR-03.2-01) | Reduce collisions by sending only changed keys (03.2-WR-04) |
| Realtime channel instead of 10 s poll | decided in 03.2-07 | Fix the identity churn only |
| Error boundary framework / global state rewrite | Disproportionate for the findings | Targeted fallbacks (WR-10, WR-07) |
| Disabling assistant controls (05 WR-01 old pass, D-19) | Locked decision | n/a |
| 17 px «M» preset sizes per area | PROJECT.md out of scope for v1.1 (2026-10-19) | n/a |
| Hiding the quest toast while the editor is open | Owner decision 03.2-07 | Keep; fix comment only |
| Fixing the unfixable: zoom while iframe focused | Cross-origin platform limit | Document the limit, keep +/− |

## Feature (finding) dependencies

```
03.1-WR-02 (server: missing key = unchanged)
   -> 03.2-WR-04 (client sends only changed keys)   [design together; do NOT make the server 400 on a missing
                                                     biography/photoUrl as the review suggests, or partial sends break]
   -> 03.2-WR-02 (reject payload without profilesRead === true)
03.1-WR-01 + 03.3-WR-02: one fetchEmployees merge; server must expose why it is degraded
   (today `degraded = !complete` conflates profiles-failed, roblox-failed, manual-failed; add `manualRead` flag or send the three booleans)
03.1-WR-03 + 03.3-WR-03: both rework PATCH in api/employees/route.ts; do in one plan (resolve id without Roblox; keep `source` knowledge for details)
03.1-WR-04 = 03.2-WR-01 (one change closes both)
03.1-WR-07 + 03.3-WR-01 (+ 03.1-WR-08 shrink the key count): shared limits in lib/portia-content.ts, then normalizer + editor + tests
03.1-IN-04 = 03.2-IN-01 (one change)
03.1-IN-06 = 03.3-IN-03 (+ content PUT, editors POST): one helper
03.1-IN-07 = 03.3-IN-04a (+ charter/sheet frame): sandbox for 3 iframes at once
03.1-IN-02 touches TS (3 places) and SQL (owner-applied)
03.1-WR-11 / IN-10 / IN-02(SQL) : single SQL migration block; owner applies; lands last, independent of code
05-WR-06 -> 05-IN-06 (write the css test with the new color)
01-IN-03, WR-02, WR-03 : same component (EmbeddedDocument), one plan
```

## MVP recommendation (priority for the roadmap)

1. **Employee-save data loss** (A): 03.1-WR-02, 03.2-WR-04/WR-02/WR-03, 03.1-WR-06, 03.1-WR-01 + 03.3-WR-02, 03.1-WR-03 + 03.3-WR-03, 03.1-WR-05, 03.3-WR-04. This is the milestone's stated first priority (data loss). Mostly `lib/portia-employees.ts`, `api/employees/route.ts`, `portia-editor.tsx` employee tab, `fetchEmployees`.
2. **Content sync and normalization** (B) + **robustness** (C): WR-04/03.2-WR-01 (small, high value), WR-07/03.3-WR-01 (policy), WR-08/09/12, IN-08, IN-02, IN-03, 03.2-IN-05, WR-10, IN-06/03.3-IN-03, IN-09.
3. **Security** (D): sandbox, `getEditorAccess` confirmed-email check, SQL migration block for the owner.
4. **Editor/format panel + embedded zoom** (E, F): 05-WR-01, WR-06 (+ test IN-06), 03.2-IN-04, 01 zoom trio; needs device checks (phone ГОТОВО, light-field contrast, sandboxed frames).
5. **A11y/copy and tests/housekeeping** (G, H): mostly S items; include the closure-without-code list (below).

### Closed with a note, no code (per milestone goal)
- 01-CR-01 (fixed in 01-03, verified in built HTML).
- 05-IN-02 (accepted by design), 05-IN-04 (record note), 05-IN-05 (owner-approved on devices; reopen only if Safari/Firefox are in scope), 05-IN-01 (accepted; the optional boundary test is 3 lines if wanted).
- 03.2-IN-03 second half (owner decision), 03.2-IN-02 mostly (logging exists; add one comment line).

Counts for REQUIREMENTS: code work in ~46 findings that collapse into roughly 25 distinct changes (see dependency groups); 8-9 are closures with a note or comment-only.

## Sources

- `.planning/milestones/v1.0-phases/PORTIA-01-ispravlenie-bagov/01-REVIEW.md`, `01-03-SUMMARY.md`
- `.../PORTIA-03.1-stabilizatsiya/03.1-REVIEW.md`, `03.1-REVIEW-DISPOSITION.md`
- `.../PORTIA-03.2-sotrudniki-i-svodka/03.2-REVIEW.md`
- `.../PORTIA-03.3-.../03.3-REVIEW.md`, `03.3-REVIEW-DISPOSITION.md`
- `.../PORTIA-05-oformlenie-teksta/05-REVIEW.md`, `05-REVIEW-DISPOSITION.md`, `05-07-SUMMARY.md`, `05-06-PLAN.md`
- Current code at repo root: `components/portia-desktop.tsx`, `components/portia-editor.tsx`, `lib/portia-employees.ts`, `lib/portia-content-normalize.ts`, `lib/editor-items.ts`, `lib/editor-changes.ts`, `lib/broadcasts.ts`, `lib/portia-cdn.ts`, `lib/editor-access.ts`, `app/api/{employees,content,editors}/route.ts`, `app/layout.tsx`, `app/portia.css`, `supabase/portia_setup.sql` (all read directly; confidence HIGH). `npm test`: 202 pass.
- Browser/DB runtime behaviour (sandboxed frames, `::highlight` thickness, RLS effects) not run here: MEDIUM/LOW until checked on a device or in Supabase.
