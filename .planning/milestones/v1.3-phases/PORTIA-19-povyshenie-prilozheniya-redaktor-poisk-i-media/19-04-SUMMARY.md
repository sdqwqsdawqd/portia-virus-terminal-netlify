---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 04
subsystem: ui
tags: [promotion, participant-ui, availability-text, qualification, notifications]
requires:
  - phase: 19-01
    provides: owner verdicts 10 (A, keep server texts) and 11 (approved PC/phone warning texts)
provides:
  - promotionAvailabilityText (device-time "Следующая заявка будет доступна ДД.ММ.ГГГГ в ЧЧ:ММ", null otherwise)
  - participant card with deadline line, PC/phone mode warning, cleanup hint, created-only submit success
  - tests pinning refusal codes, check order, safe projections, single retake notification
affects: [19-05 reviewer confirmations, 19-06 owner UAT, 19-14 320px wrap backstop]
status: complete
actuals:
  tokens: 4500
  tasks: 3
  commits: 5
plan_head_before: 7e1e66900cff0384ffe290144b0b543e20ebf891
plan_head_after: b118418acbdbc0f31e3a336b513dd43d2438a0e9
tech-stack:
  added: []
  patterns:
    - "Pure helper in lib/ returning null for 'render nothing', component falls back to a stable reason"
key-files:
  created: []
  modified:
    - lib/portia-promotion.ts
    - lib/portia-promotion.test.ts
    - components/portia-promotion.tsx
    - lib/portia-promotion-ui.test.ts
    - lib/portia-promotion-api.test.ts
    - lib/portia-qualification-ui.test.ts
    - lib/portia-promotion-notifications.test.ts
    - app/portia.css
key-decisions:
  - "Verdict 10 = A: server refusal texts and codes left untouched; only tests added."
  - "Verdict 11 = approved: PC and phone texts verbatim; shown inside the running attempt by test.clientMode, and both (labelled ПК / Телефон) in the pre-attempt block where the server mode is not yet known."
  - "Submit success requires response.ok AND a string requestId in the body (createdRequest); the server answers 201 with requestId on creation, there is no literal 'created' field."
requirements-completed: []
coverage:
  - id: D1
    description: "promotionAvailabilityText: format, null for missing/invalid/passed/now, no '..', 'Invalid', double gaps"
    requirement: STAB-PROM-02
    verification:
      - kind: unit
        ref: "lib/portia-promotion.test.ts"
        status: pass
    human_judgment: false
  - id: D2
    description: "Cooldown and failed-retake cards use the helper; no date means no deadline line; formatCalendarDate removed"
    requirement: STAB-PROM-02
    verification:
      - kind: unit
        ref: "lib/portia-promotion-ui.test.ts"
        status: pass
    human_judgment: false
  - id: D3
    description: "Seven refusals have pairwise distinct code and text, only not-listed says 'не найден'; blank and 65-char nickname refuse with no roster or write call; access roster is checked before promotion roster before database"
    requirement: STAB-PROM-14
    verification:
      - kind: unit
        ref: "lib/portia-promotion-api.test.ts"
        status: pass
    human_judgment: false
  - id: D4
    description: "Mode warning texts (owner verdict 11), cleanup hint, history capped at 3, no 'аттестац'/'hardware', success text only after the created check"
    requirement: STAB-PROM-08
    verification:
      - kind: unit
        ref: "lib/portia-promotion-ui.test.ts"
        status: pass
    human_judgment: false
  - id: D5
    description: "Participant status body and qualification projection carry no linked nickname, keys, notes, reviewer identity, other questions or given answers"
    requirement: STAB-PROM-11
    verification:
      - kind: unit
        ref: "lib/portia-promotion-api.test.ts"
        status: pass
      - kind: unit
        ref: "lib/portia-qualification-ui.test.ts"
        status: pass
    human_judgment: false
  - id: D6
    description: "Retake notification once per attemptId; two calls with the same now keep one record; reload restores the server deadline; timeout set once"
    requirement: STAB-PROM-12
    verification:
      - kind: unit
        ref: "lib/portia-promotion-notifications.test.ts"
        status: pass
    human_judgment: false
  - id: D7
    description: "Real device behaviour: 320px wrapping of warning/reasons/hint, server-side one-shot and CAS (STAB-PROM-07), authenticated reviewer flows, Postgres/RLS"
    requirement: STAB-PROM-07
    verification: []
    human_judgment: true
    rationale: "BLOCKED. 320px wrap is the 19-14 backstop; server-side behaviour and staging proof belong to 19-06/19-07. Nothing here ran against Postgres or a browser."
