# 19-EVIDENCE: доказательства acceptance gate фазы 19 (приложения, поиск, медиа, редактор)

**План:** 19-14. **Статус документа:** Task 1 и Task 2 записаны; физический вердикт владельца записан в `19-APPS-UAT.md` и `19-UAT.md` (см. раздел «Вердикт владельца» в конце).

Правила записи: каждая строка ниже отсылает к прогону. «passed» значит, что тест прошёл в указанном прогоне; «BLOCKED (DATA)» и «BLOCKED (ENV)» значат, что состояние на этой цели не показать без подмены данных или окружения (это не успех); «N/A» значит, что состояния по дизайну нет. Внутренние `/api` ни в одном прогоне не подменялись данными: допускается только абортирование или удержание запроса с отправкой его дальше на настоящий сервер (`assertNoOwnApiFulfilled` проходит в каждом тесте).

## Среда прогонов

- База: `HEAD 9eaa75b` (содержит 19-01..19-13, merge `c073339`) плюс новые spec из коммита Task 1.
- Node 22.13.1, Playwright 1.64.1, Chromium из `ms-playwright`.
- Цель: изолированный staging, `refHash 01d085e7b9f0`, `phase16-staging attest` печатает `ATTESTED` перед прогонами. Production не затрагивался (предварительный `visitor` preflight отвергает production-ref; приложение собирается и стартует самим Playwright на `http://127.0.0.1:3000`, ключ администратора в сервер не передаётся).
- Данные цели (по ответам настоящего `/api`): 3 вируса, 4 раздела «Информации», 3 файла «Корзины», около 16 сотрудников; карточек «Справочника» и записей «Сводки» нет. Состав ростера «Сотрудников» плавает от прогона к прогону (чтение живой Google-таблицы с этой машины иногда отвечает degraded), поэтому часть строк «Сотрудники» различается между прогонами и указана по финальному прогону.
- Прогон A (финальный, источник строк ниже): `npm run test:e2e -- tests/e2e/specs/app-states.spec.ts tests/e2e/specs/search-click.spec.ts tests/e2e/specs/media-states.spec.ts --project=chromium-desktop --project=chromium-phone --workers=2` → **98 тестов: 77 passed, 21 skipped, 0 failed** (chromium-desktop: 38 passed, 11 skipped; chromium-phone: 39 passed, 10 skipped). Все 21 skipped = BLOCKED (DATA), причины в строках.
- Предыдущие прогоны того же набора с 6 параллельными воркерами: 74 passed, 24 skipped, 0 failed (до правок прогона A) и 71 passed, 3 failed (до правок диагностики и таймаута). Падения были в самих тестах (диагностика третьей стороны и 5-секундное ожидание живого чтения ростера), не в продукте; исправлены в spec.

## Матрица состояний 8 приложений × 6 состояний × 2 проекта (прогон A)

Состояние `stale` у «Сотрудников» на chromium-desktop в финальном прогоне BLOCKED (DATA): ростер ответил degraded и копия на устройстве не сохранялась; на chromium-phone тот же тест passed. «denied» нет ни у одного из восьми приложений, потому что их данные публичные: `appViewState` получает `denied=false` (19-08), `AppDeniedPanel` доказан в редакторе (раздел «Editor journeys»). Источники: `tests/e2e/specs/app-states.spec.ts`; stale для «База вирусов» проверен трейсером (плашка «Не удалось обновить — показаны данные на», выбранная запись и число записей не меняются, повтор при отказе не двигает время плашки, после восстановления плашка уходит); fatal проверяет «Нет связи с сервером», «Повторить загрузку» и возврат приложения после повтора; для «Таблицы»/«Устава» fatal через удержание загрузки фрейма 15 секунд.

