# Project Research Summary

**Project:** PORTIA OS — v1.1 «Закрытие замечаний»
**Domain:** review-debt fix milestone (Next.js 16.4.2 + Supabase + Netlify)
**Researched:** 2026-10-19
**Confidence:** HIGH (what/order), MEDIUM (owner dashboard, SQL, device-dependent outcomes)

## Executive Summary

v1.1 closes 55 review findings from v1.0. Re-checked at HEAD d40c8b5: 1 fixed (01-CR-01), 3 partly fixed, ~5 stale/accept-as-is, ~46 present. Duplicates (03.1-WR-04 = 03.2-WR-01, 03.1-IN-04 = 03.2-IN-01, 03.1-IN-06 = 03.3-IN-03, …) collapse them into ~25 distinct changes.

No new dependencies or version bumps: small `lib/` helpers with `node:test` tests, owner-applied SQL blocks, one shared `sandbox` constant. Data loss is the priority, and it has one root cause: employee PATCH is a full replace of a full draft.

Main risks are lockout and silent destruction in production: an SQL `email_confirmed_at` requirement can lock the owner out; the content normalizer runs on every save, so any "drop on bad shape" deletes stored content; `sandbox`, the zoom overlay and the phone format panel need device checks; code must work before and after the owner applies SQL.

## Key Findings

### Recommended Stack
Nothing added. Next 16.4.2 (latest), supabase-js 2.117.3, @supabase/ssr 0.12.7 stay. New code: `lib/json-body.ts` (`parseJsonObject`), `embedSandbox` constant (`allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox`), SQL in `supabase/portia_setup.sql`. Tests in `lib/*.test.ts` via Node `--experimental-strip-types`; no jsdom/Playwright.

### Expected Features (fix categories)
- A employee saves (13), B content sync & normalization (12), C robustness (4), D security (4), E editor & format panel (7), F embedded docs zoom (4), G a11y & copy (5), H tests/docs.
- Unreported siblings: `PUT /api/content` (`JSON.parse` → 500) and `POST /api/editors` (no try/catch).

### Architecture Approach
Root-cause clusters A–J (see ARCHITECTURE.md): A poll skip by revision; B partial PATCH/upsert + client `profileDiff` + no-Roblox lookup; C editor form races; D `mergeDegradedRoster`; E JSON helper; F normalizer/content hygiene; G `EmbeddedDocument` + iframes; H desktop robustness; I SQL; J phase-05 format panel. `portia-desktop.tsx` and `portia-editor.tsx` are hot files — serialise phases on them.

### Critical Pitfalls
1. Contradictory PATCH findings — fix the contract first, keep accepting old full-draft body, require `profilesRead === true`, bump roster cache key.
2. `email_confirmed_at` lockout — pre-check `auth.users`, rollback block, Confirm email = ON.
3. Destructive normalizer — repair, never drop; production-snapshot round-trip; never lower a cap.
4. Poll skip edge cases — compare revision, keep first-apply and 409-reset paths, bump `contentCacheStorageKey` if output shape changes.
5. Untestable changes (sandbox, zoom overlay, phone panel) — recorded device check.
6. Test saves only on a throwaway manual employee; export snapshots first; orphan cleanup uses exact key builders.

## Open Decisions

1. **Content over-limit:** ARCHITECTURE/FEATURES → raise caps + PUT 400 over limit; PITFALLS → raise caps, editor-side limits, never 400/never drop. Agreed: shared `contentLimits`, raised caps, disabled «+» at the limit, never truncate silently.
2. **Employee PATCH contract:** absent key = unchanged, `null` clears ratings only, wrong type = 400, ≥1 known key, old full-draft body accepted (overrides literal 03.1-WR-02).
3. **01-WR-01 Ctrl+wheel over cross-origin iframe:** platform limit — accept with `shortcut:` comment (default) vs refocus spike.
4. **05-WR-05 matchMedia duplication:** lean out of scope.
5. **IN-10 (column grants, owner email, anon approval oracle):** STACK/PITFALLS close as accepted risk; storage select policy → editor-only optional.
6. **`app/error.tsx`:** lean skip.
7. **Employee save lock:** `<fieldset disabled>` vs snapshot-compare + `saveSeq` (phone-friendly).

## Implications for Roadmap

1. **Triage ledger & safety net** — close fixed/stale findings with evidence; owner exports `portia_employee_profiles` + `portia_content`, runs email pre-check, checks Confirm email.
2. **Server boundary & employee API contract** — `parseJsonObject` in 5 handlers, partial PATCH/upsert, no-Roblox lookup, `manualRead`, `code:"sheet"`, `contentLimits`, safe-path constant.
3. **Employees client** — `profileDiff`, `profilesRead`, save lock, timer ref, add form always shown, `mergeDegradedRoster`, `key={src}`, cache key bump.
4. **Content integrity** — poll skip, `removeRecycled*`, `important` cleanup, `?? []`, quest date repair, limit buttons, `today` init, normalizer repair.
5. **Desktop robustness, embeds, a11y** — assistant fallback, `text ?? ""`, `embedSandbox`, zoom overlay, toast Escape/role, settings key, copy. Exit: device check.
6. **Format panel & editor polish** — 05-WR-01 guard, 05-WR-06 colour, CSS/boundary tests, 03.2-IN-04, 01-IN-02, 05-IN-03. Exit: owner device re-check.
7. **SQL & security (owner-applied)** — app-level `email_confirmed_at` check; `portia_email_confirmed()` definer helper ANDed into `portia_is_owner`/`portia_can_edit`; storage policy; photo-url `not valid` constraint; pre-check + rollback + `begin/commit`.

### Research Flags
- Phase 2/3: spike partial-column upsert on insert path.
- Phase 4: production payload size; normalizer round-trip on snapshot.
- Phase 5: browser check of Sheet, charter, YouTube.
- Phase 6: device check.
- Phase 7: owner decisions, dashboard state, `auth.users` pre-check.
- Standard patterns: Phase 1, pure-lib parts of 2 and 4.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH / MEDIUM | auto-confirm, sandbox, dark contrast MEDIUM |
| Features | HIGH | each finding re-read against code |
| Architecture | HIGH / MEDIUM | limits policy and upsert semantics MEDIUM |
| Pitfalls | HIGH / MEDIUM | platform behaviour not browser-verified |

### Gaps to Address
Dashboard Confirm-email state; unconfirmed editors; production payload size; partial upsert on insert; final sandbox tokens; dark-field contrast; 05-WR-05 re-clamp half; unverified 03.1-IN-02 SQL, IN-03, 05-IN-05, 03.2-IN-02.

## Sources
STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md in this directory; v1.0 review files under `.planning/milestones/v1.0-phases/`.

---
*Research completed: 2026-10-19*
*Ready for roadmap: after open decisions 1–5*
