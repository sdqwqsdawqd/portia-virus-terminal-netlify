# Stack Research

**Domain:** Subsequent milestone v1.1 «Закрытие замечаний» (review-debt fixes) on an existing Next.js 16 + Supabase + Netlify app
**Researched:** 2026-10-19
**Confidence:** HIGH for "no new dependencies" and the code-level mechanisms; MEDIUM for the Supabase auth edge cases and the iframe `sandbox` behaviour of Google/YouTube pages (needs one manual check in the browser)

## Verdict

**Add nothing. Bump nothing.** Every open finding (WR and IN, phases 01, 03.1, 03.2, 03.3, 05) is fixable with platform features and libraries already installed. Run `npm install` for nothing; `package.json` and `package-lock.json` stay untouched except for what the fixes themselves do not need to touch.

The only things that are "new" are:

1. Three small SQL edits in `supabase/portia_setup.sql` (the owner applies them in the SQL Editor).
2. One tiny pure helper in `lib/` (JSON body parsing) so five route handlers share one 400 path.
3. One string constant for `sandbox` shared by three `<iframe>`s.
4. Optionally one file, `app/error.tsx`.

## Recommended Stack

### Core Technologies (already installed; keep exactly as is)

| Technology | Version | Purpose | Why keep / what it gives the fixes |
|------------|---------|---------|------------------------------------|
| next | 16.4.2 (exact pin; `latest` on npm as of 2026-10-15) | App Router, route handlers, `app/error.tsx` | Decision 03.1-06 pins it exactly. Route handlers get the Web `Request`, so `request.json()` / `request.text()` need no helper library. `error.tsx` in 16.3+ has a stable `retry` prop. |
| react / react-dom | 19.2.6 | UI | `sandbox`, `key={src}`, refs and effects cover WR-05, WR-06, WR-04, IN-07, IN-09 with no extra library. |
| @supabase/supabase-js | 2.117.3 installed (2.118.0 exists) | Auth + PostgREST | Do **not** bump: no finding needs 2.118. `User.email_confirmed_at?: string` is already in the installed auth-js types, which is what the app-level confirmed-email check uses. |
| @supabase/ssr | 0.12.7 | Cookie-based server client | Unchanged. |
| typescript | 5.9.3 | `tsc --noEmit` | Unchanged. |
| node:test (Node >=22.13) | built in | `npm test` = `node --experimental-strip-types --test lib/*.test.ts` | All new tests must live in `lib/*.test.ts` and import only relative `./x.ts` files (no `@/` alias, no `next/*`), exactly like the existing tests. |

### Fix mechanisms (finding -> tool). This is the part the roadmap needs.