| Приложение | Состояние | chromium-desktop | chromium-phone |
|---|---|---|---|
| База вирусов | loading | passed | passed |
| База вирусов | empty | BLOCKED (DATA) this target serves 3 records for «База вирусов»; the empty state needs a source with none, and own /api answer | BLOCKED (DATA) this target serves 3 records for «База вирусов»; the empty state needs a source with none, and own /api answer |
| База вирусов | populated | passed | passed |
| База вирусов | stale | passed | passed |
| База вирусов | denied | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) |
| База вирусов | fatal | passed | passed |
| Сотрудники | loading | passed | passed |
| Сотрудники | empty | BLOCKED (DATA) this target serves 16 records for «Сотрудники»; the empty state needs a source with none, and own /api answers | BLOCKED (DATA) this target serves 16 records for «Сотрудники»; the empty state needs a source with none, and own /api answers |
| Сотрудники | populated | passed | passed |
| Сотрудники | stale | BLOCKED (DATA) this target's roster is degraded, so no device copy was saved to show again. | passed |
| Сотрудники | denied | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) |
| Сотрудники | fatal | passed | passed |
| Информация | loading | passed | passed |
| Информация | empty | BLOCKED (DATA) this target serves 4 records for «Информация»; the empty state needs a source with none, and own /api answers  | BLOCKED (DATA) this target serves 4 records for «Информация»; the empty state needs a source with none, and own /api answers  |
| Информация | populated | passed | passed |
| Информация | stale | passed | passed |
| Информация | denied | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) |
| Информация | fatal | passed | passed |
| Справочник | loading | passed | passed |
| Справочник | empty | passed | passed |
| Справочник | populated | BLOCKED (DATA) this target serves no records for «Справочник», so the populated state cannot be shown without invented data. | BLOCKED (DATA) this target serves no records for «Справочник», so the populated state cannot be shown without invented data. |
| Справочник | stale | BLOCKED (DATA) this target serves no records for «Справочник», so a stale strip (a failure with no records is the fatal panel | BLOCKED (DATA) this target serves no records for «Справочник», so a stale strip (a failure with no records is the fatal panel |
| Справочник | denied | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) |
| Справочник | fatal | passed | passed |
| Сводка | loading | passed | passed |
| Сводка | empty | passed | passed |
| Сводка | populated | BLOCKED (DATA) this target serves no records for «Сводка», so the populated state cannot be shown without invented data. | BLOCKED (DATA) this target serves no records for «Сводка», so the populated state cannot be shown without invented data. |
| Сводка | stale | BLOCKED (DATA) this target serves no records for «Сводка», so a stale strip (a failure with no records is the fatal panel by  | BLOCKED (DATA) this target serves no records for «Сводка», so a stale strip (a failure with no records is the fatal panel by  |
| Сводка | denied | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) |
| Сводка | fatal | passed | passed |
| Корзина | loading | passed | passed |
| Корзина | empty | BLOCKED (DATA) this target serves 3 records for «Корзина»; the empty state needs a source with none, and own /api answers are | BLOCKED (DATA) this target serves 3 records for «Корзина»; the empty state needs a source with none, and own /api answers are |
| Корзина | populated | passed | passed |
| Корзина | stale | passed | passed |
| Корзина | denied | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) |
| Корзина | fatal | passed | passed |
| Таблица | loading | passed | passed |
| Таблица | empty | N/A: an embedded page has no record list | N/A: an embedded page has no record list |
| Таблица | populated | passed | passed |
| Таблица | stale | N/A: an embedded page has no last-good data | N/A: an embedded page has no last-good data |
| Таблица | denied | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) |
| Таблица | fatal | passed | passed |
| Устав | loading | passed | passed |
| Устав | empty | N/A: an embedded page has no record list | N/A: an embedded page has no record list |
| Устав | populated | passed | passed |
| Устав | stale | N/A: an embedded page has no last-good data | N/A: an embedded page has no last-good data |
| Устав | denied | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) | N/A: public data, appViewState gets denied=false (AppDeniedPanel is in the editor, see Editor journeys) |
| Устав | fatal | passed | passed |

Дополнительно: тест «плашка и fatal-панель не сдвигают страницу вбок» passed на обоих проектах; перенос текста плашки на 320 px этим прогоном не доказан (см. `19-APPS-UAT.md`, F1).

Дополнительный прогон только `populated` с `--workers=1` на обоих проектах: 16 тестов, 12 passed, 4 skipped (BLOCKED (DATA): «Справочник» и «Сводка» без записей), включая «Сотрудники» passed на обоих проектах.

## Search click-through (7 типов, прогон A)

Для каждого типа spec читает настоящие записи цели, вводит название, кликает результат с нужной меткой и проверяет: одно окно-владелец видно, `data-search-hit="true"` и `aria-current="true"` стоят ровно на выбранной записи (для типа app на окне приложения), запись в видимой области, окно поиска осталось открытым (на phone возвращается через панель задач) и держит запрос.

