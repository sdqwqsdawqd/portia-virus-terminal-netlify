# Stack Research

**Domain:** Visitor access gate (nickname request, approval, levels 1-5) and a unified design system on an existing Next.js + Supabase + Netlify desktop-OS site
**Researched:** 2026-11-09
**Scope:** Only additions/changes for milestone v1.4. Existing validated stack (Next 16, React 19, Tailwind 4, `@supabase/ssr`, Netlify CDN with tag purge) is not re-researched.
**Confidence:** HIGH on identity and DB approach (derived from the repo's own proven promotion pattern plus Supabase docs); MEDIUM on Netlify edge behaviour (verify on a deploy preview); MEDIUM on the Next 16.4.5 bump (from a Netlify advisory page).

## Headline: add no runtime dependencies

Every new capability fits the existing stack: `node:crypto` HMAC tokens, Postgres `SECURITY DEFINER` RPCs, plain CSS custom properties, and `node:test`. The work is a pattern change (public CDN-cached reads become per-visitor `no-store` reads) plus SQL, not a library change.

## Recommended Stack

### Identity before approval

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Opaque random device token in a new HttpOnly cookie (e.g. `portia_access`) | n/a (`node:crypto`, already used) | Holds the visitor's identity while the request is pending, and after approval | Reuses `lib/portia-device-binding.ts` (`createDeviceToken`, `keyedDigest`, `buildDeviceCookie`, `readDeviceToken`, `coarseIpBucket`). The server HMACs the token with `PORTIA_PROMOTION_DEVICE_SECRET` and passes only the digest to Postgres. No new env var; use a distinct HMAC domain label (`access:` instead of `device:`) so the two token spaces cannot be confused. |
| Postgres `SECURITY DEFINER` RPCs granted to `anon`, keyed by `p_token_hash` | Postgres on Supabase | Submit request, poll status, resolve level, read gated content | This is exactly how the promotion flow already works (`portia_promo_resolve_device`, `portia_promo_bind_device`): tables are `revoke all ... from anon, authenticated`; only definer functions with `set search_path = ''` touch them. The digest is unforgeable without the server secret, so the browser cannot call the RPCs for someone else. |
| Live lookup on every read (status/level read from the DB each time) | n/a | Revocation and level changes take effect at once | An editor who rejects or downgrades a person must cut access on the next poll. A signed self-contained token (JWT/iron-session) cannot be revoked without a DB lookup anyway, so it adds a dependency and no benefit. |

**Decision: do NOT use Supabase anonymous sign-ins.** (Supabase docs, verified 2026-11-09.)
- Anonymous users get the `authenticated` role, not `anon`. Docs say to review all existing RLS policies before enabling them; this repo has many `to anon, authenticated` grants and `authenticated`-scoped policies, so every visitor would silently count as signed in. The whole RLS surface would need re-review for no gain.
- Default limit of 30 sign-ins per hour per IP. A squad sharing one NAT or school network would hit it. The docs advise CAPTCHA (Turnstile/hCaptcha), a new third-party dependency.
- No automatic cleanup: every visit creates an `auth.users` row you must prune.
- `proxy.ts` deliberately excludes `/` and the content/employee GETs so they stay cookie-free and CDN-cacheable. Anonymous sessions need refresh there, reversing a decision made for resilience.
- You still need your own approval/level table, so the built-in JWT buys nothing the RPC pattern does not.

Editors and the owner keep Supabase Auth unchanged. `getEditorAccess()` returning `canEdit` is treated as "full access" (level 5) and bypasses the nickname gate. `/owner-login` stays reachable without the gate.

### Database: making content unreadable to `anon`

| Change | Purpose | Why |
|--------|---------|-----|
| Drop the "Public can read ..." SELECT policies and `grant select ... to anon` on `portia_content`, `portia_employee_profiles`, `portia_manual_employees`; add `to authenticated using (public.portia_can_edit())` read policies | Anonymous publishable-key reads return nothing | Today anyone with the publishable key can `select *` from `portia_content` directly (baseline `Public can read PORTIA content ... using (true)`). Hiding the UI is not enough; this is the real anti-espionage cut. |
| New tables (RLS on, all privileges revoked from `public, anon, authenticated`), e.g. `portia_access_people`, `portia_access_devices`, `portia_access_audit` | Requests, status (`pending/approved/rejected/revoked`), kind (`table`/`observer`), level 1-5 | Same shape and revoke block as the `portia_promo_*` tables. Level is a `smallint` with `check (level between 1 and 5)`. |
| `portia_visitor_content(p_token_hash)` (definer) returning payload, revision, updated_at, level for an approved visitor, nothing otherwise; same for employee profiles | The only read path for non-editors | Single choke point, mirrors `portia_promo_public_status`. |
| Editor RPCs gated by `portia_can_edit_tab('users')`: list people/requests, decide, set level, revoke | Backs the «Пользователи» tab | Same style as `portia_promo_reviewer_state` / `portia_promo_reject_request` with an audit row per action. |
| Explicit `revoke execute ... from public, anon` on every new editor-only function, and on `portia_promo_register_attempt` | Closes the carried-over v1.4 item | The app has no caller of `register_attempt` outside tests (grep of `lib/` and `app/`), so revoking is safe; any future caller must be inside another definer function. Follow `20261101000100_portia_explicit_grants.sql` and keep the fingerprint file in `supabase/fingerprint/expected/` in step. |

**Per-item access level: store in the JSONB, redact in one pure TS function. Do not try column + RLS or views.**
- `PortiaContent` is ONE row (`portia_content.id = 'main'`) holding arrays of viruses, info sections, guide sections/cards. Row-level security cannot filter items inside a JSONB document; a view over `jsonb_array_elements` would work for the arrays but is a second implementation of the redaction rules.
- Add an optional `minLevel` (1-5, missing = 1 so nothing existing becomes hidden) to `Virus`, `InfoSection`, `GuideSection`/`GuideCard` and clamp it in `normalizePortiaContent` (`lib/portia-content-normalize.ts`) with limits in `lib/content-limits.ts`.
- `GET /api/content` calls `portia_visitor_content(digest)`, then `redactContentForLevel(content, level)` in `lib/` (a new pure, unit-tested module like the rest of `lib/`).
- **Critical leak vector:** rich text for hidden items lives OUTSIDE the item, in `formattedText`, keyed by `portiaTextKey` (`virus:<id>:...`, `info:<id>:body`, `info-block:<blockId>:text`, `guide-block:<blockId>:text`). Redaction must drop those keys too, and also drop `recycledViruses`, `recycleFiles` and editor-only outline sections for non-editors. Add a test that serializes the redacted result and asserts no hidden item id, title or text substring remains.
- Security note: the RPC returns the full payload to the server runtime, which trims it. This is acceptable because the digest cannot be produced without `PORTIA_PROMOTION_DEVICE_SECRET`. If you later want defence in depth, add a SQL `portia_redact_content(jsonb, int)` that does the same trimming, but only with a shared test-vector fixture so the TS and SQL versions cannot drift.
- Writes are unchanged: editors PUT the full document; keep the existing compare-and-swap on `revision`. An editor never receives a redacted document, so there is no risk of a redacted copy being saved back. Never let `PUT` accept a payload that came from a gated read.

Alternative considered for flat tables (employees): RLS with the digest passed as a request header (`createClient(url, key, { global: { headers: { 'x-portia-visitor': digest } } })` and `current_setting('request.headers', true)::json ->> 'x-portia-visitor'` inside the policy). It keeps `.from(...).select()` code unchanged but introduces a second mechanism next to RPCs. Not recommended; one mechanism is easier to review.

### CDN / cache layer (Netlify)

| Change | Purpose | Why |
|--------|---------|-----|
| `GET /api/content` and `GET /api/employees`: replace `publicCacheHeaders(...)` with `noStoreHeaders` (`Cache-Control: no-store`, `Netlify-CDN-Cache-Control: no-store`); drop `Netlify-Cache-Tag` on these | Per-visitor responses must never be shared | Today they ship `public, durable, s-maxage=300/600, stale-while-revalidate=86400`, so a shared copy is served to everyone and survives a day stale. Both new status/gate endpoints are `no-store` too. Netlify docs: `no-store` and `private` mean the shared cache does not store the response. |
| Never use `Netlify-Vary: cookie=...` on a level or role cookie | Prevents cache-key forgery | Netlify's cache sits in front of your function, so a cached "level 4" variant keyed by a client-supplied value would be served to anyone sending that value without the function validating it. (Keying on the raw random token is safe but useless.) Cache nothing gated. |
| `app/page.tsx`: stop passing `defaultPortiaContent`; pass a content-free skeleton | The HTML/RSC payload and JS chunks are CDN-cached and public | `Home()` currently serializes the whole seed (viruses like "МОРОК", etc.) into the document. Move the seed into a server-only module (used by the `/api/content` fallback) and add a post-build guard that greps `.next/static` and prerendered HTML for a seed marker string. Check that `lib/portia-content.ts` is not pulling the seed into client chunks via the desktop's imports (types and `findInfo`/`findGuide` live in the same file). |
| Bump localStorage keys `portia-content-last-success-v1` and `portia-employees-last-success-v1` to `-v2`, delete the `-v1` keys at startup, stop reading them before the gate has said "approved", clear them on reject/revoke/401 | First paint currently seeds from a local copy; a revoked visitor would keep reading | These caches are part of the leak surface. The seed-from-cache path (desktop ~lines 520-535) must move behind the gate state. |
| Owner-run step at cutover: `purgeCacheTag("portia-content")` and `("portia-employees")` | Stale shared copies can persist up to 86400 s via stale-while-revalidate | Netlify says a redeploy clears earlier-deploy cached content in the same deploy context, but purge explicitly and verify with the `Cache-Status` response header. Production steps stay owner-run per CLAUDE.md hard rules. |
| Keep route handlers `export const dynamic = "force-dynamic"`; set the visitor cookie with an explicit `Set-Cookie` header on the (no-store) gate response, as `app/api/promotion/requests/route.ts` already does | Cookie is issued only on uncacheable responses | Netlify docs do not state how `Set-Cookie` interacts with the cache; avoid the question by never combining it with cache headers. |

**Gaps the gate cannot close (flag to the roadmap):**
- «Устав» is an iframe of `https://sdqwqsdawqd.github.io/S.E-Portia/` and «Таблица» is a public Google Sheet. Hiding the window protects nothing; the URLs are public. A per-level «Устав» only works if the charter text moves into `portia_content` (then drop `github.io` from CSP `frame-src` in `next.config.ts`) or the owner accepts that it is UI-only.
- `portia-media` is a public bucket with an open file listing (accepted risk IN-10-storage). Media URLs inside hidden items are unguessable (`recycle/<uuid>.ext`) but listable. Dropping the broad SELECT policy on `storage.objects` for that bucket should close listing while public-URL fetches keep working (public buckets are served without a SELECT policy; confirm on the isolated staging project before relying on it).
- Roblox nicknames cannot be proven by the visitor. Editors approving by name is the only check; "in the table" can be shown as a hint by comparing to the sheet roster that `loadEmployees` already fetches (compute at display time in the Users tab; do not store a client-supplied "in table" flag in an anon-callable RPC).

### Next.js / platform

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| `next` + `eslint-config-next` | bump exact pin 16.4.2 -> **16.4.5** | Security fixes | Netlify's 2026-11-03 advisory lists seven Next.js CVEs fixed in 16.4.5, including 16.4+ shared-shell cache poisoning on Netlify. This milestone puts cache correctness at the centre. Keep the project's exact-pin rule (no `^`, no `audit fix --force`). Netlify also asks for the OpenNext adapter `@netlify/plugin-nextjs` >= 5.16.6 (auto-installed; confirm in the deploy log). |
| `proxy.ts` | no change | Keep the matcher as is | The visitor cookie is read in route handlers with the existing `readDeviceToken` style. Do not run the gate in `proxy.ts`: the proxy runs before routing, adds latency to every request, and the repo deliberately keeps the public shell independent of Supabase availability. |

### Design system (Tailwind 4)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| Plain CSS custom properties in `:root` (new token block next to the existing palette in `app/portia.css`, or `app/tokens.css` imported from `globals.css`) | n/a, Tailwind 4.2.1 already installed | Radius, spacing, control height, border width, shadow, focus ring tokens | The site is styled by ~280 KB of hand-written semantic CSS (865 `var(--` uses; `--panel`, `--line`, `--teal` palette driven by `--accent-hue`), not by Tailwind utilities. Tailwind's own docs: use `@theme` only when a value should generate utility classes; use `:root` otherwise. Using `@theme` here would create utilities nobody uses, and unused theme variables are not emitted unless declared `@theme static`. |
| Variant switching via `html[data-style="..."]` blocks that only override token values | n/a | The "owner chooses from reference variants" step | Token overrides make each candidate style a few lines. Fits the existing `data-accent` / `data-motion` attribute pattern. |
| A `node:test` conformance test (e.g. `lib/design-tokens.test.ts`) | n/a | Enforce the one-radius rule | Current state: 129 `border-radius` declarations, ~15 distinct literals (7px x31, 4px x17, 10px x12, 6px x11, 3px x11, 5px x10, 8px x9, 9px x7, 14px, 19px, ...). The test reads `app/portia.css`, fails if a literal radius appears outside the token definitions (allow `0`, `50%`, `999px`) and uses a ratchet baseline so the count can only fall during migration. Matches the repo's existing file-scanning tests; no new tooling. |

Token naming: use role names (`--radius-control`, `--radius-panel`, `--radius-window`, `--space-1..6`, `--ctl-h`). Avoid `--radius-sm/md/lg/xl` and do not redefine `--spacing`, `--color-*`, `--font-*`: those are Tailwind's theme namespaces and shadowing them causes confusion if utilities are ever used. Migrate by component family (buttons, panels, editor tabs, apps), not by one giant search-and-replace, and verify with the existing Playwright visual lanes.

### Supporting libraries

None required. Explicitly considered and rejected below.

### Development tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `node --experimental-strip-types --test` | Unit tests for token digest helpers, `redactContentForLevel`, nickname normalization, level clamping, token conformance | Existing `npm test`; put new tests beside the modules. |
| Staging live-test lane (`npm run test:staging-live`, `lib/portia-*-live.test.ts`) | Prove anon cannot `select` the three tables, cannot call editor RPCs, level 1 token never sees level 3 items | Isolated test project only; per CLAUDE.md, RLS/role execution stays BLOCKED until a phase proves it. Run the `supabase-rls-reviewer` agent on the new migration. |
| Playwright + `@axe-core/playwright` (installed) | Gate screen, pending state, approved state, narrow-viewport checks | Add a "no content before approval" assertion: with no cookie, network responses contain no seed text. |

## Installation

```bash
# Core: nothing new to install for the feature work.

# Security patch (exact pins, per project policy)
npm install --save-exact next@16.4.5 eslint-config-next@16.4.5
```

New migration file goes in `supabase/migrations/` (forward-only, `set search_path = ''`, explicit grants/revokes), plus an owner-run apply to production after staging proof.

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Opaque device-token cookie + definer RPCs | Supabase anonymous sign-ins | If visitors needed direct browser-to-Supabase access with per-user RLS (they do not; all reads go through route handlers) and you were willing to add CAPTCHA. |
| Opaque token + live DB lookup | Signed JWT/session cookie (`jose`, `iron-session`) | If you wanted stateless verification at the edge. Revocation and instant level changes need the DB anyway. |
| TS redaction of one JSONB document | Normalize content into per-item tables with a `level` column and real RLS | If the content model were being rebuilt. It would rewrite the editor, revision CAS, history reducer and 1700+ tests; far outside a "minimal full diff". |
| `no-store` per-visitor reads | Per-level CDN cache variants | Only with an edge function that validates the signed cookie before cache lookup (Netlify Edge Functions). Not worth it for this audience size; 10-second polling of a small JSON read is cheap. |
| Plain `:root` tokens | Tailwind `@theme` tokens / Style Dictionary / shadcn-style theming | If the site were moving to Tailwind utility classes. It is not in scope for v1.4. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `@supabase/supabase-js` `signInAnonymously()` | `authenticated` role for visitors, IP rate limit, CAPTCHA, user-table growth | Device-token cookie + RPCs |
| Service-role key in the runtime | Violates the hard rule and removes RLS as a backstop | Definer RPCs granted to `anon` by digest |
| `next-auth` / Auth.js, Clerk, Auth0 | A second identity system next to Supabase Auth for ~tens of people | Existing pattern |
| `Netlify-Vary: cookie=` on level/role, or any `s-maxage` on gated JSON | Cache serves content without validating the visitor | `noStoreHeaders` |
| Gating in `proxy.ts` or Edge middleware | Runs on every request; ties the public shell to DB availability; Next/Netlify edge-cookie CVE history | Gate in route handlers + client gate screen |
| Supabase Realtime / WebSockets for "waiting for approval" | Needs RLS-readable rows for anon; extra moving part | Poll `GET /api/gate` every 5-10 s (same as content polling) |
| Upstash/Redis rate limiting | New service for one endpoint | Reuse the attempt-bucket pattern (`coarseIpBucket`, `portia_promo_attempt_buckets` design) in a small access-attempt table |
| `stylelint` + plugins, `tailwind-variants`, `clsx`/`cva`, Style Dictionary | Heavy, supply-chain surface (the repo pins versions exactly), and the problem is a handful of values | `:root` tokens + a `node:test` check |
| Motion/`framer-motion` for the restyle | Not needed; existing CSS animations carry the aesthetic | Keep CSS |
| Storing the visitor's raw token or nickname-level in `localStorage` | JS-readable, survives logout | HttpOnly cookie; UI learns state from `GET /api/gate` |

## Stack Patterns by Variant

**If the owner wants hidden items shown as locked placeholders (lock icon + required level) rather than absent:**
- Have `redactContentForLevel` replace the item with a stub `{ id, title, minLevel, locked: true }` and strip all body fields and `formattedText` keys.
- Because showing titles discloses existence; decide this with the owner before the schema is fixed.

**If a person loses the cookie or uses a second device:**
- Key people by `nickname_key` (lower-cased, like the promotion `nickname_key`), with device rows attached; a new device for an existing nickname creates a pending "new device" request instead of auto-granting.
- Because the nickname is unauthenticated: the first device binds it (the promotion `nickname-bound` rule), and editors approve additions. This also stops someone typing a known employee's nick to inherit level 2.

**If promotion should use the approved nick:**
- `lib/portia-promotion-api.ts` (`promotionStatus`, `submit_request`) should take the nickname from `portia_access_resolve(digest)` on the server, ignoring any client-sent value for gated visitors. Keep `portia_promo_device` as a separate cookie so a promotion device reset does not log the visitor out.

**Editor tab «Пользователи»:**
- Add `{ id: "users", label: "Пользователи", kind: "regular" }` to `tabRegistry` in `lib/editor-tabs.ts`. A `regular` tab is open to all editors unless the owner closes it (matches "у всех редакторов изначально"); a `trusted` tab would need a grant. `portia_can_edit_tab('users')` already works for any tab id. Mind `parseTabLists`, which validates against the registry.

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| `next@16.4.5` | `react@19.2.6`, `@supabase/ssr@0.12.7` (latest per npm registry, 2026-11-09) | Patch bump only; run the full `/portia-check` and the e2e smoke lane after. |
| `@supabase/supabase-js@^2.117.3` | Locked, no change needed | No new Supabase client API is used (only `.rpc()`). |
| `@netlify/functions@6.0.2` (lock) | Latest on npm is 6.1.1 | Only `purgeCache` is used; no bump required. |
| `tailwindcss@4.2.1` / `@tailwindcss/postcss@4.2.1` | n/a | No change; tokens are plain CSS. |
| Netlify OpenNext adapter | >= 5.16.6 | Auto-installed unless pinned; confirm in the deploy log. |

## Sources

- Supabase Auth, Anonymous sign-ins: https://supabase.com/docs/guides/auth/auth-anonymous (role is `authenticated`, 30/hour/IP default, CAPTCHA advice, no auto cleanup, review RLS first) - HIGH (official docs)
- Netlify caching overview: https://docs.netlify.com/build/caching/caching-overview/ (`private`/`no-store`, `Netlify-CDN-Cache-Control`, `Netlify-Vary` cookie keys, durable cache, tag purge limits; `Set-Cookie` handling NOT documented) - HIGH for what it states, gap flagged
- Netlify changelog 2026-11-03 Next.js security vulnerabilities: https://www.netlify.com/changelog/2026-11-03-nextjs-security-vulnerabilities/ (fix in 16.4.5, adapter 5.16.6) - MEDIUM (read through a page summarizer; re-read the CVE list before bumping)
- Tailwind CSS theme docs: https://tailwindcss.com/docs/theme (`@theme` vs `:root`, namespaces, `static`, `inline`) - HIGH (official docs)
- npm registry latest: `next` 16.4.5, `@supabase/ssr` 0.12.7, `@netlify/functions` 6.1.1 - HIGH
- Repo evidence (read-only): `lib/portia-device-binding.ts`, `lib/portia-cdn.ts`, `app/api/content/route.ts`, `app/api/employees/route.ts`, `app/page.tsx`, `proxy.ts`, `lib/editor-tabs.ts`, `lib/portia-content.ts`, `supabase/migrations/20261101000000_portia_baseline.sql`, `app/portia.css`, `next.config.ts` - HIGH
- Context7 was unavailable this session; Supabase storage behaviour for public buckets without a SELECT policy is from prior knowledge and is LOW until proven on staging.

---
*Stack research for: PORTIA OS v1.4 access gate and design tokens*
*Researched: 2026-11-09*
