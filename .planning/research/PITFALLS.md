# Domain Pitfalls

**Domain:** Fixing review debt (WR/IN findings of phases 01, 03.1, 03.2, 03.3, 05) in a live Next.js 16 + Supabase + Netlify app with production data
**Milestone:** v1.1 «Закрытие замечаний» (no new features)
**Researched:** 2026-10-19
**Overall confidence:** HIGH for code-specific pitfalls (read against the current source: `lib/portia-employees.ts`, `lib/content-sync.ts`, `lib/editor-history.ts`, `lib/portia-content-normalize.ts`, `app/api/content/route.ts`, `supabase/portia_setup.sql`, `components/portia-desktop.tsx`); MEDIUM for browser behaviour of `sandbox` and `::highlight` (platform knowledge, not re-verified in a browser here).

## Fix groups used below

The roadmap should group the findings roughly like this. Each pitfall names its group.

| Group | Findings | Theme |
|-------|----------|-------|
| **G-EMP** | 03.1 WR-01/02/03/05/06, 03.2 WR-02/03/04, 03.3 WR-02/03/04, IN (400 vs 500) | Employee API + roster cache + editor save |
| **G-POLL** | 03.1 WR-04, 03.2 WR-01/IN-02/IN-05 | Content poll vs editor history |
| **G-CONTENT** | 03.1 WR-07/08/09/10/12, 03.3 WR-01, 03.1 IN-08 | Normalizer, limits, deletes, type change, crashes |
| **G-SEC** | 03.1 WR-11/IN-02/IN-07/IN-10, 03.3 IN-04, 01 CR/IN | SQL (owner applies) + iframe `sandbox` + URL checks |
| **G-UI** | 01 WR-01/02/03, 05 WR-01/WR-06/IN-*, 03.2 IN-01/03/04 | Zoom, phone format panel, a11y, copy, tests |

---

## Critical Pitfalls

### Pitfall 1: Two findings prescribe contradictory PATCH semantics (G-EMP)
**What goes wrong:** 03.1 WR-02 says `sanitizeEmployeeUpdate` must return `null` (HTTP 400) when `biography` or `photoUrl` is missing. 03.2 WR-04 says the editor should send only changed keys. If both are applied literally, the new "changed keys only" client gets 400 on every save that does not touch the biography, or a dev "fixes" it by sending the full draft again and WR-04 is lost.
**Why it happens:** Findings were written in different phases against different code, then fixed one by one.
**Consequences:** Saves break for every editor, or the fix for one finding silently undoes the other. Today `sanitizeEmployeeUpdate` (`lib/portia-employees.ts:433`) turns a missing `biography`/`photoUrl` into `""` and `saveEmployeeProfile` upserts them, so a partial body wipes both.
**Prevention:** Pick one contract before coding and write it in the `EmployeeUpdate` doc comment: **absent key = unchanged; `null` (ratings only) = clear; wrong type = 400; at least one known key required.** Then `saveEmployeeProfile` must build the upsert payload from present keys only (as it already does for the six optional ratings at line 422), not from `base` with defaults. PostgREST upsert updates only the columns in the payload, so absent columns survive. For a profile row that does not exist yet, absent columns fall back to table defaults (`biography ''`, `knowledge_rating 1`), which is acceptable and must be tested.
**Detection:** A unit test `sanitizeEmployeeUpdate({ pawsRating: 5 })` must yield an update with no `biography` key (not `null`, not `""`). A second test: the upsert payload for that update has no `biography`/`photo_url` property.

