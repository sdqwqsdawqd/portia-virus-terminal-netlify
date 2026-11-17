# Quick Task 261117-px5: Promotion — candidate starts the qualification test himself, with rules; compact clear question builder - Context

**Gathered:** 2026-11-17
**Status:** Ready for planning

<domain>
## Task Boundary

«Повышение», qualification check only (ordinary promotion tasks are out of scope).

1. Candidate side: after the reviewer confirms the question set, the candidate does NOT start immediately. He sees a pre-start screen with the rules and a «НАЧАТЬ ПРОВЕРКУ» button; the 15-minute timer starts only when he presses it.
2. Editor side: the qualification question builder (single / multiple / free-text) becomes compact and understandable.

Owner request (Russian, paraphrased): the check should begin not when the reviewer issues it, but when the candidate presses "start" on his side — until then he just has the opportunity; he passes it on the site under supervision, and all rules are stated there. Creating questions is hard: options are typed oddly, the form takes a lot of space, it is unclear how to build a test.

</domain>

<decisions>
## Implementation Decisions

### Start of the test (verified in code, not a choice)
- Today `QualificationRunner` (components/portia-promotion.tsx:105-116) POSTs `action: "start"` on mount, so the timer runs as soon as the card renders.
- The deadline is set in the database at start (`portia_promo_start_test`, baseline.sql:1173: `deadline_at = now() + interval '15 minutes'`), NOT at confirm. So deferring the start is a client change: the runner must not call start on mount; it shows the pre-start screen and calls start on the button.
- Check what the current-test projection returns for a confirmed-but-not-started attempt and render the pre-start screen from that state (no start call on mount, no heartbeat, no blur/visibility failure listeners and no navigation lock before start).

### Supervision — 1a
- Keep the current supervision exactly: PC — leaving the tab/window ends the attempt as failed; phone — switching apps allowed, going offline ends it. No live reviewer view, no stricter phone rules.
- The pre-start screen states these rules explicitly (PC vs phone, 15 minutes, number of questions, one question at a time, answers cannot be changed, what happens on leaving/offline/timeout).

### Rules text — 2b (editable per transition)
- The editor can write the rules text for each qualification transition (Стажёр→Лаборант, Исследователь→Ассистент, Научный сотрудник→Специалист вирусолог — `qualificationPromotionTransitions`).
- Stored in the database next to the qualification bank of that transition (new nullable text column, length-limited, e.g. ≤ 4000 chars). Saved via the existing bank save flow (`save-qualification-bank`) or a sibling action; editor-only write, as bank writes are today.
- The candidate receives the rules for his attempt through the existing signed server path (the current-test projection or the server route), never by direct anon table read.
- The fixed supervision lines (15 minutes, PC/phone behaviour) are always shown by the site in addition to the editor text; if the editor text is empty, only the fixed lines are shown.
- This needs a NEW migration file in supabase/migrations/ (do not edit applied ones). Per CLAUDE.md: no production/staging application by the agent — the file is written and tested offline only; applying it is the owner's step and stays ОЖИДАЕТ ВЛАДЕЛЬЦА / BLOCKED. Any fingerprint / canonical-parity / expected-authz tests that pin the schema must be updated consistently. Run the `supabase-rls-reviewer` agent on the new SQL.
- The site must keep working if the migration is not yet applied (column missing): rules fall back to the fixed lines; saving rules shows a clear refusal instead of breaking bank saving.

### Question builder — 3a
- Question type chosen with three compact segmented buttons (Один ответ / Несколько / Свободный).
- Each option is its own row: text input + a "correct" mark next to it (radio for single, checkbox for multiple) + a remove ✕. Below: «+ ВАРИАНТ». Between 2 and 8 options; empty options are not allowed to be saved (no hidden blank fields).
- Free-text: one field «Образец ответа для проверяющего».
- The form opens in a separate dialog/window by a «+ ВОПРОС» button (and «ИЗМЕНИТЬ» on a row opens the same dialog filled in), instead of hanging under the list.
- The bank list becomes the main surface: compact rows, full width.

### Claude's Discretion (question 4 not answered)
- Make quotas understandable: one plain line like «В тесте: 3 с одним ответом · 1 с несколькими · 1 свободный — в банке хватает ✓» (or what is missing), and saving quotas that the active bank cannot satisfy is blocked with that explanation. Keep the existing server rules and data shape.
- Exact copy of the fixed supervision lines (owner will adjust wording later).

</decisions>

<specifics>
## Specific Ideas

- Owner memory rules: use full space (no empty areas, no narrow caps), compact controls (no oversized buttons); report visual changes as text, no review galleries.
- All UI copy in Russian, uppercase button style as in the rest of «Повышение».
- Existing editor tests pin the qualification editor's behaviour (lib/portia-promotion-editor.test.ts, lib/portia-promotion-ui.test.ts etc.) — update them to the new builder rather than deleting coverage.

</specifics>

<canonical_refs>
## Canonical References

- components/portia-promotion-qualification-editor.tsx — current builder
- components/portia-promotion.tsx — QualificationRunner and the candidate card
- app/api/promotion/test/route.ts, app/api/promotion/banks/route.ts — server routes
- supabase/migrations/20261101000000_portia_baseline.sql (portia_promo_start_test, banks), supabase/migrations/20261113000000_portia_access_promotion.sql (signed promo functions)
- CLAUDE.md hard rules (no production DB, stage by explicit path, BLOCKED never PASS)

</canonical_refs>
