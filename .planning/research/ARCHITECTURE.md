# Architecture Patterns

**Domain:** Next.js 16 + Supabase + Netlify fan-site "PORTIA OS" - subsequent milestone v1.1 (closing v1.0 code-review debt, no new features)
**Researched:** 2026-10-19
**Overall confidence:** HIGH for file/line mapping and root-cause clustering (every claim below was checked against the code at HEAD d40c8b5); MEDIUM for the two design decisions flagged "decision" (limits policy, public-column SQL); MEDIUM for 05-review findings (browser behaviour, needs device check).

> Scope note. This is not a greenfield architecture. The existing system is documented in `.planning/codebase/ARCHITECTURE.md`. This file answers only: where each group of review fixes lands, which findings share one root cause, and in what order to build to minimise file conflicts.

## Recommended Architecture (what already exists, and the seams v1.1 touches)

```
Browser
  components/portia-desktop.tsx (1861 lines)  public windows, polls /api/content (10 s) + /api/employees (5 min)
  components/portia-editor.tsx  (2275 lines)  editor; EmployeeProfilesEditor is a self-contained region (1356-1645)
        |  fetch                                   ^ CDN-cached GET (Netlify-CDN-Cache-Control, purge by tag on write)
        v                                          |
app/api/{content,employees,editors,uploads,access}/route.ts   <- trust boundary: JSON in, sanitize*, getEditorAccess
        |
lib/ (pure, node:test-covered)  portia-employees.ts | portia-content-normalize.ts | editor-items.ts | editor-history.ts
                                 content-sync.ts | editor-changes.ts | broadcasts.ts | rich-text-style.ts
        |
Supabase (RLS + portia_* functions in supabase/portia_setup.sql; owner applies SQL by hand)
```

The seams that matter for v1.1:

1. **Content poll seam**: `fetchContent` (desktop 349-378) -> `content` state -> editor `sync` effect (editor 565-573) -> `historyReducer` `sync` case (`lib/editor-history.ts:62`). Identity of `content` is load-bearing.
2. **Employee write seam**: editor `EmployeeProfilesEditor.save` (editor ~1430) -> `PATCH /api/employees` -> `sanitizeEmployeeUpdate` -> `loadEmployees` (Sheets + Roblox + Supabase) -> `saveEmployeeProfile` upsert.
3. **Employee read seam**: `GET /api/employees` -> `acceptsRoster` -> `fetchEmployees` (desktop ~417) -> `setEmployees` + `localStorage`.
4. **Normalization seam**: `PUT /api/content` -> `normalizePortiaContent` (silent caps) -> DB -> `GET` -> `normalizePortiaContent` again.
5. **Pure-logic-in-lib pattern**: every fix that can be a pure function goes in `lib/*.ts` with a `node:test` file (`npm test` = `node --experimental-strip-types --test lib/*.test.ts`). Keep doing this; components stay glue.

### Component Boundaries (v1.1 write targets)

| Component | Responsibility | v1.1 changes land here for |
|-----------|---------------|---------------------------|
| `app/api/employees/route.ts` (116 l) | auth + HTTP shape for roster CRUD | JSON 400 helper, partial PATCH, no-Roblox id lookup, `code:"sheet"` in 403, GET flags (`manualRead`) |
| `app/api/content/route.ts` (71 l) | content GET/PUT with revision check | JSON 400 (currently `JSON.parse(raw)` -> 500), over-limit rejection |
| `app/api/editors/route.ts` (65 l) | editor allow-list | JSON 400 only |
| `lib/portia-employees.ts` (454 l) | roster, profile merge, sanitizers | partial-update sanitizer, roster-merge helper, `loadEmployees` option, strict `sanitizeManualDetails`, `startsWith("/")` regex, optional `staffRowsEnd` warn |
| `lib/portia-content-normalize.ts` (273 l) + `lib/portia-content.ts` | shape + caps | shared `contentLimits`, string coercion for broadcasts/infoSections, `endsAt < startsAt` repair |
| `lib/editor-items.ts` (52 l) + test | pure delete helpers | `removeRecycledVirus`, `removeRecycleFile` (orphan keys) |
| `lib/editor-changes.ts` (98 l) | section diff | one-token `?? []` guard |
| `lib/content-sync.ts` (4 l) | stale-answer guard | optional pure `shouldApplyFetched` for the poll fix |
| `components/portia-desktop.tsx` | public windows | poll skip, roster merge, EmployeeImage key, assistant fallback, EmbeddedDocument zoom + sandbox, YouTube sandbox, toast a11y, `today` init, updater purity |
| `components/portia-editor.tsx` | editor | three disjoint regions: (a) content editor 521-1350, (b) EmployeeProfilesEditor 1356-1645, (c) text formatting 1736-2036 |
| `lib/rich-text-style.ts` + `app/portia.css` | format panel logic/CSS | Phase-05 findings only |
| `supabase/portia_setup.sql` (+ `app/owner-login/actions.ts` if oracle is removed) | RLS, RPC | WR-11, IN-10, SQL half of IN-02 |

