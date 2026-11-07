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

## Пересъёмка после исправлений 20-32

Коммиты исправлений: G1 `4fa4dd6b01495081da7730c93b0b2868aab8daf2`, G2 `19d5bc28425127ea784dbaf7ac01098f85df5006`, G3 `3a90ddaa5c05b5fc88f553511008a7f682d8ffdb` и телефонное продолжение `c19958d19e90e296186041b02adbdc9b76b9b82d`. Все кадры текущего пакета сняты на `666836d7796341fd251d2d819ddbaacbb1014952` (после теста защиты ledger; продуктовый код с G3 не менялся), набор `phase20-refresh-666836d77963`. Локальная сборка не содержала `.env.local`; использовался visitor-режим на 127.0.0.1:3100. Пять основных кандидатных спеков: 113 pass, 79 skip, 0 fail; дополнительная съёмка окон и рабочего стола на пяти профилях: 65 pass, 0 fail.

| Набор строк ledger | Не изменились / прежнее одобрение | Изменились / ОЖИДАЕТ | Область изменений |
| --- | ---: | ---: | --- |
| 1. Паук | 6 | 10 | Два кадра `custom-dark`: новый кант G1; другие различия — кадры движения, скрытия и резкости с меняющейся позой/состоянием окна. Их вердикт сброшен независимо от причины. |
| 2. Колбы | 12 | 0 | Все SHA256 побайтно прежние. |
| 3. Пустые состояния | 9 | 7 | Отличие ограничено областью паука в углу у PC; кадр `custom-dark:phone` требует повторного просмотра целиком. |
| 4. «Повышение» | 5 | 5 | Отличия PC расположены в области паука; данные участника не объявлены доказанными. |
| 5. Иконки классов | 0 | 15 | Панели карточек изменились вместе с цветами подписей G3; `vir-d17` дополнительно содержит исправленный G2 «Транзитиум». |
| 6. «Информация» на телефоне | 3 | 1 | WebKit open кадр изменился в области содержимого; причина требует визуальной проверки. |
| 10. Прежние эталоны | 0 | 10 | Новые кадры старых падений, включая ранее принятые rebaseline. При новом SHA256 одобрение сброшено. |

Сумма: 35 строк с тем же SHA256, 48 строк с новым SHA256 и вердиктом ОЖИДАЕТ. Четыре исходно отклонённые строки содержат новые байты и полный коммит исправления в разделе 11 ledger. Остальные 23 BLOCKED-строки остались BLOCKED; добавлены четыре BLOCKED (DATA) строки для B2/B3/B5, итого 27. Никакой изменившийся SHA256 не оставлен с вердиктом «принято».

### Прежние эталоны на коде после G3 (`--retries=0`)

Гейт: 75 тестов, 8 pass, 13 fail, 54 skip; повторов 0. Точечные значения ниже — число отличающихся пикселей. Для `desktop-start-open--chromium-phone` и B5 гейт остановился раньше; числа получены тем же компаратором по кандидатному кадру и обозначены оценкой. Утверждённые `tests/e2e/visual/__screenshots__` не менялись.

| Снимок / проект | Итог, пиксели | Класс / строка ledger |
| --- | --- | --- |
| `application-broadcasts--chromium-desktop` | FAIL 4326 | объяснённое изменение пустого рисунка; `rebaseline-application-broadcasts--chromium-desktop:pc` ОЖИДАЕТ |
| `application-guide--chromium-desktop` | FAIL 5000 | объяснённое изменение микроскопа; `rebaseline-application-guide--chromium-desktop:pc` ОЖИДАЕТ |
| `desktop-clean--chromium-desktop` | FAIL 294 | значок и паук; `rebaseline-desktop-clean--chromium-desktop:pc` ОЖИДАЕТ |
| `desktop-clean--chromium-dpr125`, `desktop-dpr125--chromium-dpr125` | FAIL 394, 394 | две строки `rebaseline-*` ОЖИДАЕТ |
| `desktop-clean--firefox-desktop` | FAIL 275 | строка `rebaseline-desktop-clean--firefox-desktop:pc` ОЖИДАЕТ |
| `desktop-clean--chromium-phone`, `phone-chromium--chromium-phone` | FAIL 515, 290 | две строки `rebaseline-*` ОЖИДАЕТ |
| `desktop-start-open--chromium-phone`, `desktop-start-open--webkit-phone` | оценка 508, FAIL 411 | две строки `rebaseline-*` ОЖИДАЕТ |
| `application-information--chromium-desktop` | FAIL 43446 | B1, содержимое цели, BLOCKED |
| `application-trash--chromium-desktop` | FAIL 9865 | B2, содержимое цели; новая строка BLOCKED (DATA), G3 меняет также подпись |
| `application-virus-archive--chromium-desktop` | FAIL 4511 (было 4457) | B3, содержимое цели; новая строка BLOCKED (DATA), G3 меняет также подписи |
| `phone-webkit--webkit-phone` | FAIL 54235 (было 54239) | B4, причина полосы прокрутки не изолирована, BLOCKED |
| `window-search-restored/maximized--firefox-desktop` | оценка 868 / 777 | B5, данные «Рекомендаций»; две новые строки BLOCKED (DATA), G3 тоже меняет кадр |
| `application-employees`, `application-search` на chromium-desktop | PASS | новых строк rebaseline по G3 нет: гейт принимает их при прежнем допуске |

