# Project Research Summary

**Project:** PORTIA OS, milestone v1.4 «Доступ и единый стиль»
**Domain:** gated community site styled as a retro desktop OS (Next.js 16 / React 19 / Tailwind 4 / Supabase anon+authenticated only / Netlify); adding a nick-request access gate, clearance levels 1-5, an editor «Пользователи» tab and one unified design system
**Researched:** 2026-11-09
**Confidence:** MEDIUM-HIGH (code-derived findings HIGH; Netlify cache and Supabase storage behaviour MEDIUM, must be proven on a preview or isolated staging)

## Executive Summary

v1.4 is not a feature on top of a public site; it changes the site's read model. Today `portia_content`, `portia_employee_profiles` and `portia_manual_employees` are readable by `anon` through PostgREST with the public key. `/api/content` and `/api/employees` are identical for everyone and cached on the Netlify CDN for up to a day. `app/page.tsx` bakes `defaultPortiaContent` into the static HTML and bundle, and localStorage seeds the UI before any fetch. All four researchers agree: a gate that only lives in a route or a React component is decorative. A real gate means closing anon table reads, moving every read to token-gated `SECURITY DEFINER` RPCs, making gated responses per-viewer `no-store`, emptying the static shell, and clearing the device caches on any non-approved transition.

The recommended approach adds no runtime dependency. Visitor identity is an opaque HttpOnly cookie (`portia_access`) whose HMAC digest is stored in Postgres. It reuses the proven promotion device-token pattern and the existing `PORTIA_PROMOTION_DEVICE_SECRET` with a distinct `access:` domain label. Every request resolves token to person, status and level live in the DB, so revoke and downgrade apply on the next poll. Supabase anonymous sign-ins, JWT sessions, `Netlify-Vary` on a level cookie, and gating in `proxy.ts` are all rejected. Item levels are an optional `level` field inside the existing content JSON (missing = 1). One pure, canary-tested TS function (`redactContentForLevel`) strips items, their `formattedText` keys, trash and stubs before data leaves the server. The editor tab «Пользователи» is one line in `tabRegistry` (kind `regular`) plus `/api/users` and definer RPCs with audit. The design system is plain `:root` CSS tokens (not Tailwind `@theme`), seeded at current values, then primitives that emit existing class names, then per-surface migration with a ratchet test on literal radii.

Main risks, in order: (1) leak paths that survive a "gated" API (anon PostgREST, CDN old copies and stale-while-revalidate, static bundle, `formattedText`, Корзина, media bucket, public iframes of Таблица/Устав); (2) editor and approver abuse (self-approval, escalation, an editor save that deletes hidden records); (3) rollout lockout of the whole community on flip day; (4) a big-bang restyle with endless owner variant loops. Mitigations: expand/contract migrations with an owner-run flip behind a flag, DB-enforced approval rules plus audit, a full-payload editor path that never receives a redacted copy, and a tokens-first restyle with one bounded variant round. Postgres/RLS execution, authenticated roles, staging and physical devices stay BLOCKED until a phase proves them. Nothing here is recorded as PASS without proof.

## Locked owner decisions (not re-opened)

- Observer («не из таблицы») gets level 1, table employee gets level 2 on approval; editors raise manually (up to 5).
- Nick request is on the boot screen with «из таблицы / не из таблицы».
- New editor tab «Пользователи», open to all editors by default (owner can close it per editor with existing chips).
- Scientist records become optional.
- Design: owner chooses among a few direction options; one rule for panels, buttons and corners; unified editor tabs and apps.
- Test-path repoint (old P0) is done (quick 261109-brj); not in the build order.
- No review galleries, no per-hash ledger; report visual changes as text.
- Out of scope: STAB-BASE-02/03/04/06, spider, unified app system.

## Key Findings

### Recommended Stack (STACK.md)

Add nothing at runtime. One patch bump for security. Everything else is SQL, route handlers, `node:crypto`, CSS and `node:test`.