## Root-Cause Clusters

Finding IDs are `<phase>-<ID>`: `31`=03.1, `32`=03.2, `33`=03.3, `01`, `05`. Line numbers are HEAD, not the line numbers in the reviews (which have drifted).

### Cluster A - Poll replaces `content` object every 10 s (one bug, two findings, plus noise)

| Closes | Evidence at HEAD |
|--------|------------------|
| **31-WR-04 = 32-WR-01** (same defect, reported twice) | `fetchContent` calls `setContent(fetched)` unconditionally after `acceptFetchedContent` (which deliberately accepts an equal revision) |

**Root cause:** a fresh object identity on every poll. `historyReducer` `sync` compares `action.content === state.source` (identity), so after any poll the clean-state sync effect runs `initHistory` and drops `past`/`future`. The same identity churn re-runs every `[content]` effect (broadcast signature, quest-toast recompute, `rememberActiveQuests` localStorage write).

**Fix (one place, desktop `fetchContent`):** after the stale-answer guard, `if (fetchedRevision === knownRevision.current) return;` (the `finally { setContentReady(true) }` still runs). `knownRevision` starts at 0, and a row with a payload always has revision >= 1, so the first real fetch always applies; the 409 reset (`knownRevision = -1`) also still applies. The `contentApplied` ref proposed in the review is unnecessary; verify with a test on a pure predicate in `lib/content-sync.ts` (`shouldApplyFetched(revision, known)`), keeping `acceptFetchedContent` unchanged.
**Optional hardening:** editor sync effect (`[content, dirty, revision]`) could key on `revision` instead of identity; not needed once the poll stops re-issuing identical objects, so skip (ponytail).
**Files:** `components/portia-desktop.tsx` (fetchContent only), `lib/content-sync.ts` + `lib/content-sync.test.ts`.
**Also removes** the "toast effect re-runs every 10 s" churn noted in 32-WR-01 with no extra code.

### Cluster B - Employee PATCH is a full-replace of a full draft (root of the data-loss findings)

| Closes | Where |
|--------|-------|
| **31-WR-02** missing `biography`/`photoUrl` -> `""` -> wiped | `sanitizeEmployeeUpdate` (`lib/portia-employees.ts:~436`) |
| **32-WR-04** every save writes all six ratings, concurrent editors clobber | editor `save` sends `changes: draft` |
| **32-WR-02** payload without rating keys -> `profileOf` makes explicit `null` -> a save clears stored ratings; and `profilesRead === false` check misses an absent key | `profileOf` (portia-employees.ts:~45), editor load (editor 1421) |
| **33-IN-02** `sanitizeManualDetails({})` clears title/rank/callsign; duplicated `text` closure | `sanitizeManualDetails` / `sanitizeManualEmployee` |
| **31-WR-03** PATCH needs live Sheets + Roblox (up to ~18 s) and can 404 a valid employee when Roblox is down | PATCH calls `loadEmployees(supabase)` in full |
| **33-WR-03** details save non-atomic; "zero rows" mislabelled `pending-database` | PATCH route lines ~46-52, `updateManualEmployee` |

**Root cause:** the contract is "client sends the whole profile, server treats absent/mistyped as empty". Ratings already had the right semantics (absent = unchanged, `null` = clear) but biography/photo/knowledge did not, and the client never exploited it.

**Fix shape (one contract change, then three call sites):**
1. `sanitizeEmployeeUpdate` returns a patch containing only keys that are present and valid; `biography`/`photoUrl` become optional (`Partial`), wrong-typed present values reject with `null` (400). Drop the forced `knowledgeRating` (omit it from the upsert; the column has a default and is untouched on conflict). Add the tests the reviews ask for (`{pawsRating:5}` keeps biography untouched; `{}` is a 400 or a no-op).
2. `saveEmployeeProfile` builds the upsert from present keys only (PostgREST merge-duplicates updates only supplied columns). The existing "tolerate missing rating columns" retry stays.
3. Editor `save` sends only keys where `draft[key] !== profileOf(selected)[key]` (a tiny pure `profileDiff(saved, draft)` next to `profileChanged` in `lib/portia-employees.ts`, tested), plus `details` only when `detailsChanged`.
4. PATCH resolves the employee from the sheet + stored manual rows only (add an option to `loadEmployees`, e.g. `{ roblox: false }`) and matches by `id` or, failing that, by `employeeId(nickname,null)`/nickname key, saving under the client's `roblox-\d+` id. This drops the 8 s + 5 s + 5 s stack and the Roblox-outage 404.
5. `sanitizeManualDetails` returns `null` unless all three keys are strings; hoist one `clip64` helper used by both manual sanitizers. `updateManualEmployee` returns a distinct `"not-found"` for zero rows after the table is known to exist; route wraps it so a thrown error still returns the saved profile with `detailsPending: true`.
6. Editor load: `if (payload.profilesRead !== true) throw` (covers absent key and old cached degraded copy).

