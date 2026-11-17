# Architecture Research: v1.4 «Доступ и единый стиль»

**Domain:** access gating + design system on an existing Next.js 16 / Supabase / Netlify "desktop OS" site
**Researched:** 2026-11-09
**Confidence:** HIGH on integration points (read from code), MEDIUM on Netlify billing/Supabase storage behaviour (flagged inline, verify on staging)
**Scope:** only the four new feature groups. Existing architecture: `.planning/codebase/ARCHITECTURE.md`.

## Decisions at a glance

| # | Decision | Why |
|---|----------|-----|
| D1 | Visitor identity = **opaque HttpOnly cookie `portia_access` + HMAC digest in DB**, not Supabase Auth | Reuses the proven promotion device-token pattern (`lib/portia-device-binding.ts`); no Supabase dashboard change; visitors never get a Supabase session; keeps `authenticated` role = editors only |
| D2 | `/api/content` and `/api/employees` become **per-viewer, `no-store`**; the CDN cache and tag purge stop being the read path | A shared cache cannot be keyed by anything the client can forge; per-level CDN variants are unsafe (see 3.3) |
| D3 | Level filtering = **server-side redaction in TypeScript** (`redactContentForLevel`), required level stored **inside the content JSON** | Rides the existing PUT/revision/undo/tab-refusal machinery; redaction is a pure, canary-testable function |
| D4 | **Close direct anon reads** of `portia_content`, `portia_employee_profiles`, `portia_manual_employees`; reads go through token-gated `SECURITY DEFINER` RPCs (visitors) or editor-only policies | Today the publishable key in the bundle reads these tables directly (`using (true)`); an API-level gate alone is bypassable |
| D5 | Two new tables: **`portia_access_people`** (identity + level) and **`portia_access_requests`** (one row per device/request); all writes via RPCs with an audit table | "Level per person" must not drift across devices; matches the promotion RPC style |
| D6 | New editor tab **`users`** = one line in `tabRegistry` (kind `regular`, open to all by default) + `/api/users` route | Existing per-editor chips (owner "Доступ") can close it per editor with zero extra code |
| D7 | Promotion takes the nickname **from the approved identity on the server**; the nick form is removed; promo device binding stays as is | Smallest diff to a 17-plan, heavily tested subsystem |
| D8 | Design system = **tokens file at current values first, then primitives that emit the existing class names, then per-surface migration**; do not reorganise `portia.css` | Cascade order in `portia.css` is load-bearing; deploy is local-only so interim inconsistency never ships |
| D9 | Build order: **access data layer -> Users tab -> visitor gate -> levels/content gating -> design restyle**; primitives skeleton lands with the Users tab | Gating cannot be enforced before someone can approve; restyle waits on owner variant choice and runs last, with physical UAT |

## 1. Facts in the current code that drive the design