**Core technologies:**
- Opaque device-token cookie `portia_access` + HMAC digest (`lib/portia-device-binding.ts` helpers): visitor identity before and after approval; unforgeable without the server secret; no new env var.
- Postgres `SECURITY DEFINER` RPCs (`set search_path = ''`, explicit grants) keyed by digest: submit, resolve, read content, editor list/decide/level/revoke; tables are revoke-all, same shape as `portia_promo_*`.
- Live DB lookup per request: instant revoke and level change; a signed JWT cannot give that.
- `noStoreHeaders` on every gated GET (`Cache-Control` and `Netlify-CDN-Cache-Control: no-store`), no `Netlify-Cache-Tag`, no `Netlify-Vary: cookie=`.
- `next` + `eslint-config-next` exact pin 16.4.2 to 16.4.5 (Netlify advisory 2026-11-03, cache-poisoning CVEs, adapter >= 5.16.6). MEDIUM: re-read the CVE list before bumping.
- `:root` CSS tokens with role names (`--radius-control/panel/window`, `--space-1..6`, `--ctl-h`), `html[data-ui-style]` overrides, and a `node:test` radius conformance test with a ratchet baseline (129 radius declarations, ~15 distinct values today).

**Rejected:** Supabase anonymous sign-ins (visitors become `authenticated`, 30/h/IP, CAPTCHA, user growth), service-role key, Auth.js/Clerk, Edge/proxy gating, Realtime, Redis rate limits, stylelint/cva/Style Dictionary, framer-motion for the restyle.

### Expected Features (FEATURES.md)

**Must have (table stakes):**
- Boot-screen request (nick + type), four states `pending/approved/rejected/revoked`, neutral pending/rejected/revoked screens with no app names, wallpaper or taskbar; re-request with cooldown.
- Server-side gate across every read path (content, employees, search input, media URLs, promotion).
- Nick normalization (one canonical key, Roblox charset `[A-Za-z0-9_]{3,20}`), duplicate/spam control with DB-side caps and a bucket namespace separate from Promotion.
- Table-match badge and conflict flag for approvers only; never auto-approve.
- «Пользователи» tab: queue-first list with count badge, approve (level preselected 1 or 2), reject, change level, revoke, who/when on the row, append-only audit, concurrency-safe transitions.
- Levels 1-5 per whole item in База вирусов, Справочник, Информация, Устав; children never more public than parent; omitted from search and aggregates; scientist records optional.
- Promotion takes the nick from the approved identity (observers keep manual entry per owner).
- Design: radius/elevation/button/density tokens, close button flush in the window corner, container-query layouts for maximized windows, shared editor-tab layout, six new class icons (owner approves options first), 521-900 px shortcut fix, axe findings.

**Should have (post-validation, v1.4.x):** "Просмотр как уровень N" (strongly recommended, pull in if budget allows because it is the best defence against gating mistakes and is nearly free once the redaction function exists), multi-device "add this device", profile-code verification, bulk reject/level change.

**Defer (v2+):** Sign in with Roblox OAuth, per-block levels, editor notifications, soft grant expiry, block list.

### Architecture Approach (ARCHITECTURE.md)

`app/page.tsx` stays static and content-free; a client `PortiaRoot` shows boot then `AccessGate` or `PortiaDesktop`, which mounts only for an approved visitor or an editor session. One chokepoint `resolveViewer(request)` (editor session first, then cookie via one RPC) is used by every GET route; a scan test fails if a GET handler skips it. Editors are level 5 and receive the full unredacted payload from an editor-only path. New namespace `/api/visitor`; `/api/access` stays editor-only. Migrations are forward-only expand/contract.

