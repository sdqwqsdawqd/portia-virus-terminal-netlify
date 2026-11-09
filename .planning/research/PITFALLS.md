# Pitfalls Research

**Domain:** Adding nick-based access gate + levels 1-5 + «Пользователи» tab + unified design system to an existing public Next.js 16 / Supabase (anon + authenticated only, no service role) / Netlify CDN site (PORTIA OS)
**Milestone:** v1.4 «Доступ и единый стиль»
**Researched:** 2026-11-09
**Confidence:** HIGH for codebase-derived findings (read from source: `app/api/content/route.ts`, `lib/portia-cdn.ts`, `proxy.ts`, `next.config.ts`, baseline migration, `lib/editor-tabs.ts`, `lib/portia-device-binding.ts`, Promotion API). MEDIUM for platform behaviour (Supabase storage listing, Netlify durable/Vary) — Context7 was unavailable; confirmed only via web search, re-check on a deployed preview.

## Vocabulary used below (suggested phases, roadmap may rename)

| Id | Suggested phase |
|----|-----------------|
| P0 | Housekeeping: move tests/gates off `.planning/` paths (v1.3 carry-over), decide visual-baseline policy |
| PA | Access schema + RLS migration (people, requests, levels, audit) + `register_attempt` revoke + rls-reviewer |
| PB | Server gate: visitor session, content projection by level, CDN/cache behaviour |
| PC | Boot screen: nick entry + request UX (PC and phone) |
| PD | «Пользователи» tab: approve/reject/level rules |
| PE | Levels on content items (База вирусов, Справочник, Информация, Устав) |
| PF | Promotion integration + regression set (todo 2026-10-28) |
| PG | Design system (tokens -> surfaces) |
| PH | Rollout (gate flip), acceptance on isolated staging, owner PC/phone check |

Recommended order: P0 -> PA -> PD (admin tab, gate still OFF) -> PB -> PC -> PE -> PF -> flip gate -> PG (can run in parallel with PE/PF if tokens-first) -> PH.

---

## Critical Pitfalls

### 1. Gating only in Next.js while PostgREST stays open to anon (content leak via the database itself)

**What goes wrong:** The app route `/api/content` is gated, but `portia_content`, `portia_employee_profiles`, `portia_manual_employees` still have `grant select ... to anon` + policy `using (true)` (baseline migration lines 245-252, 273-280, 312-319). Anyone with the project URL + publishable key (public by design; the URL is visible in every `portia-media` image URL) reads the full payload via `/rest/v1/portia_content?select=*` and never meets the nick screen.
**Why it happens:** The server has no service role (hard rule), so every public read currently runs as `anon` and the table is open. Gating "in the route" feels sufficient.
**Consequences:** Anti-espionage goal fails completely; unnoticed because the UI works.
**How to avoid:** In PA: revoke anon `select` on the three tables and drop the `using (true)` anon policies; give `authenticated` editors a `portia_can_edit()` read policy. Serve visitors through a `security definer` RPC `portia_read_content(p_token_hash)` that returns the payload only for an approved, unrevoked token (anon may call it, but token hash is an HMAC secret). Add the new objects to `supabase/fingerprint/expected/portia.fingerprint.json`, `tests/e2e/fixtures/data/expected-authz.json`, `lib/phase16-expected-authz.test.ts`, `lib/portia-sql.test.ts`.
**Warning signs:** Any table with `to anon` in the expected-authz matrix other than intentionally public ones; `curl` of `/rest/v1/portia_content` with the publishable key returns 200 + rows (test this on isolated staging only).
**Phase:** PA (schema) + PB (reads), verified in PH on staging.

### 2. CDN serves gated content to everyone (and old public copies survive the rollout)

**What goes wrong:** `lib/portia-cdn.ts::publicCacheHeaders` sends `s-maxage=300, stale-while-revalidate=86400, durable` with tag `portia-content` / `portia-employees`. If the gated response keeps these headers, the first approved user's payload is served to the unapproved. Even if headers are fixed, the previously cached public copy can be served for up to 5 min (+24 h stale-while-revalidate) after deploy.
**Why it happens:** "Identical for every visitor" comment in `app/api/content/route.ts` stays true by habit; per-level projections make it false. Same URL, different body per cookie = classic cache poisoning.
**Consequences:** Cross-user leak, hard to reproduce locally (`netlify dev` does not emulate the CDN).
**How to avoid:** Gated endpoints return `noStoreHeaders` (both `Cache-Control` and `Netlify-CDN-Cache-Control: no-store`). At this scale (a few dozen users) do not try `Netlify-Vary: cookie=` — correctness over hit rate. In the gate-flip step call `purgeCacheTag` for both tags and assert from an anonymous client that `/api/content` and `/api/employees` return 401/403 with no `Cache-Status: hit`. Never let gated routes emit `Set-Cookie` through a cached path (`proxy.ts` comment already says GETs "must never carry Set-Cookie"; keep new routes either out of the matcher or `no-store`).
**Warning signs:** `Netlify-Cache-Tag` header present on any gated response; a 200 for anon right after flip; the same body hash for two different cookies.
**Phase:** PB; purge + anon assertion in PH.

