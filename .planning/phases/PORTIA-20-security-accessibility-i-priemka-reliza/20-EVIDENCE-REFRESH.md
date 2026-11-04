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
| 7e5e17a | components/portia-desktop.tsx | Удержание предзагрузки GIF помощницы до завершения (экраны с медиа, результаты 20-25). | Прогон 20-25 сверен с HEAD: см. «Сводка перепрогонов 20-25/20-26/20-28». | Прогон 20-25 (03be5e3) уже включает 7e5e17a; его устаревание вызвано не этим коммитом, а правкой portia-desktop.tsx в 20-28: прогон помечен устаревшим в сводке. |
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

| Набор (был) | Что внутри | Строк | Изменилось | Не изменилось |
|---|---|---|---|---|
| phase15-current-17215b3a8bae | Promotion: участник (вход, E4 состояния) | 10 | 10 | 0 |
| phase20-spider-art | Паук: акценты, spider-off, full-walk, mid-step-off (20-03) | 12 | 9 | 3 (все PC) |
| phase20-spider-rest-after | Паук в покое, «после» (D-45) | 4 | 3 | 1 (PC, Выключены) |
| phase15-current-f20dac6e8c6a | Фон «Лабораторные колбы» (20-04) | 12 | 6 | 6 (все PC) |
| phase15-current-6e995e6e2112 | Рисунки пустых состояний: колба и микроскоп (20-05) | 16 | 14 | 2 (PC, статичные) |
| phase20-class-icons-after | Девять иконок классов, «после» (20-20) | 15 | 6 | 9 (все PC) |
| phase20-info-phone-after | «Информация» на телефоне, «после» (20-16) | 4 | 4 | 0 |
| Итого | | 73 | 52 | 21 |

Закономерность: PC-кадры в основном не изменились, phone-кадры изменились почти все. Это согласуется с правилом `max-width: 900px` из 23c1c85, которое действует на телефонную ширину. Кадр spider-full-walk (поза зависит от момента кадра) по hash невоспроизводим и в числе изменившихся не доказывает регрессию.

Старые рисунки для сравнения в строках пустых состояний (empty-art-quests-old-flask и empty-art-search-old-microscope, набор phase15-current-6e995e6e2112) пересняты тем же прогоном: у всех 16 строк их hash изменился; прежний hash записан в примечании. Наборы «до» (phase20-spider-rest-before, phase20-class-icons-before, phase20-info-phone-before) и утверждённые эталоны не переснимались.

Резкость паука «как есть» на новом spider-rest-sharpness.json совпала с прежней «после» (PC: 1.112 Выключены, 1.121 стоит; phone: 1.276 и 1.268); порог 0.9 не менялся.

Команды съёмки (HEAD `0929a084c13d`, сервер на порту 3100): `npm.cmd run test:e2e:candidates -- --retries=0 --project=chromium-desktop --project=chromium-phone tests/e2e/visual-candidates/promotion.spec.ts` и `... --project=webkit-phone tests/e2e/visual-candidates/info-phone.spec.ts` с `PORTIA_VISUAL_SET_ID=phase20-refresh-0929a084c13d`. Скрипт `test:e2e:candidates` уже содержит каталог `tests/e2e/visual-candidates`, поэтому указанный спек не сузил запуск: прошли все спеки каталога на chromium-desktop и chromium-phone (179 passed, 37 skipped, 0 failed) и на webkit-phone (20 passed, 88 skipped, 0 failed). Этого достаточно для пакета: в наборе есть кадры phase20-art, phase20-empty-art, phase20-class-icons, info-phone и promotion.

Строка дрейфа: Кандидаты Promotion пересняты, изменились hash 10 из 10 (ожидаемо: глобальный CSS 23c1c85 и редакторы 97d7abb меняют кадры, включая phone). Строки promotion-participant-cards и promotion-reviewer-* остаются BLOCKED (DATA)/(ENV); указатели ведут на новые `.blocked.json` набора `phase20-refresh-0929a084c13d`.