### Pitfall 2: Old clients and cached payloads meet the new PATCH contract (G-EMP)
**What goes wrong:** An editor has the site open from before the deploy (old JS bundle, full-draft PATCH) or the browser/CDN holds an old `/api/employees` copy. `/api/employees` is served with `s-maxage 600, stale-while-revalidate 86400`. A stale copy lacks the rating keys, `profileOf` maps them to `null` (03.2 WR-02), and the save clears all six stored ratings. Making the server stricter does not stop this because `null` is a legal "clear".
**Why it happens:** `null` and "key missing" are conflated in `profileOf` and in the editor draft.
**Consequences:** Silent loss of production ratings (the exact thing STAFF-01 delivered).
**Prevention:**
1. Editor: reject any roster payload where `profilesRead !== true` (strict, not `=== false`), so old cached degraded copies and pre-rating copies are refused. Show the existing "обновите страницу" style message.
2. `profileOf` keeps `undefined` for a key the employee object lacks; the diff-based `changes` omits it.
3. Server: never treat a missing key as clear. Only an explicit JSON `null` clears, and only for the six optional ratings.
4. Keep accepting the old full-draft body (all keys present) so a tab from the old deploy still saves. Do not add required fields.
5. Bump the roster cache key (`employeesCacheStorageKey`) when the payload shape changes so stale `localStorage` copies are not reused.
**Detection:** Test that a body with `knowledgeRating`, `biography`, `photoUrl` and no other ratings leaves the six optional ratings untouched; test that explicit `null` clears exactly that rating.

### Pitfall 3: "Fix" of the degraded roster writes blank data to the cache, or the opposite hides everyone (G-EMP)
**What goes wrong:** Two related findings: 03.1 WR-01 (degraded roster with empty profiles overwrites on-screen data and `localStorage`) and 03.3 WR-02 (failed manual-employee read drops all manual employees). A naive `if (degraded) return` drops legitimate sheet updates, and a naive "keep old entries" merge resurrects employees deleted by another editor or shows a deleted manual person forever.
**Why it happens:** Degraded has two independent causes (profiles unreadable, manual table unreadable) and a single flag.
**Consequences:** Visitors see blank biographies/ratings during a Supabase blip and the blank copy is cached on their device; or ghost employees.
**Prevention:** Expose two flags (`profilesRead`, `manualRead`) and merge per field group: when `profilesRead` is false keep stored profile fields (biography, photo, six ratings) by employee id and take roster/avatar from the answer; when `manualRead` is false keep existing `source === "manual"` entries. Never write a payload with either flag false to `localStorage`. Merge by id, never by index. Give `DELETE` a distinct 503 when the manual read failed instead of the misleading 404.
**Detection:** Tests that feed `{ profilesRead:false }` over a good roster and assert biography/ratings preserved; and the cache write is skipped. Manual: block Supabase in devtools, reload, check the Personnel window.

### Pitfall 4: Requiring `email_confirmed_at` locks out the owner or existing editors (G-SEC)
**What goes wrong:** Changing `portia_can_edit` / `portia_is_owner` to join `auth.users` with `email_confirmed_at is not null` returns false for any account whose email was never confirmed. Accounts created in the Supabase dashboard ("Add user"/invite without auto-confirm), accounts created while "Confirm email" was off in some setups, or owner created by a script can have `email_confirmed_at is null`. Every RLS write policy, `/api/content` PUT, `/api/uploads`, `/api/employees` and the editors list depend on these two functions, so one bad `create or replace` blocks all writes and the owner cannot even open the editors panel to repair it.
**Why it happens:** The repo cannot see the dashboard config or the `auth.users` rows. `getEditorAccess` swallows an RPC error into `noAccess` and logs it, so the symptom is "Нет доступа к редактору" with no hint.
**Consequences:** Total write lockout of a live site until the owner reverts SQL by hand.
**Prevention:**
1. Ship a read-only pre-check for the owner to run first: `select email, email_confirmed_at is not null as confirmed from auth.users where lower(email) = 'qloxzick@gmail.com' or lower(email) in (select email from public.portia_editors);` Apply the change only if every row says `confirmed = true`. If someone is unconfirmed, confirm them from the dashboard first (or `update auth.users set email_confirmed_at = now() where ...` by the owner), then apply.
2. Do not read `email_confirmed_at` from the JWT (it is not a standard claim) and do not trust `user_metadata.email_verified` (user-editable). Use a `security definer` function with `set search_path = ''` and fully qualified names, owned by the role that may read `auth.users`; keep `revoke ... from public, anon` and the existing `grant execute ... to authenticated`.
3. Include the exact old function bodies as a rollback block in the approval note (see Pitfall 6).
4. Keep `portia_editor_is_approved(text)` working for sign-up; if it is changed to stop answering `anon`, `editorSignUp` in `app/owner-login/actions.ts` calls it before sign-up and will return `error=setup` for everyone. Change it only together with the sign-up flow, or leave it and document the accepted enumeration risk.
5. Document next to the script that "Confirm email" must stay ON in the Supabase dashboard (the only real fix for the sign-up squatting scenario is dashboard-side, SQL only makes the helpers consistent with it).
**Detection:** After applying: log in as owner in a fresh incognito window, open the editor, save a no-op change (revision +1), open the editors panel. Test an editor account too. If any of these returns 403, run the rollback immediately.

