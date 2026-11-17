# Phase PORTIA-22: Вкладка «Пользователи» и каркас токенов стиля - Research

**Researched:** 2026-11-09
**Domain:** Next.js 16.4.5 App Router route handlers + Supabase definer RPCs (Postgres, offline-only verification) + hand-written React 19 editor tab + plain-CSS token skeleton
**Confidence:** HIGH for everything read in the repo this session (SQL, tests, CSS, tab registry); MEDIUM for the new SQL design (it is a recommendation, never executed, reviewer-gated); LOW for the Roblox profile URL form (see A3)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

#### Locked earlier (carried forward, not re-asked)
- D-71 5а / Phase 21 D-02: any editor decides; no self-approval, no level above own, owner cannot be changed; DB enforces; repeat decision returns «уже решено».
- Phase 21 D-04 / D-09: approval default level 2 «из таблицы», 1 «не из таблицы»; previous level is not restored.
- Phase 21 D-06: one pending request per nick; 1-hour cooldown after reject/revoke; owner can clear it.
- D-71 8а: style directions shown as text + values table; no `review.html` galleries, no per-hash ledger; at most one redo per screen.
- Phase 21 D-07 is **amended** by D-07 below (retention).

#### Устройство вкладки
- **D-01:** Two sections in one tab: «Заявки» (pending requests) on top, «Люди» below. The tab badge counts pending requests only (USR-01).
- **D-02:** One nickname search field above both sections; no status filters.
- **D-03:** «Люди» lists approved people only, sorted by level (desc), then by nickname. Rejected and revoked people live in a collapsed block «Отклонённые и отозванные» under «Люди» (closed by default); there the row shows status, history and, for the owner only, «снять паузу» while the 1-hour cooldown runs.
- **D-04:** Phone: compact row (nickname + status); tapping a row opens an action window holding the details (type, «в таблице» mark, Roblox profile link), actions and history. No page-level horizontal overflow. PC rows show actions inline.

#### Кто и когда, история
- **D-05:** The decider is shown as a masked email (`q•••z@gmail.com` style: first and last char of the local part, full domain) to editors; the owner sees full emails. Masking is done server-side — the full email of another editor never reaches a non-owner client.
- **D-06:** Row caption under the nickname: «одобрил q•••z · 9 нояб., 14:32» (verb follows the event), absolute date/time in Europe/Moscow, device-independent formatting. History opens by expanding the row on PC and inside the action window on phone.
- **D-07:** History shows the last **5** journal entries per person, no «Показать ещё». Storage: the journal keeps the last **20** entries per person; older ones are deleted only by this rule (new forward-only migration; the Phase 21 append-only trigger is changed to allow exactly this prune and nothing else; UPDATE stays forbidden; direct SELECT stays forbidden). Owner reason: «беспокоюсь о памяти»; the risk that 20 new actions can push out an old decision was explained and accepted. — **Reversibility:** one-way — pruned journal rows cannot be restored, and it amends the Phase 21 trigger contract (D-07 of 21, RLS21-03); needs `supabase-rls-reviewer` and a fingerprint / expected-authz update.

#### Массовое одобрение «из таблицы»
- **D-08:** Owner-only button. Pressing it opens a confirmation window «Одобрить N заявок с уровнем 2?» listing the nicknames that will be approved, plus a separate line listing «из таблицы» requests whose nickname is not in the table (they are not included). Nothing is approved before «Одобрить» (USR-08).
- **D-09:** Table match = nickname via the shared case-insensitive `nicknameKey` rule (Phase 21 ACC-04), evaluated at decision time (USR-02). `robloxUserId` is not used; a renamed player whose table row is stale is decided by hand.
- **D-10:** If the staff roster is unavailable (`degraded`), the bulk button is disabled with «Таблица сотрудников недоступна, попробуйте позже»; the row mark shows «не проверено» instead of «нет»; single approval still works and the default level comes from the chosen type.
- **D-11:** Bulk run decides each request separately and ends with a summary «Одобрено X, уже решено другим Y, ошибка Z». Requests already decided by another editor are skipped as «уже решено» (USR-07); one failure does not undo the others.

#### Направление стиля (UI-01)
- **D-12:** The style direction is the owner's choice, not the agent's. The plan includes a blocking owner checkpoint that presents A / B / C as text with a values table (radii, buttons, plaques/badges, tabs/windows) and records the chosen letter in this phase. Tokens are plain `:root` CSS variables in `portia.css` at today's values, edited in place without reordering the cascade; a test pins today's `border-radius` declaration count (129 at discussion time — re-count at plan time); the site does not change visually.

### Claude's Discretion
- Decision UX per row (area not discussed): confirmation dialog for reject and revoke, no rejection-reason field, level picked from a list (inline on PC, in the action window on phone); «уже решено» shown as a refusal message on the row followed by a refresh of that row.
- RPC shape for listing people/requests and reading the last 5 journal entries per person (definer RPCs, server-side masking per D-05), and how the «в таблице» mark is computed server-side at decision time.
- Exact empty states and Russian copy within the rules above.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.

Reviewed todos (not folded): «Стабилизировать Повышение и интерфейс рабочего стола» (Phase 23); «„Информация“ на телефоне — компактная кнопка разделов» (Phase 26); «Окно „Видимая часть“ в шаблоне» (Phase 23).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| USR-01 | Any editor sees all people and requests, pending first, with a pending badge on the tab | New list RPC + `GET /api/users`; registry line gives default-open; badge from the same server response (Architecture, SQL design §1) |
| USR-02 | Request row: nick, Roblox link, chosen type, «в таблице» mark computed at decision time | Mark is computed in the route from the sheet roster (`loadPromotionAccessRoster`, tri-state result = degraded), never stored (Roster section) |
| USR-03 | Approval pre-sets level 2 / 1 | `defaultApprovalLevel(origin)` already exists in `lib/access-levels.ts`; DB default in `decide` is the same (verified) |
| USR-04 | Reject, change level, revoke | Existing RPCs `decide` / `set_level` / `revoke` + wrappers; only the HTTP + UI layer is missing |
| USR-06 | Every decision journaled; who/when visible on the row; history | Journal exists (5 event types); new list RPC returns newest event per nick with masked decider; new history RPC returns last 5; retention to 20 via forward-only migration |
| USR-07 | Concurrent decisions: second sees «уже решено» | DB already answers `already-decided` / `stale` / `not-active` / `already-revoked`; UI mapping + row refetch; offline tests only (live race BLOCKED) |
| USR-08 | Owner one-button approve of pending «из таблицы» requests whose nick is in the table, level 2 | Owner-only preview (all pending sheet requests ∩ fresh roster) + client-driven sequential per-request approve with a server re-check |
| USR-09 | Owner closes the tab for one editor via existing tab rights | One registry line; `parseTabLists`, `getEditorAccess`, `access-tab-chip` and the SQL gate `portia_can_edit_tab('users')` are all registry/closed_tabs driven (verified); needs a 403 → `AppDeniedPanel` path in the mounted body |
| UI-01 | Owner picks A/B/C from text + values table; token skeleton in code at today's values; radius count pinned | Blocking owner checkpoint (agent never picks); declare-only `:root` tokens in the FIRST `:root` block; count pins 129 / 6 verified; mechanical no-change proof (Style tokens section) |
</phase_requirements>

## Project Constraints (from ./CLAUDE.md)

