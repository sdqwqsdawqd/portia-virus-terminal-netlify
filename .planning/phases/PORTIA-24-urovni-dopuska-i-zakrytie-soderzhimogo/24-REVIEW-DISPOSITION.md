---
phase: 24
review: 24-REVIEW.md
titles: json
findings:
  - id: WR-01
    severity: warning
    disposition: open
    title: "На телефоне тело открытого раздела «Информации» недостижимо, если все его подразделы закрыты"
  - id: WR-02
    severity: warning
    disposition: open
    title: "В `LevelPicker` с `caption` элемент `<legend>` не первый потомок `<fieldset>`: группа теряет имя"
  - id: WR-03
    severity: warning
    disposition: open
    title: "Показ уровня по умолчанию «5» для копии без маркера (fail-open на отображении)"
  - id: IN-01
    severity: info
    disposition: open
    title: "`reconcileSelection` не держит заглушку, если после потери записи закрылся и её родитель"
  - id: IN-02
    severity: info
    disposition: open
    title: "`normalizeDocumentLinks` обещает больше, чем проверяет"
  - id: IN-03
    severity: info
    disposition: open
    title: "Кэш после сохранения не содержит `documents`"
  - id: IN-04
    severity: info
    disposition: open
    title: "Дублирование сборки зависимостей `resolveGate` в двух маршрутах"
  - id: IN-05
    severity: info
    disposition: open
    title: "Устаревший комментарий и дубли литералов ключей кэша"
  - id: IN-06
    severity: info
    disposition: open
    title: "Секрет слота требуется на пути редактора, где слоты не нужны"
  - id: IN-07
    severity: info
    disposition: open
    title: "Ответ 401 обрабатывается без проверки порядка запросов"
open: 10
total: 10
recorded: 2026-11-15T12:42:03.717Z
---

# Phase 24: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |
| IN-04 | info | open | - |
| IN-05 | info | open | - |
| IN-06 | info | open | - |
| IN-07 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
