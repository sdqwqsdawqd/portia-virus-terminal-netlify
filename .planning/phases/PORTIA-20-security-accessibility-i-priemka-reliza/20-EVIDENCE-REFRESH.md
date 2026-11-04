---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 29
artifact: evidence-refresh-register
head: 0929a084c13dc8cd420152c949c3332e82ed7e67
candidates_set: phase20-refresh-0929a084c13d
generated: 2026-11-04
---

# 20-EVIDENCE-REFRESH: дрейф доказательств и перепрогоны на HEAD

Зачем. Коммиты после b1d2499 (ledger 20-11) изменили окно «Повышение», глобальный CSS и предзагрузку медиа. Строки «Повышения» в 20-VISUAL-APPROVAL.md были сняты до 97d7abb и 23c1c85, а 23c1c85 добавил правило `max-width: 900px` для `html` и `.desktop`, то есть меняет все phone-кадры. Владелец не должен одобрять устаревшие байты, поэтому кандидаты сняты заново на текущем HEAD.

HEAD пересъёмки: `0929a084c13dc8cd420152c949c3332e82ed7e67`. Набор кандидатов: `phase20-refresh-0929a084c13d` (каталог `tests/e2e/visual-candidates/.runs/phase20-refresh-0929a084c13d/`, в .gitignore). Сервер: production-сборка с `PORTIA_E2E_ALLOW_HTTP=1`, порт 3100 (`PORTIA_E2E_BASE_URL`), потому что порт 3000 занят чужим процессом Next (PID 36324), который не трогался. Утверждённые эталоны `tests/e2e/visual/__screenshots__` не менялись.

## Коммиты вне планов

Коммиты после ledger 20-11 (b1d2499), сделанные вне планов Phase 20 (quick-задачи и правки владельца).

| Коммит | Файлы | Затронутые поверхности и доказательства | Действие | Результат |
|---|---|---|---|---|
| 97d7abb | app/api/promotion/banks/route.ts, app/layout.tsx, app/portia-promotion-editor.css, components/portia-promotion-editor-main.tsx, portia-promotion-ordinary-editor.tsx, portia-promotion-qualification-editor.tsx, lib/portia-promotion-editor-state.ts | Редактор и банки «Повышения»; CSS редактора подключён глобально в app/layout.tsx, поэтому он попадает в каждую страницу, а не только в окно «Повышение». Меняет строки Promotion в ledger и матрицу безопасности (маршрут банков). | Кандидаты Promotion пересняты на HEAD (promotion.spec.ts, chromium-desktop и chromium-phone). Матрица безопасности пересмотрена в 20-26. | Hash 10 из 10 кадров участника изменились; кадры с ролью проверяющего остаются BLOCKED (ENV). Прогон на HEAD `0929a084c13d`. |
| 2f54ba9 | components/portia-promotion-editor-main.tsx | Запоздалые ответы опроса очереди проверяющего игнорируются во время команд. Поведение роли проверяющего; кадров участника не меняет. | Учтён в пересъёмке Promotion и в матрице (20-26). Браузерной проверки с ролью проверяющего нет: BLOCKED (ENV). | Кадры участника сняты на HEAD; поведение проверяющего не доказано, остаётся BLOCKED (ENV). |
| 23c1c85 | app/portia-promotion-editor.css, components/portia-desktop.tsx, portia-desktop-dossier.tsx, portia-promotion-editor-main.tsx, portia-promotion-qualification-editor.tsx | Правило `max-width: 900px` для `html` и `.desktop`: затронуты все phone-кадры, а не только Promotion; редакторы банков; EmbeddedImage с eager. 20-07 уже видел падения прежних phone-эталонов. | Пересняты все наборы кандидатов (Promotion, паук, колбы, пустые состояния, иконки классов, «Информация» на телефоне); прежние эталоны перепрогнаны на HEAD (раздел «Прежние эталоны на HEAD»). | Hash phone-кандидатов изменились; падения прежних phone-эталонов классифицированы ниже. |
| 7e5e17a | components/portia-desktop.tsx | Удержание предзагрузки GIF помощницы до завершения (экраны с медиа, результаты 20-25). | Прогон 20-25 сверен с HEAD: см. «Сводка перепрогонов 20-25/20-26/20-28». | См. сводку: изменён portia-desktop.tsx, прогон 20-25 помечается устаревшим там, где он был до этого коммита. |
| 397597c | .planning/STATE.md, quick-задача | Только .planning. На доказательства не влияет. | Нет. | Не влияет. |
| f6c5844 | .planning/STATE.md, quick-задача | Только .planning. На доказательства не влияет. | Нет. | Не влияет. |

## Коммиты внутри планов после ledger 20-11 (тот же дрейф)

Они тоже меняют продуктовый код после снятия прежних кандидатов; в ledger их влияние покрывает пересъёмка на HEAD.

| План | Коммиты | Файлы (продуктовые, без *.test.ts) | Влияние на доказательства |
|---|---|---|---|
| 20-22 | 4615678 … 1da702f | app/portia.css, components/portia-editor.tsx, portia-editor-dossier.tsx, lib/editor-columns.ts, lib/editor-notes.ts | Редактор «Информация» и «Справочник»: колонки по пять, закреплённая панель добавления, личные заметки. Публичных кадров кандидатов не меняет; прогоны редактора идут на staging (BLOCKED (ENV)). |
| 20-23 | dda602c … 31276a0 | app/layout.tsx, app/portia.css, app/portia-promotion-editor.css, app/api/promotion/banks/route.ts, components/portia-editor.tsx и редакторы Promotion, lib/editor-*.ts, lib/portia-content*.ts, lib/portia-promotion-editor-state.ts | Разделы и подразделы «Сводка» и «Рекомендации»; затронут общий CSS. Пересъёмка на HEAD это учитывает. |
| 20-28 | bef5d93, 8b81221 | components/portia-desktop.tsx | Tab внутри окна квалификации. Доказательства 20-07 и 20-25 по portia-desktop.tsx старше этого изменения: проверено в сводке перепрогонов. |

## Кандидаты (было → стало)

Пересъёмка на HEAD `0929a084c13d`, набор `phase20-refresh-0929a084c13d`. В таблицу попадают строки 20-VISUAL-APPROVAL.md со статусом CANDIDATE; прежний hash сохранён в примечании строки. Кадры «до» (phase20-spider-rest-before, phase20-class-icons-before, phase20-info-phone-before и утверждённые эталоны) не переснимались: это опорные кадры сравнения.

| Набор (был) | Строк | Изменилось | Не изменилось |
|---|---|---|---|
| phase15-current-17215b3a8bae (Promotion: участник) | 10 | 10 | 0 |

Строка дрейфа: Кандидаты Promotion пересняты, изменились hash 10 из 10 (ожидаемо: глобальный CSS 23c1c85 и редакторы 97d7abb меняют кадры, включая phone). Строки promotion-participant-cards и promotion-reviewer-* остаются BLOCKED (DATA)/(ENV); указатели ведут на новые `.blocked.json` набора `phase20-refresh-0929a084c13d`.
