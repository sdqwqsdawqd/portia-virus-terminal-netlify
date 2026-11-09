---
phase: 19-povyshenie-prilozheniya-redaktor-poisk-i-media
plan: 22
subsystem: promotion-staging-teardown
tags: [promotion, staging, cleanup, evidence]
requires:
  - phase: 19-21
    provides: owner PC and phone UAT verdicts
provides:
  - zero-residual teardown of isolated run mw1loqa9_c9451c80
  - explicit remaining evidence gaps for STAB-PROM-13 and STAB-PROM-15
affects: [STAB-PROM-13, STAB-PROM-15]
requirements-completed: []
completed: 2026-11-04
status: complete-with-evidence-gaps
---

# 19-22: Удаление временного staging run

Владелец разрешил удалить временный staging run ответом «удалить временный staging». Перед действием `attest` подтвердил refHash `01d085e7b9f0`; отдельный read-only `acceptance-residual` показал `promo=5, editors=2, storage=0, content=0, authUsers=2, banks=4, buckets=2, attempts=1, answers=5` для run `mw1loqa9_c9451c80`.

Guarded `acceptance-teardown mw1loqa9_c9451c80` удалил только данные этого run и вернул `errors=[]`. Отдельный вызов `acceptance-residual` после удаления показал нули во всех девяти категориях. Receipt сохранён в `evidence/19-ACCEPTANCE-TEARDOWN-RERUN.json`. Временные данные и учётные записи run больше не доступны.

STAB-PROM-13 и STAB-PROM-15 оставлены Pending. Владелец подтвердил PASS физического прогона на PC и phone, однако журнал `acceptance-shift` для шагов с deadline, retake, cooldown, penalty и cleanup пуст. Нельзя документально подтвердить временные границы и очистку по D-03. Новый прогон этих проверок потребует нового временного run; seed не запускался.