Для B2/B3 новые actual-файлы лежат в `tests/e2e/visual-candidates/.runs/phase20-refresh-666836d77963/_work/blocker-actuals/`; для B5 — в том же наборе `window-search-*.png`. Их SHA256 записаны в примечаниях BLOCKED-строк. Снимки с данными цели не предлагаются к одобрению. Различия остальных строк, особенно с движением паука и WebKit, требуют вердикта владельца по конкретным байтам, а не автоматического наследования прежней оценки.

## Пересъёмка после перерисовки паука и колб (20-37)

Коммиты исправлений 20-35 и 20-36: паук `d7d917e466e77e43ea0fa7ae126c86810acd7b19`, колбы `abddc8cc6efcf6aeb695fcfdc5800b51c1cffe4f`. Коммит съёмки H3 `cf8fcfcc249f745fd3836b11726445660c02ef8f`, набор S3 `phase20-refresh-cf8fcfcc249f` (в .gitignore). Сборка production на 127.0.0.1:3100 (visitor, только чтение, `PORTIA_E2E_ALLOW_HTTP=1`, Node 22.13.1), код app/components/public/lib равен H3. Эталоны `tests/e2e/visual/__screenshots__` не менялись. Предыдущая попытка на `39bd4d371efa` остановилась на блокерах B6-B9 (ниже, исправлены); её кадры в ledger не входят.

### Исправленные блокеры предыдущей попытки

| ID | Что было | Исправление | Коммит |
|---|---|---|---|
| B6 | `editor.spec.ts:5` на firefox-desktop: `NS_BINDING_ABORTED` на `/api/content` и `/api/employees`, 3 из 3 | Перепрогон на новой сборке снова красный (3 из 3), поэтому спек перед переходом на страницу входа ждёт `networkidle`: чтения цели занимают 1-1.5 с. После правки 3 из 3 зелёные, в полном прогоне 165 passed | 8b683c0 |
| B7 | текст «Повышения» «…устройство; отправьте файл…» против «…устройство. Отправьте файл…» в конструкторе, спеке и UI-SPEC | `components/portia-promotion.tsx` приведён к форме с точкой; других проверок с точкой с запятой нет | 7242911 |
| B8 | axe `label-content-name-mismatch` (serious) на `.global-format-launch > button`, chromium-phone, «Основное» | Общая кнопка `FormatLaunchButton` в `components/portia-editor-rich-text.tsx` (имена в `lib/format-launch.ts`), конструктор использует её. axe сравнивает целые слова, поэтому первая правка («Выберите текстовое поле для оформления»: слово «текстовое» не равно «текст») не помогла; имя пустого состояния теперь «Выберите текст: сначала выберите текстовое поле», имя с полем «Оформление <поле>: панель оформления текста» (содержит видимое «ОФОРМЛЕНИЕ <поле>»). Телефон в свёрнутом виде рисует тот же DOM (CSS обрезает текст), имя одно для всех состояний и ширин. Кнопка редактора в `components/portia-editor.tsx` намеренно не тронута по указанию, поэтому у редактора остаётся прежняя разметка (замечание для владельца) | f00d528, cf8fcfc |
| B9 | кадр `phase20-spider-mid-step-off--chromium-phone` показывал окно «Настройки» без паука, байты равнялись отклонённым 2026-11-06 | `phase20-art.spec.ts`: после выбора «Выключены» окно «Настройки» закрывается, тест проверяет, что ни одно окно не лежит на пауке и поза не сдвинулась, затем окно открывается для шага «Уменьшены». Паук виден на PC и на телефоне. `spider-off` (кадр «Паук: Скрыть») по замыслу без паука, строки и раздел 12 не менялись | 7e36b35 |