Строка дрейфа: Кандидаты остальных наборов (паук, колбы, пустые состояния, иконки классов, «Информация» на телефоне) пересняты на том же HEAD; изменились hash 42 из 63. Всего по ledger: изменились 52 из 73 кандидатных строк, 21 без изменений. BLOCKED-строки остались BLOCKED (DATA/ENV/CAPTURE), в том числе иконки классов «Поведение» на телефоне (панель по-прежнему под панелью задач) и все кадры проверяющего.

## Проверка свежести в тесте ledger

`lib/phase20-visual-approval.test.ts`: поле candidates_commit обязательно (40 hex, `git cat-file -e` и `git merge-base --is-ancestor <commit> HEAD` завершаются кодом 0; ненулевой код git это ошибка проверки), а `staleCandidateProblems(commit, { changedSince })` с реализацией `git diff --name-only <commit> HEAD -- app components public lib` (без *.test.ts; ненулевой код git это ошибка) в строгом режиме `PORTIA_REQUIRE_APPROVAL=1` отвергает вердикт сообщением «stale candidates: <файл> changed since <commit>». В обычном режиме результат выводится через `t.diagnostic`. Фикстуры: нет изменений, изменённый components/portia-desktop.tsx, игнорируемые тестовые и внешние файлы, падение git, строгий и обычный режим.

## Прежние эталоны на HEAD

Утверждённые эталоны (33 файла в `tests/e2e/visual/__screenshots__`) перепрогнаны на HEAD `0929a084c13dc8cd420152c949c3332e82ed7e67` без флага обновления снимков, `--retries=0`, production-сборка с `PORTIA_E2E_ALLOW_HTTP=1` на порту 3100:

- `npm.cmd run test:e2e:visual -- --retries=0` (chromium-desktop, chromium-dpr125): 8 passed, 8 failed, 14 skipped (на chromium-dpr125 пропуск «Phase 15 pixel authority is pinned to chromium-desktop», кроме двух тестов desktop.spec).
- `npm.cmd run test:e2e -- --retries=0 --project=chromium-phone --project=webkit-phone --project=firefox-desktop tests/e2e/visual`: 0 passed, 5 failed, 40 skipped (авторитет пикселей закреплён за chromium-desktop; не пропускаются только два теста desktop.spec).
- После обоих прогонов `git status --porcelain -- tests/e2e/visual/__screenshots__` пуст, `git diff --exit-code --stat HEAD -- tests/e2e/visual/__screenshots__` завершается кодом 0.

Оговорка о полноте. Тест «approved desktop and window shell» останавливается на первом расхождении (desktop-clean), поэтому следующие снимки этого теста гейт не проверил. Для них число пикселей получено тем же компаратором гейта (getComparator из playwright-core и допуски из `tests/e2e/fixtures/visual-policy.ts`) по кадру кандидатного прогона того же сценария; в таблице они помечены «оценка». Там, где гейт дошёл до снимка, оценка совпала с его числом (294, 275, 411, 310 точно; 393 и 395 против 394; 542 против 537).

Классы. (а) расхождение объяснено документированным изменением продукта после утверждения эталона. Класс (а) здесь шире текста плана: кроме паука 20-03 и рисунков пустых состояний 20-05 в него попали значки в покое и «virus icon smaller» из Phase 18/19, потому что эталоны Phase 15 не обновлялись в Phase 16-19. (б) расхождение не объяснено редизайном (данные цели, неизолированная причина). Атрибуция сделана по области отличий на diff-кадре и истории коммитов, не A/B-прогоном.

