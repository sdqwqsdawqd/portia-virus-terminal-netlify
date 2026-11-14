---
phase: 23
review: 23-REVIEW.md
titles: json
findings:
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
open: 8
total: 11
recorded: 2026-11-14T17:38:13.159Z
---

# Phase 23: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | fixed | 23-09 7b860cf fail-closed |
| WR-03 | warning | fixed | 23-09 97ef402 |
| WR-04 | warning | fixed | 23-09 97ef402 |
| WR-05 | warning | open | - |
| WR-06 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved.