- **Anon reads the DB directly.** Baseline migration: `portia_content`, `portia_employee_profiles`, `portia_manual_employees` have `select ... to anon, authenticated using (true)`. The publishable key is `NEXT_PUBLIC_*`, so redacting in `app/api/content/route.ts` alone protects nothing.
- **`GET /api/content`** uses `createPublicSupabaseClient()` (no cookies), returns `publicCacheHeaders(contentCacheTag, 300)` (`s-maxage=300, durable, stale-while-revalidate=86400`); `PUT` purges the tag. `/api/employees` GET is the same with `employeesCacheTag` (600 s) and does sheet + Roblox lookups per cache miss.
- **Bundle contains `defaultPortiaContent`** (`app/page.tsx` passes it as `initialContent`) and hard-coded embed URLs for «Таблица» (Google Sheets `htmlview`) and «Устав» (`github.io/S.E-Portia`) in `components/portia-desktop.tsx` lines 40-41.
- **Device caches:** `portia-content-last-success-v1` and `portia-employees-last-success-v1` (localStorage) seed the UI before any fetch; stamped only with the Supabase URL (`lib/device-cache.ts`).
- **Revision dedupe:** `acceptFetchedContent` (`lib/content-sync.ts`) drops any answer whose revision is not newer. One global revision + per-viewer payloads would make a level change invisible to the client.
- **Search** (`lib/search-index.ts`) is a pure client-side function over whatever content/employees the client holds; it has no data access of its own. Server redaction therefore protects search for free. The caller already filters `apps` by what the visitor may open (D-07).
- **`ScientistLog.lockedLevel` already exists** (default 3; UI hard-codes viewer level «II» and `isOpen = lockedLevel <= 2` in `components/portia-desktop-dossier.tsx`; editor offers II-IV). The locked log's text is currently shipped to every client. This is the seed of the new level model: same scale, real viewer level.
- **`formattedText`** is a top-level map keyed `virus:<id>:*`, `info:<id>:body`, `info-block:<id>:text`, `guide-block:<id>:text`, ... holding rich text separately from the item. It is the easiest leak path for redaction.
- **Promotion** already has a "restore" path: `GET /api/promotion/status` without `nickname` resolves the bound nickname from the device cookie (`portia_promo_resolve_device`). `register_attempt` is granted to `anon, authenticated` (baseline line 1597) but is only needed inside `submit_request` (definer).
- **Editor tab model:** `lib/editor-tabs.ts` `tabRegistry` + `portia_editors.closed_tabs/granted_tabs`; `getEditorAccess` returns `openTabs`; `/api/access` (editor capabilities, polled by editors) — **do not reuse this name** for visitor routes.
- **Proxy** (`proxy.ts`) excludes `/api/content` and `/api/employees` because cached GETs must never carry `Set-Cookie`. That reason disappears with `no-store`.
- **Parity machinery:** any new table/RPC must be reflected in `supabase/fingerprint/expected/portia.fingerprint.json`, `tests/e2e/fixtures/data/expected-authz.json` (`lib/phase16-expected-authz.test.ts`), explicit `service_role` grants (migration `20261101000100` only covers objects that existed then), the offline Supabase harness `tests/e2e/harness/offline-supabase.cjs`, and `portia-canonical-parity.test.ts`.

## 2. Target architecture

```
Browser
 app/page.tsx (still static, no cookie read on the server)
  └─ PortiaRoot            NEW  client wrapper; boot animation, then viewer state
      ├─ AccessGate        NEW  nick form / pending / rejected / revoked  (wallpaper only, no content)
      └─ PortiaDesktop     MOD  mounted only when viewer is approved or editor; gets {viewer}
            ├─ windows      MOD  filter by level; stubs for locked scientist logs
            ├─ PortiaEditor MOD  new "users" tab -> UsersPanel (NEW); level field in item editors
            └─ PortiaPromotion MOD  no nick form; identity from server

Route handlers (app/api)
 /api/visitor    NEW  GET state | POST request | DELETE sign-out          (cookie portia_access)
 /api/users      NEW  editor-only: GET list | POST decide | PATCH level | DELETE revoke
 /api/content    MOD  GET per viewer, no-store, redacted;  PUT unchanged (+level normalisation)
 /api/employees  MOD  GET per viewer, no-store, server-memoised roster
 /api/promotion/{status,requests,test} MOD  require approved viewer; nickname from identity
 lib/viewer.ts   NEW  resolveViewer(): editor session -> {kind:"editor"} | cookie -> RPC -> {kind:"visitor",level,...} | none

Supabase (Postgres)
 tables  NEW  portia_access_people, portia_access_requests, portia_access_audit_events
 RPCs    NEW  portia_access_submit / _resolve / portia_content_for_visitor / portia_employee_data_for_visitor (anon, token-gated)
              portia_access_list / _decide / _set_level / _revoke (authenticated, portia_can_edit_tab('users'))
 RLS     MOD  portia_content, employee_profiles, manual_employees: drop anon select; editor-only select
 grants  MOD  revoke anon/authenticated execute on portia_promo_register_attempt
```

## 3. (a) Visitor identity, `/api/content`, CDN, search

