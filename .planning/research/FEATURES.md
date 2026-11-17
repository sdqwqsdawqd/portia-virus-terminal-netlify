# Feature Research

**Domain:** Gated fan-community site styled as a retro desktop OS (PORTIA OS): nickname access requests, editor-side user management, clearance levels, unified UI style
**Milestone:** v1.4 «Доступ и единый стиль» (adds to an existing app; existing features not re-researched)
**Researched:** 2026-11-09
**Confidence:** MEDIUM overall. Access-workflow and gating patterns are well-established (HIGH on the patterns, MEDIUM on how they fit this stack). Roblox API specifics are MEDIUM (official docs for OAuth, community sources for username lookup). Design-system section is opinionated synthesis (MEDIUM).

Owner intent that frames everything (todos 2026-11-07/08): **anti-espionage**. A stranger must learn nothing about the site's content before a nick is typed AND approved by an editor. Nick entry is a gate, not authentication. That distinction drives most decisions below.

---

## Feature Landscape

### A. Nick access request (boot screen)

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Boot-screen request form: Roblox nick + type («из таблицы» / «не из таблицы») | Owner's explicit ask | LOW | Reuse the boot animation (once per session, `html[data-boot]`). Form is the only thing rendered until a grant exists. |
| Four-state lifecycle: `pending` / `approved` / `rejected` / `revoked` | Universal in access-request systems (SailPoint, IBM, Robomq all model pending/approved/rejected/revoked) | MEDIUM | Level lives on the approved grant, not on the request. Rejected and revoked are both re-requestable; keep them distinct for editors and audit. |
| Server-side gate: no content in any response without a valid grant | The whole point; "hidden in UI" is not a boundary | HIGH | Every public read path must check the grant: `/api/content`, `/api/employees`, search, uploads/media, promotion routes, SSR HTML if it embeds content. Today `/api/content` and `/api/employees` are "identical for every visitor" and CDN-cached (purged by tag). That cache model must change (see Dependencies). |
| Opaque device token (httpOnly cookie) → server grant lookup | Browser has to prove "I am the approved request" without accounts | MEDIUM | Mirror the existing `portia_promo_device_bindings` pattern (token hash stored, nick key unique). Never trust a client-sent nick or level. Revocation is checked server-side on each request, so a stolen cookie dies on revoke. |
| Pending screen: neutral "Заявка отправлена, ждите решения" + manual/auto re-check | Users must know what happened; reload must not lose the pending state | LOW | Pending shows NO app names, icons, wallpaper, taskbar. Poll status ~10 s while tab visible (same cadence as existing content poll). Survives reload via the device token. |
| Rejected / revoked screens: neutral text, re-request allowed | Dead-end screens frustrate legitimate users who mistyped | LOW | Re-request after a short cooldown (suggest 1 h–24 h, tunable) with attempt cap; reuse the `portia_promo_attempt_buckets` rate-limit pattern. Reject reason, if any, is editor-only (do not echo to requester). |
| Nick normalization + one canonical key | "Qloxz", "qloxz", " Qloxz " must be the same person | LOW | Trim, case-fold, Roblox charset (letters/digits/underscore, 3–20). Store original Roblox spelling for display (matches existing "ники вне таблицы в написании Roblox"). |
| Duplicate/spam control: one live pending request per nick and per device; rate limit per IP bucket | Open anon write endpoint = spam and DoS vector | MEDIUM | Anon insert must go through a server route/RPC, not direct table write. Ties to the todo "revoke anon `portia_promo_register_attempt`". |
| Table-match indicator for «из таблицы» requests | Editors need to know whether the claimed nick is actually in the 34-slot roster | LOW | Server compares normalized nick (and Roblox id when available) with `employees`. Show as a badge to the approver only. Do NOT auto-approve on match (see Anti-Features). |
| Impersonation visibility: approver sees conflicts | Someone typing another person's nick is the main threat | MEDIUM | Show "this nick already has an approved grant / a pending request from another device". One active approved grant set per canonical nick; second claimant lands as `pending` with a conflict flag. |
| Soft Roblox existence check on submit (server-side) | Filters junk nicks, gives approver an avatar + profile link + stable user id | MEDIUM | Roblox username→id lookup (users.roblox.com `usernames/users`, case-insensitive per community sources; verify in the sandbox before relying on it). Must be SOFT: if Roblox is unreachable, accept as "не проверен" and flag it, as the employees code already tolerates Roblox outages. Use Roblox user id as the canonical identity when known (nicks can change). |
| Logout / "forget this device" | Shared PCs, phones | LOW | Clears the cookie only; the grant stays on the server (the person can return on that device only by token, so after logout they must re-request or re-claim, see below). |
| Promotion reads nick from the approved grant (employee type) | Owner's explicit ask | MEDIUM | Replace `PromotionIdentityGate` for employee grants with the grant's nick (read-only). Observers («не из таблицы») keep entering a nick manually in Promotion, per owner's words. Promotion's own device binding must agree with the grant nick, not fork a second identity. |
| Editors/owner bypass the gate | They already authenticate via Supabase | LOW | Treat logged-in approved editors as implicit top level. Do not make editors file nick requests. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| In-profile verification code ("put PORTIA-XXXX in your Roblox About") | Real proof of nick ownership; kills impersonation cheaply; common pattern in Roblox Discord bots | MEDIUM | Server fetches the public profile description by user id and compares. Optional per request type, or only offered when a conflict flag exists. Best single upgrade for the anti-espionage goal short of OAuth. |
| "Sign in with Roblox" (OAuth 2.0/OIDC, scopes `openid profile`, `sub` = user id) | True authentication, zero impersonation | HIGH | Official, documented, but requires registering an app by an ID-verified developer and a callback flow on Netlify. Candidate for a later milestone, not v1.4. |
| Multi-device per nick with a cap (e.g. 3) and "add this device" approval | Phone + PC is this audience's real usage (PROJECT.md) | MEDIUM | New browser with an approved nick = new request that shows "already approved on another device" so one click approves it. Without this every device change is a full manual re-approval. |
| Soft grant expiry (sliding ~90 days of inactivity) | Dead grants do not live forever | LOW | Optional. Small closed community: "valid until revoked" is acceptable as the default; sliding expiry is a cheap upgrade. |
| Flag grants whose employee left the table | Level 2 should not silently outlive roster membership | LOW–MEDIUM | Badge in the editor list ("больше не в таблице"); do not auto-revoke. |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Auto-approve when the nick is in the employees table | Saves editor clicks | Anyone can type a real employee's nick; this is exactly the espionage case | Show the match badge; require a human click. |
| Nick-only "login" with no device token (re-type nick to get back in) | Simplest UX | Nick is public knowledge; whoever types it inherits the grant | Device token (+ optional profile code). |
| Pending users see a "preview" / blurred site | Feels friendlier | Leaks structure, app names, wallpaper: violates the owner's requirement | Neutral waiting screen only. |
| Revealing "this nick is approved/taken" to the requester | Helpful error text | Lets a stranger enumerate who is in the department | Same neutral response for all outcomes; details only for editors. |
| Email/password accounts for visitors | "Proper" auth | Overkill for a fan site, new attack surface and Supabase auth changes | Device-bound grants. |
| Email/Discord notifications to editors in v1.4 | Faster approval | New secrets/integration surface, production-adjacent | In-app pending badge on the editor tab. Defer. |
| Auto-expire pending requests with cleanup jobs | Tidy table | Needs a scheduler for little value | Filter by age in the editor list; manual bulk-clear. |

