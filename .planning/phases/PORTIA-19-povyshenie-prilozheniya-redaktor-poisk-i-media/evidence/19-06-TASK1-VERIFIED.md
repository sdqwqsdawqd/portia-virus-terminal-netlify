# 19-06 Task 1: seed досверен (read-only)

Дата: 2026-11-03. Статус: PASS (Task 1 verify), `evidence/19-06-RESUME-BLOCKED.md` заменён этой записью (файл сохранён как история).

Все команды выполнены через guarded wrapper `scripts/phase16-staging.mjs`, по одной, в точной форме из STAGING_FORMS.

| Шаг | Команда (подкоманда) | Результат |
|-----|----------------------|-----------|
| 1 | `attest` | exit 0, `{"status":"ATTESTED","refHash":"01d085e7b9f0"}`; refHash совпадает с манифестом |
| 2 | `self-test-production-block` | `{"checked":1,"blocked":1}`, checked == blocked |
| 3 | `acceptance-residual mvz5fqgv_c40b449b` (read-only) | `{"promo":0,"editors":2,"storage":0,"content":0,"authUsers":2,"banks":4,"buckets":0,"attempts":0,"answers":0}` |
| 4 | `scan-evidence <каталог фазы>` | `{"files_with_findings":0,"findings":0}` |

Сверка с манифестом `19-ACCEPTANCE-RUN.json` (runId `mvz5fqgv_c40b449b`, createdAt `2026-11-02T11:01:51.781Z`):

- Банки: manifest перечисляет 1 ordinary и 3 qualification = 4; residual `banks: 4`. Данные run на месте. Второго seed нет (иначе было бы 8 банков и второй манифест).
- Проверяющий с promo и редактор без promo: `authUsers: 2`, `editors: 2`.
- `buckets`, `attempts`, `answers`, `promo` = 0: поток ещё не проходился, сдвигов дат нет (`shiftedBucketKeys: []`).
- Временные файлы run (`roster.json`, `credentials.json`) присутствуют во временной папке ОС; содержимое `credentials.json` не открывалось и не печаталось.

Не выполнялось и не будет выполняться в 19-06: повторный `acceptance-seed`, `acceptance-teardown` (принадлежит 19-07 после «принято» владельца), любые ручные записи на staging.