### 3.1 Identity and session
- `POST /api/visitor {nickname, fromSheet}` validates the nick (same regex family as `robloxNickname` in `lib/portia-employees.ts`), computes `nicknameKey`, mints a 32-byte token, stores only `HMAC(secret, "access:"+token)` and sets cookie `portia_access` (`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=1y`). Secret: reuse `PORTIA_PROMOTION_DEVICE_SECRET` with the distinct `access:` prefix (no new owner env step; domain-separated). Export `keyedDigest` from `lib/portia-device-binding.ts` or put the new helpers in `lib/access-session.ts`.
- `fromSheet` is a claim only. The route also checks the sheet roster (`loadPromotionAccessRoster`) and stores `sheet_check = listed | not-listed | unknown`. A sheet outage records `unknown`; it never blocks the request and **never auto-approves**.
- `GET /api/visitor` -> `{state: none|pending|approved|rejected|revoked, nickname?, level?}`, `no-store`. The pending screen polls it (10 s, visible tab only, like `contentSyncMs`).
- Editors: a Supabase session with `getEditorAccess().canEdit` is treated as full access (level 5, unredacted) and skips the nick gate; they log in through `/owner-login` (public, shows no content). An editor who wants Promotion as a participant also holds an `portia_access` identity; resolution order is editor-session first for content, access cookie for Promotion.
- One chokepoint, `resolveViewer(request)` (`lib/viewer.ts`): only attempts the Supabase path when an `sb-*-auth-token` cookie exists (same test as `lib/supabase/proxy.ts`), otherwise one RPC. Every GET route uses it. Add a unit test that scans `app/api/**/route.ts` and fails if a GET handler (other than `/api/visitor`, `/api/access`) does not call it, in the style of the existing `lib/security-matrix.test.ts`.

### 3.2 `/api/content` after the change
1. `viewer = await resolveViewer(request)`; `none|pending|rejected|revoked` -> `401 {code:"access-required", state}` with `noStoreHeaders`.
2. Visitor: one RPC `portia_content_for_visitor(p_token_hash)` returns `{state, level, nicknameKey, payload, revision, updated_at}`; route runs `normalizePortiaContent` then `redactContentForLevel(content, level)`.
3. Editor: direct select with the editor's session (new policy `select to authenticated using (portia_can_edit())`), no redaction.
4. Response adds `viewer: {kind, level}`. PUT is unchanged except that `normalizePortiaContent` must preserve/clamp the new `level` fields (items are rebuilt field by field in places; unknown keys are not guaranteed to survive).

Client (`components/portia-desktop.tsx` `fetchContent`): treat `401 access-required` as a gate trigger, **not** a sync failure (`failureFromResponse` would otherwise show the stale banner and keep cached content). Extend `acceptFetchedContent` so a changed `viewer.level` or identity resets `knownRevision` (same revision, different payload must be accepted). Stamp both localStorage caches with `viewKey = nicknameKey:level` (extend `stampCacheSource`/`cacheMatchesSource` in `lib/device-cache.ts`) and **delete both caches on any transition to non-approved**. `PortiaDesktop` must not mount, and must not read those caches, before `/api/visitor` says approved (or an editor session exists).

### 3.3 Cache and CDN
- Gated responses: `Cache-Control: no-store` and `Netlify-CDN-Cache-Control: no-store` (`noStoreHeaders`), `force-dynamic` stays. Netlify dynamic responses are not cached without an opt-in header (docs), so no-store is belt and braces.
- **Do not** vary the CDN cache on a level/role cookie (`Netlify-Vary: cookie=...`): the CDN cannot verify it, so anyone setting `level=5` would be served the level-5 copy. Varying on the unforgeable token cookie is safe but gives ~0 hit rate and delays revocation, so it is not worth it.
- `purgeCacheTag(contentCacheTag)` after PUT becomes redundant (keep it for one release; it also clears stale pre-gate copies). `contentCacheTag` / `employeesCacheTag` can be retired once the gate is enforced.
- **Rollout trap:** the old public response was stored `durable` with `stale-while-revalidate=86400`. After deploying the gated routes, purge both tags once, or the CDN keeps serving the open copy to everyone. Put this in the rollout checklist.
- **Cost trap (MEDIUM):** the CDN used to absorb the 10 s content poll and the 5 min employee poll. Now each visible tab is a function invocation plus one RPC. Mitigations: visitors poll at 30-60 s (editors keep 10 s); memoise the expensive, viewer-independent half of `loadEmployees` (sheet CSV + Roblox lookups) in module memory with a 10 min TTL, and gate on every request (cold lambdas just recompute; Netlify Blobs is out of scope). Measure invocations on staging before choosing the interval.