---

### B. Editor tab «Пользователи»

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| New tab visible to all editors by default | Owner's words | LOW | Extend `EditorTab` union (currently `viruses|info|guide|broadcasts|recycle|search|assistant|employees|promo|access`) and the per-tab permission model (`closed_tabs`/`granted_tabs`). Default = open for all; owner can still close it per editor. Do not confuse with the existing `access` tab (that manages editors). |
| Queue-first list: default filter "Ожидают", newest first, count badge on the tab | Approvers come to clear a queue | LOW | Badge also useful as the only "notification". |
| Row data: nick (Roblox spelling) + avatar/profile link, claimed type, table-match badge, status, level, requested date, decided by/at | Editor needs every fact to decide | MEDIUM | Avatar via Roblox thumbnail (soft; fall back to initials). |
| Per-row actions: Approve (with level preselected: 1 observer, 2 table employee, editable), Reject (optional reason), change level, Revoke, Re-open | Spec'd flows | MEDIUM | Decisions are server RPCs, never direct table writes from the client. |
| Search by nick + filters (status, type, level) | Even 50–200 rows need it once spam arrives | LOW | Client-side filtering is fine at this scale; still paginate/limit (v1.3 "ограничения списков"). |
| Decision persists; audit on the row: who decided, when, previous level | "И он будет сохраняться"; accountability across several editors | MEDIUM | Store `decided_by` (auth uid) and `decided_at` on the grant, plus an append-only event table (request, approve, reject, revoke, level change: actor, from→to, at). The `portia_promo_audit_events` table is an existing precedent. |
| Concurrency-safe decisions | Two editors click at once | MEDIUM | Transition RPC with expected-status check ("уже решено: <editor>"). Matches the existing optimistic-save philosophy (revisions). |
| Same look/layout as other editor tabs | Part of the unified-style requirement | LOW | Build it on the new shared editor-tab layout, not bespoke. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Full per-person history drawer (all events) | Resolve "who let this person in" disputes | LOW (if events table exists) | |
| Bulk select + bulk reject / bulk level change | Clearing spam waves | MEDIUM | Bulk REJECT is safe. Bulk APPROVE only for explicitly selected rows, never "approve all matched". |
| "Просмотр как уровень N" preview for editors | Lets editors verify what level 2 actually sees; the best defence against gating mistakes | MEDIUM | Server-side impersonation of a level in the editor session only. High value, since mistakes here leak data. |
| Conflict panel (same nick, two claimants) with "replace grant" action | Resolves the impersonation case in one view | MEDIUM | |
| Block list (nick or device) after repeated rejects | Persistent spammers | LOW | A fifth state `blocked`, or a flag on rejected. |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Editors can edit a grant's nick | "Fix typos" | Rewrites identity and breaks audit | Reject and re-request. |
| Hard-deleting requests | Tidy list | Loses audit trail | Revoked/rejected stay; list filters hide them. |
| Per-editor approval quorum (2 approvals) | Safer | Process overhead for a tiny team | Audit trail + revoke. |
| CSV export/import of users | Admin habit | Not needed at this size, privacy surface | Skip. |