**Files:** `lib/portia-employees.ts` (+ `.test.ts`), `app/api/employees/route.ts`, `components/portia-editor.tsx` region (b) only.
**Decision for requirements:** PostgREST/`supabase-js` upsert of a partial object is documented to update only supplied columns on conflict, but a brand-new profile row (insert path) relies on column defaults (`biography ''`, `knowledge_rating 1`). Confirm with one integration check on the first save for an employee with no stored row (MEDIUM; cheap to test locally).

### Cluster C - Editor employee form: state races around a save

| Closes | Where |
|--------|-------|
| **32-WR-03** edits typed during an in-flight save are replaced by the server copy | `save` -> `setDraft(profileOf(payload.employee))`, inputs enabled while `saving` |
| **31-WR-06** `setTimeout(..., 1800)` "СОХРАНЕНО" never cleared; a second save is flipped to idle, employee switch allowed mid-PATCH | editor ~1463 |
| **33-WR-04** employees tab is a dead end when the roster is empty (cannot add) | editor ~1537 early `return` before the add button/form |
| **33-IN-04b** delete path matches Russian substring `includes("таблицы")` | editor ~1552 + route `DELETE` 403 body |

**Root cause:** `EmployeeProfilesEditor` has no single "saving" lock and renders the profile pane and the roster list in one early-return branch.
**Fix:** wrap the form in `<fieldset disabled={state === "saving"}>` (closes 32-WR-03 with zero logic and also makes `chooseEmployee` safe); `savedTimer` ref cleared before each save and on unmount (31-WR-06); render list aside + add form always, empty state only in the profile pane (33-WR-04); route returns `{ error, code: "sheet" }` for the sheet-employee 403 and the editor checks `payload.code` (33-IN-04b).
**Files:** `components/portia-editor.tsx` region (b) only; `app/api/employees/route.ts` (DELETE 403 body - same wave as Cluster D to avoid touching the route twice).
**Dependency:** apply after Cluster B step 3 (same `save` function); doing both in one plan avoids rebase pain.

### Cluster D - Reader-side roster accepts degraded answers (blank profile / vanished manual staff)

| Closes | Where |
|--------|-------|
| **31-WR-01** profiles read failed -> every employee blank on screen and in localStorage | `fetchEmployees` + `acceptsRoster` |
| **33-WR-02** manual read failed -> manual employees vanish on every device (and `DELETE` misreports 404) | same functions; `loadEmployees` returns only a combined `complete` |

**Root cause:** `acceptsRoster` guards only the empty-list case; `GET` exposes `profilesRead` but not "manual rows read".
**Fix (single pure function):** `mergeDegradedRoster(current, payload)` in `lib/portia-employees.ts`: if `profilesRead === false`, take roster/avatar fields from `payload` but keep the profile fields from `current`; if `manualRead === false`, keep `current` entries with `source === "manual"` that the payload lacks; never write a degraded payload to `localStorage`. `loadEmployees` returns `manualRead: manual.ok`; `GET` forwards `profilesRead` and `manualRead`. `DELETE`: when the manual read failed, answer 503 instead of "not found".
**Files:** `lib/portia-employees.ts` (+ test), `app/api/employees/route.ts` (GET, DELETE), `components/portia-desktop.tsx` (`fetchEmployees` only).
**Ordering:** after Cluster B (both change `loadEmployees` return/signature and the same route file).

### Cluster E - One missing helper: bad JSON body -> 500 (and its 413/shape siblings)

| Closes | Where |
|--------|-------|
| **31-IN-06** PATCH: invalid JSON / `null` body -> 500 | `employees/route.ts:33` |
| **33-IN-03** POST and DELETE same | `employees/route.ts:69,102` |
| (unreported siblings, same defect) | `content/route.ts:44` `JSON.parse(raw)` throws -> 500; `editors/route.ts:33` |