| Тип результата | Окно-владелец | chromium-desktop | chromium-phone |
|---|---|---|---|
| app | Справочник | passed | passed |
| virus | База вирусов | passed | passed |
| employee | Сотрудники | passed | passed |
| info | Информация | passed | passed |
| guide | Справочник | BLOCKED (DATA) this target serves no guide record to search for. | BLOCKED (DATA) this target serves no guide record to search for. |
| broadcast | Сводка | BLOCKED (DATA) this target serves no broadcast record to search for. | BLOCKED (DATA) this target serves no broadcast record to search for. |
| file | Корзина | passed | passed |

Guide и broadcast на этой цели не проверены: записей нет (BLOCKED (DATA)).

## Media states (прогон A, `media-states.spec.ts`)

Тест только перехватывает запросы КАРТИНОК к чужим хостам, собственные `/api` не трогает.

| Тест media-states.spec.ts | chromium-desktop | chromium-phone |
|---|---|---|
| [STAB-MEDIA-02] a portrait that answers 404 becomes the placeholder; the window, name and caption stay | passed | passed |
| [STAB-MEDIA-03] a portrait that never answers gives up after 15s: placeholder, no endless skeleton | passed | passed |
| [STAB-MEDIA-03] the picture box keeps its size from loading to error (CLS 0 for this element) | passed | passed |
| [STAB-MEDIA-03] switching A -> B -> A always shows the current record's own picture | passed | passed |

## CR-01: регрессия свёрнутых кадров (19-15)

- Код: `14e04c6` (хук и фрейм — `d642673`); Node `v22.13.1`; цель — изолированный staging, зафиксированный в предыдущем прогоне с `refHash 01d085e7b9f0`. Visitor preflight этого прогона: `ready`. Повторная аттестация refHash здесь не выполнялась.
- Целевой прогон: `npm.cmd exec playwright -- test tests/e2e/specs/media-offscreen.spec.ts tests/e2e/specs/media-states.spec.ts --project=chromium-desktop --project=chromium-phone --workers=2` → **14 тестов: 12 passed, 2 skipped, 0 failed**. Оба skipped относятся только к обложкам «Справочника» и записаны ниже как BLOCKED (DATA).
- Регрессия фреймов: `npm.cmd exec playwright -- test tests/e2e/specs/app-states.spec.ts --grep=STAB-APP-06 --project=chromium-desktop --project=chromium-phone --workers=2` → **4 passed, 0 skipped, 0 failed**.
- Собственные `/api` не подменялись. Spec удерживает внешний хост фрейма или перехватывает только запросы картинок к чужим хостам; fixture `assertNoOwnApiFulfilled` проверяет это в каждом тесте.

| Тест | chromium-desktop | chromium-phone |
|---|---|---|
| [CR-01] свёрнутый «Устав»: 16 s без ложного fatal, затем 15 s видимости и retry | passed | passed |
| [CR-01] портрет «Сотрудников»: 16 s в свёрнутом окне, затем 15 s видимости | passed | passed |
| [CR-01] обложки свёрнутого раздела «Справочника» | BLOCKED (DATA): цель не отдаёт карточку с обложкой; доказывается в 19-19 на засеянных данных | BLOCKED (DATA): цель не отдаёт карточку с обложкой; доказывается в 19-19 на засеянных данных |
| [STAB-MEDIA-02] портрет с ответом 404 | passed | passed |
| [STAB-MEDIA-03] медленный портрет: заглушка через 15 s | passed | passed |
| [STAB-MEDIA-03] размер портрета при loading/error | passed | passed |
| [STAB-MEDIA-03] смена записи A → B → A | passed | passed |
| [STAB-APP-06] «Таблица»: fatal через 15 s и retry | passed | passed |
| [STAB-APP-06] «Устав»: fatal через 15 s и retry | passed | passed |

STAB-MEDIA-02/-03/-05 в `REQUIREMENTS.md` остаются Pending до проверки обложек на засеянных данных в 19-19. Результат BLOCKED (DATA) не засчитан как passed.

## Лишние проекты (справочно, не входят в проходной критерий плана)

