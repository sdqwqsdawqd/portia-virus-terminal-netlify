# Phase 21: Фундамент доступа: люди, заявки, правила и журнал - Context

**Gathered:** 2026-11-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Data layer and shared modules only: people, nick requests, levels 1–5, append-only decision journal and the site-closure flag (default OFF, owner-only). Site behaviour for visitors does not change. Also in scope: revoke direct `portia_promo_register_attempt` from `anon`/`authenticated` (SEC-06) and an exact pin of `next` + `eslint-config-next` to 16.4.5 in a standalone commit (SEC-08).

Requirements: ACC-04, ACC-09, USR-05, LVL-01, SEC-06, SEC-08.

Not in this phase: the «Пользователи» tab UI (22), boot-screen form and `/api/visitor` gate (23), item levels and redaction (24), closing anon reads / CDN / flip (25), restyle (26).

</domain>

<decisions>
## Implementation Decisions

### Locked earlier (carried forward, not re-asked)
- **D-01:** Nick rule: `[A-Za-z0-9_]{3,20}`, one canonical case-insensitive key («Qloxz» = «qloxz»); one TS module + identical SQL check, with a TS↔SQL parity test (ACC-04).
- **D-02:** Decision rules live in the DB (D-71 5а): any editor may decide; no self-approval; no level above the decider's own; the owner cannot be changed; a repeat decision on an already-decided request returns «уже решено» (conditional transition). Journal cannot be updated, deleted or selected directly — RPC only (USR-05).
- **D-03:** Levels 1–5 named «Уровень 1…5» from one module (D-71 6а); editors and owner always resolve to 5 regardless of any person row (LVL-01).
- **D-04:** Approval defaults: «из таблицы» → 2, «не из таблицы» → 1 (owner decision). Bulk owner approval of table staff at level 2 is built in Phase 22; this phase only needs the data model to support it.
- **D-05:** Closure flag is a DB row, default OFF, writable only by the owner (editor gets a refusal) (ACC-09).

