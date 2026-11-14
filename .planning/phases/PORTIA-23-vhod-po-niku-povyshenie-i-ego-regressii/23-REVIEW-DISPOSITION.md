---
phase: 23
review: 23-REVIEW.md
titles: json
findings:
  - id: WR-07
    severity: warning
    disposition: open
    title: "an approved or pending visitor is offered \"ПОДАТЬ ЗАЯВКУ\" (submit a request) and the status card never closes on its own"
  - id: IN-06
    severity: info
    disposition: open
    title: "`isMissingClosureFunction` is a type predicate that is false for some real `AccessStoreError` values"
  - id: IN-07
    severity: info
    disposition: open
    title: "the submit failure text can still say \"check your connection\" for a server-side refusal"
  - id: IN-08
    severity: info
    disposition: open
    title: "the status-route callback is copied into the test and nothing guards the copy"
  - id: IN-09
    severity: info
    disposition: open
    title: "the alter-column replay does not fail on forms it claims to catch"
  - id: IN-10
    severity: info
    disposition: open
    title: "brittle constants and unescaped file names in the evidence test"
  - id: WR-01
    severity: warning
    disposition: open
    title: "`app/api/promotion/test/route.ts` — GET и POST без `try/catch`, любое исключение превращается в пустой 500"
  - id: WR-02
    severity: warning
    disposition: fixed
    title: "откат в `open` по `PGRST202` — fail-open при устаревшем кэше схемы PostgREST"
  - id: WR-03
    severity: warning
    disposition: fixed
    title: "форма заявки показывает пользователю сырой текст исключения разбора JSON"
  - id: WR-04
    severity: warning
    disposition: fixed
    title: "подтверждённому редактору в воротах показывается гостевая форма заявки"
  - id: WR-05
    severity: warning
    disposition: open
    title: "`editor-request` молча подменяет гостевой cookie устройства"
  - id: WR-06
    severity: warning
    disposition: open
    title: "`portia-promotion.tsx` — залипание «Проверяем доступ…» и сентинел в `checkedNickname`"
  - id: IN-01
    severity: info
    disposition: open
    title: "`device-busy`, `unauthorized`, `unavailable` отдаются как HTTP 503"
  - id: IN-02
    severity: info
    disposition: open
    title: "форма заявки редактора теряет причину отказа при `cooldown`/`throttled`"
  - id: IN-03
    severity: info
    disposition: open
    title: "`import` в середине и в конце файла"
  - id: IN-04
    severity: info
    disposition: open
    title: "`AccessStoreError.code` хранит сообщение, а `sqlState` — код PostgREST"
  - id: IN-05
    severity: info
    disposition: open
    title: "дублирующее CSS-правило и переименованный «пин» хэша"
open: 14
total: 17
recorded: 2026-11-14T21:45:51.435Z
---

# Phase 23: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-07 | warning | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |
| IN-08 | info | open | - |
| IN-09 | info | open | - |
| IN-10 | info | open | - |
| WR-01 | warning | open | - (not in the current review) |
| WR-02 | warning | fixed | 23-09 7b860cf fail-closed (not in the current review) |
| WR-03 | warning | fixed | 23-09 97ef402 (not in the current review) |
| WR-04 | warning | fixed | 23-09 97ef402 (not in the current review) |
| WR-05 | warning | open | - (not in the current review) |
| WR-06 | warning | open | - (not in the current review) |
| IN-01 | info | open | - (not in the current review) |
| IN-02 | info | open | - (not in the current review) |
| IN-03 | info | open | - (not in the current review) |
| IN-04 | info | open | - (not in the current review) |
| IN-05 | info | open | - (not in the current review) |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