**Major components:**
1. `portia_access_people / _requests / _audit_events` + definer RPCs: identity, level (per person, devices inherit), requests (one row per device), audit.
2. `lib/viewer.ts`, `lib/access-session.ts`, `lib/access-levels.ts`, shared `lib/nickname.ts` (TS and SQL parity test).
3. `lib/content-redact.ts`: pure redaction with allowlist-by-prefix on `formattedText` (fail closed), canary-string tests for L=1..5.
4. `PortiaRoot` / `AccessGate` / `UsersPanel` / `/api/visitor` / `/api/users`.
5. `app/styles/tokens.css` + `primitives.css` + `components/ui/*` emitting existing class names; `portia.css` edited in place, never reorganized (cascade order is load-bearing).
6. Parity artifacts to update with every new object: fingerprint JSON, `expected-authz.json`, offline Supabase harness, `portia-sql.test.ts`, explicit `service_role` grants.

### Critical Pitfalls (PITFALLS.md)

1. **Anon PostgREST stays open** — revoke anon select and drop `using (true)` policies on the three tables; visitors read via token-gated RPC; editors via `portia_can_edit()` policy. Prove on isolated staging only.
2. **CDN serves gated content / old public copies survive** — `no-store` on gated routes; purge both tags at the flip; assert anon gets 401 and no `Cache-Status: hit` on a deploy preview.
3. **Content in bundle, HTML and localStorage** — content-free shell, gate-first render, rename caches to `-v2`, key by identity+level, wipe on deny; grep `.next` for seed markers.
4. **UI-only hiding and `formattedText`/Корзина leaks** — server-side redaction with canary property tests; legacy `lockedLevel` maps onto the same 1-5 scale as an optional per-record restriction.
5. **Editor round-trip deletes hidden records** — editors get the full payload; `PUT` never accepts a body that came from a gated read; test a restricted-editor save.
6. **Privilege abuse and rollout lockout** — DB-enforced rules (no self-approve, no grant above own level, owner untouchable, conditional transitions, audit); ship with a gate flag OFF, bulk owner-clicked approval, editor login path outside the gate, then flip.

Also material: nick impersonation (never auto-approve; second device is a new pending request), enumeration (one neutral response, own-token status only), definer grants hygiene (`register_attempt` revoke), Promotion double identity (resolve nick server-side, link do not merge cookies), big-bang restyle, template-export class coupling (`level-1..3` classes vs access levels; use `access-level-*`), per-accent contrast, naming collisions with `/api/access`.

## Where researchers disagree, and the recommendation

| Topic | Positions | Recommendation |
|-------|-----------|----------------|
| Users tab before or after the gate | ARCHITECTURE: A data, B Users tab, C gate, D levels, E style. PITFALLS: PA, PD (tab, gate OFF), PB, PC. No researcher puts the gate first. | **Users tab before gate.** Nobody could approve anyone otherwise, and the gate-OFF flag lets the community file requests before enforcement. |
| Style variants: runtime switch vs visual-candidates lane | STACK/FEATURES: `html[data-style]`/`data-ui-style` token overrides, dev-only. ARCHITECTURE: token sets through `npm run test:e2e:candidates`, explicitly not a runtime switch. | **Token sets behind a dev-only `data-ui-style` attribute the owner can view on localhost, described to the owner as text plus token tables.** The candidates lane produces gallery-style screenshot sets that the owner dropped on 2026-11-08. Bake the winner into `tokens.css`, delete the losers and the switch. |
| When the restyle runs | ARCHITECTURE: last, after A-D. PITFALLS: may run in parallel with levels/Promotion if tokens-first. | **Tokens and primitives skeleton early (zero visual diff, with the Users tab); owner variant choice collected early; per-surface migration last.** |
| Locked items: omit or locked stub | FEATURES: omit from search/aggregates, anonymous stub in browse. STACK/ARCHITECTURE/PITFALLS: omit by default, stub optional because a title leaks. | **Omit (fail closed).** Scientist logs keep the existing locked-row UI. A teaser/stub switch is an owner option. |
| Where item levels live | STACK/ARCHITECTURE: inside the content JSON. PITFALLS: guarded table (D-11 risk). | **JSON field, with D-11 extended and documented as accepted risk** unless the owner says otherwise. |
| Where the `register_attempt` revoke lands | ARCHITECTURE: contract migration with Levels. PITFALLS: Promotion phase. | **Access foundation migration**, with Promotion contract tests green and fingerprint/authz updated in the same commit. |
| Roblox existence check | FEATURES: soft server-side lookup is table stakes. Others: evidence for approvers only. | **Defer the lookup.** Profile link + table-match badge computed at decision time; profile-code verification is v1.4.x. |
| Visitor poll interval | ARCHITECTURE: 30-60 s visitors, 10 s editors. PITFALLS: >= 10 s. | **30 s for visitors, 10 s editors**; measure Netlify invocations on staging before locking. |