| Finding(s) | Mechanism | Where | Notes |
|------------|-----------|-------|-------|
| 03.1 WR-11 (confirmed email) | **Two layers.** (a) App: `getEditorAccess` returns `noAccess` unless `user.email_confirmed_at` is set. (b) SQL: new helper `portia_email_confirmed()` ANDed into `portia_is_owner()` and `portia_can_edit()`. | `lib/editor-access.ts`, `supabase/portia_setup.sql` | See "Supabase email confirmation" below. No JWT claim can do this job. |
| 03.1 IN-06, 03.3 IN-03, WR-02/IN-02 (PATCH shape) | `parseJsonObject(text): Record<string, unknown> \| null` in a new `lib/json-body.ts`; handlers answer 400 «Некорректный запрос.» on `null`. | `app/api/employees` (PATCH, POST, DELETE), `app/api/editors` POST, `app/api/content` PUT | Pure string function, so it is testable under `node --test`. Also fixes two real bugs the review did not name: `editors` POST has no try/catch at all, and `content` PUT turns bad JSON into 500 via the outer catch. |
| 03.1 IN-07, 03.3 IN-04a (sandbox) | One constant `embedSandbox`, used by all three `<iframe>`s (Sheets `htmlview`, GitHub Pages charter, `youtube-nocookie`). | `components/portia-desktop.tsx` (~lines 1245, 1524) | See "iframe sandbox" below. |
| 03.1 IN-02 (protocol-relative URL) | Regex `/^\/(?!\/)/` in three TS places; SQL `photo_url like '/%' and photo_url not like '//%'`. | lib + editor + SQL | SQL needs `alter table ... drop constraint if exists portia_employee_profiles_photo_url_check; add constraint ... check (...) not valid;` because `create table if not exists` never changes an existing table. `not valid` keeps old rows from blocking the script. |
| 03.1 WR-04, 03.2 WR-01 (history wipe) | Plain ref guard in `fetchContent`: skip `setContent` when `contentApplied.current && fetchedRevision === knownRevision.current`. | `components/portia-desktop.tsx` | No state library. Keep the equal-revision acceptance for first apply and after the 409 reset. |
| 03.1 WR-05 | `key={src}` on `<EmployeeImage>`. | desktop | |
| 03.1 WR-06 | `useRef<number>` timer + cleanup effect (same pattern as the desktop's `saveStateTimer`). | editor | |
| 03.1 WR-07, 03.3 WR-01 (silent truncation) | Shared constants (e.g. `infoLimits`) exported from `lib/portia-content.ts`, used by the normalizer `.slice()` calls **and** the editor's `disabled=` on add buttons. For rich text, either raise the run/key caps or make `PUT` reject over-limit input with 400. | `lib/portia-content*.ts`, editor | Coerce strings explicitly in `normalizeBroadcasts` / `infoSections` (`typeof x === "string" ? x : ""`), same style as the existing `asText` helper. No schema library. |
| 03.1 WR-08 | `removeRecycledVirus` / `removeRecycleFile` in `lib/editor-items.ts` (delete `formattedText` keys with prefix `virus:${id}:` / `portiaTextKey.recycle(id)`), tests next to `removeBroadcast`. | lib | |
| 03.1 WR-09 | `item.type = type; if (type !== "news") item.important = false;` (optionally gate reader on `type === "news"`). | editor | |
| 03.1 WR-10, WR-12 | `?? "..."` / `?? []`; `text ?? ""` inside `FormattedText`. | desktop, `lib/editor-changes.ts` | |
| 03.1 WR-01, 03.3 WR-02 (degraded roster) | Merge-on-degraded in `fetchEmployees` (keep prior profile fields / prior `source === "manual"` rows) and do not write the degraded payload to `localStorage`. | desktop | |
| 03.1 WR-03 | PATCH resolves the employee from the sheet only (accept client `id` if it is `roblox-\d+` or matches the sheet nickname id); no Roblox call on save. | `app/api/employees`, `lib/portia-employees.ts` | |
| 03.2 WR-02/03/04 | Editor rejects roster unless `profilesRead === true`; `<fieldset disabled={state === "saving"}>`; send only changed keys. | editor | `<fieldset disabled>` is native HTML, no library. |
| 03.3 WR-03 | Distinct `not-found` result for "zero rows", plus try/catch around `updateManualEmployee`. | `lib/portia-employees.ts`, route | |
| 03.3 WR-04 | Move the early `return` so the list aside + add form render with an empty roster. | editor | |
| 03.3 IN-04b | Machine-readable `code: "sheet"` in the 403 body instead of `includes("таблицы")`. | route + editor | |
| 05 WR-06 (contrast) | Change the one CSS rule to `text-decoration: underline solid rgba(0,130,114,.95) 3px;` | `app/portia.css:516` | Computed WCAG contrast (own calculation, field colours from `portia.css`): current `rgba(0,188,166,.9)` = **2.0:1** on `#f3f1e9`; the reviewer's `rgba(0,150,132,.95)` = 3.08:1 (borderline); `rgba(0,130,114,.95)` = **3.88:1 light / ~3.7:1 dark** (dark bg approximated from `oklch(.168 …)`). One colour works on both previews. Re-check on the other `preview-light` areas (`--paper`, `#eeeee9`) when eyeballing. |
| 05 IN-05 | No code. `::highlight()` accepts `text-decoration` "and its associated properties"; the Custom Highlight API is Baseline "newly available" since March 2026 (MDN). Thickness inside `::highlight` is not named explicitly, so it stays a one-time visual check. | | |
| 05 IN-06 | Source-reading test in `lib/` (see Development Tools). | `lib/portia-css.test.ts` | |
| 05 WR-01 | Pure logic, no stack: skip `field.focus()` when `target.selection` is null (or send the focus read as non-own). | editor | |
| 05 IN-01/IN-02, 03.1 IN-04, 03.2 IN-01/IN-04, a11y, copy, labels | Plain ARIA attributes / text edits. `window` Esc listener while toast shown, `role="region"` + `aria-label`, `role="option"` + `aria-selected` or drop `listbox`. | desktop | |
| 03.1 IN-01 (storage key) | Export `settingsStorageKey` from `lib/accent-boot.ts`; test asserts the requested key. | lib | |
| 03.1 IN-08 | Clear/swap `endsAt < startsAt` in `normalizeBroadcasts` + one hint in the editor. ISO `YYYY-MM-DD` strings compare correctly with `<`, no date library. | lib/editor | |
| 03.1 IN-09 | Move the `localStorage` write out of the `setEmployees` updater into an effect keyed on `employees`; keep the z counter in a `useRef`. | desktop | |

### Supabase email confirmation (WR-11): exact approach

**Why the JWT cannot do it.** The Supabase access-token field list (docs "JWT Fields") has `email`, `phone`, `is_anonymous`, `aal`, `amr`, `app_metadata`, `user_metadata`, but no `email_confirmed_at` / `email_verified`. `user_metadata` is writable by the signed-in user themself, so it must never gate authorization. Therefore the only trustworthy server-side source is `auth.users.email_confirmed_at`.

**SQL (owner applies; idempotent):**

```sql
-- true only when the caller's own account has a confirmed address
create or replace function public.portia_email_confirmed()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid()) and email_confirmed_at is not null
  );
$$;
revoke all on function public.portia_email_confirmed() from public, anon, authenticated;
```

Then add `public.portia_email_confirmed() and` in front of the existing expressions in `portia_is_owner()` and `portia_can_edit()` (keep their `security definer` and `set search_path = public`; keep every `grant`/`revoke` already in the script).

- `security definer` is required because `authenticated` has no privilege on `auth.users`. `search_path` must be pinned (Supabase lint 0011 and the advisories flag definer functions without it); `auth.users` is schema-qualified so `''` is safe.
- The inner helper needs **no** grant to `anon`/`authenticated`: it is called from inside other definer functions, which run with the definer's rights (same pattern the script already uses for `portia_owner_email()`).
- Policies already call `(select public.portia_can_edit())`, so every table, storage and RPC check inherits the fix with zero policy edits.

**App layer (works the moment it ships, before the owner touches SQL):** in `lib/editor-access.ts` change the first line to `if (!user?.email || !user.email_confirmed_at) return noAccess;`. `user` comes from `supabase.auth.getUser()`, which the Auth server validates, so the field is trustworthy (unlike a decoded cookie session).

**Critical caveat for the plan (MEDIUM confidence, inference + Supabase JS reference):** with **"Confirm email" turned OFF** the Auth server hands out a session straight from `signUp`, and the user is treated as confirmed, so `email_confirmed_at` is set and *both* layers above become a no-op. The real control is the dashboard switch **Authentication -> Providers -> Email -> Confirm email = ON** (default on hosted projects). So the deliverable is: (1) the two code/SQL layers as defence in depth, (2) a comment in `portia_setup.sql` and a line in the phase checklist telling the owner to verify the switch. The repo cannot prove the switch state. With the switch ON, `signUp` returns `session: null`, which `editorSignUp` already handles (`if (data.user && data.session)`).

**Do not** try to also close the `portia_editor_is_approved` anon oracle in this milestone. It is deliberately anon-callable (pre-signup approval check). Removing the pre-check means any stranger creates `auth.users` rows; making it private needs a service-role key (a new secret on Netlify). Recommend closing the finding as an accepted risk: it only answers yes/no for one address at a time, and with Confirm email ON the oracle can no longer be turned into access.

### Supabase SQL for the other IN items

| Item | Recommendation | Why |
|------|----------------|-----|
| IN-10 `updated_by` readable by anon | **Close as accepted/won't fix.** | The clean fix is a table-level `revoke select` + column-level `grant select (cols…)`. Supabase docs: restricted roles cannot use `*` on that table. `lib/portia-employees.ts:238` deliberately uses `.select("*")` so a missing column cannot fail the read; switching to a column list re-introduces that failure mode and the roster breaks if SQL lags the code. `updated_by` is an opaque UUID of an editor; low value. |
| IN-10 storage `select` policy lists all objects | **Replace** `"Public can read PORTIA media"` (anon+authenticated, `bucket_id = …`) with the same policy `to authenticated using (bucket_id = 'portia-media' and (select public.portia_can_edit()))`. | Public-bucket URLs (`getPublicUrl`) are served without a storage policy; only `list` needs it. `app/api/uploads/route.ts` uses `upload(..., { upsert: false })`, which needs only the insert policy. The authenticated-editor policy is kept so a future move/replace (needs select) still works. MEDIUM confidence: confirm in the browser that an uploaded image still loads after the SQL is applied. |
| IN-10 owner email in committed script | **Close as accepted.** | The same address is already in `PROJECT.md` and is the owner's public contact. A deploy-time value in Postgres means a settings table or a database-level GUC set from the dashboard: more moving parts than the finding is worth. |

### iframe sandbox (IN-07, 03.3 IN-04a)

One constant, three uses:

```tsx
// Cross-origin documents only. allow-scripts + allow-same-origin together would let a
// same-origin page remove its own sandbox, which is harmless for docs.google.com,
// github.io and youtube-nocookie.com.
const embedSandbox = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";
// <iframe sandbox={embedSandbox} … />
```

| Flag | Keep? | Why |
|------|-------|-----|
| `allow-scripts` | yes | Google `htmlview` widget and the YouTube player are JS apps. |
| `allow-same-origin` | yes | Without it the frame gets an opaque origin: no cookies/storage, YouTube player and Google viewer break. Safe because all three are cross-origin to PORTIA. |
| `allow-popups` + `allow-popups-to-escape-sandbox` | yes | Links inside the sheet/charter and the YouTube logo open new tabs. Without "escape", the opened tab inherits the sandbox and e.g. Google sign-in or YouTube pages misbehave. |
| `allow-top-navigation*`, `allow-forms`, `allow-modals`, `allow-downloads`, `allow-pointer-lock` | **no** | This is the whole point of IN-07: the embedded page must not navigate the PORTIA tab. |
| `allow-presentation` | no | Only for the Presentation API/cast. Fullscreen is governed by the existing `allowFullScreen` attribute, not by `sandbox`. |

React 19 accepts `sandbox` as a plain string attribute, so no typings change. The existing Ctrl+wheel overlay and `onLoad` loader are unaffected. Existing `referrerPolicy`/`allow` attributes stay. **Verify manually** (localhost:3123): Sheet loads and scrolls, charter loads and its links open in a new tab, a YouTube block plays and goes fullscreen. If the charter page uses a form or a download, add only that single flag.

Optional regression guard (6 lines, fits `npm test`): a `lib/iframe-sandbox.test.ts` that reads `components/portia-desktop.tsx` and asserts every `<iframe` has `sandbox=`.

### Route-handler JSON (IN-06 and friends): exact approach

```ts
// lib/json-body.ts — no imports, so node --test can load it
export function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
  } catch { return null; }
}
```

Handlers: `const body = parseJsonObject(await request.text().catch(() => ""));` then `if (!body) return Response.json({ error: "Некорректный запрос." }, { status: 400 });`. `content` PUT already reads `request.text()` for its 2 MB size guard, so it just swaps `JSON.parse(raw) as …` for the helper. A one-line variant `await request.json().catch(() => null)` would also work, but it returns `null`/arrays/primitives unchecked (`null.id` is the original crash), so the shared helper is the smaller *complete* fix.

Test (`lib/json-body.test.ts`): `""`, `"{"`, `"null"`, `"[]"`, `"1"` -> `null`; `'{"a":1}'` -> object.

### Optional: error boundary (WR-07 / WR-10 defence in depth)

`app/error.tsx` wraps `page.tsx` in a React error boundary; the review notes twice that one bad item unmounts the whole desktop. Next 16.4.2 file convention: `"use client"`, props `{ error, retry }` (`retry` stable since 16.3.0; `reset` still exists; `unstable_retry` was the 16.2 name). Render one message in Russian plus a retry button using existing CSS classes; do not add Sentry/`react-error-boundary`. Recommended only if the roadmap wants "desktop does not crash" to hold against *unknown* bad data; the targeted fixes (`?? ""`, string coercion, item filtering) are the real cure and are mandatory.

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| `npm test` (`node --test`, strip-types) | Unit tests for every new pure function | `lib/json-body.test.ts`, extended `editor-items.test.ts`, `portia-employees.test.ts` (PATCH without `biography` -> `null`), `portia-content-normalize.test.ts` (limits, string coercion, quest period), `accent-theme.test.ts` (settings key), `editor-changes` with missing `recycledViruses`. |
| Source-reading tests | Guard CSS/markup invariants without a DOM | `lib/portia-css.test.ts`: `readFileSync(new URL("../app/portia.css", import.meta.url), "utf8")`, take the `::highlight(portia-format)` rule, assert `underline` present and no `background`. Works because `package.json` has `"type": "module"`. |
| `npx tsc --noEmit`, `npm run lint`, `npm run build` | Existing `npm run check` | Run after the `app/api` edits, since route files import via `@/`. |

## Supporting Libraries

**None to add.** Table intentionally empty.

## Installation

```bash
# Nothing. No new packages, no version changes.
# (Do not run `npm audit fix --force` - Key Decision 03.1-06.)
```

## Alternatives Considered

| Recommended | Alternative | When the alternative is better |
|-------------|-------------|--------------------------------|
| Hand-written `parseJsonObject` + existing `sanitize*` functions | `zod` / `valibot` | Only if the API surface grows to dozens of endpoints. Here 5 handlers and sanitizers already exist; a schema library would duplicate them and add supply-chain surface (the project pins exact versions for that reason). |
| `auth.users.email_confirmed_at` via definer helper | Reading `email_verified` from `user_metadata` / JWT | Never for authorization: not a JWT claim, and `user_metadata` is user-editable. |
| App check + SQL check + dashboard switch | Supabase Auth Hook "before user created" (Postgres function) to reject unapproved emails | If the owner later wants unapproved addresses to be unable to create accounts at all. Needs hook configuration in the dashboard; out of scope for a debt milestone. |
| Column list stays `select("*")`; IN-10 closed as accepted | Column-level grants / a public view | If more sensitive columns are added to `portia_employee_profiles`. Then also move the read to an explicit column list. |
| Source-reading tests in `node:test` | jsdom / Testing Library / Playwright for 05 IN-01 | The review itself says "if a DOM test runner is ever added". A new test runner is a toolchain change; the one-line wiring risk is covered by the owner's device check. |
| `fieldset disabled` + changed-keys-only PATCH | Optimistic locking with revision column | Already an accepted risk (AR-03.2-01, last write wins); do not expand scope. |

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Any new npm dependency (validation, sanitizer, a11y, state, i18n, test runner) | Zero are needed; project policy pins exact versions and avoids `audit fix --force`; ponytail scope | Existing `lib/` helpers + platform features above |
| `sandbox="allow-scripts allow-same-origin"` on same-origin or `srcdoc` content | Lets the framed page strip its own sandbox | Fine only for the three cross-origin embeds listed |
| `allow-top-navigation` / `-by-user-activation` on embeds | Exactly the IN-07 hole | Omit; links open via `allow-popups` |
| `user_metadata` or any JWT claim as proof of confirmed email | Not present / user-writable | `auth.users.email_confirmed_at` through a definer helper, plus server `getUser()` |
| `security definer` without `set search_path` | Search-path hijack; Supabase advisor warning | `set search_path = ''` + schema-qualified names |
| Granting the new helper to `anon` | Needless exposure of a definer function | `revoke all … from public, anon, authenticated` (called only from other definer functions) |
| Column-level `revoke`/`grant` on `portia_employee_profiles` | Breaks `select("*")` and the "missing column cannot fail the read" design | Close IN-10 (first bullet) as accepted |
| `Response.json` 500 for bad client input | Misreports client errors as server faults, noisy logs | 400 via `parseJsonObject` |
| Bumping `next` / `@supabase/*` "while we are here" | Not required; each bump re-opens the supply-chain review | Keep 16.4.2 / 2.117.3 / 0.12.7 |
| Bare `await request.json().catch(() => null)` as the only guard | Leaves `null` / arrays / primitives unchecked | The shared `parseJsonObject` |

## Stack Patterns by Variant

**If the owner confirms "Confirm email" is ON (expected, hosted default):**
- Ship the app-level check + SQL helper as defence in depth; no behaviour change for existing users (their addresses are already confirmed).
- Because existing editors who signed up before the switch was ON could have `email_confirmed_at = null`, list them first: `select email from auth.users where email_confirmed_at is null;` and confirm or re-invite them *before* applying the SQL, or they lose editor access.

**If "Confirm email" is OFF:**
- The code/SQL layers do not protect; turning the switch ON is the fix. Existing unconfirmed users must be confirmed manually in Dashboard -> Authentication -> Users first.

**If the SQL is not yet applied when the code ships:**
- App-level check already blocks unconfirmed users in the site; direct PostgREST writes stay governed by the old policies until the owner runs the script. The script is idempotent, so order is not critical.

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| next@16.4.2 | react@19.2.6 | Pinned pair; `error.tsx` `retry` prop needs >=16.3.0. |
| node >=22.13 <23 (Netlify `NODE_VERSION = 22.13.0`) | `node --experimental-strip-types --test` | Local machine runs Node 24.21; strip-types syntax limits are the same (no enums, no parameter properties); keep new lib files to plain type annotations and `.ts` import extensions. |
| @supabase/supabase-js@2.117.3 | auth-js `User.email_confirmed_at?: string` | Optional field: use `!user.email_confirmed_at`, not a `Date` parse. |
| Postgres on Supabase | `create or replace function`, `alter table … add constraint … not valid`, `drop policy if exists` | All idempotent, safe for "run the script again". |

## Sources

- Supabase JWT field reference https://supabase.com/docs/guides/auth/jwt-fields - claim list has no `email_confirmed_at` (HIGH, official, fetched 2026-10-19)
- Supabase column-level security https://supabase.com/docs/guides/database/postgres/column-level-security - restricted roles cannot use `*` (HIGH, official)
- Supabase Auth email docs https://supabase.com/docs/guides/auth/auth-email - "Confirm email" default on hosted projects, off locally/self-hosted (HIGH); behaviour of `email_confirmed_at` under auto-confirm is inferred from the JS `signUp` reference (session returned when confirmations are off) (MEDIUM)
- Definer-function pattern (definer + pinned `search_path` + revoke from anon) https://vibe-eval.com/checklists/supabase/ and https://apify.com/renzomacar/supabase-security-auditor (MEDIUM, secondary; matches what the repo's script already does for `portia_owner_email()`)
- Next.js `error.js` reference https://nextjs.org/docs/app/api-reference/file-conventions/error - `retry` stable in 16.3.0, `unstable_retry` 16.2.0 (HIGH, official, page dated 2026-10-15)
- MDN `::highlight()` https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Selectors/::highlight - allowed properties include `text-decoration` and associated properties; Baseline 2026 newly available (HIGH for properties, MEDIUM for "thickness renders everywhere")
- npm registry (`npm view next dist-tags.latest` = 16.4.2; `@supabase/supabase-js` latest 2.118.0; `@supabase/ssr` 0.12.7; `@netlify/functions` 6.0.2), checked 2026-10-19 (HIGH)
- Repo files read: `supabase/portia_setup.sql`, `lib/editor-access.ts`, `app/api/{content,editors,employees,uploads,access}/route.ts`, `app/owner-login/actions.ts`, `components/portia-desktop.tsx` (iframes), `package.json`, `netlify.toml`, the five v1.0 REVIEW files and dispositions (HIGH)
- WCAG contrast numbers: own calculation with the `portia.css` field colours (HIGH for the light field `#f3f1e9`; the dark-field figure uses an sRGB approximation of `oklch(.168 .014 hue)`, so MEDIUM)

---
*Stack research for: v1.1 review-debt fixes (Next.js 16.4.2 + Supabase + Netlify)*
*Researched: 2026-10-19*