Проверка B8: `template-builder.spec.ts` и полоса «template builder» в `accessibility.spec.ts` на chromium-desktop и chromium-phone: 24 passed, 0 failed (`--retries=0`, сборка H3). На сборке перед второй правкой тот же прогон: 23 passed, 1 failed (то самое `label-content-name-mismatch`).

### Прогоны на H3

- `phase20-art.spec.ts`, chromium-desktop и chromium-phone, `--retries=0`: 44 passed.
- Остальные кандидатные спеки (apps, desktop, editor, motion, info-phone, class-icons, empty-art, promotion, template-builder) на пяти проектах: 165 passed, 165 skipped, 0 failed (`--retries=0`).
- UI-контракт конструктора (второй verify): 24 passed, ноль запросов записи (трекер в спеке роняет тест при любой записи).

### Сводка по разделам ledger

| Раздел ledger | Строк CANDIDATE | Тот же SHA256 / прежнее одобрение | Новый SHA256 / ОЖИДАЕТ | Что изменилось |
| --- | ---: | ---: | ---: | --- |
| 1. Паук | 16 | 0 | 16 | Новый паук D-50 (20-35); `spider-off` изменил байты без паука в кадре |
| 2. Колбы | 12 | 0 | 12 | Фон D-51 (20-36) |
| 3. Пустые состояния | 16 | 7 | 9 | Область паука в углу у PC; на телефоне один кадр изменился ниже порога канала 16 |
| 4. Promotion (участник) | 10 | 4 | 6 | Область паука у PC; кадр `gate-refused:phone` изменился ниже порога |
| 5. Иконки классов | 5 | 5 | 0 | Панели без паука, байты те же |
| 6. «Информация» на телефоне | 6 | 5 | 1 | `info-phone-next:phone` изменился ниже порога канала 16 |
| 10. Прежние эталоны (rebaseline-*) | 23 | 0 | 23 | 14 существующих и 9 новых строк |
| Конструктор шаблона (D-52, раздел 4) | 8 | 0 | 8 | Новые строки, прежнего кадра нет |

Итого 131 строка: 21 принято (те же байты), 75 ОЖИДАЕТ, 35 BLOCKED. Ни один изменившийся SHA256 не оставлен с вердиктом «принято».

### Прежние эталоны на H3 (`--retries=0`)

Гейт на chromium-desktop и chromium-dpr125 запускался дважды (`npm run test:e2e:visual -- --retries=0`: 11 failed, 5 passed, 14 skipped; повтор со списком: 10 failed, 6 passed). Расхождение между прогонами в одном снимке: «Корзина» (данные цели). Остальные проекты: `npm run test:e2e -- --retries=0 --project=chromium-phone --project=webkit-phone --project=firefox-desktop tests/e2e/visual`: 5 failed, 40 skipped, 0 passed. Числа пикселей отличаются от прежних таблиц (паук стал крупнее). Снимки, до которых гейт не дошёл (тест останавливается на первом упавшем снимке), оценены компаратором гейта по кадру кандидата того же сценария и помечены «оценка».