---

### C. Clearance levels 1–5 on content

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Level on the grant: observer=1, table employee=2 on approval, editors raise manually up to 5 | Owner's words | LOW | Editors and owner implicitly see everything. Open question for discuss-phase: who may grant 4–5 (any editor vs owner only). |
| Required level per item in База вирусов, Справочник, Информация, Устав | Owner's words | HIGH | Visible = `user level >= item level`. Default for all existing content on migration: 1 (keeps current behaviour for approved users; owner raises later). Level field must be editable in each of the four editors with one shared control. |
| Granularity: per whole item (virus record, Справочник card, Информация section/subsection, Устав document) | Cheapest model that matches "select for each piece of information" | MEDIUM | Children inherit the parent's level and may only be equal or higher (a child cannot be more public than its parent). |
| Enforcement on the server BEFORE data leaves (filter at query/serialization time) | Filter-after-render and client-side hiding are the classic leak (Confluence/SharePoint search-leak bugs) | HIGH | `/api/content` must return a per-level projection. Never ship restricted payloads and hide them in React. |
| Restricted items are omitted from search, "recent", links lists, previews, counts, and the assistant/«Вивьян» | Titles and snippets in search are the usual leak; counts and "no results" also leak | HIGH | Global search index (Справочник has global search; SRCH work from v1.3) must filter by level before ranking. Include media thumbnails and Корзина (trash) for non-editors: trash is editor-only, check it. |
| One consistent presentation for restricted items in browse views | Avoid mixed hide/lock UX | LOW | Recommendation: **omit** from search and any aggregate; in plain browse lists/trees show an anonymous locked stub («▒▒ ЗАСЕКРЕЧЕНО · нужен допуск N») with no title, no icon type, no thumbnail. Thematically fits "classified" while leaking only the existence and required level. If the owner wants zero leakage, flip a single switch to omit stubs entirely (see Differentiators). |
| Deep link to a restricted item shows the lock screen with required level only (no title) | Links shared in chat must not leak | LOW | Same response shape as an unknown id is the stricter option; lock screen is acceptable because ids are random. |
| Scientist records («записи учёных») become optional | Owner's words | MEDIUM | Not required in validation/normalization (`portia-content-normalize`, `portia-content`), hidden when empty, existing data never deleted. Touches templates and the editor forms. |
| Level changes take effect immediately and survive CDN caching | A lowered level must not keep serving stale data | HIGH | See Dependencies: cache keying. |

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Per-block level inside a Справочник card / Информация section (redact only part) | Mixed-clearance pages without duplicating them | HIGH | Defer unless the owner asks; per-item covers the stated need. If done, render a redaction bar for the block (██████), same inheritance rule. |
| Global "show locked stubs" vs "hide completely" switch | Owner chooses between theme and zero-leak | LOW | Single site setting once projection exists. |
| Level badge on items in the editor (colored chip) + bulk "set level" on selected items | Editors can audit what is open | MEDIUM | Prevents "forgot to set the level" errors. |
| "Просмотр как уровень N" (shared with the Users tab) | See above | MEDIUM | |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Per-field levels (hide just the age, just a photo) | "Maximum control" | Combinatorial editor UI, huge test surface, redaction leaks via layout | Per-item, optional per-block later. |
| Per-user allow-lists (give person X record Y) | Exceptions | Becomes an ACL system; unmanageable | Raise the person's level. |
| Hiding only in the UI / blurring images client-side | Cheap | Data is still in the payload | Server projection. |
| Public "level 0" tier | Some content open to strangers | Contradicts anti-espionage (nothing visible pre-approval) | Level 1 requires an approved nick. |
| Levels on Сотрудники / Повышение / Рассылки | Consistency | Owner scoped levels to four areas only | Out of scope; revisit later. |
| Gating the embedded «Устав»/«Таблица» by hiding the iframe only | Quick | The iframe URL is itself the secret and cross-origin docs cannot be partially redacted | Whole-document level; URL only issued by the server to users with enough level. Document that a publicly shared Google link stays a leak outside the site. |