- `webkit-phone`, `@smoke` из `visitor.spec.ts` на этой цели: 2 passed (12 секунд). Раньше `DesktopPage.goto()` на webkit-phone не проходил даже для @smoke; в этом прогоне проходит.
- `webkit-phone`, три spec Task 1, прогон «все три проекта» (6 воркеров): 36 passed, 11 skipped, 2 failed. Два падения: «Устав: loading» (404 страницы третьей стороны в диагностике, исправлено в spec уже после этого прогона) и «STAB-MEDIA-03, портрет, который не отвечает 15 секунд» (на webkit `loading` к моменту проверки уже `failed`: расхождение таймеров WebKit в spec 19-10; не разбиралось). Итог для webkit: не принят как подтверждение; финальный повтор на webkit после исправления диагностики не выполнялся.

## Editor journeys (mutation-lane, изолированный staging)

Прогон B: `npm run test:e2e:mutation -- tests/e2e/specs/editor-journeys.spec.ts --project=chromium-desktop` (скрипт сам добавляет `--workers=1`, `roles.spec.ts` и `staging-authz.spec.ts`); перед ним `phase16-staging attest` = `ATTESTED`, `refHash 01d085e7b9f0`. Итог: **21 тест, 21 passed, 0 failed** (7 новых editor-journeys и 14 прежних roles и staging-authz). Receipt: `evidence/receipt-playwright-19-14-editor-journeys.json`: `status PASS`, `residual` все пять счётчиков 0, `created` authUsers 13 и editors 11, `deleted` authUsers 13 и editors 10 (одна строка editor перезаписана тестом того же email), схема `portia-staging-receipt-v1`, `commit` в receipt `6da2f94` (после него в spec менялась только проверка сценария 3).

Предыдущая попытка этого прогона дала 20 passed и 1 failed («частичное сохранение»): проверка смотрела на вкладку «Информация», которой после отказа уже нет в полосе вкладок (закрытый раздел скрывается). Проверка заменена на серверную (ревизия +1, новый раздел «Справочника» сохранён, заголовок закрытого раздела прежний). Receipt той попытки (suite FAIL) тоже имеет `residual` 0; в evidence не копировался.

| # | Сценарий | Результат | Что подтверждено |
|---|----------|-----------|------------------|
| 1 | правка и «Сохранить» | passed | пока PUT удержан: статус «Сохраняем…» и нет «Сохранено», набранный текст не потерян; после ответа «Сохранено»; сервер: ревизия +1, заголовок равен введённому |
| 2a | два сеанса, 409, «Загрузить их версию» | passed | у второго сеанса панель «Запись изменили до вас», видны «Заменить своей» и «Их изменения будут перезаписаны.»; после «Загрузить их версию» поле показывает версию первого, в раскрывающемся «Ваши правки» значение второго; на сервере версия первого |
| 2b | два сеанса, 409, «Заменить своей» | passed | статус «Сохранено», панель уходит, на сервере версия второго |
| 3 | раздел закрыт во время правки, изменены два раздела | passed | «Сохранено 1 из 2» (таймеры страницы остановлены фиктивными часами, поэтому закрытый раздел отклоняет сервер, а не клиент после опроса прав); на сервере ревизия +1, новый раздел «Справочника» записан, заголовок закрытого раздела не изменился |
| 6 | сбой проверки прав (abort `/api/access`) | passed | в окне редактора `.app-denied-panel` с «Доступ закрыт» и «Не удалось проверить права. Повторите позже.» (решение владельца 4 A); ждёт опроса прав до 25 секунд |

Данные `portia_content` "main" возвращаются к исходной ревизии в каждом тесте (`withContentRestored`, ревизия сверяется после восстановления). Строки `portia_editors` и пользователи Auth удалены harness (residual 0).

## Upload/cache/network (тот же прогон B)

| # | Сценарий | Результат | Что подтверждено |
|---|----------|-----------|------------------|
| 4 | файл с подменённым типом (`forged.png`, MIME image/png, содержимое — текст) | passed | под полем `.editor-media-error[role=alert]` ровно «Содержимое файла не соответствует формату изображения.» (`uploadRefusal.signature`); значение поля «Фото раздела» осталось прежним |
| 5 | успешный upload (PNG) и повторная загрузка того же URL | passed | значение поля заканчивается `/recycle/<uuid>.png`, схема https; по CDP `Network` ровно одна загрузка этого URL не из кэша, её `Cache-Control` содержит `31536000`; повторные загрузки (второй `Image` и `fetch`) новой загрузки не создали. Тест не различает «ответ из кэша» и «запрос не уходил»: в обоих случаях тело повторно не скачивалось |