### Pitfall 5: RLS / grant changes cannot be tested by the app code and break reads silently (G-SEC)
**What goes wrong:** 03.1 IN-10 suggests column-level grants that omit `updated_by` for `anon` on `portia_employee_profiles`. The reader does `select("*")` (`lib/portia-employees.ts:238`). With column grants that omit a column, `select *` as `anon` fails with "permission denied" for the whole request, `profilesRead` becomes false, and the site shows blank biographies and ratings to everyone (the degraded path from Pitfall 3). The same goes for dropping the storage `select` policy if any code lists the bucket.
**Why it happens:** Grant changes are invisible to unit tests and to `tsc`; `select *` expands to all columns at request time.
**Consequences:** Public employee data disappears after the owner applies SQL.
**Prevention:** Change the reader to an explicit column list first and deploy; only then apply the grant change. Prefer a view (`portia_employee_profiles_public`) over column grants only if the reader is switched at the same time. For IN-10, the accepted-risk option (document, do not change) is legitimate for a non-commercial fan site; closing it as "won't fix with reason" costs nothing. Grep `.list(`/`storage` usage before touching the storage policy (today no `.list(` call exists in `app`/`lib`, but uploads must still be able to `insert`/`select` as the editor).
**Detection:** After applying SQL, load the site anonymously and confirm a biography and ratings are visible; check the network response for `profilesRead: true`.

### Pitfall 6: SQL recorded in `portia_setup.sql` has no rollback and runs against live rows (G-SEC)
**What goes wrong:** The file is one idempotent script that the owner re-pastes. A tightened `CHECK` (`photo_url not like '//%'`) is added as `add constraint`, which validates existing rows and fails the whole transaction if one row violates it; or it succeeds and later blocks saves for a row. A function replaced without a copy of the old body cannot be reverted.
**Prevention:**
- Every SQL change ships as a small, separately runnable block, appended to `portia_setup.sql`, with: (a) the pre-check query, (b) the change, (c) a commented rollback block holding the previous definition verbatim. Never ask the owner to re-run the whole file for a one-function change.
- New constraints: `alter table ... add constraint ... check (...) not valid;` then `validate constraint` after checking `select count(*) ... where not (...)` is 0. Note the existing inline check has an auto name (`portia_employee_profiles_photo_url_check`); drop it by that name only after confirming it exists.
- Wrap in `begin; ... commit;` so a failed statement leaves nothing half-applied.
- The deployed code must work both before and after the SQL (the pattern `isMissingColumnError` already exists). Do not make the code depend on the SQL being applied.
- Keep the owner email out of new code paths; moving it to a deploy-time setting (IN-10) changes `portia_owner_email()` and has the same lockout risk as Pitfall 4, so treat it as "document, not change" unless the owner asks.
**Detection:** The approval note must contain the three parts; a plan task that lacks the rollback block is not done.