| Снимок / проект | Итог, пиксели | Класс / строка ledger |
| --- | --- | --- |
| `application-broadcasts--chromium-desktop` | FAIL 5057 | паук и пустой рисунок; строка rebaseline ОЖИДАЕТ |
| `application-guide--chromium-desktop` | FAIL 5764 | паук и пустой рисунок; строка ОЖИДАЕТ |
| `application-settings--chromium-desktop` | FAIL 4049 | паук D-50; строка ОЖИДАЕТ |
| `application-search--chromium-desktop` | FAIL 4571 | паук D-50; строка ОЖИДАЕТ |
| `application-information--chromium-desktop` | FAIL 25449 | паук и содержимое окна (данные цели, B1); строка ОЖИДАЕТ, как в 20-33 |
| `editor-visitor-denied--chromium-desktop` | FAIL 3044 | паук D-50; строка ОЖИДАЕТ |
| `desktop-clean--chromium-desktop` | FAIL 2020 (2015 в первом прогоне) | паук; строка ОЖИДАЕТ |
| `desktop-clean--chromium-dpr125`, `desktop-dpr125--chromium-dpr125` | FAIL 2789, 2777 | две строки ОЖИДАЕТ |
| `desktop-clean--firefox-desktop` | FAIL 2053 | строка ОЖИДАЕТ |
| `desktop-clean--chromium-phone`, `phone-chromium--chromium-phone` | FAIL 8794, 8703 | две строки ОЖИДАЕТ |
| `desktop-start-open--webkit-phone` | FAIL 411 | строка ОЖИДАЕТ |
| `desktop-start-open--chromium-phone` | оценка 787 | строка ОЖИДАЕТ |
| `motion-web-rest--chromium-desktop` | FAIL 2985 (3031 в первом прогоне); на 7aafc61edef8 проходил | НОВАЯ строка ОЖИДАЕТ |
| `motion-vivian-idle`, `-activity`, `-offended`, `-recovery` | оценка 2991, 5170, 3885, 3764 (допуск 2300); idle, activity, recovery на 7aafc61edef8 проходили | четыре НОВЫЕ строки ОЖИДАЕТ; различие фразы Вивьян в пузыре было и раньше, в пределах допуска |
| `desktop-start-open` на chromium-desktop, chromium-dpr125, firefox-desktop | оценка 1831, 2543, 1868 | три НОВЫЕ строки: на 7aafc61edef8 оценка тоже превышала допуск, строки не было (гейт не доходил); теперь классифицировано |
| `window-search-minimized--firefox-desktop` | оценка 2139 | НОВАЯ строка (тот же пробел 20-33) |
| `application-employees`, `application-charter`, `application-table`, `promotion-participant-lookup` | PASS | строк нет |
| `application-trash--chromium-desktop` | FAIL 12402 в первом прогоне, PASS во втором | B2, данные цели нестабильны; строка остаётся BLOCKED (DATA), новый кадр не предлагается |
| `application-virus-archive--chromium-desktop` | PASS в обоих прогонах (на 666836d77963 было FAIL 4511) | B3, данные цели изменились; строка остаётся BLOCKED (DATA), PASS на сегодняшних данных не считается доказательством |
| `phone-webkit--webkit-phone` | FAIL 60777 (было 54235) | B4, причина полосы прокрутки не изолирована, BLOCKED; строки в ledger нет |
| `window-search-restored/maximized--firefox-desktop` | оценка 2786 / 2121 | B5, данные «Рекомендаций»; строки остаются BLOCKED (DATA) |

Новые строки rebaseline-* (9): `motion-web-rest`, `motion-vivian-idle`, `-activity`, `-offended`, `-recovery`, `desktop-start-open` на chromium-desktop, chromium-dpr125 и firefox-desktop, `window-search-minimized` на firefox-desktop. Кадры лежат в `tests/e2e/visual-candidates/.runs/phase20-refresh-cf8fcfcc249f/rebaseline/`; для шести кадров гейта это его actual, для остальных кадр кандидата того же сценария.

### Блокеры

Незакрытых блокеров нет: B6-B9 исправлены, B1-B5 остаются данными цели (BLOCKED), B4 не изолирован. Физический бюджет кадров на телефоне остаётся BLOCKED до 20-14 (на телефоне getAnimations насчитывает 96).

## Пересъёмка после исправлений D-53..D-57 (20-47)

Коммиты исправлений: паук 20-40 `f7a1faf172a9adbe029f066027e3890a0b18a598` и 20-41 `db151677cf01d45f852b32e14d73725dd515dc70`, колбы 20-42 `859a493fb295cd6a7a879b0f0ae12b25efeac45f`, конструктор шаблона 20-44 `be9af79925cb12dd1d6dcb933d7b48a3de3c956e` (раскладка карточки 20-43), кнопка «ОФОРМЛЕНИЕ» 20-45 `769601524e4d76773bede7be2c1f063365b17211`, подсказки 20-46. Коммит съёмки H4 `ecf5173a5d51616ac3a1f1cc044e2b536a61a2fb`, набор S4 `phase20-refresh-ecf5173a5d51` (в .gitignore). Сборка production на 127.0.0.1:3100 (visitor, только чтение, `PORTIA_E2E_ALLOW_HTTP=1`, Node 22.13.1, прямые команды: `npm run` падает на node-gyp), код app/components/public/lib равен H4. Эталоны `tests/e2e/visual/__screenshots__` не менялись (`git status --porcelain` пуст, флаг обновления не использовался).

### Прогоны на H4 (`--retries=0`)

