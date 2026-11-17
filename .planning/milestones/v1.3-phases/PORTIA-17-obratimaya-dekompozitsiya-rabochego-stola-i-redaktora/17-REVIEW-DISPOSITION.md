---
phase: 17
review: 17-REVIEW.md
titles: json
findings:
  - id: CR-01
    severity: critical
    disposition: fixed
    title: "шаг (d) e2e-спека кликает по кнопке окна, перекрытого окном «Настройки»"
  - id: WR-01
    severity: warning
    disposition: open
    title: "CLI проверки переноса молча ничего не делает и завершается с кодом 0 при запуске через симлинк или junction"
  - id: WR-02
    severity: warning
    disposition: open
    title: "проверка переноса не видит строки, удалённые из целевых файлов, и не проверяет порядок"
  - id: WR-03
    severity: warning
    disposition: open
    title: "`gitShow` скрывает все ошибки git, а разбор `import` может проглотить код"
  - id: IN-01
    severity: info
    disposition: open
    title: "`DossierSection` и `MediaBlock` экспортируются без внешних потребителей"
  - id: IN-02
    severity: info
    disposition: open
    title: "тест границ импортов проверяет только двойные кавычки и только алиас `@/components/`"
  - id: IN-03
    severity: info
    disposition: open
    title: "хрупкие source-тесты `window-open.test.ts`"
open: 6
total: 7
recorded: 2026-11-01T03:45:30.375Z
---

# Phase 17: Code Review Disposition

| Finding | Severity | Disposition | Source |
|---------|----------|-------------|--------|
| CR-01 | critical | fixed | 17-08: c278a29, taskbar bring-to-front перед закрытием в tests/e2e/specs/window-reopen.spec.ts; браузерный прогон BLOCKED (ENV) |
| WR-01 | warning | open | - |
| WR-02 | warning | open | - |
| WR-03 | warning | open | - |
| IN-01 | info | open | - |
| IN-02 | info | open | - |
| IN-03 | info | open | - |

Dispositions: `open` (recorded, not yet triaged), `fixed`, `skipped`, `deferred`.
Set `deferred` by hand and put the reason in the Source cell; both are preserved. A `|` in the reason is kept as prose and escaped on the next run.
Re-running the gate keeps every row it can. A row the current review no longer reports is kept and its Source cell flagged, so a finding does not leave this record silently. ONE exception: when a finding id is REUSED by a different finding, the earlier decision cannot keep a row — the id is taken — and it is dropped. A RECORDED decision (anything but `open`) is named on the console when that happens; a row still at `open` is replaced silently, because `open` records no decision to lose.