---

# Phase 19 Plan 04: Participant Promotion UI Summary

**Participant "Повышение" now shows a correct device-time deadline line, the owner-approved PC/phone warning, the cleanup hint and a submit success only after the server created the request; refusal codes, check order and projections are pinned by tests.**

## What was built

- `lib/portia-promotion.ts`: `promotionAvailabilityText(iso, now)` with two `Intl.DateTimeFormat("ru-RU")` formatters (dd.mm.yyyy, hh:mm with `hourCycle: "h23"`, device time zone, no suffix). Returns `null` for missing, invalid, equal-to-now or past dates.
- `components/portia-promotion.tsx`:
  - cooldown card and failed-retake card use the helper; with no usable date they show "Повышение сейчас недоступно." and "Повторная проверка будет доступна по решению проверяющего." respectively; `formatCalendarDate`, `calendarDate` and the trailing-dot `replace` are gone (`formatDate` stays for the history, Moscow time).
  - `.promotion-mode-warning` with the approved texts: inside the running attempt by `test.clientMode`, and both labelled lines in the pre-attempt block.
  - `.promotion-cleanup-hint` under the card list, before the history (history already capped at 3).
  - `createdRequest(body)`: the "отправлена в очередь" feedback is produced only when `response.ok` and the body carries a string `requestId`; otherwise the error branch with the server text.
- `app/portia.css`: `.promotion-mode-warning` (13px/1.5, 400, `--warning`) and `.promotion-cleanup-hint` (11px/1.25, 700, .06em, `--muted`), both `overflow-wrap: anywhere`.
- Tests: availability text (2), UI source (4 new, 3 updated), API (4 new: refusal matrix, validation-first, check order, hostile projection), qualification UI (3 new), notifications (3 new).

## Verification

- `npm test`: 946 pass, 0 fail. `npm exec tsc -- --noEmit`: clean. `npm run lint`: 0 errors, 18 pre-existing warnings (none in promotion files). `npm run build`: passes. `node --experimental-strip-types --test lib/accent-theme.test.ts`: 31 pass.
- `grep -ci "аттестац|hardware" components/portia-promotion.tsx` = 0.
- Nothing was run against a browser, staging or Postgres.

## Deviations from Plan

None in code. Process notes:

- Task 1 and Task 2 have a RED commit (125209b, 347bf46) before the GREEN commit. For Task 2 the API tests (refusal matrix, order, validation, projection) and for Task 3 all tests are characterization tests: the behaviour already existed and they passed on first run, so only the UI tests were genuinely red. Task 3 needed no code change.
- Plan wording "only in the `created` branch": the API has no literal `created` field in the HTTP body (201 + `requestId` + `status: "pending"`); the client check is therefore `response.ok` + `requestId`.

## Known limits and open items for 19-06

- **Auto-start of the attempt.** `QualificationRunner` calls the `start` action as soon as the card has an `attemptId`, so there is no screen before the first question; the mode warning is shown on the first-question screen and the pre-attempt "15 МИНУТ" block. A true "read, then press Start" step would change the attempt flow (Rule 4 territory) and is left for the owner to decide.
- The server mode (`clientMode`) is not part of the status projection, so the pre-attempt block shows both labelled texts instead of one.
- A failed attempt whose `availableAt` is already past (with no request button because `canRequest` requires no active request) shows the "по решению проверяющего" line; the retake-open notification covers this case, but the card has no retake button. Pre-existing gap, not changed here.
- Requirements STAB-PROM-01..04, 06..08, 11..14 are NOT marked complete: this plan is the client part; server one-shot/CAS and live behaviour are proven in 19-06/19-07.

## Known Stubs

None.

## Threat Flags

None.

## Self-Check: PASSED

- Files: lib/portia-promotion.ts, components/portia-promotion.tsx, app/portia.css and the five test files exist.
- Commits found in HEAD: 125209b, c61f463, 347bf46, 7a18f17, b118418.