## Implications for Roadmap

Suggested structure: 7 phases. Phases 1, 2 and 4 carry the DB/RLS risk and need the `supabase-rls-reviewer` agent. Owner-run production apply stays outside the agent's reach throughout.

### Phase 1: Access foundation (data layer, rules, no behaviour change)
**Delivers:** Migration 1 (people, requests, audit, definer RPCs, caps, cleanup, gate flag row owned by the owner); `register_attempt` revoke from anon and authenticated; shared `lib/nickname.ts` with SQL parity test; `lib/access-levels.ts`, `lib/access-session.ts`, `lib/viewer.ts`; fingerprint, expected-authz, offline harness and `portia-sql.test.ts` updates; explicit `service_role` grants; `next` 16.4.5 bump (standalone commit).
**Note:** number after the three unapplied migrations (`20261104000000`, `...0100`, `20261106000000`) and state the apply order. Postgres execution is BLOCKED until staging proves it.

### Phase 2: «Пользователи» tab + design-token skeleton
**Delivers:** `users` in `tabRegistry` (kind `regular`), `/api/users`, `UsersPanel` (queue, approve/reject/level/revoke, table-match badge, conflict flag, who/when, history, pending badge), owner bulk "approve sheet staff as level 2"; `tokens.css` at current values, `components/ui/*` emitting existing class names; radius ratchet test baseline.

### Phase 3: Visitor gate (flag OFF) + Promotion identity
**Delivers:** Promotion regression set (todo 2026-10-28) first; `PortiaRoot`, `AccessGate`, `/api/visitor` (state, request, sign-out), boot screen with the nick form; neutral responses and cooldown; Promotion routes ignore client nickname and use the approved identity; editor login link on the gate.

### Phase 4: Levels and content gating
**Delivers:** `level` fields in types/normalize/limits/`editor-changes` (missing = 1, garbage = most restrictive); one shared level control in the four editors; scientist records optional and `lockedLevel` on the real 1-5 scale; `redactContentForLevel` with canary tests; `/api/content` and `/api/employees` per viewer, `no-store`, full payload for editors; `PUT` guard; client `viewer` handling; caches `-v2`; «Просмотр как уровень N» if cheap.

### Phase 5: Enforcement cutover (contract migration and flip)
**Delivers:** Contract migration (drop anon select and `using (true)` policies; editor-only read policies; media list policy decision); seed removed from the static shell with a post-build grep guard; CDN purge; anon assertions on a preview/staging; written rollout checklist; invocation measurement. Staging/production proof BLOCKED until run; the flip is owner-run.

### Phase 6: Unified style
**Delivers:** Owner picks one direction (A fully sharp / B soft OS / C hybrid by meaning, recommended C) and approves class-icon options; winner baked into tokens; surface-by-surface migration (gate and Users tab, editor shell and one `TabStrip`, window chrome with close button flush in the corner and maximized layouts via container queries, apps, «Повышение»); «Информация» phone button, «Видимая часть» in the template builder, 521-900 px shortcut layout, axe findings fixed by token and checked per accent; template-export whitelist kept stable; desktop regressions. Cap one re-do per surface.