Загруженный объект удаляется админ-клиентом сразу после теста (путь `recycle/<uuid>` вне префикса run); `residual.storage` 0.

В логе веб-сервера после каждого сохранения есть «PORTIA cache purge failed for portia-content: Netlify site ID was not found». Это локальное окружение без Netlify (очистка CDN-кэша недоступна); сохранение проходит, на результаты не влияет.

## Что не доказано этим планом (честно)

- Состояние «пусто» для «База вирусов», «Сотрудники», «Информация», «Корзина» и состояние «данные»/stale для «Справочника» и «Сводки»: цель отдаёт непустые (или пустые) источники, а подмена собственных `/api` запрещена. BLOCKED (DATA).
- Поиск типов guide и broadcast: записей на цели нет (BLOCKED (DATA)).
- Reviewer-часть «Повышения» (очередь, банки, F10–F12), живая приёмка STAB-PROM-15 (нужен новый acceptance-seed, не входит в 19-14): не проверялись в этом плане.
- Физический PC/phone, DPR 1.25, перенос на 320 px, длинные тексты: `19-APPS-UAT.md`.

## Вердикт владельца

Источник: `19-UAT.md` (commit 5d7c225, status partial, 11 PASS, 0 issues, 2 BLOCKED), отметки перенесены в `19-APPS-UAT.md`. Устройства: PC и iPhone 16 (Firefox), изолированный staging.

- PASS владельцем (PC и phone): A (состояния 8 приложений), B (поиск), C (медиа-заглушка; значок без подписи в портрете 76 px принят, отступление от UI-SPEC), E (покой иконок, D-17), F1–F8, F13.
- D (редактор): автоматика PASS (Lane B, раздел «Editor journeys», 21/21, residual 0), физически BLOCKED (ENV): на момент проверки не было staging-аккаунта редактора. Это не PASS владельца.
- F9–F12 (reviewer-часть «Повышения»): BLOCKED (ENV), нет аккаунта проверяющего.
- STAB-PROM-15 (живая приёмка «Повышения» на staging): BLOCKED, долг (вариант 2 владельца).
- B6 (Справочник, Сводка): нет данных на staging.

Исправления по находкам владельца во время UAT (коммиты оркестратора, не коммиты задач плана 19-14):

| Коммит | Что исправлено |
|---|---|
| 973d354 | `fix(19-11)`: `key` перед spread в строках результатов поиска (предупреждение React при открытии файла корзины из поиска) |
| 7ca0a35 | `fix(employees)`: лист сотрудников читается только в A1:Z35, ранги не обнуляются из-за типизации даты в столбце E |
| 796e840 (24e0277 отменён в 19468e9) | `fix(trash)`: на телефоне список растёт со строками и страница прокручивается (iOS не листал вложенный список) |
| 97b804d | `fix(desktop)`: копии контента и ростера на устройстве привязаны к источнику данных (чужая/непомеченная копия отбрасывается) |
| 5bef0ef | `todo`: переключатель разделов «Информации» на телефоне перенесён в Phase 20 (кнопка не должна мешать нажатиям) |
| 856c80e | новый staging-прогон `mw0rbyf6_72424cdc` оставлен владельцу, учётные данные во временной папке, не удалён |

## Прогон C (gap closure 19-19)

Среда: код `57a25c8` (Task 1) и `2f01a18` (Task 2), Node 22.13.1, Chromium desktop/phone, 2 workers. Перед каждым матричным запуском guarded `phase16-staging attest` вернул `ATTESTED`, `refHash 01d085e7b9f0`; порт 3000 был свободен. Вердикт владельца по пункту 12: **B** — серверный источник «Сотрудников» не менялся, флаг `--staging-employees` не применялся. Внутренние `/api` не подменялись. После каждого варианта wrapper вернул `restored:true`, а `matrix-residual` — `{"open":false,"contentMatchesSnapshot":true`. Последний манифест: `evidence/19-MATRIX-DATA-RUN.json`, `variant=empty`, `restoredAt` заполнен.