### Pitfall 7: `sandbox` on the embedded pages breaks Google Sheets, the charter site or YouTube (G-SEC)
**What goes wrong:** An iframe with `sandbox=""` or a short token list blocks scripts, same-origin storage, popups and forms. There are three iframes with different needs: Google Sheets `htmlview` (`portia-desktop.tsx:24`, needs scripts and same-origin for tab switching and rendering; links open in new tabs), the charter at `sdqwqsdawqd.github.io/S.E-Portia/` (an arbitrary page of the owner, may use scripts, storage, popups; may link out), and the YouTube nocookie embed (`:1245`, needs scripts, same-origin, presentation; the "Watch on YouTube" link and ads/links need popups). Omitting `allow-same-origin` makes YouTube show "Video unavailable" or error 153/150 in some browsers, and breaks the sheet (no cookies/storage).
**Why it happens:** `onLoad` still fires for a blocked page, so the "Загрузка документа…" spinner disappears and the user just sees a blank or broken frame; there is no error in the page, only a console message.
**Consequences:** The three windows look like the fix "worked" in the build but are broken for visitors; the reviewer cannot see it without a real browser.
**Prevention:** Use the same permissive-but-bounded list for all three, and drop only the dangerous tokens: `sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"`; add `allow-forms` for the sheet only if filters/tabs need it (test). Never add `allow-top-navigation`. Note `allow-scripts` plus `allow-same-origin` on a cross-origin page is safe with respect to the parent (the combination is only a problem for same-origin content); do not apply it to anything served from the site's own origin. Fullscreen is controlled by `allowFullScreen`/`allow=`, not by `sandbox`, but test it. `referrerPolicy` is independent, keep `strict-origin-when-cross-origin` for YouTube (it refuses embeds without a Referer) and `no-referrer` for the documents.
**Detection (manual device check, required):** In Chrome and on a phone: sheet loads, tabs switch, a cell link opens a new tab; charter loads and its internal navigation works, external links open; YouTube starts playing, fullscreen works, "Открыть на YouTube" works; a YouTube block in a guide subsection inside the Info window. If any of these fails, add the single missing token rather than removing `sandbox`. Record the final list and the browsers tried in the summary (05 IN-05 shows the cost of leaving this unrecorded).

### Pitfall 8: A content-equality check for the poll is too expensive, or misses changes (G-POLL)
**What goes wrong:** The 10 s poll replaces `content` with a new object, which resets editor undo/redo history (the reducer `sync` compares by identity) and re-runs every `[content]` effect. Fix options go wrong in two directions: (a) `JSON.stringify` equality on every poll on a payload that may be up to 2,000,000 bytes (the `PUT` cap) every 10 s per tab, plus `normalizeBroadcasts`/`normalizeInfoSections` re-allocation before the compare; (b) a revision-only skip that misses real changes.
**Why it happens:** Revision looks like a perfect key, but there are three edge cases where it is not: the first apply when no content has ever been applied (initial `knownRevision` may be 0 and the default content is revision 0); the 409 recovery path that sets `knownRevision = -1` on purpose; and a normalizer or default-content change deployed without a revision bump (cached content of the same revision stays old).
**Consequences:** Either the phone burns battery and the editor stutters on large guides, or a visitor never sees content that changed (for example after the owner restores the table from a backup, or a deploy changes defaults).
**Prevention:** Compare **revision**, not content: skip the apply only when `contentApplied.current && fetchedRevision === knownRevision.current` (03.2 WR-01/03.1 WR-04 fix) and do it before building `fetched` and before any normalizer call. Keep these paths intact: the first apply, the 409 reset (`knownRevision = -1`), the `savesAtSend === savesNow` guard, and the `finally` that clears the in-flight flag (an early `return` inside `try` still reaches `finally`; do not add a new early return before the `try`). When a fix changes the normalizer output shape, bump `contentCacheStorageKey` (`portia-content-last-success-v1`) so equal-revision cached content is re-normalized. Optionally also make the editor sync effect compare `revision` rather than object identity so a legitimately new object does not wipe history.
**Detection:** A test for `acceptFetchedContent`-adjacent logic (extract a pure `shouldApplyFetched` in `lib/content-sync.ts`): equal revision + applied = false; equal revision + not applied = true; lower = false; knownRevision -1 = true. Manual: edit, undo to clean, wait 12 s, redo still works; save in tab A, tab B shows it within about 10 s plus CDN delay.