- Обязательные проверки до показа: UI-контракт конструктора (`template-builder.spec.ts` и полоса «template builder» в `accessibility.spec.ts`, chromium-desktop и chromium-phone): 32 passed, ноль запросов записи. `phase20-art.spec.ts` в S4: 60 passed. `visual-candidates/template-builder.spec.ts` в S4: 8 passed.
- Остальные кандидатные спеки (apps, desktop, editor, motion, info-phone, class-icons, empty-art, promotion) на всех проектах: 157 passed, 153 skipped (чужие проекты), 0 failed.
- Спек сопровождения галереи `phase20-review-extras.spec.ts` (новый): 8 passed, ноль запросов записи; ролики ходьбы паука (два акцента × два проекта), ролики колб (два проекта), скачанные HTML и PNG, снимки открытого HTML без сети в `S4/extras/`.
- Прежние эталоны: chromium-desktop и chromium-dpr125: 11 failed, 5 passed, 14 skipped; chromium-phone, webkit-phone, firefox-desktop: 5 failed, 40 skipped, 0 passed.

### Сводка по разделам ledger

| Раздел ledger | Строк CANDIDATE | Тот же SHA256 / прежнее одобрение | Новый SHA256 / ОЖИДАЕТ | Что изменилось |
| --- | ---: | ---: | ---: | --- |
| 1. Паук | 16 | 0 | 16 | Паук D-53 (20-40, 20-41); `spider-off` изменил байты без паука в кадре |
| 2. Колбы | 12 | 0 | 12 | Фон D-54 (20-42) |
| 3. Пустые состояния | 16 | 8 | 8 | Область паука у PC (8 строк PC); телефон не изменился |
| 4. Promotion (участник) | 10 | 0 | 10 | Подсказки D-56 (20-46); у четырёх ранее принятых строк телефона прежнее одобрение не перенесено |
| 5. Иконки классов | 5 | 5 | 0 | Панели без паука, байты те же |
| 6. «Информация» на телефоне | 6 | 5 | 1 | `info-phone-next:phone-webkit` изменился ниже порога канала 16 (ранее «принято», сброшен) |
| 10. Прежние эталоны (rebaseline-*) | 24 | 0 | 24 | 22 существующих и 2 новых строки; `application-information` переведена в BLOCKED (DATA) |
| Конструктор шаблона (D-55, раздел 4) | 8 | 0 | 8 | Карточка базы вирусов (20-43, 20-44) |

Итого 133 строки: 16 принято (те же байты), 81 ОЖИДАЕТ, 36 BLOCKED, «исправить» 0. Ни один изменившийся SHA256 не оставлен с вердиктом «принято»; 36 строк раунда 13 (с `spider-off`) показаны заново.

### Прежние эталоны на H4

Тест останавливается на первом упавшем снимке; снимки, до которых гейт не дошёл, оценены компаратором гейта (`getComparator`, допуск и порог политики снимка) по кадру кандидата того же сценария и помечены «оценка».