### Повторные заявки и пауза
- **D-06:** At most one pending request per nick (canonical key). After rejection or revocation a new request is allowed after a **1-hour** cooldown (owner chose 1б, not the 24 h default). The owner can clear the cooldown manually. A general per-day attempt cap still applies as a DB-side guard (exact number: Claude's discretion, keep it modest). — **Reversibility:** reversible — cooldown is a constant in the RPC/migration.

### Журнал
- **D-07:** The journal records **decisions about people only**: approve, reject, level change, revoke, cooldown clear. Closure-flag toggles are **not** written to this journal (owner chose 2б). Retention: forever, no automatic deletion. Editors will see history per person (exposed via RPC in Phase 22). — **Reversibility:** costly — adding flag events later means a new event type plus backfill is impossible for past toggles.
- **D-08:** Because flag toggles are not journaled, the flag row itself should still keep `updated_at` / `updated_by` so the last change is knowable (Claude's call; this is row metadata, not a journal).

### Уровень после отзыва и повторного одобрения
- **D-09:** Every new approval starts fresh at the type default (2 «из таблицы», 1 «не из таблицы»); the previous level is not restored and is visible only in history (owner chose 3а).

### «Повышение»
- **D-10:** Promotion keeps its current nickname validation (up to 64 chars) in this phase; the only Promotion change here is the `register_attempt` revoke. Moving Promotion onto the shared nick rule happens in Phase 23 together with taking the nick from the approved request (owner chose 4а). Promotion contract tests must stay green.

### Закрытие фазы
- **D-72:** 2026-11-09 владелец закрыл фазу 21 как принятый риск, без живого прогона (ответ в UAT: «all pass ведь все работает», затем выбор «1»). Все 6 пунктов `21-UAT.md` (ACL на staging, роли с аутентификацией, pgcrypto/HMAC, адаптер Netlify >= 5.16.6, конкурентность, живые контракты «Повышения») записаны `skipped` с причиной «принято владельцем», не PASS. Поведение Postgres/RLS остаётся BLOCKED (ENV); миграция `20261109000000` нигде не применена. Долг переходит на staging-прогон по `21-MIGRATION-APPLY.md` до включения закрытия в Phase 25. Требования ACC-04, ACC-09, USR-05, LVL-01, SEC-06, SEC-08 галочкой не отмечаются. Прецедент: D-70 (v1.3).

### Claude's Discretion
- Table/column names, RPC names and signatures (research suggests `portia_access_people / _requests / _audit_events`, digest-keyed definer RPCs).
- Exact daily attempt cap; request cleanup policy for stale pending rows (must not delete journal rows).
- Whether `lib/viewer.ts` / `lib/access-session.ts` land as stubs here or wait for Phase 23, as long as visitor behaviour does not change.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §Phase 21 — goal, success criteria, constraints (migration numbering and apply order, parity artifacts, owner-only production apply), acceptance gate
- `.planning/REQUIREMENTS.md` — ACC-04, ACC-09, USR-05, LVL-01, SEC-06, SEC-08; D-71 owner decisions (line 7)
- `.planning/PROJECT.md` — project decisions history

### Research (v1.4)
- `.planning/research/SUMMARY.md` — recommended stack (opaque cookie + HMAC digest, definer RPCs, no new deps), Phase 1 deliverables, open questions
- `.planning/research/ARCHITECTURE.md` — components, migrations expand/contract, parity artifacts
- `.planning/research/PITFALLS.md` — privilege abuse, definer grant hygiene, `register_attempt`
- `.planning/research/STACK.md` — `next` 16.4.5 bump notes (re-read Netlify 2026-11-03 advisory before bumping)

### Database
- `supabase/migrations/20261101000000_portia_baseline.sql` — `portia_editors`, `portia_is_owner()`, `portia_owner_email()`, `portia_can_edit()`, promo RPCs incl. `portia_promo_register_attempt`
- `supabase/migrations/20261101000100_portia_explicit_grants.sql` — explicit grant pattern incl. `service_role`
- `supabase/migrations/20261104000000_*.sql`, `20261104000100_*.sql`, `20261106000000_*.sql` — unapplied; new migration numbers after these, apply order written explicitly
- `supabase/fingerprint/portia_schema_fingerprint.sql`, `supabase/fingerprint/expected/` — must be updated with every new object

### Tests / harness
- `lib/portia-sql.test.ts`, `lib/e2e-offline-supabase-harness.test.ts`, `lib/phase16-expected-authz.test.ts`, `lib/phase16-staging-harness.test.ts`

### Promotion
- `lib/portia-device-binding.ts` — HMAC device-token pattern to reuse (distinct `access:` label)
- `lib/portia-promotion-*.test.ts` — Promotion contracts that must stay green after the revoke

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `lib/portia-device-binding.ts`: opaque token + HMAC digest helpers, reuse with a separate domain label.
- `public.portia_is_owner()` / `portia_can_edit()` (security definer, `search_path = ''`): base for owner-only flag writes and editor checks.
- `lib/editor-access.ts`: current editor/owner resolution on the server.

### Established Patterns
- Tables are `revoke all` from `anon`/`authenticated`; access only through `SECURITY DEFINER` RPCs with explicit grants (same as `portia_promo_*`).
- Editors are identified by email (`portia_editors.email`), people will be identified by nick: editors do not need a person row to resolve to level 5.
- Every new DB object updates fingerprint, `expected-authz.json`, offline harness, `portia-sql.test.ts` and `service_role` grants in the same change.

### Integration Points
- New migration after `20261106000000`; production apply is done by the owner.
- `supabase-rls-reviewer` review is mandatory before the phase is considered done.

</code_context>

<specifics>
## Specific Ideas

- Cooldown 1 hour after rejection/revocation, owner can lift it.
- Journal = decisions about people only, kept forever.

</specifics>

<deferred>
## Deferred Ideas

- Journaling closure-flag toggles — declined for now (2б); revisit if the owner wants an audit of flips in Phase 25.

### Reviewed Todos (not folded)
- `2026-11-07-nick-access-request.md` — boot-screen request belongs to Phase 23.
- `2026-11-08-access-levels.md` — item levels belong to Phase 24.
- `2026-10-28-stabilize-promotion-and-desktop-ui.md` — Promotion regressions, Phase 23.
- `2026-11-03-info-phone-sections-toggle.md`, `2026-11-07-desktop-visual-overhaul.md` — Phase 26.
- `2026-11-08-template-builder-framing-dialog.md` — Phase 23.
- `app-spravochnik.md`, `app-povyshenie.md`, `spider-body-visible-and-toggle.md`, `unified-apps-system-discuss.md` — UI/out of scope for this phase.

</deferred>

---

*Phase: 21-fundament-dostupa-lyudi-zayavki-pravila-i-zhurnal*
*Context gathered: 2026-11-09*