| Прогон | Команда | Passed | Failed | Skipped | Restore |
|---|---|---:|---:|---:|---|
| base | `npm run test:e2e -- tests/e2e/specs/app-states.spec.ts tests/e2e/specs/search-click.spec.ts tests/e2e/specs/media-states.spec.ts tests/e2e/specs/media-offscreen.spec.ts tests/e2e/specs/search.spec.ts --project=chromium-desktop --project=chromium-phone --workers=2` | 85 | 0 | 29 | данные не менялись |
| populated | `node --experimental-strip-types scripts/phase16-staging.mjs matrix-run populated` | 101 | 0 | 13 | true; residual совпал |
| empty | `node --experimental-strip-types scripts/phase16-staging.mjs matrix-run empty` | 70 | 0 | 44 | true; residual совпал |

Счётчики здесь относятся к итоговым прогонам. Две диагностические попытки до исправления test data/spec завершились `populated: 91/9/14` и `empty: 65/7/42`; обе восстановили снимок. Они **не** засчитаны как PASS. Первый сбой вызвали уведомление активного тестового квеста поверх кнопок и слишком узкое ожидание состояния обложки (`loading`, хотя она уже `loaded`). Квест теперь опубликован как предстоящий; CR-01 требует `loading|loaded` во время свёрнутого раздела и `loaded` после раскрытия. Второй сбой выявил тесты, ожидавшие первую строку там, где источник пуст: они теперь дают `BLOCKED (DATA)` после завершения загрузки. Отказ живого ростера после retry также не записывается как PASS.

### Матрица состояний 8 приложений × 6 состояний × 2 проекта

`passed (base/populated/empty)` указывает конкретный успешный прогон. Для `denied` данные публичны и состояние не предусмотрено; для встроенных страниц нет списка записей или last-good. `BLOCKED (DATA)` не является успешной ячейкой.

| Приложение | Состояние | chromium-desktop | chromium-phone |
|---|---|---|---|
| База вирусов | loading | passed (base) | passed (base) |
| База вирусов | empty | passed (empty) | passed (empty) |
| База вирусов | populated | passed (populated) | passed (populated) |
| База вирусов | stale | passed (populated) | passed (populated) |
| База вирусов | denied | N/A: публичные данные | N/A: публичные данные |
| База вирусов | fatal | passed (base) | passed (base) |
| Сотрудники | loading | passed (base) | passed (base) |
| Сотрудники | empty | BLOCKED (DATA): вердикт B, живой ростер не опустошался | BLOCKED (DATA): вердикт B, живой ростер не опустошался |
| Сотрудники | populated | passed (base) | passed (base) |
| Сотрудники | stale | BLOCKED (DATA): вердикт B, нет управляемого desktop источника; отдельный incidental pass в populated не доказывает воспроизводимость | passed (populated) |
| Сотрудники | denied | N/A: публичные данные | N/A: публичные данные |
| Сотрудники | fatal | passed (base) | passed (base) |
| Информация | loading | passed (base) | passed (base) |
| Информация | empty | passed (empty) | passed (empty) |
| Информация | populated | passed (base) | passed (base) |
| Информация | stale | passed (base) | passed (base) |
| Информация | denied | N/A: публичные данные | N/A: публичные данные |
| Информация | fatal | passed (base) | passed (base) |
| Справочник | loading | passed (base) | passed (base) |
| Справочник | empty | passed (empty) | passed (empty) |
| Справочник | populated | passed (populated) | passed (populated) |
| Справочник | stale | passed (populated) | passed (populated) |
| Справочник | denied | N/A: публичные данные | N/A: публичные данные |
| Справочник | fatal | passed (base) | passed (base) |
| Сводка | loading | passed (base) | passed (base) |
| Сводка | empty | passed (empty) | passed (empty) |
| Сводка | populated | passed (populated) | passed (populated) |
| Сводка | stale | passed (populated) | passed (populated) |
| Сводка | denied | N/A: публичные данные | N/A: публичные данные |
| Сводка | fatal | passed (base) | passed (base) |
| Корзина | loading | passed (base) | passed (base) |
| Корзина | empty | passed (empty) | passed (empty) |
| Корзина | populated | passed (base) | passed (base) |
| Корзина | stale | passed (base) | passed (base) |
| Корзина | denied | N/A: публичные данные | N/A: публичные данные |
| Корзина | fatal | passed (base) | passed (base) |
| Таблица | loading | passed (base) | passed (base) |
| Таблица | empty | N/A: у встроенной страницы нет списка записей | N/A: у встроенной страницы нет списка записей |
| Таблица | populated | passed (base) | passed (base) |
| Таблица | stale | N/A: у встроенной страницы нет last-good данных | N/A: у встроенной страницы нет last-good данных |
| Таблица | denied | N/A: публичные данные | N/A: публичные данные |
| Таблица | fatal | passed (base) | passed (base) |
| Устав | loading | passed (base) | passed (base) |
| Устав | empty | N/A: у встроенной страницы нет списка записей | N/A: у встроенной страницы нет списка записей |
| Устав | populated | passed (base) | passed (base) |
| Устав | stale | N/A: у встроенной страницы нет last-good данных | N/A: у встроенной страницы нет last-good данных |
| Устав | denied | N/A: публичные данные | N/A: публичные данные |
| Устав | fatal | passed (base) | passed (base) |