- Stack: Next.js (App Router) + React 19 + TypeScript + Tailwind 4, Supabase via `@supabase/ssr`, hosted on Netlify. Owner writes Russian; user-facing answers in Russian.
- Never use production Supabase, real secret/service-role keys; no production mutation; DB changes go to an isolated test branch/project only. Never read/print real `.env*` (`.env.example` fine).
- Do not modify, stage or commit: `.planning/milestone.lock`, `.planning/forensics/`, `.planning/milestones/v1.2-incomplete-research/`, `.planning/quick/261028-c9g-portia-promotion-1-8/`, `.planning/ui-reviews/`.
- Stage by explicit path only. No `git add -A` / `git add .`, `git stash`, `git clean`, `git reset --hard`.
- Never record BLOCKED evidence as a pass. Authenticated roles, Postgres/RLS execution, staging/production and physical devices stay BLOCKED until a phase proves them.
- Figma and Codex Security are removed from the plan; do not reintroduce.
- `.claude/hooks/guard.mjs` blocks some commands ("Blocked by project guard" = change approach). It blocked a Bash call in this session that mentioned the Supabase CLI by name; use Read/Grep/Glob or plain commands.
- Commands: `npm test` = `node --experimental-strip-types --test lib/*.test.ts`; types `npm exec tsc -- --noEmit`; lint `npm run lint`; build `npm run build`. Never run `phase15-visual-manifest.mjs --verify` (rewrites signed evidence); `--verify-promotion` is fine.
- Reference Node 22.13.1 (it is on PATH in this session: `node --version` -> `v22.13.1`). In earlier phases the temp Node's npm was broken, so steps were run as `node node_modules/typescript/bin/tsc --noEmit`, `node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next`, `node node_modules/next/dist/bin/next build` (21-07 SUMMARY).
- Changes to `supabase/*.sql`, RLS, RPCs or storage policies: run the `supabase-rls-reviewer` agent (`.claude/agents/supabase-rls-reviewer.md` exists).
- Memory rules: no `review.html` galleries / per-hash ledger; ask choice questions as numbered text; owner waived UAT 20-14 (D-70) - never PASS.

## Summary

Phase 22 is almost entirely an HTTP + UI + one small SQL layer on top of a Phase 21 data layer that already contains every mutation the tab needs. Verified this session: `portia_access_decide`, `portia_access_set_level`, `portia_access_revoke`, `portia_access_clear_cooldown` and their TS wrappers (`decideAccessRequest`, `setAccessLevel`, `revokeAccess`, `clearAccessCooldown`) exist, are gated by `portia_can_edit_tab('users')` (or `portia_is_owner()`), enforce self / owner / level rules in the database, and return typed result codes. What is missing is exactly: (1) a **read** path (list of requests/people with masked deciders, permission flags, totals, search; last-5 history; an owner-only bulk candidate list), (2) the **journal retention** change (D-07), (3) a route handler, (4) the tab component + badge + registry line, (5) the roster match, (6) the CSS token skeleton, and (7) the owner style checkpoint. No new npm packages are needed.

The main planning risks are not in the feature but in the **repository's evidence tests**, which this phase trips in at least eight places: the frozen v1.3 route-coverage matrix and the Phase 21 migration/freshness matrix (new route, new migration, edited `lib/access-store.ts`), the "visitor behaviour is unchanged: nothing under app/ or components/ uses the access modules" guard, the hard-coded `tabRegistry` expectations, the `portia-canonical-parity` per-migration hash pin, the golden fingerprint (`counts.triggers === 2`) and expected-authz matrix, the `phase20-hints-inventory` long-text scan over `components/*.tsx` (any 7+-word Cyrillic string in a component not in a frozen register fails), and `proxy.ts`'s explicit matcher allow-list. Each needs a deliberate, same-commit update; the plan should name them as tasks, not discover them as red tests.

Two design facts drive the SQL: editors hold a normal Supabase session in the browser, so they can call any `authenticated`-granted RPC directly — therefore the gate (`portia_can_edit_tab('users')`) and the **email masking must live inside the definer functions**, not only in the route; and journal retention is best expressed as a content-based guard in the existing append-only trigger function (a DELETE is allowed only for a row older than the 20 newest of its nickname) plus an AFTER INSERT prune trigger, which keeps the "UPDATE, TRUNCATE and any other DELETE stay forbidden" contract self-evident and leaves both existing trigger definitions untouched.

**Primary recommendation:** One forward-only migration `20261110000000_portia_users_tab.sql` (names must match `^\d{14}_portia_…`) adding `portia_access_mask_email`, `portia_access_list`, `portia_access_history`, `portia_access_bulk_candidates` (owner-only), a redefined `portia_access_journal_append_only()` with the bounded-DELETE branch and an AFTER INSERT `portia_access_journal_prune` trigger; one `app/api/users/route.ts` (GET views + POST actions) built on a dependency-injected `lib/users-api.ts`; all long Russian copy in `lib/users-copy.ts`; token skeleton + appended `users-*` CSS; and a final "evidence" task that creates `22-SECURITY-MATRIX.md`, the pins, the golden/authz updates and the BLOCKED owner style checkpoint.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Who may see/decide (editor gate, closed tab) | Database (`portia_can_edit_tab('users')` inside each RPC) | API route (`getEditorAccess` → 403) | Editors hold a session and can call RPCs directly; the DB is the enforcer, the route is convenience + clean 403 |
| Self / owner / level rules | Database (`target_guard`, level checks in decide/set_level/revoke) | UI hides actions via server-sent permission flags | USR-05 is "DB, not only UI"; flags are computed in the list RPC |
| Email masking for non-owners | Database (inside list/history RPC, `portia_is_owner()` branch) | — | Full email must never reach a non-owner client; a route-only mask would still leak through a direct RPC call |
| «В таблице» mark / roster degraded | API / Backend (route fetches sheet roster) | — | The sheet is an external service; Postgres cannot see it. Computed fresh, never stored |
| Bulk eligibility (pending sheet ∩ roster) | API / Backend | Database (owner-only candidate list of ALL pending sheet requests) | Roster only exists server-side; display cap of 50 must not limit eligibility |
| Bulk execution | Browser (sequential per-request calls, progress line) | API (owner check + roster re-check per call) → DB `decide` | Avoids a 200-decision request exceeding serverless time limits; each decision stays separate (D-11) |
| Journal retention (last 20 per nick) | Database (trigger) | — | Only the DB can make "deleted only by this rule" provable |
| Moscow time formatting, plural, view-model | Pure `lib/*.ts` (node-testable) | Browser renders | No component test harness for TSX exists; logic must be outside JSX |
| Pending badge | Browser (editor shell polls) | API `GET /api/users?view=count` | Badge must show while the tab body is not mounted |
| Style tokens | CDN / Static (`app/portia.css` `:root`) | — | Declare-only, no consumers in this phase |

## Standard Stack

### Core (all already in the repo; nothing to install)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| next | 16.4.5 (exact pin) | Route handler `app/api/users/route.ts`, `export const dynamic = "force-dynamic"` | [VERIFIED: package.json] `"next": "16.4.5"`; same pattern as `app/api/employees/route.ts` |
| react / react-dom | 19.2.6 | Tab component, native `<dialog>` | [VERIFIED: package.json] |
| @supabase/ssr | ^0.12.7 | `createServerSupabaseClient()` = user-session client; RPCs run as `authenticated` with `auth.uid()` | [VERIFIED: package.json, lib/supabase/server.ts] |
| @supabase/supabase-js | ^2.117.3 | `SupabaseClient.rpc` satisfies `AccessRpcClient` | [VERIFIED: lib/access-store.ts:1-2 comment "A SupabaseClient satisfies AccessRpcClient"] |
| typescript | 5.9.3 | Type check (`tsc --noEmit`) | [VERIFIED: package.json] |
| node:test | Node 22.13.1 | All unit tests (`--experimental-strip-types`, `.ts` only - no `.tsx`) | [VERIFIED: package.json scripts.test] |

### Supporting (existing project modules to reuse - do not re-implement)