| Снимок | Проект | Результат | Пикселей (допуск) | Класс | Причина и действие |
|---|---|---|---|---|---|
| application-broadcasts | chromium-desktop | FAIL | 4326 (2300) | (а) | новый рисунок колбы и текст пустого состояния 20-05, паук 20-03; строка rebaseline-application-broadcasts--chromium-desktop:pc |
| application-charter | chromium-desktop | PASS | 0 | - | - |
| application-employees | chromium-desktop | PASS | 0 | - | - |
| application-guide | chromium-desktop | FAIL | 5000 (2300) | (а) | новый рисунок микроскопа и текст пустого состояния 20-05, паук 20-03; строка rebaseline-application-guide--chromium-desktop:pc |
| application-information | chromium-desktop | FAIL | 43446 (2300) | (б) | отличается содержимое окна (текст статьи, переносы строк, список подразделов), не только оформление; блокер B1 |
| application-search | chromium-desktop | PASS | 0 | - | - |
| application-settings | chromium-desktop | PASS | 0 | - | - |
| application-table | chromium-desktop | PASS | 0 | - | - |
| application-trash | chromium-desktop | FAIL | 9865 (2300) | (б) | отличаются имена и строки списка (содержимое живой цели); блокер B2 |
| application-virus-archive | chromium-desktop | FAIL | 4457 (2300) | (б) | эталон показывает одну запись «НОВЫЙ ВИРУС» (ревизия 205), цель отдаёт три записи (МОРОК, АРАХНА, КАЛЛИСТО); различие данных цели; блокер B3 |
| desktop-clean | chromium-desktop | FAIL | 294 (256) | (а) | значок «База вирусов» и значок кнопки «Настройки» на панели задач; строка rebaseline-desktop-clean--chromium-desktop:pc |
| desktop-start-open | chromium-desktop | не проверен гейтом, оценка PASS | 0 (256) | - | тест остановился на desktop-clean |
| editor-signed-out-login | chromium-desktop | PASS | 0 | - | - |
| editor-visitor-denied | chromium-desktop | PASS | 0 | - | - |
| motion-vivian-activity, motion-vivian-idle, motion-vivian-offended, motion-vivian-recovery, motion-web-rest | chromium-desktop | PASS (один тест) | 0 | - | - |
| promotion-participant-lookup | chromium-desktop | PASS | 0 | - | - |
| desktop-clean | chromium-dpr125 | FAIL | 393 (256) | (а) | значок «База вирусов», панель задач; строка rebaseline-desktop-clean--chromium-dpr125:pc |
| desktop-dpr125 | chromium-dpr125 | FAIL | 395 (256) | (а) | то же; строка rebaseline-desktop-dpr125--chromium-dpr125:pc |
| desktop-start-open | chromium-dpr125 | не проверен гейтом, оценка PASS | 0 (256) | - | тест остановился на desktop-clean |
| desktop-clean | chromium-phone | FAIL | 542 (256) | (а) | значок «База вирусов» и значок кнопки на панели задач; строка rebaseline-desktop-clean--chromium-phone:phone |
| desktop-start-open | chromium-phone | не проверен гейтом, оценка FAIL | 508 (256) | (а) | отличается значок «База вирусов» в сетке и в меню; строка rebaseline-desktop-start-open--chromium-phone:phone |
| phone-chromium | chromium-phone | FAIL | 310 (256) | (а) | значок «База вирусов» и несколько точек; то же число в 20-07, правила 20-07 не причина; строка rebaseline-phone-chromium--chromium-phone:phone |
| desktop-start-open | webkit-phone | FAIL | 411 (256) | (а) | значок «База вирусов» в сетке и в меню; строка rebaseline-desktop-start-open--webkit-phone:phone |
| phone-webkit | webkit-phone | FAIL | 54239 (256) | (б) | в эталоне видна вертикальная полоса прокрутки страницы и весь экран сдвинут на 30 px вправо; на HEAD полосы нет; причина не изолирована; блокер B4 |
| desktop-clean | firefox-desktop | FAIL | 275 (256) | (а) | значок «База вирусов»; строка rebaseline-desktop-clean--firefox-desktop:pc |
| desktop-start-open | firefox-desktop | не проверен гейтом, оценка PASS | 0 (256) | - | тест остановился на desktop-clean |
| window-search-restored | firefox-desktop | не проверен гейтом, оценка FAIL | 867 (256) | (б) | меняются подписи строки «Рекомендации» (содержимое), плюс значок; блокер B5 |
| window-search-maximized | firefox-desktop | не проверен гейтом, оценка FAIL | 777 (256) | (б) | меняются подписи строки «Рекомендации»; блокер B5 |
| window-search-minimized | firefox-desktop | не проверен гейтом, оценка PASS | 0 (256) | - | - |