**Fix:** a ~6-line `readJsonObject(request): Promise<Record<string, unknown> | null>` (new `lib/api-json.ts`, or exported from `portia-cdn.ts` if you want zero new files) that does `request.json().catch(() => null)` and returns `null` unless the value is a non-null plain object; each handler returns 400 `{error:"Некорректные данные."}`. Content PUT keeps its `request.text()` + 2 MB check and wraps its own `JSON.parse` in the same null-return.
**Files:** the three route files + the new helper (+ a tiny test for the helper).
**Ordering:** put this in the **first** wave: every later API cluster edits these routes, and doing the boundary helper first removes one merge conflict source. Cluster B/D then build on the new handlers.

### Cluster F - Content normalizer: silent caps, loose shapes, orphan keys, type-change residue

| Closes | Where |
|--------|-------|
| **31-WR-07** 500 runs / 1000 `formattedText` keys cut silently; `infoSections`/`broadcasts`/`viruses` shapes not validated (`title: {}` crashes every visitor) | `portia-content-normalize.ts:46,67,176` |
| **33-WR-01** 50 subsections / 100 blocks / 100 rows silently dropped on save | `portia-content-normalize.ts:129,144,159` |
| **31-IN-08** quest with `endsAt < startsAt` never shows | `normalizeBroadcasts` (~79-95) + editor date inputs |
| **31-WR-08** hard-deleting a recycled virus / recycle file leaves `formattedText` orphans that eat the 1000-key cap | editor `deleteSelectedRecycledVirus` (~642), recycle-file delete, `lib/editor-items.ts` |
| **31-WR-09** `important` survives a type change and shows ВАЖНО on a quest | editor type `onChange` (~1077) and reader card (desktop ~1265) |
| **31-WR-12** `changedDossierTabs` spreads possibly missing `recycledViruses` | `lib/editor-changes.ts:76` |
| **31-IN-02** `startsWith("/")` admits `//host` | `portia-employees.ts` (sanitizer), `portia-content-normalize.ts:76`, editor `mediaUrlFromText` (~78), SQL `photo_url` check |

**Root cause:** the normalizer is the only validation layer, it truncates instead of rejecting, and the editor has no knowledge of its limits, so "saved" can mean "partially saved".
**Fix shape (decision: pick one policy up front - recommended below):**
- Add `contentLimits` to `lib/portia-content.ts` (runs, formattedText keys, subsections, blocks, tableRows) and import it in the normalizer and the editor. **Recommended policy:** raise the caps well above realistic use (runs 5 000, keys 5 000, 100/200/500) *and* reject with 400 in `PUT` when the incoming payload exceeds a cap (cheap pre-normalize count) so truncation can never be silent; disable the editor's "+" buttons at the limit. This is the least code that makes loss impossible.
- Coerce `id/title/body/published/important` in `normalizeBroadcasts` and `infoSections` item fields with the existing `asText`/boolean pattern; drop items without a non-empty string `id` (this is the "no crash on `title: {}`" fix; also add `text ?? ""` in desktop `FormattedText`, see Cluster H).
- `normalizeBroadcasts`: when `endsAt < startsAt`, clear `endsAt`; editor shows a one-line hint under the date inputs.
- `editor-items.ts`: add `removeRecycledVirus(content, id)` (deletes `virus:${id}:*` keys, including mutations) and `removeRecycleFile(content, id)` (deletes `portiaTextKey.recycle(id)`), with tests beside `removeBroadcast`'s. Wire the two editor call sites. A server-side "prune keys whose owner id is gone" in the normalizer would also close it, but needs every key pattern enumerated; prefer the explicit helpers (matches the existing `removeBroadcast`/`removeInfoSection` convention).
- Type change: in the editor handler `if (type !== "news") item.important = false`; gate the reader card on `item.type === "news" && item.important`.
- `lib/editor-changes.ts:76`: `...(content.recycledViruses ?? [])`.
- URL check: one `/^\/(?!\/)/` constant exported from `lib/portia-content.ts`, used by the three TS sites; SQL half goes to Cluster I.
**Files:** `lib/portia-content.ts`, `lib/portia-content-normalize.ts` (+ test), `lib/editor-items.ts` (+ test), `lib/editor-changes.ts`, `app/api/content/route.ts`, `lib/portia-employees.ts` (one regex), `components/portia-editor.tsx` region (a) only, `components/portia-desktop.tsx` (one-line reader gate).
**Ordering inside the cluster:** limits + normalizer first -> editor-items helpers -> editor wiring (buttons, type handler, hint). Cluster F (editor region a) and Cluster G (region c) never touch the same lines.