| Module | Purpose | When to Use |
|--------|---------|-------------|
| `lib/access-store.ts` | RPC names (`accessRpc`), `AccessStoreError`, wrappers + result unions | Extend with `listAccess`, `accessHistory`, `bulkCandidates` wrappers; keep fail-closed `call()` |
| `lib/access-levels.ts` | `accessLevelLabel`, `accessOriginLabel`, `defaultApprovalLevel`, `ACCESS_LEVELS`, `isAccessLevel` | Level/origin labels - "No other file hard-codes «Уровень N»" |
| `lib/nickname.ts` | `nicknameKey`, `NICKNAME_PATTERN`, `parseNicknameInput` | Search normalisation and roster match (D-09) |
| `lib/portia-promotion-sheet.ts` `loadPromotionAccessRoster` | Staff nick list, tri-state result `ok | unavailable | invalid-source`, staging override | The roster source for the «в таблице» mark (see Roster) |
| `lib/editor-access.ts` `getEditorAccess` | `canEdit`, `canManageEditors`, `openTabs` | Route gate; owner = `canManageEditors` |
| `lib/request-json.ts` `parseJsonObject`, `lib/portia-cdn.ts` `noStoreHeaders` | Body parsing, no-store | Every response |
| `components/portia-desktop-states.tsx` | `AppSkeleton shape="employees"`, `AppFatalPanel`, `AppStaleBanner`, `AppDeniedPanel` | Loading / first-load failure / stale / «Доступ закрыт» |
| `components/portia-editor-dossier.tsx` `ConfirmDialog` | Native `<dialog class="portia-dialog">`; `text` is a plain string | Reject / revoke confirm. NOT usable for the bulk dialog (needs lists) - write a sibling dialog on the same chrome |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `loadPromotionAccessRoster` (B2:B35, nicknames only) | `loadEmployees` (`/api/employees` path) | `loadEmployees` also calls Roblox user/thumbnail APIs and reads profile/manual tables; its `degraded` flag (`complete`) turns true when Roblox fails, which would wrongly disable bulk approval. The promotion access roster is one small CSV and its status is exactly "sheet readable or not" |
| Content-based guard in the trigger function | Session-flag (`set_config`) bypass | A GUC flag can be set by any session that can run SQL; the content rule cannot be bypassed by setting anything |
| AFTER INSERT prune trigger | Editing 4 definer RPCs to call a prune helper | Four `create or replace` of frozen-body functions = four new body hashes + four reviewer re-reads; trigger is one object and cannot be forgotten |
| Client-driven bulk loop | One server POST that loops 200 decisions | A single request can exceed the serverless limit and cannot show "k из N" progress (UI-SPEC) |

**Installation:** none. `npm install` is not part of this phase.

**Version verification:** no package is added; versions above were read from `package.json` this session, not from the registry.

## Package Legitimacy Audit

No external packages are installed or added by this phase, so `gsd-tools query package-legitimacy check` was not run (nothing to check).