---

### D. Unified design style (retro OS)

#### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One corner rule, expressed as tokens, applied everywhere | Owner complaint: mixed rounded/sharp | MEDIUM | Tokens: `--r-0` (0), `--r-1` (2px), `--r-2` (4px), `--r-pill`. Containers (windows, panels, tables, inputs, tabs) use one value; the exception class is explicit and documented (e.g. selectable thumbnails/pickers, per owner's own example). |
| Elevation scale instead of ad-hoc shadows | Flat retro UIs need a deliberate depth system | MEDIUM | 4 steps: flat, raised panel, floating (menu/popover), window (active stronger than inactive). Implement with border + hard offset or bevel, not soft blur, to stay on-brand. |
| Button variants: primary, secondary, ghost/toolbar, danger, icon-only; states default/hover/active/disabled/focus-visible | Buttons are currently inconsistent between apps and editor tabs | MEDIUM | One shared component/class set; two sizes. Keep `--accent-hue` recolouring (LOOK-01) working through all variants. |
| Close button flush in the window's exact corner | Owner's complaint | LOW | Titlebar controls occupy full titlebar height, flush right, zero padding; hit area extends to the corner (Fitts's law). Same on mobile full-screen windows. |
| Maximized windows use the space sensibly | Owner complaint ("Доступные записи" one per row) | MEDIUM–HIGH | Use container queries on the window content (Tailwind 4 has `@container` built in), not viewport media queries, with `repeat(auto-fill, minmax(Npx, 1fr))` grids for record lists. Cap line length for long text. Maximized = no radius, no outer border/shadow, flush to taskbar. |
| Shared editor-tab layout (header with title/count/primary action, toolbar with search/filters, list/detail, footer actions) used by all tabs incl. «Пользователи» | Owner asks for a uniform tab/app format | MEDIUM | Scope is styling + layout primitives, NOT the "единая система приложений" rebuild (explicitly out of v1.4). |
| Density: compact (pointer) vs comfortable (touch ≤900px) via a small set of tokens | Phone is a real audience | LOW–MEDIUM | Control heights and spacing as tokens switched at the existing 900px breakpoint; touch targets target 44px. |
| Six new class icons (all but «Способ распространения») | Owner's ask | MEDIUM | Constraint: propose options to the owner first (PROJECT.md: new SVG needs approval). SVG in `currentColor`. |
| Direction options for the owner to choose | Owner's ask | MEDIUM | See below; owner has dropped galleries (memory), so present as text + token tables, or a `data-ui-style` switch on localhost. |
| Fix shortcut layout at 521–900px and axe findings | Already listed in Active | MEDIUM | Do after tokens exist so fixes are not redone. |

#### Direction options to put before the owner (recommendation first)

1. **C. Hybrid by meaning (recommended):** sharp containers (windows, panels, inputs, tables, tabs), rounded only for selectable tiles/thumbnails/pickers and pills. Matches the owner's own wording and the «Электрофорез» terminal/gel identity. Lowest rework.
2. **A. Fully sharp terminal:** radius 0 everywhere except avatars/radios; bevel/line borders. Most coherent retro-OS read, harshest against the existing gel/web art.
3. **B. Soft OS:** windows 8px, controls 4px, pills for chips; closest to modern macOS-like feel, weakest "lab terminal" character.

Implement all as one token set so switching directions is a variable change, not a rewrite (this is also what makes "show 2–3 options" cheap).

#### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Token-driven style switch (`html[data-ui-style]`) for trying options on localhost | Owner picks by seeing, not reading | LOW once tokens exist | Dev-only; remove or freeze after the decision. |
| Titlebar states (active/inactive window) tied to elevation + accent | Sells the "real OS" feel | LOW | |
| Window "snap to half" for maximize/restore parity | OS feel | MEDIUM | Defer unless cheap. |

#### Anti-Features

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Full component library / Storybook | "Proper design system" | Solo-owner site; big scope | Tokens + ~6 shared primitives. |
| User-selectable corner style in Settings | Customisation | Doubles every visual test, conflicts with "one rule" | Single decided style. |
| Per-app themes | Variety | Contradicts the unification goal | Accent hue only (exists). |
| Rebuilding the app registry/windows ("единая система приложений") | Natural neighbour | Explicitly excluded from v1.4 | Separate milestone. |
| Re-drawing all seven class icons | Consistency | Owner likes «Способ распространения» | Keep it; match the other six to it. |
| SVG spider / new animations without approval | Polish | Owner vetoed before | Ask first. |

---

## Feature Dependencies

```
Device-token grant + gate (A)
    ├──requires──> server-side projection of /api/content, /api/employees, search, uploads
    │                   └──requires──> CDN cache change (per-level cache key or no-store)
    ├──requires──> anon write path via server route/RPC with rate limit (revoke anon portia_promo_register_attempt)
    └──requires──> approved/revoked state check on every request

Users tab (B) ──requires──> grants + events tables, decision RPCs, EditorTab/permission extension
Access levels (C) ──requires──> grant.level (A, B) AND projection layer
    └──requires──> per-item level field in content model + normalization + editor control in 4 editors
Promotion nick reuse ──requires──> grant lookup (A); ──conflicts──> promotion's own device binding if not reconciled
Scientist records optional ──independent──> (touches content normalize/validation only)
Design tokens (D) ──precedes──> shared editor-tab layout ──precedes──> Users tab UI, level controls, axe/521–900px fixes
New class icons ──requires──> owner approval of options
"Просмотр как уровень N" ──enhances──> B and C; strongly recommended before shipping C
```

### Dependency Notes

- **CDN caching is the biggest hidden dependency.** `/api/content` and `/api/employees` are currently identical for all visitors, cached on Netlify's CDN and purged by tag. Per-level responses require either `no-store` (simplest; audience is small) or cache-key variation by a level cookie via `Netlify-Vary: cookie=<name>` (Netlify guidance: vary on named cookies, not the whole Cookie header; `Netlify-CDN-Cache-Control` keeps browser caches out). With 5 levels, keyed caching is feasible but the tag purge must clear all variants. Unauthenticated requests must never get a cached content response.
- **Storage:** the `portia-media` bucket listing is an accepted public risk (IN-10-storage). Images belonging to leveled items remain fetchable by URL; either accept and document, or serve leveled media via signed URLs. Decide in discuss-phase.
- **Embedded Google docs (Устав, Таблица):** protected only as far as the URL stays server-side.
- **Anon RLS:** the milestone adds grant tables and revokes `portia_promo_register_attempt` from anon. All of it needs `supabase-rls-reviewer` and an isolated test project; production untouched (project hard rules).
- **Promotion:** `PromotionIdentityGate`, `/api/promotion/status|requests`, and `portia_promo_device_bindings` must read the grant. Observers keep manual entry.
- **Users tab depends on D** only for layout; the logic can be built before restyling but should adopt the shared layout in the same phase to avoid a second pass.
- **Editors vs levels:** existing per-tab permissions (`closed_tabs`/`granted_tabs`) stay orthogonal; levels apply to readers.

## MVP Definition

### Launch With (v1.4)

- [ ] Boot-screen nick request, 4-state lifecycle, device token, neutral pending/rejected/revoked screens
- [ ] Server-side gate across all read paths, with the cache decision made
- [ ] Table-match badge, conflict flag, soft Roblox check, rate limiting
- [ ] «Пользователи» tab: queue, approve/reject/revoke/level change, who/when on row, concurrency-safe RPCs, event log
- [ ] Levels 1–5 on grants; per-item required level in 4 areas; server projection; omit-from-search; locked stub; scientist records optional
- [ ] Promotion uses the grant nick for employees
- [ ] Token-based radius/elevation/button/density system, corner close button, container-query maximized layouts, shared editor-tab layout, owner-approved direction and icons

### Add After Validation (v1.4.x)

- [ ] Profile-code verification (when impersonation actually happens)
- [ ] Multi-device "add this device" flow and sliding expiry
- [ ] "Просмотр как уровень N", bulk level change, hide/stub switch

### Future Consideration

- [ ] Sign in with Roblox (OAuth) as real authentication
- [ ] Per-block levels inside a page
- [ ] Editor notifications (Discord/email)

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Server-side gate + grant lifecycle | HIGH | HIGH | P1 |
| Users tab with audit | HIGH | MEDIUM | P1 |
| Per-item levels + projection + search filtering | HIGH | HIGH | P1 |
| Scientist records optional | MEDIUM | MEDIUM | P1 |
| Promotion reuses grant nick | HIGH | MEDIUM | P1 |
| Design tokens + corner/close/maximized fixes | HIGH | MEDIUM | P1 |
| Shared editor-tab layout | MEDIUM | MEDIUM | P1 |
| New class icons | MEDIUM | MEDIUM | P1 (needs owner approval) |
| "Просмотр как уровень N" | HIGH (safety) | MEDIUM | P2, pull to P1 if budget allows |
| Profile-code verification | HIGH | MEDIUM | P2 |
| Multi-device approval | MEDIUM | MEDIUM | P2 |
| Bulk actions | LOW | MEDIUM | P3 |
| Per-block levels | LOW | HIGH | P3 |
| Roblox OAuth | HIGH | HIGH | P3 |

## Comparable Patterns

| Feature | Reference pattern | Our approach |
|---------|-------------------|--------------|
| Access states | SailPoint / IBM PIM / Robomq: pending, approved, rejected, revoked, expired | 4 states, no expiry by default |
| Restricted content in search | Confluence/SharePoint leak bugs; guidance to filter before ranking; KB tools hide restricted titles by default | Filter before ranking; omit from search; anonymous stub in browse only |
| Roblox identity | Discord bots verify via profile code; OAuth gives `sub` = user id | Soft lookup now, profile code next, OAuth later |
| Retro OS UI tokens | ryOS exposes border width, radius, titlebar height as CSS variables per theme; 98.css square-cornered bevels | Single token set, swap by `data-ui-style` |

## Sources

- Project: `.planning/PROJECT.md`; todos `2026-11-07-nick-access-request`, `2026-11-08-access-levels`, `2026-11-07-desktop-visual-overhaul` (HIGH, owner's words)
- Codebase facts (HIGH): `supabase/migrations/20261101000000_portia_baseline.sql` (`portia_editors` closed/granted tabs, `portia_promo_device_bindings`, `portia_promo_attempt_buckets`, `portia_promo_audit_events`, anon `portia_promo_register_attempt`); `components/portia-editor.tsx` (`EditorTab` union); `components/portia-promotion.tsx` (`PromotionIdentityGate`); `app/api/content/route.ts`, `app/api/employees/route.ts` (public, CDN-cached, tag-purged)
- Access request state models: SailPoint, IBM Security PIM, Robomq, BU CCURE portal docs (MEDIUM)
- [Permission-aware global search design (AppMaster)](https://appmaster.io/blog/permission-aware-global-search-design) and [Permissions before retrieval](https://alpeshnakrani.com/books/rag-that-survives/permissions-before-retrieval/) (MEDIUM)
- [Confluence CONF-32105: restricted content appears in search](https://jira.atlassian.com/browse/CONF-32105); [UW KB "Hide Restricted Documents from Search"](https://kb.wisc.edu/remote-instruction/12074) (MEDIUM)
- [Roblox OAuth 2.0 reference](https://create.roblox.com/docs/cloud/auth/oauth2-reference) and [app implementation](https://create.roblox.com/docs/cloud/auth/oauth2-develop): `openid`/`profile` scopes, `sub` = user id, developer ID-verification required (HIGH)
- Roblox username lookup (`/v1/usernames/users`, case-insensitivity) via [roblox-api crate](https://docs.rs/roblox-api/0.1.8/src/roblox_api/api/users/v1.rs.html) and community sources (LOW–MEDIUM: verify in sandbox)
- [Netlify caching overview](https://docs.netlify.com/build/caching/caching-overview) and [cache key variations](https://www.netlify.com/blog/netlify-cache-key-variations/): `Netlify-Vary: cookie=` (HIGH)
- ryOS and 98.css as retro-OS token references ([98.css topic](https://redirect.github.com/topics/windows98), [ryOS ui-design-styling](https://playbooks.com/skills/ryokun6/ryos/ui-design-styling)) (LOW–MEDIUM); radius/elevation/density recommendations are synthesis, not sourced

---
*Feature research for: PORTIA OS v1.4 access control and unified style*
*Researched: 2026-11-09*