### 3.4 Redaction rules (`lib/content-redact.ts`, NEW, pure)
Required level lives in the JSON: `level?: 1..5` on `Virus`, `InfoSection`, `InfoSubsection`, `GuideSection`, `GuideCard`; `appLevels?: { charter?: 1..5 }` for «Устав». **Missing = 1** (existing content stays visible to every approved person). Scientist logs keep `lockedLevel` (optional, same 1-5 scale, editor dropdown widened from II-IV).

| Part of `PortiaContent` | Rule for viewer level L |
|---|---|
| `viruses[]` | omit if `level > L` |
| `viruses[].scientistLogs[]` | keep a stub `{id,title,scientist,lockedLevel}` if `lockedLevel > L` (UI already renders locked rows); drop `content`, `richContent` |
| `infoSections[]`, `subsections[]`, `guideSections[]`, `cards[]` | omit; effective level = max(section, child); omitted parent removes children |
| `recycledViruses[]`, `recycleFiles[]` (kind `virus`) | inherit the virus level; text/image files level 1 |
| `formattedText` | **allowlist by key prefix**: drop every `virus:<id>:*`, `info:*`, `info-block:*`, `guide-block:*` key whose owner was omitted; unknown prefixes are dropped (fail closed) |
| `broadcasts`, assistant fields, `searchRecommendations` | visible to every approved viewer |

- Omit, not "locked placeholder", is the default: it is fail-closed and search/lists need no change. A teaser row for locked items (title + lock) is a later owner-decided option because the title itself can be sensitive.
- Test with **canary strings**: build a fixture where every leveled item and every rich-text key carries a unique marker; assert no marker above level L appears in `JSON.stringify(redacted)` for L = 1..5.
- The function is pure and secret-free, so the editor can reuse it for a "preview as level N" control (cheap differentiator).
- «Устав»/«Таблица» embeds: the iframe URLs are public by themselves (github.io page, Google Sheet). Level-gating the **window** is UI-level; hiding the URL needs it moved from the bundle into the server response (optional hardening). The owner must know the sheet and the Pages site stay reachable by URL unless unshared. Same for the open `portia-media` bucket: with omission, locked-item image URLs are never delivered; removing the broad `select` policy on `storage.objects` should close listing while public URLs keep working (**LOW-MEDIUM, official docs say a broad SELECT policy permits listing; public-GET-without-policy not confirmed, test on staging**).

### 3.5 Search
No change to `buildSearchIndex`/`matchSearch`. Required: (1) content and employees arrive already redacted, (2) the `apps` list passed to the index excludes apps whose level exceeds the viewer's (`appLevels.charter`), (3) caches cleared on view change so a downgraded user cannot search stale local copies. Add a `search-index` test over the redacted canary fixture.

## 4. (b) Database model, RLS, RPCs, editor tab

Forward-only migrations (baseline is frozen), timestamped after `20261106000000`. Production is owner-run; this repo work targets an isolated staging only.