### 3. Static page, bundle, HTML and localStorage still carry content

**What goes wrong:** `app/page.tsx` is a static prerender of `<PortiaDesktop initialContent={defaultPortiaContent}/>`: the whole default content is in the HTML and JS chunks for everyone. The client also seeds state from `localStorage["portia-content-last-success-v1"]` and `portia-employees-last-success-v1` before fetching (ARCHITECTURE.md), and the Google Sheet id + GitHub Pages URL are constants in `components/portia-desktop.tsx:40-41`.
**Why it happens:** Resilience features (last-good cache, bundled defaults for "Supabase not configured") were built for a public site.
**Consequences:** An unapproved visitor sees defaults in View Source/DevTools; a revoked or shared-device user sees cached content before the gate resolves; a user switching nick on one browser sees the previous person's content.
**How to avoid:** (a) Confirm with the owner that `defaultPortiaContent` is placeholder-only (it contains sample viruses МОРОК/АРАХНА — if any is real lore, strip it); keep `/` a static shell that contains zero real data. (b) Render the gate first; construct `PortiaDesktop` only after `/api/visitor` says approved (no flash). (c) Key the localStorage caches by approved identity + level, and wipe them on gate/deny/logout/revoke. (d) Move Sheet/Устав URLs into the gated payload (see #6). (e) Do not make `/` dynamic just to read cookies — it would put a personalised page behind a CDN that may cache it.
**Warning signs:** `grep` of `.next/static` for real virus codes/names; first paint shows desktop icons for a cookie-less client; content visible with JS disabled.
**Phase:** PB (+PC for gate-first render).

### 4. "Hide in the UI only" — API returns everything, filtered by the client

**What goes wrong:** The codebase already has the anti-pattern: `ScientistLog.lockedLevel` (II available / III, IV "заблокирована") is a display flag; the log text travels to every client (`components/portia-desktop-dossier.tsx:29`). Repeating it for levels 1-5 leaks every locked record to anyone with DevTools.
**Why it happens:** Filtering in the renderer is the cheapest change; payload is one big JSON blob (`viruses`, `recycledViruses`, `recycleFiles`, `infoSections`, `guideSections`, `broadcasts`, `formattedText`, `searchRecommendations`).
**Consequences:** Levels are decorative. Second-order leaks: `recycledViruses`/`recycleFiles` (Корзина holds deleted records), `formattedText` keyed by item id (`virus:<id>:external` survives after the virus is dropped), `searchRecommendations` and assistant phrases that name hidden items, search index built from unfiltered content.
**How to avoid:** One pure function `projectContentForLevel(content, level)` in `lib/`, applied server-side in the route (and unit-tested with `node --test`): removes items above level from every array **and** the keyed `formattedText`/trash/recommendation entries that reference them. Test by property: for each level 1..5, `JSON.stringify(projection)` contains none of the ids/strings of items above that level. Search index and assistant are built only from the projected content. Decide scientist-log semantics once: legacy `lockedLevel` 2/3/4 keep their meaning as a per-record optional restriction mapped onto the new 1-5 scale, not a second competing system.
**Warning signs:** A level-1 `fetch('/api/content')` response diff vs level-5 shows only differing flags; search finds hidden records.
**Phase:** PB (projection), PE (per-item level field + editor UI).

### 5. Editor round-trip destroys hidden records

**What goes wrong:** If the editor loads a projected (filtered) payload and "СОХРАНИТЬ" PUTs it back, items above the editor's level are deleted from `portia_content`. `PUT /api/content` only checks revision and closed tabs (`contentRefusal`), not "did the body come from a filtered view". Filtered and full views share one `revision` number.
**Why it happens:** Editors are also people with a level; the same GET feeds desktop and editor.
**Consequences:** Silent data loss of high-level records; revision conflict check passes.
**How to avoid:** Define that any `canEdit` account (tab-restricted or not) gets the full payload from an editor-only path; the visitor projection never feeds the editor. In `PUT`, reject bodies that miss ids present in the stored row unless they are in the trash/delete flow (server-side diff already exists in `editor-changes`), or merge by id. Add a test: save from a level-2 editor does not remove level-5 items.
**Warning signs:** Item counts drop after an editor save; v1.1 lesson "клиент объединяет ответ только с неизменёнными полями" re-appears.
**Phase:** PB/PE.

### 6. Embedded documents (Таблица, Устав) cannot be gated by an iframe

**What goes wrong:** «Таблица» is a link-shared Google Sheet (`.../htmlview?widget=true`) and the server also reads it as public CSV (`gviz/tq?tqx=out:csv`, `lib/portia-employees.ts:154`, `lib/portia-promotion-sheet.ts:10`); «Устав» is public GitHub Pages (`https://sdqwqsdawqd.github.io/S.E-Portia/`). The URLs are in the client bundle and in git history. A level on these apps hides the window, not the document.
**Why it happens:** Cross-origin iframes are outside the app's control; CSP `frame-src` only restricts what the site embeds, not who opens the URL.
**Consequences:** "Level 4 Устав" is only courtesy; anyone who saw the repo or bundle opens it. The roster in the sheet is also public, which matters for #9.
**How to avoid:** Decide explicitly in PE and write it down as a Known Limitation: either (a) external docs are display-gated only (remove URLs from the bundle, serve them in the gated payload, keep sheet/Pages unlisted), or (b) move Устав content into `portia_content` (real gating) — larger scope, owner decision. Do not claim level enforcement on iframes in any requirement or acceptance text. If the sheet must stay private-ish, change its Google sharing; the server CSV fetch would then break (test Promotion roster first).
**Warning signs:** Requirement text says "Устав доступен только с уровня N" with no mechanism; URL still present in `components/portia-desktop.tsx`.
**Phase:** PE (decision), PB (URL moved out of bundle).

### 7. Public storage bucket: images of hidden records stay reachable and enumerable

**What goes wrong:** `portia-media` is `public: true`, uploads are cached `31536000`, and `storage.objects` has `Public can read PORTIA media` for `anon` (baseline lines 1647-1651). Anon can **list** every object name (listing needs a select policy; public GET by URL does not — MEDIUM, verify) and fetch images of records they are not allowed to see. Image URLs are also embedded in the payload and immutable for a year at CDN/browser.
**Why it happens:** Media was designed as public (accepted risk IN-10-storage).
**Consequences:** Level-gated infection photos/mutation screenshots leak by enumeration; a revoked user who kept the URL keeps access forever.
**How to avoid:** Minimum for v1.4: drop the anon select policy (closes enumeration; known-UUID URLs still work) and document "media is unlisted-by-UUID, not access-controlled". Stronger option (only if owner wants real gating of images): private bucket + short-lived signed URLs minted in the projection step (breaks the 1-year cache and the media pipeline — call it out as a separate decision). Never put a restricted record's image URL into a lower-level projection.
**Warning signs:** `storage.objects` anon policy still in the fingerprint; projection leaves `image` fields of removed items in `formattedText`/trash.
**Phase:** PA (policy), PE (decision on signed URLs).

### 8. SECURITY DEFINER RPCs callable by the whole internet (the `register_attempt` lesson, repeated)

**What goes wrong:** With no service role, every visitor flow (request access, check status, read content) must be an RPC executable by `anon`. A definer function that is sloppy about `search_path`, caller checks, or return shape becomes a public API. Precedent: `portia_promo_register_attempt` is `grant ... to anon, authenticated` (baseline line 1597) with no caller; the baseline revokes from `public` on line 1573 and then re-grants — a copy-paste revoke/grant sandwich. `portia_editor_is_approved(email)` is an anon-callable oracle on editor emails.
**Why it happens:** PostgreSQL grants `EXECUTE` to `PUBLIC` on new functions by default; people grant "to anon, authenticated" to make the first test pass.
**Consequences:** Forged approvals, level escalation, bucket poisoning (anyone can lock out any `p_bucket_key`), enumeration of who is approved.
**How to avoid:** Per function: `set search_path = ''`, fully schema-qualified body, first statement `revoke all ... from public, anon, authenticated`, then grant only the minimum. Admin functions (approve/reject/set level/revoke) are `authenticated` only and check `portia_can_edit_tab('users')` **inside the body**; tables are RPC-only (`revoke insert,update,delete` from `authenticated`). Visitor functions take only the token hash and return a minimal, uniform shape. Revoke `register_attempt` from **anon and authenticated** (and keep `public` revoked); confirm `portia_promo_submit_request` (definer) calls the bucket logic inline (it does) so nothing breaks; update fingerprint + expected-authz in the same commit. Run `supabase-rls-reviewer` (project rule); apply only to the isolated staging; production migrations are owner-run and three older ones (`20261104000000`, `...0100`, `20261106000000`) are still unapplied — number the new migration after them and state the apply order.
**Warning signs:** A new function absent from `expected-authz.json`; `anon` in a function grant list that is not a visitor flow; `phase16-fingerprint` mismatch.
**Phase:** PA (and PF for the revoke).

### 9. Nickname impersonation and squatting

**What goes wrong:** The visitor is anonymous; identity = a typed string. The staff roster ("из таблицы") is public in the Google Sheet, so anyone can claim a real member's nick. Conversely an attacker can request a real member's nick first (nick-bound), blocking the real person.
**Why it happens:** Approval by a human looks like authentication, but the approver sees only text.
**Consequences:** An outsider approved as Level 2 staff; real member locked out; Promotion run under someone else's name.
**How to avoid:** (a) Restrict nick charset to Roblox's (`^[A-Za-z0-9_]{3,20}$`, matching `portia_manual_employees` 3-20) — kills homoglyph/zero-width tricks. (b) One canonical key, defined once: `lower(btrim(nick))` in SQL and the same function in TS (today SQL `lower(trim())` vs JS `toLocaleLowerCase("en-US")` could diverge for non-ASCII; the charset rule removes the gap) with a UNIQUE index on the key. (c) Level 2 is granted **at approval** (human click), never auto on request even if the nick is in the sheet; show approvers the claim kind, sheet match and Roblox profile link (Roblox lookup already exists). (d) Owner-level "release nick/reset device" action (Promotion already has `portia_promo_reset_device` owner-only — mirror it). (e) Two devices per person must be allowed (PC + phone): do **not** copy Promotion's strict one-device-per-nick binding; model a person with N device tokens, each approved or auto-linked by an editor.
**Warning signs:** Sheet-nick request shows "auto-approved"; the same nick differing only by case produces two rows; a real member reports "ник занят".
**Phase:** PA (key + unique), PD (approver evidence/reset), PC (validation).

### 10. Enumeration and spam of the request endpoint

**What goes wrong:** Status/duplicate responses reveal "this nick exists / is approved / is rejected"; the endpoint is anonymous and unauthenticated, so scripted POSTs fill the requests table and the editors' queue.
**Why it happens:** Helpful error messages; Promotion's `active-request` code already reveals existence.
**Consequences:** Editors drown in junk; a roster of members is harvested; DB growth.
**How to avoid:** Status is returned only for the caller's own device token; submit answers with one neutral code for "already exists/pending/approved" (UX copy: "Заявка принята или уже есть — ждите решения"). Rate limit in the DB with the existing bucket pattern (coarse /24 IP bucket + nick bucket via `portia_promo_attempt_buckets`-style table) but **separate bucket namespace** from Promotion (shared buckets lock people out of Promotion). Cap pending requests globally and per device; cap body size; extend the `pg_cron` cleanup (`portia-promo-cleanup`) to expire rejected/old requests. Beware coarse /24 and mobile CGNAT: a 5/15/60-minute escalation on the first failure punishes innocent users sharing an IP; define "failure" narrowly (invalid format, duplicate spam), not "pending".
**Warning signs:** Pending count grows overnight; response bodies or timings differ between known and unknown nick.
**Phase:** PA (tables/buckets/cron), PB (neutral responses), PC (copy).

### 11. Approval/revocation not enforced on the next request (stale approval)

**What goes wrong:** Approval is baked into a signed cookie or cached client state and stays valid after revoke or level downgrade. The existing client is deliberately resilient: `/api/access` returns 503 on blips and "the desktop keeps its last state on a non-OK answer"; `/api/content` is polled every ~10 s. If a 401/403 is treated like a 503, a revoked user keeps the open window and the cache.
**Why it happens:** Resilience code written for outages; cookies are cheaper than a DB lookup.
**Consequences:** Revoked/downgraded people keep seeing content until they reload — or forever from localStorage.
**How to avoid:** Cookie holds only an opaque device token; every gated request resolves token -> person -> status -> level in the DB (one RPC; cost is trivial at this scale). Separate explicit denial (401/403 with `code: "access-revoked"`) from transient failure (5xx/network): denial clears caches, unmounts the desktop, shows the gate; transient keeps last state. A level downgrade must close windows showing now-hidden records (re-project, drop stale window state/search results). Test with a deterministic fake: approve -> read -> revoke -> next poll returns gate.
**Warning signs:** Revoke in the Users tab and the other browser still updates for >1 poll interval; denial handled by the same branch as 503.
**Phase:** PB.

### 12. Editors approve themselves, grant above their own level, or lock out the owner

**What goes wrong:** «Пользователи» is open to **all** editors by default (tab kind `regular`, open unless in `closed_tabs`). Without rules, an editor approves their own request, grants level 5 to a friend or themselves, revokes/downgrades the owner or another editor, or two editors race on the same request. Any editor can also write `portia_content` directly in Supabase (known limitation D-11) — if item levels live in the payload, an editor can lower a level without touching the Users tab.
**Why it happens:** `portia_can_edit()` is the only check on most policies; "equal editors" is mistaken for "equal power".
**Consequences:** Level model meaningless; privilege escalation; no accountability.
**How to avoid:** Enforce in the definer RPC, not the route: caller must not be the target (no self-approve/self-level; different editor required); `new_level <= caller_level`; target's current level must be `< caller_level` (owner exempt via `portia_is_owner()`); editors are mapped to a level (decide: editors = 5 or an explicit level on their person row) and the owner can never be modified by editors; conditional state transitions (`update ... where status='pending'`) plus an advisory lock to survive concurrent clicks; every change appended to an audit table (actor, target, old/new, time). Keep per-item level definitions out of the freely-writable payload if they must be trustworthy (separate owner/definer-guarded table), or write down that editors can bypass it (extend D-11) — decide in PA. Add `users` to `tabRegistry` as `regular` and add a staging test for a `closed_tabs` editor.
**Warning signs:** Users tab can edit the row of the viewer; no audit table in the migration; `grant update on ... to authenticated` on people tables.
**Phase:** PA (rules in SQL), PD (UI/route), PE (where item levels are stored).

### 13. Rollout lockout and chicken-and-egg

**What goes wrong:** On the day the gate goes live every existing visitor (members, the 34 sheet staff, current Promotion users) is locked out and nobody is pre-approved; the only approvers are editors, who must first discover that `/owner-login` still works from behind the gate. Existing editors on a new browser hit the gate too. Existing `portia_promo_device_bindings` look like identities but are not approvals.
**Why it happens:** Feature ships as one switch.
**Consequences:** Site effectively down for the community; panic bypass added.
**How to avoid:** Ship in two steps: (1) schema + Users tab + request form with the gate **off** (a feature flag/`portia_settings` row owned by the owner), (2) let people submit, approve the known community (offer a bulk "approve all sheet staff as level 2" owner action — knowing #9 — and the owner's own row), then flip. Authenticated editors (confirmed email, `portia_can_edit`) bypass the nick gate; the gate always shows a visible «Вход для редакторов» link; `/owner-login`, `/api/access`, auth callbacks stay outside the gate. Pre-fill the nick from the existing Promotion binding but require a fresh request.
**Warning signs:** No flag in the plan; acceptance only tested with an empty database.
**Phase:** PH (flip), PD/PA (flag, bulk approve).

### 14. Breaking the Promotion flow (two identity stores)

**What goes wrong:** Promotion today takes a nick typed in the app, checks the sheet roster (`findPromotionAccessEntry`) and binds it to the `portia_promo_device` cookie. Requirement: Promotion "берёт ник из одобренной заявки". If the client still sends `nickname` and the server trusts it, an approved person can run Promotion for someone else; if the server ignores it, existing in-flight requests keyed by `nickname_key` and bound devices break. "Не из таблицы" users are not in the roster and will get a confusing "not found".
**Why it happens:** Two cookies, two tables, same word "ник".
**Consequences:** Impersonation inside Promotion; orphaned requests; regression in a flow whose live proof is already BLOCKED.
**How to avoid:** Resolve the nick **server-side** from the visitor session and ignore/validate any client nickname against it; keep the promo device cookie and bindings untouched in v1.4 (link, do not merge); keep `nickname_key` normalization identical to the access key (#9); explicit UI message for approved-but-not-in-sheet. Write the regression set first (the 2026-10-28 todo): submit -> status -> test -> reviewer queue, with unit/contract tests (live proof stays BLOCKED, never PASS). Do the `register_attempt` revoke in this phase's migration with the Promotion contract tests green.
**Warning signs:** `components/portia-promotion.tsx:418` still posts a free-text nickname; promo tests only mocked at `portia-promotion-api` level.
**Phase:** PF.

### 15. Visual restyle as a big bang

**What goes wrong:** `app/portia.css` is one monolith with 23 `max-width` media queries, accent system (`--accent-hue`, `data-accent`, PNG filter recolouring, "Свой" neutral-grey rule D-23), wallpapers, spider, assistant. Restyling "all at once" breaks windows, editor mobile panel, template export, and the owner then judges a moving target (phase 20 reached 63 plans in verdict loops).
**Why it happens:** "Unified style" sounds like one task; variants/choices invite endless iteration.
**Consequences:** Regressions spread across apps; cannot bisect; milestone overruns.
**How to avoid:** Tokens first with **current values** (no pixel change, assert by computed-style spot checks), then migrate surface by surface (windows chrome/close button, buttons/plaques/radius, editor tabs, apps). Offer owner **one** round of 2-3 variants as plain text/screenshots, record the choice as a D-xx with the owner's words, then freeze. Cap verdict cycles per surface (1 re-do). Do not rebuild review galleries or the per-hash ledger (owner dropped them 2026-11-08); report changes as text. Keep class names that other systems depend on (next pitfall).
**Warning signs:** A plan titled "restyle everything"; token PR that changes rendered colours; third round of variants.
**Phase:** PG.

### 16. Visual-baseline and test-path churn

**What goes wrong:** 33 owner-approved snapshot bytes plus `scripts/phase15-visual-manifest.mjs --verify-promotion` and many tests read `.planning/` paths (24 hits in 9 `lib/*.test.ts`; `phase20-release-gate`, `phase15-visual-manifest`). Any restyle changes every PNG; the gate (which also assumes anonymous visitors see the desktop) makes every visitor e2e spec land on the gate; running `--verify` in default mode rewrites signed evidence markdown.
**Why it happens:** Evidence infrastructure from v1.3 is still wired in; v1.3 archive move (first step noted in MILESTONES.md) not done.
**Consequences:** `npm test` red for reasons unrelated to the change; temptation to force baselines or fake PASS.
**How to avoid:** P0 first: repoint tests/gates to `milestones/v1.3-*` archive copies or fixtures. Decide the baseline policy before PG: baselines regenerate once, from current code, after the owner's overall «принято»; never run `--verify`. Add an "approved visitor" actor/fixture to e2e (cookie or stubbed `/api/visitor`) and update `tests/e2e/fixtures/data/public-content.json` usage; privileged and staging lanes stay BLOCKED, not PASS.
**Warning signs:** Plans touching `20-*` evidence docs; e2e specs failing at "desktop not found".
**Phase:** P0, PG, PH.

### 17. Template export and CSS-class coupling

**What goes wrong:** `lib/portia-template-export.ts` copies site CSS into exported templates by a whitelist of class names (`cardClasses`: `record-view`, `class-badge`, `level-1..3`, `mutation-card`, ...). Renaming classes in the restyle silently produces unstyled exports; `level-1/2/3` also collide in meaning with access levels 1-5 (grep noise, wrong selector edits).
**How to avoid:** Keep these class names stable during PG or update whitelist + export test in the same change; name access-level styling differently (`access-level-*`). Run the template builder/export tests in PG's definition of done ("Видимая часть" window is in scope of v1.4 too).
**Phase:** PG (and the «Видимая часть» item).

### 18. Contrast, accents and mobile regressions in the design system

**What goes wrong:** Open axe findings carried from v1.3: `.eyebrow` 4.28:1, `small.formatted-text-field-hint` 3.53:1, `small[title]` 3.25:1, `.nested-editor-toggle` label mismatch. New tokens that look fine on the default teal fail on amber, red, or the custom/neutral accent; "fixing" by brightening everything changes the identity. Shortcuts at 521-900px (WR-01/02) are still open; the nick input on phones triggers iOS zoom (<16 px font) and keyboard covering; the Users tab (tables) and tab-format unification touch the already fragile editor mobile panel (repeated `(max-width: 900px)` query, 05-WR-05).
**How to avoid:** Contrast tokens are checked per accent (ice/amber/red/custom incl. grey) with axe in the Playwright matrix (five projects); fix the four known findings by token, not per-selector patches. Gate/boot and Users UI built mobile-first: inputs >=16 px, 44 px targets, `autocomplete="off"`/`nickname` semantics, visible focus, errors in `role="alert"`, `lang="ru"` copy. Add 375/414/768/900 widths to the checks for new surfaces; fold WR-01/02 into the window/shortcut restyle step. Physical PC+phone check is a small written checklist (the 80-step UAT must not return), owner-run at the end.
**Warning signs:** axe violation count rises in any accent; layout checked only at 1440 px.
**Phase:** PG, PC, PD.

---

## Moderate Pitfalls

### 19. Boot animation vs gate ordering
**What goes wrong:** Boot plays once per session (`sessionStorage`, `html[data-boot="seen"]` set before first paint) and the nick screen lives "on the boot screen". Gate shown only on the first load of a session, or content mounting behind the animation.
**Prevention:** Gate is a state of the app, not a boot step: `seen` boot must not skip the gate; decision comes from the visitor endpoint, not the animation. **Phase:** PC.

### 20. Naming collisions (`access`, `level`, «Доступ»)
**What goes wrong:** `/api/access` + `getEditorAccess` = editor rights; an owner-only «Доступ» editor panel exists; `lockedLevel` = scientist-log display lock; `level-1..3` = CSS classes. New visitor access invites overloading `/api/access` and mixing editor `canEdit` with visitor approval.
**Prevention:** New namespace (`/api/visitor`, `portia_visitor_*`, `access_level`), glossary in the phase CONTEXT, keep `/api/access` for editors unchanged. **Phase:** PA/PB.

### 21. Normalizer drops or mis-defaults the new field
**What goes wrong:** `normalizePortiaContent` repairs/removes unknown shapes and `contentRefusal` fails closed on unclassified keys (`unclassifiedTextKeys`): a new per-item `minLevel` is stripped on save, or restricted editors get 400 "Некорректная структура данных". A missing level silently defaulting to "visible" (or to 5, hiding everything).
**Prevention:** Add the field to normalizer, `editor-changes` section classification and tests; explicit rule: *missing* (legacy) = documented default (e.g. 1), *invalid/garbage* = most restrictive (fail closed). Migration of existing items is a no-op by design. **Phase:** PE.

### 22. Leaking via metadata, indexing and previews
**What goes wrong:** Currently safe (static `metadata` in `app/layout.tsx`, no sitemap/robots/OG image), but adding `generateMetadata` from content, OG images, or per-item routes would expose titles to crawlers and link-preview bots (Discord/Telegram fetch anonymously).
**Prevention:** Keep metadata static; add `robots: { index: false, follow: false }` and a `noindex` header; no per-record URLs/OG; hash-based window state must not put record ids in the URL. **Phase:** PB.

### 23. CDN purge and Set-Cookie interplay in `proxy.ts`
**What goes wrong:** `proxy.ts` matcher deliberately excludes `/` and CDN-cached GETs. Adding visitor-session cookies (`Set-Cookie`) to a route that still has `Netlify-CDN-Cache-Control` could cache one user's cookie.
**Prevention:** Any route that sets or reads the visitor cookie is `no-store` and `force-dynamic`; cookie `HttpOnly; Secure; SameSite=Lax`, secret-keyed token digest like `lib/portia-device-binding.ts` (`PORTIA_PROMOTION_DEVICE_SECRET` pattern; new secret named separately, never printed). **Phase:** PB.

### 24. Users tab polling and queue UX
**What goes wrong:** 10 s polling from each editor + pending badge costs requests; list pages unbounded; reject/approve without reason or undo; stale-list approvals of a request already decided.
**Prevention:** Fetch on tab open + manual refresh + slow visible-only poll; pagination/limits (content-limits pattern); optimistic concurrency per row (`updated_at`/status condition) with clear 409 text. **Phase:** PD.

### 25. Approver sees no context, rejected people retry forever
**What goes wrong:** Reject is final or invisible; user sees nothing.
**Prevention:** Distinct visitor states (pending / rejected with cooldown / approved / revoked), cooldown enforced in DB, owner can clear. **Phase:** PC/PD.

## Minor Pitfalls

- **Dark Reader lock / fonts:** keep `darkreader-lock` meta and Cyrillic faces when introducing new tokens or fonts (owner wants to choose fonts/SVG animations first — propose variants before adding). Phase PG.
- **Close button / maximised windows:** `window-geometry.test.ts` and `shortcut-layout.test.ts` encode current geometry; update tests with intent, not to green. Phase PG.
- **«Информация» compact sections button on phone:** reuse existing responsive pattern; do not add a fourth copy of the 900px query. Phase PG.
- **Unified editor tab format:** `tabRegistry` is the single source; adding «Пользователи» is one line (`regular`), but UI strip and closed-tab messages (`closedMessage`) must be checked. Phase PD.
- **Env/secret hygiene:** never read/print `.env*`; new HMAC secret documented in `.env.example` only.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Cookie with "approved" claim, no DB lookup | One fewer RPC | Revocation impossible (#11) | Never |
| Filter by level in the React renderer | 1-hour change | Pure decoration, leaks all data (#4) | Never |
| Keep anon `select` on `portia_content` "for now" | No RPC rewrite | Gate bypass (#1) | Never |
| Item levels inside the payload | No new table | Any editor can rewrite them (D-11) | Only if documented as accepted risk by the owner |
| Auto-approve sheet nicks | Smooth onboarding | Impersonation (#9) | Never; bulk **owner-clicked** approve is fine |
| Big-bang CSS rewrite | Looks done fast | Unbisectable regressions (#15) | Never |
| Updating snapshots to turn tests green | Fast CI | Evidence meaningless | Only after owner overall «принято», once |
| Gate flip without flag | Simpler code | No rollback, community lockout (#13) | Never |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Supabase RLS/RPC | `grant ... to anon, authenticated` copy-paste; definer without `search_path=''` | Revoke from public first, minimal grants, checks inside body, fingerprint + expected-authz updated |
| Supabase storage | Assuming "public bucket" means no leak surface | Drop anon list policy; decide signed URLs explicitly |
| Netlify CDN | Reusing `publicCacheHeaders` on a per-user route; trusting local dev for cache behaviour | `noStoreHeaders`; verify with `Cache-Status` on a deploy preview; purge tags at flip |
| Netlify `durable` | Assuming deploy clears everything | Purge tags explicitly at rollout (deploy-time invalidation behaviour not confirmed, MEDIUM) |
| Google Sheet / GitHub Pages | Treating iframe src as protected | Public by nature; document as limitation or move content in-app |
| Promotion | Merging cookies/bindings with the new session | Link, don't merge; server-side nick resolution |
| Roblox lookup | Using it as proof of ownership | Evidence for approvers only |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-request DB resolve of token on every poll | Latency on `/api/content` | Single RPC returning level + payload; poll interval >=10 s | Hundreds of concurrent viewers (not expected) |
| Losing CDN caching on content | More Supabase reads | Accept; community is small | >~1-2K active users |
| Large projected payloads per level | Slow first paint | Project server-side, keep body limits (`MAX_CONTENT_BODY_BYTES`) | Large Справочник with images |
| Users tab unpaginated | Slow tab after spam | Limits + cleanup cron | A few thousand requests |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Anon read of content/profiles via PostgREST | Total bypass of gate | #1 revokes |
| Status endpoint reveals nick states | Roster harvesting | #10 uniform responses |
| Self/escalating approvals by editors | Level model void | #12 DB-enforced rules + audit |
| Client-supplied nickname trusted in Promotion | Impersonation | #14 server-side resolution |
| Raising item level via direct `portia_content` write | Bypass of restrictions | Separate guarded storage or documented accepted risk |
| Public profile columns (`updated_by`, `nickname`) in `/api/employees` | Leaks editor ids/nicks to the gated-out | Gate `/api/employees` too; select explicit columns |
| Secrets in logs | Credential exposure | Never print env/cookies/token hashes in `console.error` |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Gate that says only "доступ закрыт" | Members think the site broke | Clear states: enter nick, pending, rejected, revoked; link for editors |
| Losing access on cleared cookies/new phone | Re-request every time | "Тот же ник, новое устройство" flow approved by an editor |
| Long form on phone | Abandoned requests | One field + radio «из таблицы / не из таблицы» + submit |
| Hidden items vanish without explanation | Confusion about levels | Show level badge of the user; neutral "не доступно" only where an owner wants a teaser (and then no title leaks) |
| Restyle changes familiar hit areas | Regressions on shortcuts/windows | Move surface by surface; owner checks text list of changes |

## "Looks Done But Isn't" Checklist

- [ ] **Gate:** anon `curl` of `/api/content`, `/api/employees`, and PostgREST tables (staging) returns nothing; JS-disabled view shows no data.
- [ ] **CDN:** `Cache-Status` is miss/bypass for gated routes; both cache tags purged at flip.
- [ ] **Projection:** per-level property test covers viruses, trash, recycle files, `formattedText`, recommendations, info/guide, search index.
- [ ] **Editor save:** a restricted editor's save does not delete higher-level records.
- [ ] **Revocation:** revoke/downgrade is visible to an open session within one poll; localStorage cleared.
- [ ] **Users tab rules:** no self-approve, no grant above own level, owner untouchable, concurrent clicks safe, audit row written.
- [ ] **RLS:** `register_attempt` revoked from anon+authenticated; fingerprint/expected-authz/`portia-sql.test.ts` updated; rls-reviewer run; staging-live proof marked BLOCKED if staging is not attested.
- [ ] **Promotion:** nick comes from session; regression set green; live proof honestly BLOCKED.
- [ ] **Existing users:** editors can log in from behind the gate; flag allows rollback; known community pre-approved.
- [ ] **Design:** tokens contrast-checked for every accent; four known axe findings fixed; template export still styled; phone widths checked.
- [ ] **Evidence:** no BLOCKED recorded as PASS; physical PC/phone check is the owner's words, not an agent's.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Content leaked via anon table / CDN | HIGH | Revoke grants in a hot migration (owner-run), purge both tags, rotate nothing (publishable key is public), assess what was exposed, tell the owner |
| Stale approvals after revoke | LOW | Force `revoked_at` check in RPC, bump a session epoch to invalidate all tokens |
| Editor save deleted hidden records | MEDIUM | Restore from `portia_content` revision history / backup of payload; add merge guard |
| Community locked out at flip | LOW | Flag off; bulk approve; re-flip |
| Wrong approval granted | LOW | Revoke + audit trail lookup; owner reset |
| Restyle regression | MEDIUM | Revert the surface commit (tokens-first makes this isolated) |
| Evidence/baseline drift | MEDIUM | Re-run P0 path repoint; regenerate baselines once after owner «принято» |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| 1 Anon PostgREST bypass | PA, PB | Staging anon REST read denied; expected-authz diff |
| 2 CDN leak / old copies | PB, PH | `Cache-Status` + anon assertion after purge on preview |
| 3 Bundle/HTML/localStorage | PB, PC | Bundle grep, JS-off check, cache keyed by identity |
| 4 UI-only hiding | PB, PE | Per-level projection property test |
| 5 Editor round trip | PB, PE | Save-from-restricted-editor test |
| 6 Embedded docs | PE (decision), PB | Written limitation or in-app Устав; URLs out of bundle |
| 7 Public media bucket | PA, PE | Fingerprint shows no anon list policy; decision logged |
| 8 Definer/anon grants | PA, PF | rls-reviewer, fingerprint, authz matrix |
| 9 Nick impersonation | PA, PD, PC | Unique key test, charset tests, no auto-approve |
| 10 Enumeration/spam | PA, PB, PC | Uniform-response test, bucket tests, cron cleanup |
| 11 Stale approval | PB | Approve->revoke->poll test |
| 12 Self/escalation | PA, PD | SQL tests for each forbidden transition |
| 13 Rollout lockout | PD, PH | Flag exists; bulk approve; editor login path checked |
| 14 Promotion break | PF | Regression set from todo 2026-10-28 |
| 15 Big-bang restyle | PG | Tokens-first no-diff commit, per-surface plans, cycle cap |
| 16 Baseline/test churn | P0, PG, PH | `npm test` green without `.planning/` working paths; approved-visitor fixture |
| 17 Template export | PG | Export test passes after restyle |
| 18 Contrast/mobile | PG, PC, PD | axe per accent, phone widths, owner checklist |
| 19-25 Moderate | as listed | per item |

## Phase-Specific Research Flags

- **PA / PF:** needs deep review (RLS, grants, fingerprint) — mandatory `supabase-rls-reviewer`; staging proof likely BLOCKED, plan for contract tests and owner-run production apply.
- **PE:** needs an owner decision on embedded documents and on whether media is access-controlled (signed URLs) before planning.
- **PB:** verify Netlify cache behaviour on a deployed preview (cannot be proven locally).
- **PG:** standard patterns, but owner-choice loops are the main risk — bound them upfront.

## Sources

- Source reads (HIGH): `.planning/PROJECT.md` (Known Limitations, Key Decisions), `.planning/MILESTONES.md` (v1.3 Known Gaps, carried items), `.planning/RETROSPECTIVE.md` (v1.3 lessons), `app/api/content/route.ts`, `app/api/access/route.ts`, `lib/portia-cdn.ts`, `proxy.ts`, `next.config.ts`, `lib/editor-access.ts`, `lib/editor-tabs.ts`, `lib/portia-device-binding.ts`, `lib/portia-promotion-api.ts`, `lib/portia-content.ts`, `lib/portia-template-export.ts`, `supabase/migrations/20261101000000_portia_baseline.sql` (grants, policies, promo RPCs, storage), `components/portia-desktop.tsx` (embed URLs), memory note on dropped visual ledger.
- Platform (MEDIUM, web search, not confirmed in official docs; re-verify): [Supabase Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [WeWeb thread on listing public bucket](https://community.weweb.io/t/storage-list-all-files/10035), [Netlify caching overview](https://docs.netlify.com/build/caching/caching-overview), [Netlify cache key variations (Netlify-Vary)](https://www.netlify.com/blog/netlify-cache-key-variations.md), [Durable cache on Netlify](https://flaviocopes.com/durable-cache-on-netlify).

---
*Pitfalls research for: PORTIA OS v1.4 access gate, levels and design system*
*Researched: 2026-11-09*