### Cluster G - Embedded frames and zoom (all in `EmbeddedDocument` + two iframes)

| Closes | Where |
|--------|-------|
| **01-WR-01** Ctrl+wheel lost once the iframe has focus | `EmbeddedDocument` (desktop 1484-1535) |
| **01-WR-02** `metaKey` counted as zoom modifier | same, two spots |
| **01-WR-03** overlay stuck / eats Ctrl+click, listeners per instance | same |
| **01-IN-03** `aria-label` hides the zoom level | same, line ~1531 |
| **31-IN-07** charter iframe has no `sandbox` | same iframe (line ~1524) |
| **33-IN-04a** YouTube iframe has no `sandbox` | desktop ~1245 |

**Root cause:** zoom is driven by keyboard state on the parent `window`, which an iframe swallows; the overlay is the mechanism.
**Fix:** drop `ctrlHeld`/keydown/keyup/blur listeners entirely; keep the overlay mounted with `pointer-events: none` (CSS `.document-app-zoom-layer`) and switch it to `auto` from a `pointermove` on the frame when `event.ctrlKey` (the review's own recommendation; ctrlKey only, which also covers trackpad pinch). `aria-label={`Сбросить масштаб, сейчас ${pct}%`}`. Add `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"` to the document iframe (no `allow-top-navigation`) and `sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"` to the YouTube iframe. Needs a real-browser check: Google's viewer and the GitHub Pages charter must still render, and the `transform: scale` zoom must still work with `allow-same-origin` absent/present (HIGH risk if `allow-same-origin` is omitted - keep it).
**Files:** `components/portia-desktop.tsx` (EmbeddedDocument + YouTube block), `app/portia.css` (one rule).
**01-CR-01 and 01-IN-01 are already fixed at HEAD** (see Stale list).

### Cluster H - Desktop render robustness and small a11y/idiom items (desktop only)

| Closes | Where |
|--------|-------|
| **31-WR-10** `assistantAdvice[assistantTipIndex]` can be `undefined` -> `FormattedText` throws -> whole desktop unmounts (no error boundary) | desktop ~1115 (the `??` fallback exists for idle/activity/offended branches only) + `FormattedText` (~1782) `runs` map |
| **31-WR-05** `EmployeeImage` keeps `failed`/`loaded` after `src` changes | desktop 1379; add `key={src}` at both call sites (1194-1195) |
| **31-IN-04 = 32-IN-01** (same finding twice) Escape only works if focus is in the toast; `role="status"` with buttons; `role="listbox"` without `option` | `QuestToast` (~1763), virus list (~1157) |
| **32-IN-03** toast over the owner's editor window; CSS comment overclaims | desktop toast effect + `app/portia.css:~446` |
| **32-IN-05** `today` is `""` until first tick -> wrong badges for one render | desktop ~276, `lib/broadcasts.ts` |
| **31-IN-09** side effects inside state updaters (`updateEmployee`, `removeEmployee`, `focusApp`) | desktop ~393-402, ~703 |
| **31-IN-01** settings storage key literal in 3 places (+ weak test) | `lib/accent-boot.ts:10`, desktop 541/682, `lib/accent-theme.test.ts` |
| **31-IN-03** `staffRowsEnd = 35` silently drops a 35th employee | `lib/portia-employees.ts` (optional `console.warn`; trivial) |
| **32-IN-02** poll freshness vs CDN purge: one-line comment/log | `portia-cdn.ts` / `content/route.ts` comment |
| **32-IN-04** undo of a type change leaves the Сводка on the wrong tab | editor `step` (region a, line ~610) |

**Root cause:** no error boundary and unchecked indices into content arrays that a 10 s sync can shorten. Two quick fixes (`?? "..."` and `text ?? ""` in `FormattedText`) remove the crash class. Consider adding `app/error.tsx`-style protection only if the milestone wants it; it is **not** in the findings, so do not add it (ponytail).
**Files:** `components/portia-desktop.tsx` (several disjoint regions), `lib/accent-boot.ts`, `lib/accent-theme.test.ts`, `lib/broadcasts.ts`, `app/portia.css`.
**Conflict note:** `updateEmployee`/`removeEmployee` (IN-09) sit in the same block as `fetchEmployees` (Cluster D). Do IN-09 in the same plan as Cluster D's `fetchEmployees` change.

### Cluster I - Database/security (SQL only; owner applies it manually)

| Closes | Where |
|--------|-------|
| **31-WR-11** authorization trusts JWT email without `email_confirmed_at`; anon oracle `portia_editor_is_approved` | `supabase/portia_setup.sql:52-97` |
| **31-IN-10** anon can read `updated_by`/`nickname`; owner email hard-coded; storage `select` policy lists the bucket | SQL 49, 155-162, 192-196, 243 |
| **31-IN-02** SQL half: `like '/%' and photo_url not like '//%'` | SQL line 22 |

**Code coupling to watch:**
- `portia_editor_is_approved(text)` is called from `app/owner-login/actions.ts:32` (sign-up gate). Removing the anon grant means rewriting the sign-up flow (hook or server-side check using a service-role/definer path). **Decision:** the minimum that closes the finding without a flow rewrite is to require `email_confirmed_at is not null` in `portia_can_edit`/`portia_is_owner` (join `auth.users` on `auth.uid()` inside the SECURITY DEFINER function) and document "Confirm email must stay on". Treat the oracle removal as optional/deferred unless the owner insists.
- IN-10 column-level grants break `readEmployeeProfiles`, which deliberately uses `.select("*")` (`lib/portia-employees.ts:~232`) so missing columns cannot fail the read. Either keep `select *` and expose a public view without `updated_by`, or switch to an explicit column list in the same change. Do not ship the SQL before the code change. Classify IN-10 as "owner decision / possible defer".
**Files:** `supabase/portia_setup.sql` (+ docs/comment), optionally `app/owner-login/actions.ts`, `lib/portia-employees.ts` (only if explicit columns).
**Conflict profile:** zero overlap with components; can be built **in parallel with anything**, but the owner-apply step needs lead time, so start it early.

### Cluster J - Phase-05 text-format panel (editor region c + rich-text-style + CSS)

| Closes | Where |
|--------|-------|
| **05-WR-01** ГОТОВО with unknown selection -> default caret `{0,0}` -> first word targeted | `FloatingTextFormatPanel.finish` / `FormattedTextarea` focus (editor ~1908-1915, 1759-1762) |
| **05-WR-06** underline `rgba(0,188,166,.9)` ~2.1:1 on the light field | `app/portia.css:516` |
| **05-IN-01** wiring untested | `lib/rich-text-style.test.ts` boundary test (3 lines) |
| **05-IN-02** own-input window edge cases | accept / document only (review: "None required") |
| **05-IN-03** import merge (comment half already fixed) | editor lines 23-24 |
| **05-IN-04** disposition doc says WR-02 plainly "fixed" | `.planning/phases/.../05-REVIEW-DISPOSITION.md` text edit |
| **05-IN-05** underline thickness unverified across browsers | device check, no code |
| **05-IN-06** "no fill in marker" guarantee not in `npm test` | new `lib/` test reading `app/portia.css` |
| **01-IN-02** drag handle lost its hint | `OrderDragHandle` (editor 179) - add `title` |
| **31-IN-05** unprofessional strings + empty `<small>` | editor ~1244/1258, ~1790, ~1840 |
| Excluded by owner decision | panel size presets (PROJECT.md Out of Scope) |

**Files:** `components/portia-editor.tsx` region (c) plus three string sites, `lib/rich-text-style.ts` + test, `app/portia.css`, planning doc. Behavioural items (WR-01, WR-06, IN-02) need a **device check** (phone + PC, light and dark field) - the only cluster that cannot be proven by unit tests alone.

## Findings that need no code or a recheck (close with a note)

Verified against HEAD:

| Finding | Status at HEAD |
|---------|----------------|
| 01-CR-01 darkreader-lock never rendered | `app/layout.tsx:22` now `{ "darkreader-lock": "true" }` -> fixed; confirm the `<meta>` in rendered HTML, then close |
| 01-IN-01 unlabelled Roblox portrait link | anchor has `aria-label="Профиль Roblox: {nickname}"` (desktop 1195) -> functionally fixed (add `title` only if you want a hover hint) |
| 32 "Resolved since previous review" list (CR-01, CR-02, old WR-04, IN-03, old IN-01) | resolved per the review itself - note only |
| 32 "not re-reviewed" old WR-02 / WR-03 / IN-02 | map onto 31-WR-07 / `markQuestsSeen` pruning / 31-IN-08; the first and third are Cluster F; `markQuestsSeen` pruning has no finding text in the supplied reviews - recheck |
| 05-IN-03 comment half | fixed by 7191038 |

Not individually verified at HEAD (treat as "verify first, then fix or close"): 31-IN-02 SQL, 31-IN-03, 05-IN-05, 32-IN-02. Everything else in Clusters A-J was confirmed present.

## Duplicate map (one fix, several findings)

| One fix | Closes |
|---------|--------|
| `fetchContent`: skip apply at equal revision | 31-WR-04, 32-WR-01 (+ toast/broadcast-effect churn) |
| `readJsonObject` helper | 31-IN-06, 33-IN-03 (+ content PUT, editors) |
| Partial PATCH contract + diff on client + no-Roblox id lookup | 31-WR-02, 31-WR-03, 32-WR-02, 32-WR-04, 33-IN-02, (33-WR-03 half) |
| `mergeDegradedRoster` | 31-WR-01, 33-WR-02 |
| `<fieldset disabled>` | 32-WR-03 (+ makes 31-WR-06 consequence harmless) |
| `contentLimits` shared + reject on PUT | 31-WR-07 (truncation half), 33-WR-01 |
| orphan helpers | 31-WR-08 (+ frees the 1000-key budget) |
| QuestToast Esc on `window` + `role="region"` | 31-IN-04, 32-IN-01 |
| `sandbox` on two iframes | 31-IN-07, 33-IN-04a |
| EmbeddedDocument pointer-driven overlay | 01-WR-01, 01-WR-02, 01-WR-03 (+ 01-IN-03 same lines) |
| `/^\/(?!\/)/` constant | 31-IN-02 (three TS sites) |

## Data Flow (corrected target state)

```
Employee save:  form -> profileDiff(saved, draft) -> PATCH {id, changes: patch, details?}
                -> readJsonObject -> sanitizeEmployeeUpdate (patch, 400 on bad types)
                -> roster from Sheets + stored rows only (no Roblox) -> saveEmployeeProfile(upsert present cols)
                -> purge tag -> 200 employee -> fieldset re-enabled, draft = server copy

Employee read:  GET -> {employees, degraded, profilesRead, manualRead}
                -> mergeDegradedRoster(current, payload) -> setEmployees + (non-degraded only) localStorage

Content poll:   GET /api/content (CDN) -> acceptFetchedContent -> equal revision? stop : setContent(new object)
                -> editor sync effect only when revision truly changed -> history survives
```

## Patterns to Follow

### Pattern 1: Pure function in `lib/` + node:test, component stays glue
**What:** `profileDiff`, `mergeDegradedRoster`, `shouldApplyFetched`, `removeRecycledVirus`, `readJsonObject`, `contentLimits` check.
**When:** any fix whose logic can be tested without React. Matches the existing 202-test suite.
```ts
// lib/content-sync.ts
export function shouldApplyFetched(revision: number, known: number): boolean {
  return revision !== known; // an equal revision is the copy already shown: a new object would reset editor history
}
```

### Pattern 2: Patch semantics end to end
**What:** absent key = unchanged, `null` = clear (ratings already work this way). Extend to biography/photo, and have the client send only what changed.

### Pattern 3: Reject, do not truncate
**What:** the trust boundary returns 400 with a Russian message when a cap is exceeded; normalizer caps stay as a backstop only.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Fixing the same defect twice because it was reported twice
31-WR-04/32-WR-01 and 31-IN-04/32-IN-01 are single fixes; track them as one requirement with two closers.

### Anti-Pattern 2: Shipping SQL before the code that depends on it
Column-level `select` grants (IN-10) break `select("*")`; the sign-up oracle removal breaks `editorSignUp`. SQL changes are applied by the owner out of band, so code must work **before and after** the SQL is applied (the repo already follows this: `isMissingColumnError` retry, `pending-database` statuses).

### Anti-Pattern 3: Adding an error boundary / rewrite "while here"
Not in any finding. v1.1 is review-debt only.

### Anti-Pattern 4: Parallel plans in `portia-editor.tsx` or `portia-desktop.tsx` without region discipline
Both files are >1800 lines; use the region map above.

## Change-Risk Considerations (replaces Scalability)

| Concern | Low risk | Needs care |
|---------|----------|-----------|
| Shared hot files | route files (small), lib modules | `portia-editor.tsx` (3 regions) and `portia-desktop.tsx` (6 clusters touch it) |
| Behavioural regressions | pure lib fixes (A, E, D-merge, F helpers) - unit-testable | G (iframe sandbox + zoom), J (focus/selection on phone) - need a real browser/device |
| Data safety | B and D protect data; test on a local profile row first | B insert-path with defaults; F reject-on-limit must not block a legitimately large existing document (check current prod payload size against new caps) |
| Out-of-band | I (SQL) depends on owner timing | start early |

## Suggested Build Order (phases/waves, conflict-minimised)

Ordering principles: (1) shared boundary helpers before consumers; (2) lib/API contract before the client that uses it; (3) one cluster per hot region of each giant component; (4) things that need owner or device time start early.

| # | Phase candidate | Clusters | Files touched (exclusive in this phase) | Depends on |
|---|-----------------|----------|-----------------------------------------|-----------|
| 0 | Triage ledger (docs only) | stale-list above | `.planning/` only | none; do first, shrinks scope |
| 1 | Server boundary + employee API contract | E, B (server half), D (server half), C (route 403 `code`) | `app/api/{employees,content,editors}/route.ts`, `lib/api-json.ts`, `lib/portia-employees.ts` + test, `lib/portia-content.ts` (limits), `lib/portia-content-normalize.ts` + test | 0 |
| 2 | Employees client (desktop + editor region b) | B (client half), C, D (client half), H (31-WR-05, 31-IN-09) | `components/portia-editor.tsx` 1356-1645, `components/portia-desktop.tsx` employee blocks (~393-440, 1379, 1194), `lib/portia-employees.ts` (`profileDiff`, merge) | 1 |
| 3 | Content integrity | A, F | `lib/content-sync.ts`, desktop `fetchContent`, `lib/editor-items.ts`, `lib/editor-changes.ts`, editor region (a) (delete handlers 642/1185, type handler 1077, add buttons, date hint), desktop reader gate | 1 (limits constants, normalizer) |
| 4 | Desktop robustness and embeds | G, rest of H | desktop (`EmbeddedDocument`, YouTube, assistant bubble, `FormattedText`, `QuestToast`, virus list, `today`), `lib/accent-boot.ts` + test, `app/portia.css` | 2 and 3 done (same file, different regions: sequence, do not parallelise) |
| 5 | Editor text-format panel and copy | J, 32-IN-04 (`step`), 31-IN-05 | editor region (c), `lib/rich-text-style.ts` + test, `app/portia.css:~516`, strings | 3 (region a done) |
| 6 | SQL / security | I | `supabase/portia_setup.sql`, possibly `app/owner-login/actions.ts`, `lib/portia-employees.ts` `readEmployeeProfiles` | none functionally; **start in parallel from Phase 1** because owner applies it by hand; IN-10 column-grant part only after Phase 2 |

Why this order:
- Phase 1 first because three routes and `lib/portia-employees.ts` are touched by clusters B, C, D, E; finishing the server contract once avoids four rebases, and Phase 2's `profileDiff`/`code:"sheet"`/`manualRead` need it.
- Phase 2 before 3 because data loss (employee wipe) is the milestone's stated priority and Cluster B/D are the only HIGH-impact defects; Cluster A/F are next.
- Phases 3 -> 4 -> 5 serialise the two giant components so no two plans edit the same file in one wave. If the roadmapper wants parallelism, Phase 6 (SQL) and a pure-lib-only slice of Phase 3 (normalizer, editor-items, editor-changes) are the only safe parallel pairs.
- Phase 5 last among code phases because it is the only one that needs on-device verification and has the weakest data-safety value.

Research flags for phases:
- Phase 1/2: Likely needs a short spike - confirm partial-column upsert behaviour on the insert path with the real Supabase project (MEDIUM now).
- Phase 3: Needs one check of the current production `portia_content` payload size/run counts before picking new caps (otherwise reject-on-limit could block an existing document).
- Phase 4: Needs a browser check of sandboxed Google viewer + GitHub Pages charter + YouTube nocookie embed.
- Phase 5: Needs device check (phone + PC, light/dark preview) - cannot be closed by tests.
- Phase 6: Owner decision on oracle removal and public-column strategy; otherwise standard.
- Phase 0: no research; standard.

## Sources

- Review files (HIGH, primary): `.planning/milestones/v1.0-phases/PORTIA-01-ispravlenie-bagov/01-REVIEW.md`, `PORTIA-03.1-stabilizatsiya/03.1-REVIEW.md`, `PORTIA-03.2-sotrudniki-i-svodka/03.2-REVIEW.md`, `PORTIA-03.3-sotrudniki-vne-tablitsy-i-gaydy-v-informatsii/03.3-REVIEW.md`, `PORTIA-05-oformlenie-teksta/05-REVIEW.md`
- Code at HEAD d40c8b5 (HIGH): `app/api/employees/route.ts`, `app/api/content/route.ts`, `lib/portia-employees.ts`, `lib/portia-content-normalize.ts`, `lib/editor-items.ts`, `lib/editor-history.ts`, `lib/content-sync.ts`, `lib/editor-access.ts`, `components/portia-desktop.tsx`, `components/portia-editor.tsx`, `app/layout.tsx`, `supabase/portia_setup.sql`, `app/owner-login/actions.ts`
- `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md` (HIGH, project context)
- PostgREST upsert merge semantics (MEDIUM, from training knowledge, not re-fetched this session; verify locally in Phase 1/2 spike)