| Снимок / проект | Итог, пиксели (допуск) | Класс / строка ledger |
| --- | --- | --- |
| `application-broadcasts--chromium-desktop` | FAIL 4868 (2300) | паук D-53 и рисунок пустого состояния; существующая строка ОЖИДАЕТ |
| `application-guide--chromium-desktop` | FAIL 5685 (2300) | то же; существующая строка |
| `application-settings--chromium-desktop` | FAIL 23187 (2300) | подпись окна убрана по D-56 (h-13), паук D-53; существующая строка |
| `application-search--chromium-desktop` | FAIL 21876 (2300) | подпись убрана по D-56 (h-11), паук D-53, данные «Рекомендаций»; существующая строка |
| `application-information--chromium-desktop` | PASS | на H3 падал на 25449 px из-за данных цели (B1); строка переведена в BLOCKED (DATA), PASS на сегодняшних данных не доказательство |
| `application-virus-archive--chromium-desktop` | PASS | B3, данные цели, строка BLOCKED (DATA) без изменений |
| `application-trash--chromium-desktop` | FAIL 12158 (2300) | B2, данные цели, строка BLOCKED (DATA); actual в `S4/_work/blocker-actuals/` |
| `application-employees`, `application-table`, `application-charter` | PASS | строк нет |
| `editor-visitor-denied--chromium-desktop` | FAIL 22790 (2300) | кадр показывает окно «Настройки»: D-56 (h-13), паук D-53; существующая строка |
| `editor-signed-out-login--chromium-desktop` | оценка 10301 (2300) | подпись входа сокращена по D-56 (h-01); НОВАЯ строка |
| `promotion-participant-lookup--chromium-desktop` | FAIL 21225 (2300); на H3 проходил | подсказки «Повышения» по D-56 (h-109, h-110, h-112), паук; НОВАЯ строка |
| `desktop-clean` на chromium-desktop, chromium-dpr125, firefox-desktop, chromium-phone | FAIL 1091, 1659, 1066, 4975 (256) | паук D-53; существующие строки |
| `desktop-dpr125--chromium-dpr125`, `phone-chromium--chromium-phone` | FAIL 1659, 4884 (256) | паук D-53; существующие строки |
| `desktop-start-open` на webkit-phone | FAIL 411 (256) | существующая строка |
| `desktop-start-open` на chromium-desktop, chromium-dpr125, firefox-desktop, chromium-phone | оценка 924, 1442, 912, 669 (256) | существующие строки |
| `motion-web-rest`, `motion-vivian-idle`, `motion-vivian-activity` | PASS в допуске (оценка по кадру кандидата 1818, 1748, 3925 при 2300: фраза Вивьян) | существующие строки; кадры показываются для сравнения |
| `motion-vivian-offended--chromium-desktop` | FAIL 2321 (2300) | существующая строка |
| `motion-vivian-recovery--chromium-desktop` | оценка 2438 (2300) | существующая строка |
| `window-search-minimized--firefox-desktop` | оценка 1183 (256) | существующая строка |
| `window-search-restored`, `window-search-maximized` на firefox-desktop | оценка 17540, 26758 (256) | B5, данные «Рекомендаций», строки BLOCKED (DATA) |
| `phone-webkit--webkit-phone` | FAIL 57837 (256) | B4, причина полосы прокрутки не изолирована, BLOCKED; строки в ledger нет |

### Допущения исполнителя

- `application-information` переведена из CANDIDATE в BLOCKED (DATA): гейт проходит на сегодняшних данных цели, нового actual нет; тот же подход, что у `application-virus-archive`. Если владелец предпочтёт оставить строку кадром кандидата, это решение плана 20-12.
- Откройте-файл-офлайн снимок конструктора на проекте chromium-phone масштабирован (DPR контекста), содержимое то же.
- В HTML и PNG шаблона слово «Предупреждение» в ячейке «Угроза и риск побега» переносится посреди слова («Предупреждени-е») при ширине 1280; шрифты в файл не встраиваются (D-24), запасные шрифты шире. Это на показ владельцу (допущение 20-44), не блокер.

### Блокеры

Незакрытых блокеров нет. B1-B5 остаются данными цели (BLOCKED), B4 не изолирован. Физический бюджет кадров на телефоне остаётся BLOCKED до 20-14 (на телефоне показано 55 из 118 анимаций колб при пределе 80, замер в `flasks-animation-count--chromium-phone.json`).

## Пересъёмка после исправлений D-59..D-64 (20-54)

Коммиты исправлений: колбы 20-48 `b003476abe7f0774d99ebdfc00a27d0819b32b1f` (D-59), конструктор шаблона 20-49 `b9ff7d0ecbe470ad5bc059162bc032a33c466052` (D-60, D-61), «Информация» 20-50, кадр картинок 20-51..20-53 (D-62, D-63; `employee_framing: b`, 20-52). Коммит съёмки H5 `a6e2918b2afb0539f468cfa5ac802d349cae0ffb` (тест раунда 14, `PLAN_BASE 9e68f1ebe6485b75634cc69b1140e255d1f3f2b3`), набор S5 `phase20-refresh-a6e2918b2afb` (в .gitignore). Сборка production на 127.0.0.1:3100 (visitor, только чтение, `PORTIA_E2E_ALLOW_HTTP=1`, Node 22.13.1, прямые команды: `npx` и `npm run` падают на node-gyp, Playwright запускался как `node node_modules/@playwright/test/cli.js test`), код app/components/public/lib равен H5 (`git diff --name-only H5 HEAD -- app components public lib` пуст). Эталоны `tests/e2e/visual/__screenshots__` не менялись (`git status --porcelain` пуст). `scripts/phase15-visual-manifest.mjs --verify` не запускался.

### Прогоны на H5 (`--retries=0`)