**Packages removed due to [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
Editor browser (session cookie)                       Netlify route handler                     Postgres (definer RPCs, NOT executable here)
┌─────────────────────────────┐                  ┌──────────────────────────────────┐      ┌──────────────────────────────────────┐
│ PortiaEditor shell          │  GET ?view=count │ app/api/users/route.ts (thin)    │ rpc  │ portia_access_list(q, limit)         │
│  - tab strip (registry)     ├─────────────────►│  getUser + getEditorAccess       ├─────►│  gate portia_can_edit_tab('users')   │
│  - badge poll 30 s, visible │◄─────────────────┤  openTabs.includes("users")?     │      │  mask email unless portia_is_owner() │
│                             │   {pending:N}    │   no -> 403 (no code)            │      │  perm flags: self / owner-protected  │
│ UsersTab (active)           │  GET list 10 s   │  lib/users-api.ts (DI, tested)   │      │  newest journal event per nick       │
│  search (debounced, q)      ├─────────────────►│   roster = loadPromotionAccess   │      │  caps 50/section, true totals        │
│  Заявки / Люди / Закрытые   │◄─────────────────┤   marks yes|no|unknown           │      ├──────────────────────────────────────┤
│  phone: row -> action dialog│  POST {action}   │   map result codes (200)         │ rpc  │ portia_access_decide / set_level /   │
│  history on demand          ├─────────────────►│   map exceptions (403/409/503)   ├─────►│  revoke / clear_cooldown  (Phase 21) │
│                             │                  │                                  │      │ portia_access_history(key) last 5    │
│ Bulk (owner): preview ──────┤  GET ?view=bulk  │  owner only: candidates ∩ fresh  │      │ portia_access_bulk_candidates()  own.│
│  then loop POST approve ────┤  POST bulk:true  │  roster (TTL 0) re-check per call│      ├──────────────────────────────────────┤
└─────────────────────────────┘                  └───────────────┬──────────────────┘      │ journal: AFTER INSERT prune trigger   │
                                                                 │ fetch CSV               │  BEFORE DELETE guard: only rows older│
                                                                 ▼                         │  than the 20 newest of the same nick │
                                                  Google Sheet (B2:B35 nicknames)          └──────────────────────────────────────┘
```

### Recommended Project Structure

```
supabase/migrations/20261110000000_portia_users_tab.sql   # new, forward-only, no begin/commit
lib/
├── access-store.ts          # + list/history/bulkCandidates wrappers (fail-closed)
├── users-api.ts             # DI handlers: handleUsersGet / handleUsersPost (tested)
├── users-model.ts           # payload types + parseUsersList (fail closed on unknown shape)
├── users-view.ts            # rows -> view model: sections, captions, visible controls, badge text, bulk groups
├── users-time.ts            # formatMoscow(), pluralZayavka()
├── users-copy.ts            # ALL Russian copy of 7+ words (see Pitfall 5)
├── users-roster.ts          # roster match + short TTL cache around loadPromotionAccessRoster
└── *.test.ts                # one test file per module + SQL text contract + style tokens
app/api/users/route.ts       # thin glue, noStoreHeaders, dynamic = "force-dynamic"
components/portia-users-tab.tsx  # "use client"; JSX only, no long strings, no logic worth testing
app/portia.css              # + tokens in FIRST :root; + users-* rules appended at END (CRLF file!)
proxy.ts                    # + "/api/users" in matcher
```

### Pattern 1: Dependency-injected handler (precedent: `lib/portia-promotion-api.ts` + its test)
**What:** Pure functions take `{ access, client, loadRoster, now }` and return `{ status, body }`; `route.ts` only builds deps and calls them. The promotion test builds `dependencies(overrides)` and asserts status/body without Next.
**When to use:** every GET view and POST action. This is how "tests API" in success criterion 3 is satisfied without a Next runtime - route files import `@/lib/...` aliases that `node --test` cannot resolve, while `lib/*.ts` use relative `./x.ts` imports.

### Pattern 2: Result codes are 200, refusals of auth are 4xx
Outcomes the UI branches on (`already-decided`, `stale`, `not-active`, `already-revoked`, `not-found`, `unchanged`) are returned as `200 { code, … }`. `403` with **no `code`** = tab closed / not an editor (the promotion editor already uses "403 without a command code" as "access revoked": `components/portia-promotion-editor-main.tsx` `const isDenied = (response, body) => response.status === 403 && typeof body.code !== "string"`). Per-command DB refusals get `409 { code: "self" | "owner" | "level-above-own" | "invalid-level" }`. Missing SQL (`PGRST202`/`42883`/`42P01` style errors, precedent `pending-database`) → `503 { code: "pending-database" }`. Anything else → `502/500` generic. [VERIFIED: components/portia-promotion-editor-main.tsx lines 40-41 (isDenied, "pending-database")]

### Pattern 3: Server-driven permission flags
The list RPC returns, per row, `canDecide`, `canSetLevel`, `canRevoke`, `reason: null | "self" | "owner"`; UI renders controls only for true flags and one caption otherwise (UI-SPEC). The flags mirror `portia_access_target_guard` (self = request filed by `auth.uid()` or person linked to `auth.uid()`; owner-protected = not owner and the owner's account is linked) - see SQL design §1.

### Anti-Patterns to Avoid
- **Masking in the route only.** A direct `rpc/portia_access_list` call by an editor would return full emails. Mask in SQL.
- **`ilike`/`like` for nickname search.** `_` is a LIKE wildcard and is a legal nickname character (`^[A-Za-z0-9_]{3,20}$`). Use `strpos(nickname_key, p_query) > 0` on the lower-cased query.
- **Reading `portia_access_*` tables from the route with a table client.** All tables are RPC-only (RLS on, no policy, privileges revoked); only definer functions reach them.
- **Long copy in `components/*.tsx`.** See Pitfall 5.
- **Editing the frozen migration.** Pinned sha `a2c69408…82334f7e` in `lib/portia-canonical-parity.test.ts`; also tracked in `21-MIGRATION-APPLY.md`.
- **Defining `--muted`**, using `oklch(.559 …)` text, new radii, new animations (UI-SPEC hard rule).

## SQL Design (recommendation, subject to supabase-rls-reviewer; nothing here has been executed)

All functions: `security definer` where they read `auth.users`/journal, `set search_path = ''`, `revoke all … from public, anon, authenticated;` **before** `grant execute … to authenticated` (+ `service_role`), because `lib/portia-sql.test.ts` requires revoke-before-grant for every post-baseline function, and `lib/phase16-expected-authz.test.ts` requires the matrix to cover every effective `portia_*` function. Never `set search_path = public`.

Frozen facts the new SQL builds on [VERIFIED: supabase/migrations/20261109000000_portia_access_foundation.sql, read this session]:
- Gate line used by decide/set_level/revoke: `if not public.portia_can_edit_tab('users') then raise exception 'forbidden'; end if;` (lines 404, 498, 547).
- Exceptions: `'self-decision'` (362, 368), `'owner-protected'` (378), `'level-above-own'` (453, 513), `'invalid-level'` (452, 512), `'level-change-separate'` (446), `'invalid-decision'` (407), `'owner-required'` (610, 682).
- Journal event types: `check (event_type in ('approve', 'reject', 'level-change', 'revoke', 'cooldown-clear'))` (line 140). `details`: approve `{level, origin, deviceAdded[, previousLevel]}`, level-change `{from, to}`, revoke `{level}`, cooldown-clear `{count}`, reject `{origin}`.
- Index for newest-event-per-nick: `create index if not exists portia_access_journal_by_nickname on public.portia_access_journal (nickname_key, id desc);` (146-147).
- Statuses: `check (status in ('pending', 'approved', 'rejected', 'revoked'))` on requests (109); `check (status in ('active', 'revoked'))` on people (83).
- Cooldown rule: `r.decided_at > now() - interval '1 hour'` and `cooldown_cleared_at is null` (lines 276-277, 336).
- Existing triggers: `create trigger portia_access_journal_append_only before update or delete on public.portia_access_journal for each row execute function public.portia_access_journal_append_only();` and the `before truncate … for each statement` twin (591, 596).
- `caller_level` is 5 for anyone with `portia_can_edit()` (line 59) - so the level select offers 1..5 for every editor and `level-above-own` cannot fire in practice; keep the flag anyway.

### §1 `portia_access_list(p_query text, p_limit integer)` → jsonb
Returns `{ callerIsOwner, pending:{total, rows[]}, people:{total, rows[]}, closed:{total, rows[]}, serverNow }`. Gate first (`forbidden`). `p_limit` clamped to 0..50 (0 = counts only → serves `view=count`; the badge is `pending.total`). Search = `p_query is null or p_query = '' or strpos(nickname_key, p_query) > 0`, with `p_query` validated `^[a-z0-9_]{0,20}$` else return empty sets (the route lower-cases and pre-validates too). Totals are computed **without** the limit and **with** the search filter (UI-SPEC: section titles show true totals; the badge must be the unfiltered pending total, so compute `pendingTotalAll` separately for the badge).
Row fields: `id` (request id for pending; person id for people), `nickname`, `nicknameKey`, `origin`, `status`, `level`, `createdAt`, `retryAt` (closed rows, only while the pause runs), `existingLevel` (pending request whose nick already has an active person - see Pitfall 8), `lastEvent: {type, at, actor}` where `actor` = masked email (or full if `portia_is_owner()`), flags `canDecide/canSetLevel/canRevoke`, `reason`.
- **Pending:** `requests.status = 'pending'`, oldest first (A5).
- **People:** `people.status = 'active'`, `order by level desc, nickname_key asc` (D-03).
- **Closed (my reading of D-03, A-flagged):** one row per `nickname_key` whose person is absent or `revoked`, and whose newest decided request is `rejected`/`revoked`; order by latest decision desc. A nick may appear both in «Заявки» (new pending) and in the closed block; that is useful history, not a bug.
- **Flags** mirror `portia_access_target_guard` (lines 354-380) - same three predicates, set-based, no per-row exception. Do not change `target_guard` (frozen body hash is in the golden).
- **Last event:** `lateral (select … from journal j where j.nickname_key = x.nickname_key order by j.id desc limit 1)`; actor email from `auth.users` by `actor_id`, masked via §2 unless `portia_is_owner()`. Missing/deleted user → `null` (UI prints «неизвестно»).

### §2 `portia_access_mask_email(p_email text)` → text (immutable, internal)
`local = split_part(email,'@',1)`; length ≤ 2 → `left(local,1) || '•••@' || domain`; else `left(local,1) || '•••' || right(local,1) || '@' || domain`. Null/no `@` → null. Bullet is U+2022 (`•`, verified `codePointAt(0).toString(16) === "2022"`). Internal helper: `revoke … from public, anon, authenticated; grant … to service_role` only (like `portia_access_nickname_key`). Not executable offline - the TS reference implementation lives in the SQL-contract test as a table of expected outputs derived from the same rule, and the SQL text is asserted to contain the same three branches.

### §3 `portia_access_history(p_nickname_key text)` → jsonb
Gate; validate key with `portia_access_nickname_key` (as `clear_cooldown` does, lines 611-613); return `entries` = newest 5 by `id desc` with `{type, at, actor (masked unless owner), details subset}`. Return only whitelisted `details` keys (`level`, `from`, `to`, `origin`, `deviceAdded`, `previousLevel`, `count`) - never pass raw jsonb through.

### §4 `portia_access_bulk_candidates()` → jsonb (owner only)
`if not public.portia_is_owner() then raise exception 'owner-required'; end if;` Returns every pending request with `origin = 'sheet'` as `[{id, nickname, nicknameKey}]` (cap is structurally ≤ 200 = `ACCESS_REQUEST_LIMITS.maxPending`). The route intersects with the fresh roster.

### §5 Journal retention (D-07) - one-way
```sql
-- guard: the SAME function name, so both existing trigger definitions stay byte-identical
create or replace function public.portia_access_journal_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' and old.id < (
    select j.id from public.portia_access_journal j
    where j.nickname_key = old.nickname_key
    order by j.id desc offset 19 limit 1      -- the 20th newest row of this nick; fewer than 20 rows -> null -> refused
  ) then
    return old;
  end if;
  raise exception 'journal-append-only';       -- UPDATE, TRUNCATE, any other DELETE
end; $$;
-- restate revoke/grant (portia-sql test wants them after every post-baseline create-or-replace)
revoke all on function public.portia_access_journal_append_only() from public, anon, authenticated;
grant execute on function public.portia_access_journal_append_only() to service_role;

create or replace function public.portia_access_journal_prune()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.portia_access_journal j
  where j.nickname_key = new.nickname_key
    and j.id < (select k.id from public.portia_access_journal k where k.nickname_key = new.nickname_key order by k.id desc offset 19 limit 1);
  return null;
end; $$;
-- revoke/grant like above
drop trigger if exists portia_access_journal_prune on public.portia_access_journal;
create trigger portia_access_journal_prune after insert on public.portia_access_journal for each row execute function public.portia_access_journal_prune();
```
Why this shape: the privileged API role keeps `select, insert` only (frozen section f, line 177) - no DELETE privilege - and only the definer (owner) can delete, and even the owner is refused unless the row is beyond the 20 newest; UPDATE and TRUNCATE still raise; `details`/`nickname_key` of retained rows can't be touched. Concurrent decisions on one nick are already serialised by `access:nickname:<key>` advisory locks; a stale snapshot can only delete less, never a row inside the 20 newest. "Per person" = per `nickname_key` (reject events have `person_id null`; `nickname_key` is unique per person, `portia_access_people_nickname_key_unique`). Residual (inherited from RLS21-03): the table owner can still `alter table … disable trigger`. Reversibility is one-way - flag it in the plan and in the RLS review request.
Effects on artifacts: trigger count 2 → 3 (`counts.triggers` assertion), new golden function entries + changed `src_sha256` of `portia_access_journal_append_only`, matrix `migrations` list gains the new file, canonical-parity gets a new pinned hash line.

### Not adding
No new table, no change to `decide`/`set_level`/`revoke`/`clear_cooldown`/`target_guard` signatures or bodies (avoids the RLS21-09 overload hazard and re-hashing frozen functions), no stored «в таблице» mark, no `closed_tabs` constraint (none exists: `closed_tabs text[] not null default '{}'`).

## Roster and the «в таблице» mark

- The sheet range used by the employees roster is rows 2-35: `const staffRowsEnd = 35;` (`lib/portia-employees.ts:158`) with `rows.slice(1, staffRowsEnd)`, and the promotion access roster reads `const accessCsvUrl = \`${sheetCsvUrl}&range=B2:B35\`;` (`lib/portia-promotion-sheet.ts:11`) - the same population. [VERIFIED by Read]
- `loadPromotionAccessRoster()` returns `{status:"ok", roster:[{nickname, nicknameKey}]}` | `{status:"unavailable", reason}` | `{status:"invalid-source", reason}` and honours a staging override (`stagingRosterPath(process.env)`). Map `ok` → marks `yes|no`; anything else → `degraded` → marks `unknown`, bulk disabled (D-10).
- That module's own `normalizedNickname` is NFKC + lower-case; **D-09 requires the shared strict rule**: `nicknameKey(entry.nickname)` from `lib/nickname.ts` (null for a roster nick that is not `^[A-Za-z0-9_]{3,20}$` → never matches, which is correct because requests are always valid). Compare keys with a `Set`.
- Manual employees (added by editors outside the sheet) are NOT "в таблице" in this design - the phase text says «таблица сотрудников»; recorded as Open Question 1.
- Caching: a module-level 20 s TTL cache for list polls; `ttl = 0` for `view=bulk` and for every `bulk:true` approve (D-09 "evaluated at decision time"). A failed fetch is never cached as an empty roster.
- Do **not** reuse `/api/employees` GET (public, CDN-cached by path only; comment in `app/api/employees/route.ts`) for this - it must stay out of per-user flows.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Level names, origin labels, defaults | New string tables | `lib/access-levels.ts` | Single source, pinned to SQL by tests |
| Nickname normalisation | `toLowerCase()` ad hoc | `nicknameKey` / `parseNicknameInput` | ACC-04 parity with SQL |
| Confirm dialogs | `window.confirm` | `ConfirmDialog` (reject/revoke) + sibling native `<dialog>` for bulk and phone action window | File comment: "Never use window.confirm for new prompts: embedded browsers answer it 'no' unseen" |
| Tab visibility / closing | New permission store | `tabRegistry` line + `closed_tabs` | `parseTabLists`, `openTabIds`, `getEditorAccess`, `access-tab-chip`, SQL gate are all registry-driven |
| Loading/error/denied panels | New markup | `AppSkeleton`, `AppFatalPanel`, `AppStaleBanner`, `AppDeniedPanel` | Existing copy and a11y |
| Time zone math | `toLocaleString()` | `Intl.DateTimeFormat("en-GB",{timeZone:"Europe/Moscow",hourCycle:"h23"}).formatToParts` + own month table | Device-independent; verified output below |
| Race handling | Client-side locking | DB conditional transitions (`already-decided`, `stale`, advisory locks) | Already enforced; UI only maps codes |
| Plural of «заявка» | Inline ternaries | One tested `pluralZayavka(n)` | Rule in UI-SPEC (1/11/12-14 edge cases) |

**Key insight:** every mutation and every rule already exists in Phase 21; the risk is re-implementing a rule in the UI that then drifts from the DB.

## Suggested Plan Slicing (for the planner; dependencies drive the waves)

| Wave | Slice | Depends on | Notes |
|------|-------|------------|-------|
| 1 | A. Migration `20261110000000_portia_users_tab.sql` + `lib/users-sql.test.ts` + same-commit golden / expected-authz / parity pin / fingerprint-test updates; request `supabase-rls-reviewer` | — | Largest evidence surface; one-way retention flagged. Keep all line-number-bearing artifacts regenerated after the last SQL edit |
| 1 | B. Pure modules: `users-time`, `users-copy`, `users-model`, `users-view`, `users-roster` + tests; registry line + `editor-tabs.test.ts` | — | Independent of SQL; can run parallel with A |
| 1 | C. Token skeleton in first `:root` + `lib/style-tokens.test.ts` (count pins 129 / 6, no-edit digest) | — | Letter-independent; touches `portia.css` (CRLF) - do it before D adds rules to the end of the same file |
| 2 | D. Store wrappers (`access-store.ts`) + `lib/users-api.ts` + `app/api/users/route.ts` + `proxy.ts` matcher + visitor-guard allow-list + `users-api.test.ts` | A (RPC names/shapes), B | Route + store are covered paths → matrix freshness (Pitfall 1) |
| 3 | E. `components/portia-users-tab.tsx`, `users-*` CSS appended at end, editor shell integration (badge, `historyTab`, `AppDeniedPanel` on 403), `users-component.test.ts`, mocked e2e spec | D, C | Re-run `phase20-hints-inventory` |
| 4 | F. Evidence: `22-SECURITY-MATRIX.md` + test repoint, `22-MIGRATION-APPLY.md`, BLOCKED register, full `portia-check` + build | all code frozen, RLS review done | Pin the matrix commit last |
| 4 | G. **Blocking owner checkpoint** A/B/C (text + values table from UI-SPEC), record in `22-STYLE-DIRECTION.md` | none (blocks phase closure only) | Agent presents, never picks or defaults; UI-01 stays BLOCKED (owner decision) until the letter arrives |

## Runtime State Inventory

Not a rename/refactor phase, but the journal prune is a data-affecting change:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `portia_access_journal` rows: none exist anywhere yet (Phase 21 migration is applied nowhere: `21-MIGRATION-APPLY.md` status table "ОЖИДАЕТ ВЛАДЕЛЬЦА"). Prune is forward-only: deleted rows are unrecoverable | Flag one-way in plan + review request; no data migration needed |
| Live service config | `portia_editors.closed_tabs` rows of existing editors do not mention `users` → the tab is open for everyone, including editors the owner closed everything for ("Владелец пока не открыл вам ни одного раздела") | Tell the owner in the checkpoint note; no code change |
| OS-registered state | None - verified by absence of any scheduler in the repo for this feature | None |
| Secrets/env vars | `PORTIA_ACCESS_SUBMIT_SECRET` is Phase 23's concern; this phase adds no secret | None |
| Build artifacts | None (no package rename) | None |

## Common Pitfalls

### Pitfall 1: The security matrix tests go red as soon as a route, a migration or `lib/access-store.ts` appears
**What goes wrong:** `lib/security-matrix.test.ts` (a) checks `routeCoverageProblems(matrixText(), routes)` against the **frozen v1.3** matrix - a new `app/api/users/route.ts` is "missing route row" and that file cannot be edited; (b) checks migration coverage and freshness against `21-SECURITY-MATRIX.md` - a new `supabase/migrations/…` file is "missing migration row", and any change to a covered path (`app/api`, `supabase/migrations`, `proxy.ts`, `lib/access-store.ts`, `lib/access-levels.ts`, `lib/nickname.ts`, `lib/editor-access.ts`, `lib/supabase`) after the pinned commit is "stale matrix".
**Why:** 21-07 deliberately tied them (see its SUMMARY: "Структура находок, маршруты … проверяются по архивной матрице v1.3, потому что Phase 21 не добавляла маршрутов").
**How to avoid:** Final plan task creates `22-SECURITY-MATRIX.md` (copy the 21 structure: header with a 40-hex «Проверяемый commit», «Охват файлов», «Маршруты API (охват)» with all 12 routes incl. `app/api/users/route.ts`, «Миграции (охват)» with 8 rows, findings from the Phase 22 RLS review), repoint `currentMatrixText` **and the route-coverage test** to it, and keep the Phase 21 apply-record/findings tests reading the 21 files. Pin commit = last code commit after the RLS review; every later edit to a covered path invalidates it (order tasks accordingly).
**Warning signs:** `missing route row`, `missing migration row`, `stale matrix: <path> changed since <sha>`.

### Pitfall 2: "Visitor behaviour is unchanged" guard rejects the new route/component
`lib/access-foundation.test.ts` ("visitor behaviour is unchanged: nothing under app/ or components/ uses the access modules or RPCs") scans every `.ts/.tsx` under `app/` and `components/` and forbids `/access-store|access-session|access-levels|\/nickname(\.ts)?["']/` and the string `portia_access_`. `app/api/users/route.ts` and `components/portia-users-tab.tsx` will import `access-levels` labels. **Fix:** change the test to an explicit allow-list (`app/api/users/route.ts`, `components/portia-users-tab.tsx`, plus the editor shell if it imports the badge hook) and keep forbidding every visitor-facing file (`app/page.tsx`, desktop, promotion components). Do not delete the guard. Also keep the string `portia_access_` out of app/components (use `accessRpc.*` constants inside `lib/`).

### Pitfall 3: `tabRegistry` is hard-coded in tests
`lib/editor-tabs.test.ts` pins `regularTabs = ["viruses","info","guide","broadcasts","recycle","search","assistant","employees"]`, `tabRegistry.slice(0, 8)`, `tabRegistry[8]` = `{ id: "promo", label: "Повышение", kind: "trusted" }`, and "all eight closed gives an empty list (D-07)". UI-SPEC A2 places `users` after «Сотрудники», before «Повышение», so indices shift. `lib/editor-access.test.ts` derives from the registry (safe). `tests/e2e/specs/editor-ui-contract.spec.ts` maps `tabRegistry` into the mocked `/api/access` reply and fails on any non-GET `/api` call: if it activates every tab, mock `**/api/users**` (GET only). Register line: `{ id: "users", label: "Пользователи", kind: "regular" }`. `EditorTab` union (`components/portia-editor.tsx:41`) gains `"users"`; add it to `historyTab` exclusion (`:1058`).

### Pitfall 4: `proxy.ts` matcher is an allow-list
Matcher is `["/owner-login/:path*", "/api/access", "/api/editors", "/api/uploads", "/api/promotion/reviewer/:path*", "/api/promotion/banks/:path*"]` [VERIFIED: proxy.ts:13-20]. `/api/employees` is intentionally absent, with writes refreshing the session inside the handler. A 10 s poller that sits for a long time should refresh its session; add `"/api/users"` (non-CDN, per-user, no-store) - this also makes `proxy.ts` a covered-path change for Pitfall 1.

### Pitfall 5: `phase20-hints-inventory` fails on any 7+-word Cyrillic string in `components/*.tsx`
`longTexts()` walks string literals, template parts and JSX text in every `components/**/*.tsx` and `app/**/page.tsx` (`hintPaths`), `const longTextWords = 7;`, and requires each hit to appear in the **frozen v1.3** register (`PORTIA-20-…/20-HINTS-INVENTORY.md`), which cannot gain rows. Many UI-SPEC strings exceed 7 words (empty bodies, reject/revoke texts, search hint, degraded caption, «Нет заявок «из таблицы» с ником из таблицы.»). `lib/**/*.ts` is scanned only for *old* texts (`sourcePaths`), not for long texts. **Fix:** keep every 7+-word string in `lib/users-copy.ts` (precedent: `lib/app-state.ts` `failureCopy`) and import it; keep JSX text pieces short. Also run the whole suite, not just new tests.

### Pitfall 6: Generated evidence artifacts must change in the same commit as the SQL
Same-commit set (21-04/21-05 rule): `tests/e2e/fixtures/data/expected-authz.json` (add `migrations` entry, one function entry per new RPC with six role cells and `source` = `supabase/migrations/20261110000000_portia_users_tab.sql:<line>`; lines must be regenerated if the file is edited above them), `supabase/fingerprint/expected/portia.fingerprint.json` (function entries with `src_sha256` recomputed per the test's rule - body between `as $$` and `$$;`, CR removed - and the changed append_only hash, the new trigger entry, `triggers: 3`), `lib/portia-canonical-parity.test.ts` (new pin line; never touch the existing ones), `lib/portia-migration-fingerprint.test.ts` (`counts.triggers` 2 → 3 and the golden-triggers test, which currently parses only `accessText`), `lib/phase16-expected-authz.test.ts` thresholds, `lib/portia-staging-live.test.ts` (golden keys vs matrix keys comparison at live time). Fingerprint text for constraints/indexes/triggers is "derived by analogy" (BLOCKED ENV) - state it, do not claim it verified.

### Pitfall 7: `portia.css` is CRLF in the working tree
`git ls-files --eol app/portia.css` → `i/lf w/crlf` (core.autocrlf=true); `portia-promotion-editor.css` is LF. Existing tests normalise with `.replace(/\r\n/g, "\n")`; Edit/Write tools can produce mixed endings. Write the token block and appended rules with the file's own endings, and make the new style test normalise CRLF. The two `:root` blocks are at lines 8 and 1749; the first sits after 7 lines of icon-animation comment/rules (do not assume line 1).

### Pitfall 8: Pending request of an already-active person (extra device)
`decide` treats it as "a further device": `if p_level is not null and p_level <> person.level then raise exception 'level-change-separate';` (line 446). If the UI pre-selects `defaultApprovalLevel(origin)` and sends it, approving a second device of a level-4 person fails. The list row must expose `existingLevel`; the UI shows that level read-only and sends no `level`.

### Pitfall 9: Counting `border-radius` - comment text and regex
`grep -c "border-radius"` and the regex both give 129 today, but any added comment containing the literal word with a colon or even just the word changes a line-grep. Use `/border-radius\s*:/g` (so `--radius-*` never counts) and write the skeleton comment without the literal `border-radius`. Verified this session: `portia.css` 129 declarations on 129 lines, `portia-promotion-editor.css` 6 on 6 lines, `globals.css` 0.

### Pitfall 10: Dead database ahead of code
The Phase 21 migration is not applied anywhere; the new migration depends on it. Deploying the tab before the owner applies both makes every call fail. All editors get the tab by default. Map missing-function errors to `503 pending-database` → `AppFatalPanel` (not an empty "Новых заявок нет" - that would be a lie), keep the badge hidden while unknown, and document apply order (…, `20261109000000`, `20261110000000`) in a `22-MIGRATION-APPLY.md`.

### Pitfall 11: Visual baselines
The editor tab strip gains a tab, so any pixel baselines of the editor (`tests/e2e/visual/*`) drift. Owner dropped galleries and the per-hash ledger; do not regenerate baselines and do not run `phase15-visual-manifest.mjs --verify`; report the change as text.

## Code Examples

### Moscow time without `toLocaleString` (verified output)
```ts
// Source: Node 22.13.1 run in this session -> day=09|month=11|year=2026|hour=14|minute=32 for 2026-11-09T11:32:00Z
const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Moscow", hourCycle: "h23",
  year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).formatToParts(date);
// Numbers only; month names from an own table. NOTE day comes back zero-padded ("09") even with "numeric": Number(...) it.
const MONTHS = ["янв.", "февр.", "мар.", "апр.", "мая", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."];
```

### Pin the radius count and prove "no existing line edited"
```ts
// lib/style-tokens.test.ts (node:test, relative imports only)
const css = readFileSync(new URL("../app/portia.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");
assert.equal((css.match(/border-radius\s*:/g) ?? []).length, 129);
assert.equal((promoCss.match(/border-radius\s*:/g) ?? []).length, 6);
assert.equal((css.match(/^:root\s*\{/gm) ?? []).length, 2);
// primitives equal values present in the census; layout import order:
assert.deepEqual([...layout.matchAll(/import "\.\/([\w-]+\.css)";/g)].map((m) => m[1]), ["globals.css", "portia.css", "portia-promotion-editor.css"]);
// strongest mechanical evidence (recommended): strip the marked skeleton block and the marked users-* block,
// then sha256 of the rest equals the pre-phase file (LF-normalised) - computed by the executor from `git show HEAD:app/portia.css` BEFORE editing.
// Pre-edit value read in this session (working tree, LF-normalised): 0446df52dd83bb42e3a4837b7262b73d230f4600572475b28222e569e192367c (2457 split lines) - recompute at execution time.
```
Phase 26 will legitimately change the pin; the test comment must say so.

### Plural helper (UI-SPEC rule)
```ts
export function pluralZayavka(n: number): "заявку" | "заявки" | "заявок" {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return "заявку";
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return "заявки";
  return "заявок";
}
```

### Bulk run (client loop, each call separately)
```ts
// summary always prints all three numbers (D-11)
let approved = 0, already = 0, failed = 0;
for (const c of eligible) {                       // eligible comes from GET ?view=bulk
  const r = await post({ action: "approve", requestId: c.id, level: 2, bulk: true });   // server re-checks owner + roster (TTL 0)
  if (r.code === "approved") approved++; else if (r.code === "already-decided") already++; else failed++;
  setProgress(approved + already + failed);       // «Одобрено k из N» - aria-live
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Middleware file | `proxy.ts` with explicit `config.matcher` | Next 16 (already in repo) | New per-user API path must be added to the matcher |
| One-line function-header regex in tests | Multi-line header regex up to `as $$` | 21-05 | New migration functions must follow the `as $$ … $$;` shape or the fingerprint test mis-parses them |

**Deprecated/outdated:** none relevant. Context7 was unavailable (disconnected); Next.js behaviour was taken from the repo's own working routes and `node_modules/next` (16.4.5) rather than fresh docs.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | "Таблица сотрудников" for the mark/bulk = the sheet access roster only (B2:B35), excluding manual employees added in the «Сотрудники» tab | Roster | Owner expects manual staff to count → bulk would skip them. Confirm in discuss/plan |
| A2 | Closed-block membership rule (one row per nick, no active person, newest decided request rejected/revoked; may coexist with a pending row) | SQL §1 | Different expectation of what «Отклонённые и отозванные» lists; cheap to change before SQL is written |
| A3 | Roblox profile URL: use `https://www.roblox.com/users/profile?username={nick}`. Evidence: `curl -sIL "https://www.roblox.com/user.aspx?username=Roblox"` → `HTTP/1.1 301 Moved Permanently`, `location: /users/profile?username=Roblox`, then `HTTP/1.1 404 Not Found` from curl; the same 404 for the new form and for a nonexistent name, so headless curl cannot tell whether a real nick resolves (page is client-rendered / bot-gated). UI-SPEC A6 proposed `user.aspx?username=` | Rows | Link may land on a 404 for some nicks; owner/device check needed, mark BLOCKED (physical device/browser) not PASS |
| A4 | Bulk execution is a client-driven loop of single POSTs with server re-check, not one server loop | Architecture | If owner prefers atomic server run, progress line goes away; both honour D-11 |
| A5 | Session refresh for `/api/users` via the `proxy.ts` matcher is desirable (like `/api/access`) | Pitfall 4 | If omitted, long-lived pollers may see 403 after token expiry until the shell's `/api/access` poll refreshes |
| A6 | List RPC returns at most 50 rows/section and `p_limit = 0` serves the badge; separate history RPC rather than embedding 5 entries per row | SQL §1, §3 | Payload size / extra requests; either variant satisfies UI-SPEC |
| A7 | Any single caller can send `level` only 1..5 and the DB default applies when omitted; UI preselects default but omits level for extra-device requests | Pitfall 8 | Approving an extra device with a mismatched level raises `level-change-separate` |
| A8 | The JSON-over-`text/plain` cross-site POST risk is covered by cookie SameSite defaults, as for existing routes (`/api/editors`, `/api/employees`); no extra Origin check added | Security | Low; if the owner wants defence in depth, require `content-type: application/json` in the new route only |

## Open Questions

1. **Does «в таблице» include manual employees?**
   - What we know: the mark and bulk follow the staff sheet; manual employees live in a separate table and are not on the sheet.
   - Unclear: whether the owner considers them «в таблице сотрудников».
   - Recommendation: sheet only (matches origin «из таблицы» semantics and the promotion access roster); ask once in plan-phase if cheap, otherwise record as accepted.
2. **Where is the style-direction answer recorded and what blocks closure?**
   - UI-SPEC: `22-STYLE-DIRECTION.md` in the phase folder, written only after the owner answers one letter; until then UI-01 is BLOCKED (owner decision). The checkpoint blocks **phase closure**, not the code tasks (tokens are letter-independent).
3. **Does the owner want `existingLevel` shown for extra-device requests?** Minor copy; default: read-only text «Уровень N уже выдан».
4. **Deploy order.** Phase 21 migration + the owner step «секрет подписи» are still owner-side; the tab works only after both migrations are applied. Confirm the owner accepts a visible «серверная часть не обновлена» state meanwhile.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node | tests, tsc, eslint, build | ✓ | v22.13.1 (reference version, on PATH) | `%TEMP%\portia-node-v22.13.1\…` |
| npm | `npm test` etc. | not probed (earlier phases: temp-Node npm broken, no `node-gyp`) | — | run the underlying `node …` commands directly (see Project Constraints) |
| Postgres / `psql` / Docker | executing the new SQL | ✗ (`command -v psql docker pg_isready` empty) | — | None → SQL stays text-contract-tested; execution BLOCKED (ENV) |
| Isolated staging project | live role / race proof | ✗ not provisioned for this phase | — | BLOCKED (ENV), never PASS |
| Playwright browsers / data source | e2e overflow check at 320/390/900 | ✗ treated as unavailable (data-backed lanes fail ENOTFOUND; Playwright MCP disconnected) | — | Write the mocked-lane spec in `editor-ui-contract.spec.ts` style, record BLOCKED if it cannot run |
| Context7 MCP | docs | ✗ disconnected | — | Repo code + `node_modules` (used) |
| Internet (Roblox, Google Sheets) | A3, roster | ✓ (curl worked) but unrelated to automated tests | — | Roster is injected in tests |

**Missing dependencies with no fallback:** Postgres/staging/authenticated roles/physical devices - all stay BLOCKED by project rule (CLAUDE.md, D-72).
**Missing dependencies with fallback:** npm (call node scripts directly), Playwright lane (record BLOCKED).

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json` (read this session), so this section is optional by the contract; it is included because the orchestrator asked for it explicitly.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | `node:test` via `node --experimental-strip-types --test lib/*.test.ts` (Node 22.13.1); no TSX in unit tests (strip-types is `.ts` only) |
| Config file | none |
| Quick run command | `node --experimental-strip-types --test lib/users-*.test.ts lib/style-tokens.test.ts lib/editor-tabs.test.ts` |
| Full suite command | `bash .claude/skills/portia-check/run.sh` (tests, tsc, lint, visual manifest test + `--verify-promotion`; add `build` arg for the build). Baseline at Phase 21 close: 1821 tests / 1818 pass / 0 fail / 3 skipped |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| USR-01 | list payload parsed fail-closed; pending first; badge text hidden at 0/unknown, `99+` above 99; true totals vs 50-row cap | unit | `node --experimental-strip-types --test lib/users-view.test.ts lib/users-model.test.ts` | ❌ Wave 0 |
| USR-01 / USR-09 | `users` registry line, `parseTabLists` accepts it, route 403 when `openTabs` lacks it, SQL gate `portia_can_edit_tab('users')` present in all four new RPCs | unit | `… lib/editor-tabs.test.ts lib/users-api.test.ts lib/users-sql.test.ts` | ✅ editor-tabs (update) / ❌ others |
| USR-02 / USR-03 | mark yes/no/unknown from roster result tri-state; default level 2/1; extra-device request sends no level | unit | `… lib/users-api.test.ts lib/users-view.test.ts` | ❌ Wave 0 |
| USR-04 | approve/reject/set-level/revoke/clear-cooldown POST dispatch and body validation; result-code → 200 mapping; `self-decision`/`owner-protected` → 409 | unit (stub client) | `… lib/users-api.test.ts` | ❌ Wave 0 |
| USR-06 | masked email in SQL text (three branches, owner branch via `portia_is_owner()`); caption verbs; Moscow format «9 нояб., 14:32», year only when different; history ≤ 5 | unit | `… lib/users-sql.test.ts lib/users-time.test.ts` | ❌ Wave 0 |
| USR-07 | stub returns `already-decided`/`stale`/`not-active`/`already-revoked`/`not-found` → UI notes; bulk summary counts | unit | `… lib/users-api.test.ts lib/users-view.test.ts` | ❌ Wave 0 |
| USR-08 | bulk: owner-only (editor → 403), eligible = pending sheet ∩ roster using `nicknameKey`, excluded list, degraded → disabled, per-call re-check, one failure does not stop the rest | unit | `… lib/users-api.test.ts` | ❌ Wave 0 |
| D-07 | SQL text: guard allows DELETE only via `offset 19` rule, UPDATE/TRUNCATE still raise, prune trigger AFTER INSERT, no new table, no grant of delete/update/truncate | unit (text) | `… lib/users-sql.test.ts lib/access-foundation.test.ts` | ❌ Wave 0 |
| Component contract | `components/portia-users-tab.tsx` source: `aria-live` region, `role="alert"` on errors, `aria-busy` rows, `aria-haspopup="dialog"` on phone rows, no 7+-word Cyrillic literal, imports copy from `lib/users-copy.ts`, absent (not disabled) owner-only controls | unit (source text) | `… lib/users-component.test.ts lib/phase20-hints-inventory.test.ts` | ❌ Wave 0 |
| UI-01 | radius count 129 / 6, 2 `:root` blocks, import order, skeleton primitives ⊂ census, "no existing line edited" digest | unit | `… lib/style-tokens.test.ts` | ❌ Wave 0 |
| Evidence gates | route/migration coverage, freshness, parity pin, fingerprint, authz replay, visitor guard | unit (existing, updated) | `… lib/security-matrix.test.ts lib/portia-canonical-parity.test.ts lib/portia-migration-fingerprint.test.ts lib/phase16-expected-authz.test.ts lib/portia-sql.test.ts lib/access-foundation.test.ts` | ✅ (update) |
| Phone overflow 320/390/900 | `scrollWidth <= clientWidth` | e2e (mocked `/api/users`) | `npm run test:e2e*` (needs preflight env) | ❌ → BLOCKED (ENV) if it cannot run |
| Live editor/owner roles, real race, RLS on Postgres, devices, owner style pick | — | — | — | BLOCKED, never PASS |

### Sampling Rate
- **Per task commit:** the quick command above plus `node node_modules/typescript/bin/tsc --noEmit`.
- **Per wave merge:** `bash .claude/skills/portia-check/run.sh`.
- **Phase gate:** full run + `… run.sh build` green before `/gsd-verify-work`; BLOCKED list written next to it.

### Wave 0 Gaps
- [ ] `lib/users-sql.test.ts`, `lib/users-time.test.ts`, `lib/users-view.test.ts`, `lib/users-model.test.ts`, `lib/users-api.test.ts`, `lib/users-component.test.ts`, `lib/style-tokens.test.ts` - new.
- [ ] Update existing: `lib/editor-tabs.test.ts`, `lib/access-foundation.test.ts` (visitor guard allow-list), `lib/security-matrix.test.ts` (+ `22-SECURITY-MATRIX.md`), `lib/portia-canonical-parity.test.ts`, `lib/portia-migration-fingerprint.test.ts`, `lib/phase16-expected-authz.test.ts`.
- [ ] No framework install needed.

## Security Domain

`security_enforcement` is enabled (`workflow.security_enforcement: true`, `security_asvs_level: 1`, `security_block_on: "high"`).

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | Supabase session via `@supabase/ssr`; unconfirmed e-mail never edits (`getEditorAccess`) |
| V3 Session Management | yes (inherited) | `proxy.ts` matcher refresh; routes use `getUser()` |
| V4 Access Control | **yes - core** | Gate inside every RPC (`portia_can_edit_tab('users')` / `portia_is_owner()`), route gate, server-driven flags; owner-only bulk + clear-cooldown |
| V5 Input Validation | yes | `parseJsonObject`; `q` validated to `[A-Za-z0-9_]{0,20}`; ids `uuid` regex; `level` via `isAccessLevel`; action allow-list; `strpos` not `like` |
| V6 Cryptography | no new | Phase 21 HMAC unchanged; nothing hand-rolled here |
| V8 Data Protection | yes | Masked decider e-mail for non-owners in SQL; whitelisted `details` in history; `noStoreHeaders` on all responses |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Editor calls list/history RPC directly to read other editors' e-mails | Information disclosure | Mask inside the definer function keyed on `portia_is_owner()` |
| Editor with `users` closed still calls RPCs | Elevation of privilege | Same gate as `decide`: `portia_can_edit_tab('users')` → `forbidden`; matrix cell `outsider`/closed expectation |
| Wildcard search (`_`) used to enumerate | Information disclosure (minor) | `strpos` on validated lower-case query |
| Journal tampering via new delete path | Tampering / Repudiation | Content-based DELETE guard (only beyond 20 newest), UPDATE/TRUNCATE still raise, no DELETE/UPDATE/TRUNCATE privilege for API roles, reviewer gate |
| Self-approval / owner change via stale UI | Elevation of privilege | DB `target_guard`; UI flags are convenience only |
| Bulk used to approve non-roster nicks | Tampering | Server re-checks owner + fresh roster on each `bulk:true` call; (an owner can approve anyone singly anyway - not a boundary) |
| Cross-site POST with ambient cookie | Spoofing/CSRF | SameSite defaults as for existing routes (A8); optional JSON content-type requirement |
| Roster outage treated as "not in table" | Integrity | Tri-state result → `unknown`, bulk disabled; never cache a failure as empty |
| Open redirect / tabnabbing via Roblox link | Tampering | `target="_blank" rel="noopener noreferrer"`, `encodeURIComponent(nick)`; nick is `[A-Za-z0-9_]` only |

## Sources

### Primary (HIGH confidence - read this session)
- `supabase/migrations/20261109000000_portia_access_foundation.sql` (all 711 lines) - RPC bodies, gates, exceptions, journal, triggers, indexes
- `supabase/migrations/20261101000000_portia_baseline.sql` lines 95-205 - `portia_is_owner`, `portia_can_edit`, `portia_can_edit_tab`, grants
- `lib/access-store.ts`, `lib/access-levels.ts`, `lib/nickname.ts`, `lib/editor-tabs.ts`, `lib/editor-access.ts`, `lib/portia-employees.ts` (roster parts), `lib/portia-promotion-sheet.ts`
- `app/api/employees/route.ts`, `app/api/access/route.ts`, `proxy.ts`, `lib/supabase/server.ts`, `app/layout.tsx`, `app/portia.css` (first 50 lines, `:root` locations, counts via script), `components/portia-editor.tsx` (tab strip, access panel), `components/portia-desktop-states.tsx`, `components/portia-editor-dossier.tsx` (`ConfirmDialog`)
- Tests: `lib/security-matrix.test.ts`, `lib/access-foundation.test.ts`, `lib/editor-tabs.test.ts`, `lib/portia-migration-fingerprint.test.ts`, `lib/portia-canonical-parity.test.ts`, `lib/phase20-hints-inventory.test.ts`, `lib/portia-promotion-api.test.ts`, `lib/e2e-offline-supabase-harness.test.ts`, `tests/e2e/specs/editor-ui-contract.spec.ts` (head)
- Phase 21 docs: `21-01..21-07-SUMMARY.md`, `21-MIGRATION-APPLY.md`, `21-SECURITY-MATRIX.md`, `21-CONTEXT`-derived `22-CONTEXT.md`, `22-UI-SPEC.md`, `.planning/config.json`, `REQUIREMENTS.md`, `ROADMAP.md` Phase 22, `STATE.md`
- Commands run: radius census script (129 / 6 / 0), `git ls-files --eol`, `node` Intl check, `curl -sIL` for the Roblox URL

### Secondary (MEDIUM)
- Roblox URL redirect header evidence (curl) - partial, see A3

### Tertiary (LOW)
- None used for recommendations.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - nothing new; versions read from `package.json`.
- Architecture: HIGH for tier split and test seams (verified against working precedents); MEDIUM for the SQL shape (never executed, reviewer-gated).
- Pitfalls: HIGH - each was found by reading the exact test or file that fails; none rests on memory.
- Roblox link: LOW (A3).

**Research date:** 2026-11-09
**Valid until:** 2026-12-09 (repo-internal; re-check the pins - radius count, migration list, registry order - at plan time, as D-12 and UI-SPEC require)