Счёт по 33 файлам: гейт проверил 26 (13 совпали, 13 упали), 7 не проверены (по оценке 4 совпали, 3 нет). Красных снимков 16: 10 объяснены классом (а) и приложены строками rebaseline-*, 6 класса (б) остаются блокерами (application-information, application-trash, application-virus-archive, phone-webkit, window-search-restored, window-search-maximized).

Десять строк rebaseline-* лежат в разделе «10. Пересъёмка прежних эталонов» файла 20-VISUAL-APPROVAL.md со статусом CANDIDATE и вердиктом «ОЖИДАЕТ»; файлы кандидатов лежат в `tests/e2e/visual-candidates/.runs/phase20-refresh-0929a084c13d/rebaseline/`. Ни один утверждённый эталон не заменён.

## Сводка перепрогонов 20-25/20-26/20-28

Для каждого плана проверено `git diff --name-only <hash прогона> HEAD -- app components public lib` без *.test.ts.

| План | Что прогонялось | Hash прогона | Итог | Продуктовые файлы, изменённые после прогона | Вывод |
|---|---|---|---|---|---|
| 20-25 | медиа и предзагрузка GIF; Playwright `--retries=0`, пять проектов, тройной прогон | 03be5e3b836d26fe1a075bdbc1f44ed954edde57 (7e5e17a в него входит) | 0 failed, 0 flaky, 178 passed, 67 skipped (BLOCKED (DATA)) | components/portia-desktop.tsx (20-28: Tab внутри окна квалификации и единый metaKey) | прогон устарел, повторить в 20-13 |
| 20-26 | матрица безопасности; `lib/security-matrix.test.ts`, 12 маршрутов, 5 миграций | b88669fb7d92dbf22d66ac6d7bb9a1b011195956 | структура, охват и свежесть проходят | components/portia-desktop.tsx (в охват матрицы не входит) | прогон устарел по правилу плана, повторить в 20-13; тест свежести матрицы при этом проходит |
| 20-28 | accessibility.spec.ts, четыре проекта, `--retries=0` | 8b81221e0cf0e6e2020d7a2102d01e0c34835ad8 | 78 passed, 30 skipped, 0 failed, 0 flaky | нет | актуален |

Прогоны 20-07 (axe, касания) старше 97d7abb, 23c1c85 и 20-28 и повторяются в 20-13 целиком; числа 20-07 здесь не используются.

## Блокеры для 20-13

После замены эталонов по строкам rebaseline-* прежний визуальный гейт остаётся красным: ниже снимки, чьё расхождение не объяснено редизайном. Эталоны не менялись, каждый блокер FAIL до решения владельца или исправления.

| ID | Снимок | Пикселей | Описание | Что нужно |
|---|---|---|---|---|
| B1 | application-information--chromium-desktop | 43446 (2300) | в окне «Информация» отличается содержимое: заголовок, абзацы, список подразделов; эталон и цель отдают разные тексты | закрепить данные цели для гейта либо решение владельца о новом эталоне на закреплённых данных |
| B2 | application-trash--chromium-desktop | 9865 (2300) | отличаются имена и строки списка «Корзина» | то же: данные живой цели |
| B3 | application-virus-archive--chromium-desktop | 4457 (2300) | эталон: одна запись НОВЫЙ ВИРУС, ревизия 205; цель: МОРОК, АРАХНА, КАЛЛИСТО | то же |
| B4 | phone-webkit--webkit-phone | 54239 (256) | в эталоне видна полоса прокрутки страницы и сдвиг экрана на 30 px; на HEAD полосы нет; 20-07 уже видел 54k и показал, что причина не в правилах 20-07; причина не изолирована (возможна нестабильность полосы прокрутки WebKit при съёмке, не доказано) | изолировать причину (A/B по коммитам или повторные снимки WebKit) до замены эталона |
| B5 | window-search-restored и window-search-maximized, firefox-desktop | 867 и 777 (256), оценка | меняются подписи строки «Рекомендации» (содержимое); гейт до них не дошёл, потому что desktop-clean падает раньше | снять после замены desktop-clean; данные «Рекомендаций» закрепить |

Новых Playwright-флейков в этих прогонах не появилось (падения детерминированы, различие между гейтом и кадром кандидата 1-5 px), поэтому строка в 20-PLAYWRIGHT-WAIVERS.md не добавлялась.