### Pitfall 9: Normalizer changes reject or drop already stored content (G-CONTENT)
**What goes wrong:** 03.1 WR-07 proposes coercing `id`, `title`, `body`, `published` in `normalizeBroadcasts` and filtering out items "without a non-empty string id". Applied literally: (a) legacy items with a missing `published` become `published: false` (`item.published === true`) and disappear from the feed; `broadcasts.ts` filters on `item.published`; (b) items without an id are deleted on the next save, taking real posts with them; (c) `PUT` returning 400 for "over-limit" input blocks the owner from saving an otherwise valid document, since stored content (already truncated by `.slice`) is fine but the in-memory draft may exceed it.
**Why it happens:** The normalizer runs on every save (`PUT`) and on every cached read, so what it drops is physically deleted from Supabase on the next save. It is a destructive filter, not just validation.
**Consequences:** Silent permanent loss of news/quests/guide parts in production; an editor cannot save until they delete content by hand.
**Prevention:**
- Never drop on shape errors; repair. Missing `id` -> generate a stable one; non-string `title`/`body` -> `""`; `published` undefined -> keep the previous default for legacy items (check what the editor creates: if legacy items were always saved with `published`, say so in a test fixture).
- Before changing the normalizer, run it against a snapshot of the production `portia_content.payload` (owner exports one row) and assert `deepEqual(normalize(x), x)` for all fields the fix does not intend to change. This is the single most valuable test in the milestone.
- Limits: **raise caps and enforce the same constants in the editor** (03.3 WR-01 `infoLimits`) rather than returning 400. Never lower an existing cap. Today caps are 500 runs per rich text, 1000 `formattedText` keys, 50 subsections, 100 blocks, 100 table rows; checking the production payload for the largest actual values first tells how much headroom the new caps need.
- Over-limit in `PUT`: if 400 is chosen, the editor must show the message and keep the draft; it must never be the only way to learn that something was cut.
- Add a test for each new rule that "legacy shape X survives unchanged".
**Detection:** Round-trip test on a production snapshot (owner provides), plus diff of the saved payload before/after a no-op save in the real editor; revision +1 and no content difference.

### Pitfall 10: Orphan cleanup deletes live formatting (G-CONTENT)
**What goes wrong:** 03.1 WR-08 adds `removeRecycledVirus`/`removeRecycleFile` that delete every `formattedText` key starting with `virus:${id}:` or equal to the recycle key. An id prefix match is dangerous: `virus:1:` is a prefix of `virus:10:` only if the separator is missing, but ids that contain the separator, or ids reused after a delete (restore from Корзина gives the virus the same id), can make the cleanup delete the formatting of a live virus. A virus restored from the recycle bin must keep its formatting.
**Prevention:** Delete only on **permanent** delete (`deleteSelectedRecycledVirus`), never on move to the recycle bin; match with the exact key builders (`portiaTextKey.*`) rather than string prefixes where possible; if prefix, include the trailing `:`. Test: restore -> formatting still there; permanent delete -> keys gone; deleting virus 1 does not touch virus 10.

### Pitfall 11: The phone format panel regresses (G-UI)
**What goes wrong:** The panel is a focus/selection state machine (`fieldSelectionStep`, `own` input window, `finish()` with `flushSync(onClose)`, `onPointerDown`/`onMouseDown` `preventDefault`). Only the pure function is unit-tested; the wiring of React events to step events is checked only by a string grep. 05 WR-01 (ГОТОВО with unknown selection targets the first word) has a one-line fix (`if (!target.selection) return;`) that changes whether the keyboard comes back; "fixing" IN-02 (own-input window) changes the same window and re-opens CR-01 (stale range on re-entry, flag never cleared).
**Why it happens:** Focus and selection behave differently on iOS Safari, Chrome Android and desktop; nothing in CI exercises them. The owner's earlier approval (steps 1-6) was a device check.
**Consequences:** The very feature the owner asked for in TEXT-01 breaks on his phone while `npm test` stays green.
**Prevention:**
- Make the minimum change for each finding: WR-01 gets the guard and nothing else; IN-02 stays "none required" per the review; WR-06 (contrast) is a one-line CSS color change.
- Add the three-line boundary test (`read` at exactly `up + 400` is not own) and the CSS guard test (`::highlight(portia-format)` has no `background*`, has `underline`) because those are the only regressions CI can catch.
- Add a test for the new WR-01 case: `read` with `guarded: false`, collapsed `{0,0}`, no known selection -> not accepted as target.
- Re-run the owner's device checklist (PC Chrome, real phone, `preview-light` on) after any change touching `portia-editor.tsx` between lines ~1759 and ~1915. Do not claim "verified" from tests alone.
**Detection:** Open the panel with nothing selected, press ГОТОВО, reopen ✎: it must say «ВЫДЕЛИТЕ ТЕКСТ», not target the first word. Tap a word, change size, tap another field: no stale highlight.