### Phase 7: Owner acceptance
**Delivers:** PC and phone check of gate, Users tab, levels and the restyle on the owner's words; unproven lanes recorded as BLOCKED or accepted risk, never PASS.

### Research Flags

- **Phase 1:** RLS, grants, fingerprint, three unapplied migrations; mandatory `supabase-rls-reviewer`.
- **Phase 4:** owner decisions on Устав/Таблица and media; redaction coverage across `formattedText` prefixes.
- **Phase 5:** Netlify cache behaviour and Supabase storage listing — prove on deploy preview / isolated staging; re-read the Next 16.4.5 advisory.
- **Phase 3:** light research on Promotion regression coverage and mobile gate UX.
- Standard patterns: Phases 2, 6, 7.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH on identity/DB; MEDIUM on Netlify edge and the 16.4.5 bump | Context7 unavailable |
| Features | MEDIUM | Roblox lookup details LOW-MEDIUM; design directions are synthesis |
| Architecture | HIGH on integration points; MEDIUM on Netlify cost and storage | Consistent with PITFALLS |
| Pitfalls | HIGH for code-derived; MEDIUM for platform behaviour | |

### Gaps to Address

- Netlify durable cache / stale-while-revalidate after deploy; `Set-Cookie` with cache headers.
- Supabase storage listing vs public URLs without a broad SELECT policy.
- `defaultPortiaContent` may contain real lore (МОРОК, АРАХНА).
- Poll cost at 30 s visitor polling.
- Restricted editors can still grant levels (mitigated by closing the `users` tab per editor).
- Таблица and Устав stay public by URL unless unshared or moved in-app.

## Open owner questions (deduplicated)

1. Levels 3-5: names and meaning.
2. Who may grant what (any editor up to 5? not above own level? owner untouchable? editors = 5?).
3. Locked items: omit completely (recommended) or locked stub/teaser; keep locked-row look for scientist logs?
4. Default level for existing content: 1 (recommended).
5. Устав and Таблица: UI-only gating, move Устав into `portia_content`, and/or unshare (unsharing the sheet breaks the server roster read).
6. Media bucket: "unlisted by UUID" or private + signed URLs.
7. Item levels in content JSON (extends D-11) or guarded storage.
8. Is `defaultPortiaContent` placeholder-only?
9. Second device for an approved nick: new pending request? Device cap?
10. Rejected requests: cooldown length; can the owner clear it?
11. Rollout: owner-clicked bulk "sheet staff = level 2"? Gate flag owner and flip timing; apply order with the three unapplied migrations.
12. Do editors also file a nick identity to use Promotion as participants?
13. Map legacy scientist-log `lockedLevel` 2/3/4 onto 1-5 as-is?
14. Roblox verification in v1.4: profile link + table-match badge only?
15. 30 s visitor poll acceptable?
16. Design direction A / B / C and exceptions to the single radius rule.
17. Approve options for new class icons (and any new font) before drawing.

## Sources

- Primary (HIGH): repo reads (`lib/portia-device-binding.ts`, `lib/portia-cdn.ts`, `app/api/**`, `app/page.tsx`, `proxy.ts`, `lib/editor-tabs.ts`, `lib/portia-content.ts`, `supabase/migrations/20261101000000_portia_baseline.sql`, `app/portia.css`, `next.config.ts`, components); Supabase anonymous sign-ins docs; Tailwind theme docs; Roblox OAuth 2.0 reference.
- Secondary (MEDIUM): Netlify caching and cache-key docs; Netlify changelog 2026-11-03 (Next.js 16.4.5); Supabase Storage access control; permission-aware search guidance; access-request state models.
- Tertiary (LOW): Supabase public-bucket GET without SELECT policy; Roblox username lookup; ryOS / 98.css references.

---
*Research completed: 2026-11-09 (synthesizer output persisted by the orchestrator; condensed where the synthesizer's text repeated the four source files)*
*Ready for roadmap: yes*