- Обязательные проверки до показа: UI-контракт конструктора и полоса «template builder» accessibility (`template-builder.spec.ts`, `accessibility.spec.ts`, chromium-desktop и chromium-phone): 38 passed; D-61 на пяти проектах (chromium-desktop, chromium-dpr125, firefox-desktop, chromium-phone, webkit-phone, форматы HTML и PNG): 10 passed; `editor-ui-contract.spec.ts` 34 passed; `image-framing.spec.ts` 10 passed; `phase20-art.spec.ts` и `visual-candidates/template-builder.spec.ts` в S5: 78 passed; тест ledger `lib/phase20-visual-approval.test.ts`: 44 tests, 43 pass, 0 fail, 1 skipped.
- Остальные кандидатные спеки (apps, desktop, editor, motion, info-phone, class-icons, empty-art, promotion, editor-images): 157 passed, 178 skipped (чужие проекты и BLOCKED), 0 failed.
- Спек сопровождения галереи `phase20-review-extras.spec.ts`: 8 passed, ноль запросов записи; в ролике колб на PC работают все пять частей досок (столбики, линия диаграммы, ячейки таблицы, инструменты, волна осциллографа), в скачанном HTML «Предупреждение» в одну строку на 1280 и 412 px.
- Колбы (D-59): бесконечных анимаций 136 при пределе 140 (PC), на телефоне показано 55 при пределе 80 (`flasks-animation-count--*.json`); контраст подписей, пустые клетки и высота рисунка проверены тестами phase20-art.
- Прежние эталоны: chromium-desktop и chromium-dpr125 11 failed, 5 passed, 14 skipped; chromium-phone, webkit-phone, firefox-desktop 5 failed (в одном общем запуске firefox-desktop дополнительно давал 5 разрывов `browserContext.close: Protocol error ... _maybeDontRestoreTabs`; одиночный прогон firefox-desktop: 1 failed (desktop:clean 1108 px), 14 skipped; это сбой Firefox при закрытии контекста под параллельной нагрузкой, не расхождение кадра).

- Галерея `tests/e2e/visual-candidates/.runs/phase20-refresh-a6e2918b2afb/review.html`: 86 строк ОЖИДАЕТ, 170 ссылок (158 уникальных), 0 отсутствующих; пять вопросов раздела 7 с картинками; сервер на 3100 остановлен (PID 31332, `next start` этого проекта). Строгий прогон `PORTIA_REQUIRE_APPROVAL=1` красный только на «owner verdict is still pending» (86 строк) и «owner answer is missing» (пять вопросов 20-54): нет «captured outside candidates_set», «stale candidates», «does not match», «re-presents the rejected frame», «owner asked for a fix». `node --experimental-strip-types --test lib/*.test.ts`: 1591 tests, 1587 pass, 0 fail, 4 skipped; `tsc --noEmit` код 0; eslint по изменённым файлам чист.

### Сводка по разделам ledger

| Раздел ledger | Строк | Тот же SHA256 / прежнее одобрение | Новый SHA256 / ОЖИДАЕТ | Что изменилось |
| --- | ---: | ---: | ---: | --- |
| 1. Паук | 16 | 8 | 8 | Код паука не менялся; поза паука не детерминирована (раздел 9 ledger) |
| 2. Колбы | 12 | 0 | 12 | D-59: один циферблат, доски и волна движутся |
| 3. Пустые состояния (колба «Новости») | 8 | 4 | 4 | Поза паука у PC и лапа на телефоне |
| 3. Пустые состояния («Справочник») | 8 | 0 | 0 | BLOCKED (DATA): цель отдаёт раздел «лол»; три строки телефона прежде были «принято», одобрение не перенесено |
| 4. Promotion (участник) | 10 | 5 | 5 | Поза паука у PC |
| 4. Конструктор шаблона | 8 | 2 | 6 | D-60/D-61 (20-49); phone `main` и `preview` без изменений |
| 5. Иконки классов | 5 | 5 | 0 | Панели без паука |
| 6. «Информация» на телефоне | 6 | 5 | 1 | `info-phone-next:phone-webkit` ниже порога канала 16 |
| 10. Прежние эталоны (rebaseline-*) | 24 | 1 | 23 | Поза паука, фраза Вивьян, момент загрузки у `application-broadcasts`; `application-guide` переведена в BLOCKED (DATA) |
| 15. Кадр картинок (новый) | 10 | 0 | 10 | Новые строки D-62, D-63 |

Итого 143 строки: 12 «принято» (те же байты), 86 ОЖИДАЕТ, 45 BLOCKED, «исправить» 0. Ни один изменившийся SHA256 не оставлен с вердиктом «принято».

### Прежние эталоны на H5