### Pitfall 12: The `::highlight` colour change is invisible on one of the two backgrounds (G-UI)
**What goes wrong:** 05 WR-06 proposes a darker teal for the light field. `::highlight` cannot read custom properties from the field, so a single colour must work on both `preview-light` and the dark field. A too-dark teal disappears on the dark field (about the same ratio problem in reverse).
**Prevention:** Pick one mid-tone that has at least 3:1 against both `#f3f1e9` and the dark field (compute with a script, test both), or use a second highlight name per mode. Check the final value on both backgrounds before closing WR-06, and keep the "no fill" rule (G-05-2).

---

## Moderate Pitfalls

### Pitfall 13: In-flight edits fixed by disabling inputs makes the editor feel frozen (G-EMP)
**What goes wrong:** 03.2 WR-03 offers `<fieldset disabled={state === "saving"}>`. A disabled field loses focus and, on a phone, closes the keyboard and may blur the format panel; with a slow Netlify function (several seconds) typing is blocked.
**Prevention:** Prefer the non-blocking fix: apply the server copy only if the current draft still equals the snapshot that was sent (compare the sent `changes`). If a field changed in the meantime, keep the draft, keep `dirty` true, and merge only the server-side fields (updated timestamp). Test with a delayed fetch.

### Pitfall 14: The «СОХРАНЕНО» timer fix leaves a second save racing the first (G-EMP)
**What goes wrong:** 03.1 WR-06 clears the timer with a ref, but `chooseEmployee` is guarded only by `state !== "saving"`. Clear the timer at the start of `save()` and in unmount cleanup, and also keep a monotonically increasing request token so an answer from save N cannot overwrite the draft after save N+1 or an employee switch.
**Prevention:** A `saveSeq` ref compared when the response arrives; ignore stale responses.

### Pitfall 15: Server-side `loadEmployees` removal from PATCH breaks id matching (G-EMP)
**What goes wrong:** 03.1 WR-03 resolves the employee from the sheet only and accepts the client's id. If the id format check (`roblox-\d+` or `employeeId(nickname, null)`) is too loose, an editor can write a profile row for an arbitrary id; if too strict, valid manual employees (`roblox-N` rows in the manual table) and ids derived with Roblox casing fail. Manual-employee PATCH goes through the same route (03.3 WR-03).
**Prevention:** Validate against the pattern `^roblox-[0-9]+$` or a nickname-derived id that matches a sheet row; manual employees additionally exist in the manual table. Keep the 404 only for ids that match nothing. Test sheet row without a Roblox hit, sheet row with a Roblox hit, manual row, and an arbitrary id (must 404).

### Pitfall 16: 400-instead-of-500 handling changes the success path too (G-EMP / G-CONTENT)
**What goes wrong:** Replacing `await request.json()` with `.catch(() => null)` fixes POST/DELETE/PATCH but a shared helper that also swallows other errors hides real failures, and `Response.json({...}, { status: 400 })` without `noStoreHeaders` can be cached by the CDN for a later request. Also `JSON.parse(raw)` in `/api/content` PUT (separate path) still throws for bad JSON and returns 500.
**Prevention:** One helper `readJsonBody(request)` returning `unknown | null`, used by all four handlers (employees POST/PATCH/DELETE, content PUT); 400 with the same text the handlers already use. Mutating responses are never cached; verify headers in a test or by `curl -i`.

### Pitfall 17: Defensive guards for `undefined` hide the data bug and keep stored garbage (G-CONTENT)
**What goes wrong:** 03.1 WR-10 (`?? "Добавьте советы…"`) and WR-12 (`?? []`) stop the crash but leave inconsistent cached content. An error boundary around the desktop is the second line of defence; adding a boundary that renders nothing hides the crash from the owner.
**Prevention:** Fix both the read site (fallback) and the cause (`assistantTipIndex` clamped when the list shrinks); add one top-level error boundary with a visible "Перезагрузить" button, and log. Do not add the boundary to the editor in a way that swallows a failed save.