```
portia_access_people
  id uuid pk, nickname text, nickname_key text unique (= lower(trim)), level smallint 1..5 default 1,
  origin text ('sheet'|'outside'), status text ('active'|'blocked'),
  created_at, approved_at, approved_by uuid -> auth.users, level_changed_at, level_changed_by uuid, updated_at

portia_access_requests          -- one row per device/request; an approved row IS a session
  id uuid pk, person_id uuid null -> people, nickname, nickname_key, claimed_from_sheet bool,
  sheet_check text ('listed'|'not-listed'|'unknown'), token_hash text unique, ip_bucket text,
  status text ('pending'|'approved'|'rejected'|'revoked'), created_at, decided_at, decided_by uuid,
  decision_note text, last_seen_at (updated at most every ~10 min, never per poll)

portia_access_audit_events      -- append-only, like portia_promo_audit_events
  id bigint identity, actor_id uuid, event_type text, nickname_key text, details jsonb, created_at
```
- Both main tables and the audit table: RLS on, `revoke all from public, anon, authenticated` (promotion pattern); no direct table grants; PostgREST never touches them.
- Second device for an already-approved nick is a **new pending request**, never auto-attached (otherwise typing someone's nick grants access). Approving it attaches the device to the existing person.
- One person, one level; devices inherit it. Level change/revoke/block take effect on the visitor's next poll because nothing is cached.

| RPC (`security definer`, `set search_path = ''`) | Caller | Gate |
|---|---|---|
| `portia_access_submit(nickname, nickname_key, claimed, sheet_check, token_hash, ip_bucket)` | anon via route | DB-side caps (global pending max, per-nick max, per-ip-bucket) independent of what the caller passes |
| `portia_access_resolve(token_hash)` | anon via route | valid HMAC digest only |
| `portia_content_for_visitor(token_hash)` | anon via route | approved + active person; returns payload for TS redaction |
| `portia_employee_data_for_visitor(token_hash)` | anon via route | same; returns profiles + manual rows |
| `portia_access_list()` | authenticated | `portia_can_edit_tab('users')`; people + requests, pending first |
| `portia_access_decide(request_id, decision, level, sheet_listed)` | authenticated | tab `users`; default level 2 if the **editor route's** fresh sheet check says listed, else 1; never trust stored `sheet_check` |
| `portia_access_set_level(person_id, level, expected_level)` | authenticated | tab `users`; optimistic via `expected_level` |
| `portia_access_revoke(request_id \| person_id)`, block toggle | authenticated | tab `users` |
| `portia_access_cleanup()` | pg_cron | purge rejected/stale pending (same job style as `portia-promo-cleanup`) |

Notes:
- The anon-callable RPCs are only unreachable-without-secret for `resolve`/`*_for_visitor` (attacker cannot compute a valid digest). `submit` is reachable directly with the public key (same as `portia_promo_submit_request` today), hence the DB-side caps.
- `portia_content` / employee tables: replace the three `Public can read` policies with `select to authenticated using (portia_can_edit())` (employees: `portia_can_edit_tab('employees')` is not needed for read); `revoke select ... from anon`. `portia_editor_is_approved` (anon, needed for sign-up) is untouched.
- **Expand/contract order:** migration 1 adds tables/RPCs (additive, old code still works) -> deploy code that reads via RPC/session -> purge CDN tags -> migration 2 revokes anon table reads and anon `register_attempt`. Never ship migration 2 before the code, never the reverse for the gate. Rollback = re-grant.
- Editor tab: `tabRegistry` gets `{ id: "users", label: "Пользователи", kind: "regular" }`; `PortiaEditor` renders `UsersPanel` for `tab === "users"` (sibling of the `promo` and `access` branches around lines 1626-1628). `UsersPanel` talks only to `/api/users` (routes, not supabase-js in the browser, matching `/api/editors`); the route does `getEditorAccess` -> `openTabs.includes("users")` -> RPC. Add `/api/users` to the `proxy.ts` matcher. Optional: include `pendingRequests` in `/api/access` for editors with the tab open to badge the tab.
- Escalation note: a restricted editor (some content tabs closed) can still grant a visitor level 5. Accepted: it is audited, and the owner can close the `users` tab per editor with the existing chips.
- Shared normaliser: `nicknameKey` is a private function in `lib/portia-employees.ts` (`trim().toLocaleLowerCase("en-US")`); SQL uses `lower(trim(...))`. Export one function, use it in access, promotion and employees, and add a parity test against the SQL expression.

## 5. (c) Promotion mapping

| Today | After |
|---|---|
| `PromotionIdentityGate` asks for a nick; `GET /api/promotion/status?nickname=` and `POST /api/promotion/requests {nickname}` trust the client | Routes call `resolveViewer`; **client-sent nickname is ignored**; `nicknameKey` comes from the approved person |
| Sheet access roster check (`findPromotionAccessEntry`) | Unchanged (a "not in table" person gets the existing `not-listed` 404 and a friendly screen) |
| Device cookie `portia_promo_device` -> `portia_promo_device_bindings` (`bind`/`resolve`/`deny`), `PORTIA_PROMOTION_DEVICE_SECRET` | **Unchanged.** Same secret, new `access:` digest prefix for the new cookie. Merging the two cookies is a possible later cleanup, not v1.4 |
| UI "restore" path (`status` without nickname) | Becomes the only path: `PortiaPromotion` auto-loads status on mount, `PromotionIdentityGate` is deleted |

- Existing promo bindings were made under open nick entry; a binding whose `nickname_key` differs from the later-approved nick yields `device-denied`. Reviewer `device-reset` already handles this; note it in the rollout.
- `test/`, `reviewer/`, `banks/` routes: add the approved-viewer requirement to `test/` (participant path); reviewer/banks stay editor-grant based.
- Revoking anon `portia_promo_register_attempt`: forward migration `revoke execute ... from anon, authenticated`; update fingerprint and `expected-authz.json`; confirm `submit_request` (definer) still passes (staging proof; Postgres execution is BLOCKED until a phase proves it).

## 6. (d) Design system

**Current state (measured):** `app/portia.css` 2456 lines of dense one-line rules, global, order-sensitive (comments such as "after X so it wins the cascade"); Tailwind is imported but unused for components; 15 distinct `border-radius` values (7px x31, 4px x17, 10px x12, 6px, 3px, 5px, 8px, 9px, 2px, 14px, 19px...); button classes `primary-control` / `secondary-control` / `danger-control` / `promotion-action`; two editor tab strips (`editor-tabs`, `dossier-tabs`); tokens exist for colour/fonts (`--bg --panel --line --teal --paper --ink ...`, accent via `--accent-hue`/`--accent-chroma`, written by `lib/accent-custom.ts`/`accent-boot.ts` — **names must not change**).

**Placement**
```
app/styles/tokens.css       NEW  radius/space/type/border scale + semantic aliases (--radius-control, --space-2 ...) pointing at existing vars; first version = CURRENT values
app/styles/primitives.css   NEW  rules for ui/* primitives; imported BEFORE portia.css so legacy still wins until its rule is deleted
components/ui/              NEW  Button, TabStrip, Field, Chip/Badge, Panel/Dialog shell, WindowChrome parts
app/portia.css              MOD in place, never reorganised or split (moving rules changes cascade)
app/layout.tsx              MOD  two extra imports
```
- Primitives first emit the **existing class names** (`<Button variant="secondary">` -> `className="secondary-control"`): DOM/CSS identical, the same technique as v1.3's byte-for-byte decomposition (`phase17-move-parity`).
- New UI (AccessGate, UsersPanel) is the pilot consumer from day one.
- Window chrome (close cross in the corner, maximized windows) -> `components/portia-desktop-window.tsx`; class icons -> `components/portia-icons.tsx`; phone «Информация» button -> `lib/info-phone-nav.ts` + its component; template-builder «Видимая часть» window -> `components/portia-template-builder.tsx`. Tab formats: replace `nav.editor-tabs` (portia-editor.tsx ~1175) and `dossier-tabs` (~1449) and the apps' tab bars with one `TabStrip`.

**Migration order (no big bang):**
1. Tokens at current values -> existing visual baselines must pass unchanged (zero-diff proof).
2. Primitives with identical output (zero-diff again).
3. Owner picks the variant. Variants are **token sets rendered through the existing candidate lane** (`npm run test:e2e:candidates`, `tests/e2e/visual-candidates`), not a runtime switch; the winner is baked into `tokens.css`, losers deleted.
4. Surface by surface, one plan each, smallest first: AccessGate + UsersPanel (already new) -> editor shell/tab strips -> window chrome + desktop -> apps (Информация, Справочник, Сводка, Сотрудники) -> «Повышение». Per surface: replace literal radii/colours with tokens, delete the superseded legacy rule, regenerate only that surface's baselines.
5. Ratchet test (like `lib/editor-field-look.test.ts`): count of literal `border-radius: Npx` and raw hex in `portia.css` may only go down; target <= 4 radius tokens.
- Deploy is local-only (PROJECT.md), so interim visual inconsistency never reaches users; a scope-flag (`data-ui="v2"`) would double the CSS and is not needed.
- Visual evidence: per the owner's 2026-11-08 decision there are no galleries or per-hash ledger; use Playwright screenshots in `tests/e2e/visual/{desktop,apps,editor,promotion,motion}.spec.ts` (1:1 with surfaces), never `--verify` of the visual manifest (CLAUDE.md), report changes as text. Axe findings and the 521-900 px shortcut layout ride in the same per-surface plans; `accessibility.spec.ts` is the gate.
- Do not use Tailwind utilities for the system; keep hand-written CSS on tokens (optionally mirror tokens in `@theme` later).

## 7. (e) Suggested build order and phase boundaries

| Phase (v1.4) | Contents | Depends on | Notes |
|---|---|---|---|
| **A. Access foundation** | migration 1 (tables, RPCs, audit, cron cleanup), `lib/access-levels.ts`, `lib/access-session.ts`, shared `nicknameKey`, `lib/viewer.ts`, fingerprint/authz/harness updates, explicit `service_role` grants, RLS review via `supabase-rls-reviewer` | none | Postgres/RLS execution is BLOCKED until proven on isolated staging (project rule); unit tests + offline harness first |
| **B. Users tab + primitives skeleton** | `users` in `tabRegistry`, `/api/users`, `UsersPanel` (list, approve/reject, level, revoke), `components/ui` + `tokens.css` at current values, proxy matcher | A | Editors can approve requests seeded on staging; first consumer of primitives; parity with zero visual diff elsewhere |
| **C. Visitor gate + Promotion identity** | `PortiaRoot`, `AccessGate`, `/api/visitor`, boot-screen text (fake «УРОВЕНЬ II» line removed), sign-out/change nick, Promotion routes + UI use identity, gate behind an `ACCESS_ENFORCED`-style switch defaulting off until D | A (B for approving) | Test with approve-all; cache clearing on transitions |
| **D. Levels + content gating** | `level` fields in types/normalise/limits, editor level controls (virus, info, guide, charter, scientist logs widened to 1-5), `content-redact.ts` + canary tests, `/api/content` & `/api/employees` per viewer, client `viewer`/dedupe/cache-stamp changes, search app filter, CDN purge, **migration 2 (contract)**, `register_attempt` revoke | A, B, C | Highest risk: leak paths (`formattedText`, recycle, logs), rollout order, poll cost |
| **E. Unified style** | owner variant choice (collect early, in parallel with A-D), per-surface migration, window chrome, tabs, class icons, 521-900 px shortcuts, axe, phone «Информация», «Видимая часть», Promotion/desktop regression set, owner PC + phone acceptance | B (primitives); independent of A-D logically | Runs last so baselines change once and UAT covers the finished UI; the regression set for «Повышение» should be written **before** C changes the Promotion UI |

Why not design first: it delays the security value and blocks on the owner's variant choice; why not gate before the Users tab: nobody could approve anyone. Phases B and C can overlap after A. Nothing is enforced for real visitors until A-D are all in and migration 2 is applied (owner-run).

## 8. New vs modified

| Item | Status |
|---|---|
| `components/portia-root.tsx` (PortiaRoot), `components/access-gate.tsx`, `components/users-panel.tsx`, `components/ui/*` | NEW |
| `app/api/visitor/route.ts`, `app/api/users/route.ts` | NEW |
| `lib/viewer.ts`, `lib/access-session.ts`, `lib/access-levels.ts`, `lib/content-redact.ts`, shared `lib/nickname.ts` | NEW |
| `app/styles/tokens.css`, `app/styles/primitives.css` | NEW |
| `supabase/migrations/*_portia_access.sql`, `*_portia_access_contract.sql` | NEW |
| `app/page.tsx` (render `PortiaRoot`), `app/layout.tsx` (CSS imports) | MOD (small) |
| `components/portia-desktop.tsx` (`fetchContent`, `fetchAccess`, boot lines, cache keys, level-aware lists, search app filter), `portia-desktop-dossier.tsx` (real viewer level for logs), `portia-desktop-window.tsx` | MOD |
| `components/portia-editor.tsx` (`users` branch, tab strips), `portia-editor-dossier.tsx` (log levels 1-5), item editors (level field) | MOD |
| `components/portia-promotion.tsx` (remove `PromotionIdentityGate`, auto status) | MOD |
| `app/api/content/route.ts`, `app/api/employees/route.ts`, `app/api/promotion/{status,requests,test}/route.ts`, `proxy.ts` | MOD |
| `lib/portia-content.ts` (types), `portia-content-normalize.ts`, `content-limits.ts`, `editor-tabs.ts`, `content-sync.ts`, `device-cache.ts`, `portia-employees.ts` (reader abstraction: token-RPC vs editor client; export `nicknameKey`), `portia-promotion-api.ts`, `portia-device-binding.ts` (export digest helper), `portia-cdn.ts` | MOD |
| `lib/search-index.ts` | **UNCHANGED** (+ tests) |
| `lib/editor-access.ts`, `/api/access`, `/api/editors`, `EditorAccessManager` | UNCHANGED (chips list the new tab automatically via `tabRegistry`) |
| Tests/fixtures: `tests/e2e/harness/offline-supabase.cjs`, `fixtures/actors.ts` (visitor actors by level), `expected-authz.json`, fingerprint JSON, `visitor.spec.ts`, `roles.spec.ts`, `staging-authz.spec.ts`, promotion specs | MOD |
| `app/portia.css`, `portia-promotion-editor.css` | MOD in place, incrementally |

## 9. Anti-patterns to avoid

- **Gating only in the route.** The anon key reads the tables; close RLS or the gate is decorative.
- **CDN cache keyed by a client-set role/level cookie.** Forgeable; leaks the highest level.
- **Per-item `if (level >= x)` in React components.** Content must arrive already redacted; the UI only renders what it got. Filtering client-side leaves data in memory, devtools and localStorage.
- **Trusting client-sent nickname or `sheet_check`.** Derive identity from the cookie and re-check the sheet at decision time.
- **Auto-approving sheet nicks.** Anyone can type a sheet nick.
- **Storing levels in a separate table keyed to content ids.** Breaks undo/history, revision CAS, and tab refusal; JSON field keeps one source of truth.
- **Restyling by editing `portia.css` globally.** Cascade order is load-bearing; migrate rule by rule with a baseline per surface.
- **Adding a fifth parallel per-app record for a new app/gate** (see codebase anti-patterns); this milestone adds no new `AppId`.

## 10. Scaling (realistic)

| Concern | ~30 people (today) | ~300 | ~3000 |
|---|---|---|---|
| Content GET | per-viewer function + 1 RPC at 30-60 s poll: fine | measure invocations/month; widen poll or add `If-None-Match` revision short-circuit in the RPC | per-level memoised redacted payload in lambda memory keyed by (revision, level) |
| Users list | single `portia_access_list()` | paginate pending/people | search + pagination |
| Approval queue abuse | DB caps | tighten buckets / add captcha-free proof-of-work | consider Supabase anon auth + captcha |

## 11. Open questions for the owner / later phase research

- Names and meaning of levels 3-5 (only 1 observer and 2 employee are defined); labels needed in `lib/access-levels.ts` and the editor.
- Default level for existing content (recommended 1 = everyone approved sees it) and whether locked items should show a teaser row.
- Whether editors with a closed content tab may grant levels above their own.
- Unsharing the Google Sheet and the github.io charter (otherwise they stay public by URL).
- Poll interval for visitors and Netlify invocation budget (Phase D research flag).
- Supabase storage: does dropping the broad `select` policy close listing without breaking public URLs (Phase D, verify on staging).

## Sources

- Code read: `app/api/{content,employees,editors,promotion/*}/route.ts`, `lib/{editor-access,editor-tabs,portia-cdn,portia-promotion-api,portia-device-binding,search-index,portia-employees,device-cache}.ts`, `proxy.ts`, `lib/supabase/{server,proxy}.ts`, `supabase/migrations/20261101000000_portia_baseline.sql`, `20261101000100_portia_explicit_grants.sql`, `components/portia-desktop*.tsx`, `components/portia-editor.tsx`, `app/portia.css`, `.planning/PROJECT.md`, `.planning/codebase/ARCHITECTURE.md` (HIGH)
- Netlify caching docs: https://docs.netlify.com/build/caching/caching-overview and https://www.netlify.com/knowledge-base/how-to-control-cdn-caching-on-netlify/ (MEDIUM: dynamic responses uncached by default; avoid varying on whole Cookie; per-user `private` semantics not confirmed)
- Supabase storage access control: https://supabase.com/docs/guides/storage/security/access-control (MEDIUM: broad SELECT policy permits listing; public-GET behaviour needs staging verification)
- Context7 was unavailable (connection closed) during this run; no library-doc claims beyond the above are made.

---
*Architecture research for: PORTIA OS v1.4 access gating and unified design system*
*Researched: 2026-11-09*