| Снимок / проект | Итог, пиксели (допуск) | Класс / строка ledger |
| --- | --- | --- |
| `application-broadcasts--chromium-desktop` | FAIL 4993 (2300) | поза паука; кадр гейта на ecf5173a5d51 был скелетом загрузки, теперь загруженное пустое состояние; существующая строка |
| `application-guide--chromium-desktop` | FAIL 5168 (2300) | данные цели (раздел «лол»); строка переведена в BLOCKED (DATA), actual в `S5/_work/blocker-actuals/` |
| `application-search--chromium-desktop` | FAIL 21829 (2300) | подпись убрана по D-56, паук; существующая строка |
| `application-settings--chromium-desktop` | FAIL 23310 (2300) | подпись окна убрана по D-56, паук; существующая строка |
| `application-information--chromium-desktop` | FAIL 24851 (2300) | данные цели; строка BLOCKED (DATA), на ecf5173a5d51 проходила |
| `application-trash`, `application-virus-archive`, `application-employees`, `application-table`, `application-charter` | PASS | строки BLOCKED (DATA) без изменений, PASS на сегодняшних данных не доказательство |
| `editor-visitor-denied--chromium-desktop` | FAIL 22804 (2300) | окно «Настройки» D-56, паук; существующая строка |
| `promotion-participant-lookup--chromium-desktop` | FAIL 21218 (2300) | подсказки D-56, паук; существующая строка |
| `desktop-clean` на chromium-desktop, chromium-dpr125, firefox-desktop, chromium-phone | FAIL 1081, 1657, 1108, 4747 (256) | поза паука; существующие строки |
| `desktop-dpr125--chromium-dpr125`, `phone-chromium--chromium-phone` | FAIL 1665, 5109 (256) | поза паука; существующие строки |
| `desktop-start-open` на webkit-phone | FAIL 411 (256) | существующая строка |
| `desktop-start-open` на chromium-desktop, chromium-dpr125, firefox-desktop, chromium-phone | гейт до снимка не дошёл (оценка не пересчитывалась) | существующие строки; кадр кандидата того же сценария, байты измерены против ecf5173a5d51 |
| `motion-vivian-activity--chromium-desktop` | FAIL 2499 (2300) | поза паука и фраза Вивьян не детерминированы; `motion-web-rest`, `motion-vivian-idle`, `motion-vivian-offended`, `motion-vivian-recovery` гейт не достиг, строки существующие, кадр кандидата |
| `window-search-minimized--firefox-desktop` | гейт не достиг | существующая строка, кадр кандидата |
| `phone-webkit--webkit-phone` | FAIL 57215 (256) | B4, причина полосы прокрутки не изолирована, BLOCKED; строки в ledger нет |

### Допущения исполнителя

- Новые строки раздела 15 и кадры редактора сняты на подменённых чтениях GET /api/access и GET /api/content (UI-контракт, не доказательство ролей); картинки в них файлы `public/assets`, не настоящие фото. Как выбранная часть выглядит на настоящих фото владельца, проверяется физически (UAT EDITOR-FRAMING-01, EDITOR-INFO-ADD-01).
- Восемь строк `empty-microscope-guide-*` и `rebaseline-application-guide--chromium-desktop:pc` переведены из CANDIDATE в BLOCKED (DATA): на цели теперь один раздел «Справочника» («лол»; `/api/content`: guideSections 1), пустое состояние показать нельзя без выдуманных данных, а кадр гейта с настоящим разделом цели не может быть кандидатом. Это меняет число «принято» (16 -> 12: три строки телефона «Справочника» и `empty-flask-news-custom-dark:phone`, у последней изменились 14 px у лапы паука).
- `q-download-browser` не задаётся: 20-49 нашла причину ошибки скачивания измерением (вызов `setTimeout` как метода окружения, бросок TypeError во всех трёх движках) и воспроизвела её на пяти проектах.
- Выбор видимой части для фото сотрудников не сделан по решению владельца «b» (20-52); кадров `editor-image-framing-employee` и `employee-portrait-framed` нет.
- Расширение 20-12 на строки раздела 15 нужно сделать в самом 20-12; здесь оно не выполнялось.

### Блокеры

Незакрытых блокеров нет. B1-B5 остаются данными цели (BLOCKED), B4 не изолирован. Физический бюджет кадров на телефоне остаётся BLOCKED до 20-14 (на телефоне показано 55 из 136 анимаций колб при пределе 80, замер в `flasks-animation-count--chromium-phone.json`).