### Pitfall 18: Type-change cleanup deletes data the editor expects to restore (G-CONTENT)
**What goes wrong:** 03.1 WR-09 clears `important` when the type changes away from news. Undo (global history) restores the old item object, so `important` comes back with the type, which is correct; but clearing it in the reducer without a history entry, or clearing other fields (conditions, dates), makes switching type back lose user input.
**Prevention:** Clear only `important`, and do it inside the same change that sets the type (one history step). Also gate the reader on `type === "news" && important` so already-stored quests with a stray `important: true` stop showing «ВАЖНО» without a data migration.

### Pitfall 19: Ctrl+wheel overlay rewrite breaks scrolling and clicks inside the document (G-UI)
**What goes wrong:** 01 WR-01..03 fix: an overlay always mounted with `pointer-events: none` switched on by `pointermove` with `event.ctrlKey` gives the zoom a hook, but a `pointer-events: auto` overlay that stays on after Ctrl is released eats clicks and scroll; and listeners inside a cross-origin iframe are unreachable. `metaKey` removal changes macOS behaviour (Cmd+wheel no longer zooms; acceptable).
**Prevention:** Clear the overlay state on `keydown`/`pointermove` without `ctrlKey`, on `pointerleave`, `blur` and `visibilitychange`. Count only `ctrlKey` (trackpad pinch is reported as ctrl). Test by hand: click inside the sheet after releasing Ctrl, scroll the sheet, Ctrl+click a link. If the sandbox change (Pitfall 7) is made in the same phase, check zoom afterwards (transform scale of an iframe is independent of `sandbox`, but test).

### Pitfall 20: Testing a save fix against production data (G-EMP, process)
**What goes wrong:** The only run target is localhost, and `.env` may point at the production Supabase. A manual check of "save does not wipe the ratings" with a real employee can wipe production ratings if the fix is wrong.
**Prevention:** Test with a throwaway **manual employee** (03.3 feature, POST then DELETE), never with a sheet employee. Snapshot first: owner exports `portia_employee_profiles` and `portia_content` (CSV/JSON) before the milestone starts. Do not run `PUT /api/content` from automated scripts.

### Pitfall 21: Toast/notification fixes change seen-state storage (G-UI)
**What goes wrong:** 03.2 IN-03 (skip the toast while the editor window is open) and WR-03 of 03.1 (`markQuestsSeen` pruning) alter what is stored in `localStorage`. If a quest is marked seen when it was never shown (editor open), visitors on that device never see it. Bump the storage key only if the stored format changes; do not reinterpret the old format.
**Prevention:** Skip showing, but do not mark seen; test the sequence save quest -> close editor -> toast appears once.

---

## Minor Pitfalls

### Pitfall 22: Closing a finding as "already fixed" without evidence (all groups)
**What goes wrong:** The milestone includes closing outdated findings without code. 01 CR-01 (`darkreader-lock`) is listed as fixed in PROJECT.md but depends on rendered HTML. 03.2 IN-04 and similar are "accept".
**Prevention:** Each closure cites a commit hash or a command whose output shows it (for example `curl` the page and grep `darkreader-lock`). A finding without evidence stays open.

### Pitfall 23: Info-level text changes alter strings tests assert on (G-UI)
**What goes wrong:** Replacing the editor copy (05 IN-05, 03.1 IN-05) or the 403 message text breaks tests that match substrings, or the client code that matches `payload.error?.includes("таблицы")` (03.3 IN-04).
**Prevention:** Introduce the machine-readable `code` (`"sheet"`) in the 403 body first, switch the client to it, then reword. Grep the tests for the old strings before editing.

### Pitfall 24: Shared constants imported from client and server (G-CONTENT)
**What goes wrong:** `infoLimits` in `lib/portia-content.ts` imported by both the editor and the normalizer: `lib/*.test.ts` runs with `node --experimental-strip-types`, which requires explicit `.ts` extensions in relative imports; existing files use `./portia-content.ts`. A new import without the extension passes `tsc`/Next but fails `npm test`.
**Prevention:** Use the `.ts` extension in `lib/` imports, run `npm test` and `npx tsc --noEmit` and the build.