Из прежних 21 `BLOCKED (DATA)` закрыты 18: empty «База вирусов», «Информация», «Корзина» (по две ячейки); populated и stale «Справочник» и «Сводка» (по две на каждое состояние и приложение); guide и broadcast click-through (по две). Отдельно закрыты две CR-01 ячейки обложек «Справочника» из прогона 19-15. Остались три матричные ячейки: empty «Сотрудники» на обоих проектах и stale «Сотрудники» на desktop. Источник «Сотрудников» по вердикту B не управляется матричным вариантом. Отдельные прогоны могли дать удачное чтение живой таблицы, но не устраняют это ограничение. В base также был `BLOCKED (DATA)` portrait offscreen на phone; populated дал passed.

### Search click-through

Каждый тип открывает ровно одно окно-владелец, помечает выбранную сущность и оставляет поиск открытым; draft «Сводки» не индексируется. Все семь типов прошли на опубликованных данных populated.

| Тип | Окно-владелец | chromium-desktop | chromium-phone |
|---|---|---|---|
| app | Справочник | passed (populated) | passed (populated) |
| virus | База вирусов | passed (populated) | passed (populated) |
| employee | Сотрудники | passed (populated) | passed (populated) |
| info | Информация | passed (populated) | passed (populated) |
| guide | Справочник | passed (populated) | passed (populated) |
| broadcast | Сводка | passed (populated) | passed (populated) |
| file | Корзина | passed (populated) | passed (populated) |

### Media states и CR-01

| Проверка | chromium-desktop | chromium-phone |
|---|---|---|
| Портрет 404 → fallback, текст и размер окна сохранены | passed (populated) | passed (populated) |
| Портрет не отвечает 15 s → fallback, бесконечного skeleton нет | passed (populated) | passed (populated) |
| Размер портрета от loading до error | passed (populated) | passed (populated) |
| Смена записи A → B → A без старого изображения | passed (populated) | passed (populated) |
| CR-01: свёрнутый «Устав», затем visible timeout/retry | passed (populated) | passed (populated) |
| CR-01: свёрнутый портрет «Сотрудников» | passed (populated) | passed (populated) |
| CR-01: обложки свёрнутого «Справочника» после 16 s и раскрытия | passed (populated) | passed (populated) |

WR-07: тест «ЁЖ / ёж / еж» в populated **passed на обоих проектах**. В каждом проекте три счётчика равны и строго больше нуля (`counts[0] > 0`, `new Set(counts).size === 1`); точное число результатов reporter не сохраняет. В base/empty тест пропущен как `BLOCKED (DATA)`, поскольку там нет записи с «ё/е» — эти пропуски не учитывались как PASS. `page.waitForTimeout(600)` заменён на `page.clock.runFor(450)`.

Оставшиеся Pending из этого плана: **STAB-DESK-08**, **STAB-APP-02**, **STAB-APP-10** — empty «Сотрудники» на обоих проектах и desktop stale не доказаны при вердикте B. Остальные требования переводятся в Complete только после сверки соответствующих строк и открытых пунктов `19-VERIFICATION.md`.

Окружение: цикл перезагрузки Next dev («HMR hash mismatch») устранён очисткой `.next/dev`; дефектом продукта не является.
