# Architecture Research

**Domain:** два управляемых workflow внутри существующей PORTIA OS
**Researched:** 2026-10-27
**Confidence:** HIGH

## System Overview

```
Public Promotion App
  ├─ nickname/status/request
  ├─ promotion assignment view
  └─ qualification test runner
             │
             ▼
Next.js Route Handlers ── eligibility reader ── Google Sheet A61:E85 (read only)
             │
             ├─ authorization / trusted promo tab
             ├─ transition guards / server clock
             └─ Supabase repositories
                    ├─ config + banks
                    ├─ active promotion workflows
                    ├─ active qualification attempts
                    └─ result history (max 3 per nickname)
             ▲
Reviewer Tab «Повышение»
  ├─ Запросы
  ├─ Задания
  ├─ Проверки
  └─ Банки и настройки
```

## Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| Eligibility reader | Parse only A61:E85, normalize titles/dates, return eligibility without side effects |
| Promotion state machine | request → approved → assigned → completed/closed |
| Qualification state machine | request → approved → in_progress → awaiting_review → passed/failed |
| Policy module | Cooldowns, retake dates, one-active constraint, 3-day expiry |
| Test runner | One question at a time, server deadline, forward-only answers, desktop visibility guard |
| Reviewer API | Trusted-tab authorization and idempotent transitions |
| Cleanup service | Delete stale active payloads and trim history to three results |
| Notification selector | Derive assignment/retake-ready notices without duplicating them |

## Data Model Boundaries

Recommended separate tables or strongly separate repositories:

- `portia_promotion_config`: titles, cooldowns, required assignment count.
- `portia_promotion_tasks`: task bank keyed by target title.
- `portia_qualification_questions`: question bank keyed by rank transition and question type.
- `portia_promotion_requests`: active ordinary promotion workflow.
- `portia_qualification_attempts`: active/test/review workflow; answer payload removed on close.
- `portia_promotion_results`: short immutable outcome rows, pruned to three per normalized nickname.

Do not store these inside `portia_content`: independent writes, sensitive answers and cleanup rules conflict with the content revision model.

## State Machines

### Promotion

```
requested → reviewer_approved → assignment_preview → assigned
→ completion_requested → approved_for_promotion → closed
```

Random preview is transient or expiring server state. Only reviewer confirmation freezes the assignment.

### Qualification

```
requested → reviewer_approved → in_progress
→ awaiting_review → passed | failed
failed → cooldown → eligible
```

Every transition checks current persisted state and requester role. Repeated requests use idempotency keys or compare expected state.

## Key Data Flows

1. **Public request:** normalize nickname → read sheet → evaluate current title/date/cooldown → reject without DB write or create one active request.
2. **Issue assignments:** trusted reviewer chooses/manual-random → server validates required count → preview → confirm → immutable assigned list.
3. **Start test:** reviewer authorizes → server creates attempt and deadline → participant fetches one question at a time.
4. **Answer:** server checks attempt state, question index and deadline; stores answer then advances exactly one position.
5. **Focus failure:** desktop sends failure event; server closes attempt as failed. Phone omits this rule.
6. **Review:** trusted reviewer marks each answer correct/incorrect, sees percentage, manually selects final result and retake date.
7. **Close/cleanup:** remove detailed payload, append short result, keep newest three.

## Project Structure

```
lib/
  portia-promotion-types.ts
  portia-promotion-policy.ts
  portia-promotion-sheet.ts
  portia-promotion-state.ts
  portia-promotion-repository.ts
app/api/promotion/
  status/route.ts
  requests/route.ts
  assignments/route.ts
  attempts/route.ts
  review/route.ts
components/
  portia-promotion.tsx
  portia-promotion-editor.tsx
supabase/
  phase14_apply.sql
```

## Integration Points

- Add `promo` as `kind: "trusted"` in `tabRegistry`; it stays closed unless granted.
- Reviewer APIs must use `getEditorAccess` and require `openTabs.includes("promo")`.
- Public endpoints reveal only data intentionally available by nickname; never answers, correct options, reviewer notes or banks.
- Desktop window and shortcut use existing independent-position and motion contracts.
- Retake-ready notice reuses the corner-notification interaction, with a separate seen key.

## Build Order

1. Pure domain types/policies and SQL schema/RLS.
2. Sheet eligibility reader and public status/request API.
3. Reviewer permissions, queues and banks.
4. Ordinary assignment workflow.
5. Qualification runner and focus guard.
6. Manual review, history, cleanup and notifications.
7. Browser/UAT verification on PC and phone.

## Sources

- Local API, permission, content and employee modules
- Existing SQL apply/rollback pattern from Phase 12
- Owner-approved milestone model

---
*Architecture research for: PORTIA v1.2 «Повышение»*
*Researched: 2026-10-27*