### Pitfall 25: `startsWith("/")` -> `/^\/(?!\/)/` forgets one of the four sites (G-SEC)
**What goes wrong:** The check exists in `portia-employees.ts:297`, `portia-content-normalize.ts:76`, `portia-editor.tsx:61` and the SQL check. Fixing three leaves `//host/x.png` accepted by the fourth; changing the SQL check is a constraint change (Pitfall 6) and can reject existing rows.
**Prevention:** One shared `isLocalOrHttpsUrl` in `lib/`, used in the three TypeScript sites; the SQL part is a separate optional block with a pre-check. Test `//evil.example/x.png` and `/photos/a.png`.

---

## Phase-Specific Warnings

| Fix group / topic | Likely pitfall | Mitigation |
|-------------------|----------------|------------|
| G-EMP PATCH contract | Contradictory findings (1), old clients (2) | Decide "absent = unchanged" first; refuse non-`profilesRead === true` rosters; keep accepting full body |
| G-EMP roster/cache | Blank cache, ghost employees (3) | Two flags, per-field merge, never cache degraded |
| G-EMP save UX | Frozen inputs, racing saves (13, 14) | Compare snapshot, `saveSeq` token |
| G-EMP id matching | Loose/strict id check (15) | Pattern + sheet row + manual table, 404 only for nothing |
| G-POLL | Expensive equality / missed change (8) | Revision compare, keep first-apply and 409 paths, bump cache key on shape change |
| G-CONTENT normalizer | Destructive filter (9), orphan cleanup (10), type change (18) | Repair never drop; production snapshot round-trip test; exact key builders |
| G-CONTENT robustness | Crash guards hide cause (17), 400 handling (16) | Clamp index + fallback + boundary; one `readJsonBody` helper |
| G-SEC SQL | Lockout (4), broken `select *` (5), no rollback (6) | Pre-check query, rollback block, explicit columns before grants, `not valid` constraints |
| G-SEC iframe | Blank sheet / video (7) | Permissive token list, device check on three frames |
| G-UI format panel | Focus regressions (11, 12) | Minimal diffs, boundary tests, owner device re-check |
| G-UI zoom | Overlay eats input (19) | Clear on every non-ctrl event |
| Process | Production data risk (20), closing without proof (22) | Manual employee for tests, export snapshots, evidence per closure |

## Ordering consequences for the roadmap

1. **Snapshot and read-only checks first** (owner exports content and profiles; email-confirmation pre-check query). Costs nothing and gates Pitfalls 4, 9, 20.
2. **G-EMP before G-POLL before G-CONTENT**: employee data loss is the stated priority; the poll fix is small and unblocks editor-history tests; the normalizer needs the production snapshot.
3. **G-SEC SQL last and separate**: it needs the owner, cannot be tested by the app, and the code must work either way. The `sandbox` change can ship earlier but needs the device check.
4. **G-UI format panel**: touch only after all else, with the owner's device re-check as the exit criterion.

## Sources

- Review files: `.planning/milestones/v1.0-phases/PORTIA-01-ispravlenie-bagov/01-REVIEW.md`, `PORTIA-03.1-stabilizatsiya/03.1-REVIEW.md`, `PORTIA-03.2-sotrudniki-i-svodka/03.2-REVIEW.md`, `PORTIA-03.3-.../03.3-REVIEW.md`, `PORTIA-05-oformlenie-teksta/05-REVIEW.md` (HIGH).
- Current source read for this document: `lib/portia-employees.ts`, `lib/content-sync.ts`, `lib/editor-history.ts`, `lib/portia-content-normalize.ts`, `app/api/content/route.ts`, `app/owner-login/actions.ts`, `lib/editor-access.ts`, `supabase/portia_setup.sql`, `components/portia-desktop.tsx` (iframes, poll, cache keys) (HIGH).
- `sandbox` token behaviour, PostgREST upsert column semantics, Supabase `auth.users.email_confirmed_at` and "Confirm email" behaviour: platform knowledge, not re-verified against current docs in this session (MEDIUM). Verify with the device check (Pitfall 7) and a dry run of the SQL pre-check (Pitfall 4).
