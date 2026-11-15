---
phase: PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo
verified: 2026-11-15T14:00:00Z
status: human_needed
score: 5/5 must-haves verified
covered_files:
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-01-PLAN.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-01-SUMMARY.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-02-PLAN.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-02-SUMMARY.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-03-PLAN.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-03-SUMMARY.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-04-PLAN.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-04-SUMMARY.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-05-PLAN.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-05-SUMMARY.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-06-PLAN.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-06-SUMMARY.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-07-PLAN.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-07-SUMMARY.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-08-PLAN.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-08-SUMMARY.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-09-PLAN.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-09-SUMMARY.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-10-PLAN.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-10-SUMMARY.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-11-PLAN.md
  - .planning/phases/PORTIA-24-urovni-dopuska-i-zakrytie-soderzhimogo/24-11-SUMMARY.md
  - app/api/content/route.ts
  - app/portia.css
  - components/portia-access-gate.tsx
  - components/portia-desktop-documents.tsx
  - components/portia-desktop-dossier.tsx
  - components/portia-desktop.tsx
  - components/portia-editor-dossier.tsx
  - components/portia-editor.tsx
  - components/portia-level-picker.tsx
  - components/portia-redacted.tsx
  - lib/access-levels.ts
  - lib/access-viewer.ts
  - lib/content-response.ts
  - lib/content-save.ts
  - lib/content-sync.ts
  - lib/device-cache.ts
  - lib/editor-changes.ts
  - lib/embedded-documents.ts
  - lib/level-copy.ts
  - lib/level-hierarchy.ts
  - lib/level-placeholders.ts
  - lib/level-redact.ts
  - lib/portia-content-normalize.ts
  - lib/portia-content.ts
  - proxy.ts
  - tests/e2e/specs/access-levels.spec.ts
covered_digest: "v4:sha256:21d5b92b3ec57ac618e63f8c484ea28cdf7dd52c0880f4b13bc5c7de3754034d"
behavior_unverified: 0
overrides_applied: 0
human_verification:
  - test: "Живая смена уровня и отзыв доступа (LVL-09): на изолированном staging с настоящими ролями одобрить посетителя, открыть сайт, в «Пользователях» понизить его уровень, затем отозвать доступ; страницу не перезагружать."
    expected: "Через не более 30 с открытая запись заменяется «ЗАСЕКРЕЧЕНО · нужен допуск N», окно остаётся открытым; после отзыва — экран «Доступ отозван», кэш контента и сотрудников в localStorage пуст."
    why_human: "BLOCKED: живые роли и Postgres/RLS. В этой фазе уровень менялся только в подменённом ответе /api/** (24-BROWSER-EVIDENCE, S6, mocked API)."
  - test: "Живые роли и RPC шлюза: посетитель, одобренный посетитель, редактор, владелец получают разное содержимое от настоящего GET /api/content (редактор — полное, посетитель — по уровню)."
    expected: "Ответ посетителя не содержит названий, картинок, текста и ключей formattedText записей выше его уровня; ответ редактора — полное содержимое без маркера redaction."
    why_human: "BLOCKED: аутентификация и Postgres/RLS не исполнялись; ответы шлюза в тестах выдуманы."
  - test: "Заголовки кэша на настоящем хостинге: GET /api/content на Netlify (staging) для двух разных зрителей подряд."
    expected: "Cache-Control: no-store и Netlify-CDN-Cache-Control: no-store, нет Netlify-Cache-Tag; Set-Cookie допустим только как no-store ответ редактора; второй зритель не получает копию первого."
    why_human: "BLOCKED: Netlify CDN не проверялся; код выставляет заголовки (lib/portia-cdn.ts, route.ts), реальное поведение хостинга — нет."
  - test: "Телефон и скринридер: «Информация» на 390 px с открытым разделом, у которого все подразделы закрыты (WR-01); имя группы выбора уровня «Устав» (WR-02); реальные размеры экранов."
    expected: "Тело открытого раздела открывается тапом; группа выбора уровня озвучивается с именем записи; нет горизонтальной прокрутки."
    why_human: "BLOCKED: физические устройства и скринридер; WR-01 и WR-02 — открытые замечания код-ревью."
  - test: "Прямое чтение таблицы portia_content анонимом по публичному ключу (SEC-01) — остаточный риск."
    expected: "До Phase 25 чтение возможно и обходит очистку сайта; записано в известных ограничениях (D-03, D-11), не засчитывается как закрытое."
    why_human: "Передано Phase 25 (SEC-01); требует изолированного Supabase проекта."
---

# Phase 24: Уровни допуска и закрытие содержимого — отчёт о проверке

**Цель фазы:** У записей есть нужный уровень допуска, и посетитель с меньшим уровнем не получает их ни в ответе сервера, ни в поиске, ни в кэше — вместо записи он видит строку «ЗАСЕКРЕЧЕНО · нужен допуск N»; редактор всегда работает с полным содержимым.
**Проверено:** 2026-11-15
**Статус:** human_needed
**Повторная проверка:** нет — первичная проверка

Вывод одной строкой: цель достигнута в объёме, который разрешает Acceptance gate фазы (локальная сборка, тесты-приманки, подмена API). Провалов (gaps) нет. Остаются непроверенные живые линии (BLOCKED), они не засчитаны как пройденные, поэтому статус `human_needed`, а не `passed`. Три предупреждения код-ревью (WR-01..03) остаются открытыми и не противоречат пунктам цели, но WR-01 — реальная регрессия в крайнем случае (см. ниже).

## Что проверено сам, а не по SUMMARY

| Проверка | Команда / способ | Результат |
|---|---|---|
| Unit-набор | `node --experimental-strip-types --test lib/*.test.ts` (Node 22.13.1) | код 0: tests 2104, pass 2101, fail 0, skipped 3 (прежние opt-in живые наборы) |
| Типы | `node node_modules/typescript/bin/tsc --noEmit` | код 0, вывод пуст |
| Серверный код | чтение `lib/level-redact.ts`, `lib/content-response.ts`, `lib/content-save.ts`, `app/api/content/route.ts`, `lib/access-viewer.ts`, `lib/level-hierarchy.ts`, `lib/access-levels.ts`, `lib/content-sync.ts`, `lib/device-cache.ts` | реализация существенная, не заглушки |
| Клиентский код | чтение `components/portia-desktop.tsx`, `portia-desktop-dossier.tsx`, `portia-redacted.tsx`, `portia-editor.tsx` (места `LevelPicker`) | проводка есть |
| Маркеры долга | grep `TBD/FIXME/XXX` по изменённым файлам и по добавленным строкам diff `d9114aa..HEAD` | не найдено |
| Браузерная спецификация | не перезапускалась (нужен сервер сборки; запрещено правилами проверки) | см. «Не перепроверено» |

Не перепроверено: `tests/e2e/specs/access-levels.spec.ts` (9 тестов, mocked API) я не запускал — полагаюсь на запись в `24-BROWSER-EVIDENCE.md` (код выхода 0, 2026-11-15) и на существование спецификации. Это подменённый API, не живой прогон. Полный `npm run build` на итоговом HEAD с настоящим источником данных — BLOCKED по `24-LOCAL-CHECK.md`.

## Достижение цели

### Наблюдаемые истины (критерии успеха ROADMAP)

| # | Истина | Статус | Доказательство |
|---|--------|--------|----------------|
| 1 | Редактор задаёт нужный уровень каждой записи в «Базе вирусов», «Справочнике», «Информации» и «Уставе» одним общим элементом; нет поля = 1; раздел не доступнее приложения, подраздел не доступнее раздела [LVL-02, LVL-03] | ✓ VERIFIED | `LevelPicker` подключён для вируса (`portia-editor.tsx:1276`), записи учёного (`:1323`), «Устава» (`:1339`, `LEVELED_APP_IDS`), раздела и подраздела «Информации» (`:1357/:1369`), раздела и карточки «Справочника» (`:1421/:1444`). `requiredLevelOf(undefined)=1`, мусор=5 (`lib/access-levels.ts:23-27`). Иерархия: `effectiveLevel`/`raiseChildren`/`raiseChildLevels` (`lib/level-hierarchy.ts`), в редакторе `min=effectiveLevel(section.level,1)` и автоподъём детей; на сервере PUT всегда прогоняет `raiseChildLevels` (`lib/content-save.ts:23`), поэтому нарушение не сохраняется при любом клиенте; редакция тоже берёт `max(own, section)`. Уровня у самого «Справочника»/«Информации» нет (A-5): «раздел ≥ приложения» относится к «Уставу», у которого иерархии нет. Тесты `lib/level-hierarchy.test.ts`, `level-editor.test.ts` зелёные. |
| 2 | Посетитель с недостаточным уровнем видит только «ЗАСЕКРЕЧЕНО · нужен допуск N»; закрытое не уходит ни в ответ сервера, ни в поиск, ни в рекомендации, ни в «Корзину», ни в кэш браузера; доказано приманками 1–5 включая `formattedText` [LVL-04, LVL-05] | ✓ VERIFIED (локально; живые CDN/RLS/роли BLOCKED) | Ответ строится по именам полей, не копированием хранимого объекта (`level-redact.ts:233-260`); закрытое выпадает из массивов, раздел — один узел без детей (D-10), `formattedText` — белый список префиксов с проверкой «открытая запись существует», неизвестные префиксы отбрасываются (`:193-219`); рекомендации поиска с названием закрытого удаляются вместе с общим ключом (`:188-191`); корзина: закрытый вирус и файл закрытого вируса — заглушка на месте, файл с битым `virusId` закрыт уровнем 5 (RLS24-01 исправлено); черновики сводок не уходят. GET: `no-store` на всех ответах, без тега кэша, 401 до чтения строки (`route.ts:23-55`); `localStorage` ключуется зрителем, при несовпадении сбрасывается (`device-cache.ts:26`, `portia-desktop.tsx:757`). Заглушка — статичный `RedactedPlaceholder` без кнопки/ссылки (`portia-redacted.tsx`), текст через `levelCopy.redacted` = «ЗАСЕКРЕЧЕНО · нужен допуск N». Поиск и рекомендации работают над уже очищенным клиентским содержимым, «Устав» убирается из глобального поиска при закрытии (`portia-desktop.tsx:1500-1501`). Приманки 1–5: `lib/level-redact.test.ts` (строки 54, 246 и др.), все зелёные. Ограничение: прямое анонимное чтение таблицы и CDN — Phase 25 (SEC-01), не заявлено закрытым. |
| 3 | Записи учёных необязательны; пустой блок не показывается; существующие не удаляются; старые уровни II/III/IV работают на шкале 1–5 по реальному уровню [LVL-06, LVL-07] | ✓ VERIFIED | Новая карточка создаётся с `scientistLogs: []` (`portia-editor.tsx:435`); `portia-desktop-dossier.tsx:20` рисует блок только при `virus.scientistLogs.length > 0`; «ЗАПИСИ ОТСУТСТВУЮТ» нет в компонентах (проверка в `level-visitor.test.ts:122`); сохранение не требует записей, редактор показывает «Карточку можно сохранить без них». Нормализатор не создаёт и не удаляет записи (`portia-content-normalize.ts:360-378`). Уровень записи: нет поля = 1, целое 1..5 как есть (старые 2/3/4 читаются как 2/3/4), мусор = 5; открыта/закрыта по серверной метке `withheld`, посчитанной по реальному уровню посетителя (`level-redact.ts:52-62`), римских цифр нет (`levelCopy.logLevel` — арабские). Закрытая запись показывает номер, название и учёного, текст и `richContent` не отдаются (узкое исключение D-12). Плашка «ТЕКУЩИЙ УРОВЕНЬ ДОСТУПА» — реальный уровень. |
| 4 | Сохранение редактором никогда не удаляет скрытые записи; изменение уровня или отзыв применяются при следующем обновлении без перезагрузки [LVL-08, LVL-09] | ✓ VERIFIED (локально, по тестам и подмене API; живая часть LVL-09 BLOCKED) | LVL-08: редактор и владелец всегда получают `withoutViewerMarkers(stored)` без очистки (`content-response.ts:29-33`); PUT отказывает 422 `viewer-copy`, если в теле есть ключ `redaction` с любым значением или есть `withheld` (`content-save.ts:18-22`, `route.ts:80-81`), до чтения и записи строки; редактор на неполной копии не показывает форм и не сохраняет (`portia-editor.tsx:1182`, `:949`). LVL-09: опрос 30 с у посетителя, 10 с у редактора, немедленно при возврате на вкладку (`portia-desktop.tsx:151-152`, `:821`); тот же номер ревизии от другого зрителя принимается (`content-sync.ts` `acceptFetchedContent` + `viewerKeyOf`), поздний устаревший ответ отбрасывается по номеру запроса (`isNewerAnswer`); 401 `access-required` очищает кэши устройства и просит шлюз перепроверить (`portia-desktop.tsx:582-589`); окно с ставшей закрытой записью заменяется блоком-заглушкой, выбор согласуется `reconcileSelection`. Тесты зелёные; браузерный S6 (понижение 3→2, повышение, отзыв без перезагрузки) пройден на подменённом API по записи в `24-BROWSER-EVIDENCE.md` (не перезапускался мной). Живая смена уровня в «Пользователях» — BLOCKED. |
| 5 | Ограничение «Устава» и «Таблицы» только на сайте; прямые ссылки открыты; записано в известных ограничениях и релизных заметках; тексты не заявляют закрытия [SEC-07] | ✓ VERIFIED | `.planning/PROJECT.md:140` (известное ограничение, с оговоркой про историю git и старые сборки и про то, что у «Таблицы» уровня нет, O-1); `24-RELEASE-NOTES.md` «Известные ограничения»; адрес «Устава» лежит только в `lib/embedded-documents.ts` (сервер) и отдаётся только при достаточном уровне (`content-response.ts:34-38`), в клиентском коде его нет (grep по репозиторию вне `.planning` и временного `.claude/worktrees`). Релизные заметки и PROJECT.md не обещают закрытия ссылок. |

**Счёт:** 5/5 истин подтверждено; 0 «присутствует, поведение не доказано» (переходы LVL-08/LVL-09 покрыты поведенческими тестами). Все пять оговорки о живых линиях вынесены в `human_verification`.

### Требуемые артефакты

| Артефакт | Назначение | Статус | Детали |
|---|---|---|---|
| `lib/level-redact.ts` | чистая серверная очистка по уровню | ✓ VERIFIED | 261 строка, подключена в `content-response.ts`; приманочные тесты 554 строки |
| `lib/content-response.ts` | тело GET по зрителю, HMAC-ключи заглушек | ✓ VERIFIED | подключена в `route.ts` |
| `app/api/content/route.ts` | GET по зрителю + PUT с отказом копии «для зрителя» | ✓ VERIFIED | `no-store`, `contentBodyFor`, `prepareContentSave` |
| `lib/content-save.ts`, `lib/level-hierarchy.ts` | отказ 422 и подъём детей | ✓ VERIFIED | подключены в PUT и в редакторе |
| `lib/level-placeholders.ts` | слияние заглушек, `reconcileSelection`, `isViewerShapedContent` | ✓ VERIFIED | используются `portia-desktop.tsx` |
| `components/portia-redacted.tsx` | статичная заглушка пяти форм | ✓ VERIFIED | используется в «Базе вирусов», «Информации», «Справочнике», «Корзине», «Уставе» |
| `components/portia-level-picker.tsx` | общий выбор «1 2 3 4 5» | ✓ VERIFIED | WR-02 (имя группы) открыто |
| `lib/embedded-documents.ts` | адрес «Устава» только на сервере | ✓ VERIFIED | импортируется только из `content-response.ts` |
| `lib/content-sync.ts`, `lib/device-cache.ts` | ключ зрителя, порядок ответов, очистка кэша | ✓ VERIFIED | подключены в `portia-desktop.tsx` |
| `tests/e2e/specs/access-levels.spec.ts` | браузерные backstop-проверки, mocked API | ✓ PRESENT (не перезапускался) | доказательства — `24-BROWSER-EVIDENCE.md` |

### Проверка ключевых связей

| От | К | Через | Статус |
|---|---|---|---|
| `GET /api/content` | `redactContentForViewer` | `viewerOf(resolveGate)` → `contentBodyFor` | ✓ WIRED |
| `PUT /api/content` | отказ копии зрителя и подъём иерархии | `prepareContentSave` до чтения/записи | ✓ WIRED |
| ответ `redaction` | UI-заглушки | `mergePlaceholders`/`flattenPlaceholders` → `RedactedPlaceholder` | ✓ WIRED |
| 401 `access-required` | экран «Доступ отозван» и сброс кэша | `clearDeviceContentCaches` + `onAccessLost` → `refresh` шлюза | ✓ WIRED |
| ключ зрителя | кэш устройства | `cacheMatchesViewer`, штамп в `stampCacheSource` | ✓ WIRED |
| «Устав» закрыт | окно и поиск | `content.redaction.apps.charter` → блок-заглушка, исключение из поиска | ✓ WIRED |

### Трассировка данных (уровень 4)

| Артефакт | Переменная | Источник | Реальные данные | Статус |
|---|---|---|---|---|
| «База вирусов», «Информация», «Справочник» | `content` / `content.redaction` | `fetch("/api/content")` → `contentBodyFor` → строка `portia_content` | да (читается публичным клиентом Supabase; прямое анонимное чтение — Phase 25) | ✓ FLOWING |
| Окно «Устав» | `documents.charter` | `embeddedDocuments` на сервере, только при достаточном уровне | да | ✓ FLOWING |
| Плашка уровня | `viewerLevel` / `redaction.level` | решение шлюза и маркер ответа | да (WR-03: запасное значение 5 без маркера) | ⚠️ STATIC-fallback только на экране отказа |

### Поведенческие проверки

| Поведение | Команда | Результат | Статус |
|---|---|---|---|
| Приманки 1–5, `formattedText`, корзина, рекомендации | `node --experimental-strip-types --test lib/*.test.ts` (включая `level-redact.test.ts`) | 2104 теста, 0 падений | ✓ PASS |
| Типы | `node node_modules/typescript/bin/tsc --noEmit` | код 0 | ✓ PASS |
| Браузер на подменённом API (S1/S3/S4/S6) | `24-BROWSER-EVIDENCE.md`, `access-levels.spec.ts` | запись: 9/9, код 0 (мной не повторялось) | ? SKIP (по записи; mocked API) |

### Выполнение проб

SKIPPED: фаза не объявляет `probe-*.sh`; `scripts/*/tests/probe-*.sh` не требуются.

### Покрытие требований

| Требование | План(ы) | Описание | Статус | Доказательство | Рекомендация для REQUIREMENTS.md |
|---|---|---|---|---|---|
| LVL-02 | 24-01, 02, 03, 07, 08 | Редактор задаёт уровень записи, нет поля = 1 | ✓ SATISFIED | истина 1 | Complete (уже отмечено) |
| LVL-03 | 24-03, 06, 08 | Вложенная часть не доступнее родителя | ✓ SATISFIED | истина 1; сервер нормализует в PUT, редактор блокирует и поднимает | **отметить Complete** (сейчас Pending) |
| LVL-04 | 24-01, 02, 05, 09, 10, 11 | Строка «ЗАСЕКРЕЧЕНО · нужен допуск N» без названия, картинки, текста | ✓ SATISFIED | истина 2 (исключение D-12 — записи учёных, подтверждено владельцем) | Complete (уже отмечено) |
| LVL-05 | 24-01, 04, 05, 10, 11 | Закрытое не попадает в ответ, поиск, рекомендации, «Корзину», кэш | ✓ SATISFIED (на сайте; прямое чтение таблицы и CDN — Phase 25) | истина 2 | Complete (уже отмечено) |
| LVL-06 | 24-04, 07 | Записи учёных необязательны | ✓ SATISFIED | истина 3 | **отметить Complete** (сейчас Pending) |
| LVL-07 | 24-03, 04, 07 | Старые II/III/IV на шкале 1–5 по реальному уровню | ✓ SATISFIED | истина 3 | **отметить Complete** (сейчас Pending) |
| LVL-08 | 24-06, 08, 10, 11 | Сохранение не удаляет скрытое | ✓ SATISFIED | истина 4 | Complete (уже отмечено) |
| LVL-09 | 24-02, 04, 09, 11 | Изменение уровня и отзыв без перезагрузки | ⚠️ SATISFIED локально (код, тесты, mocked API); живая проверка BLOCKED | истина 4, `human_verification` №1 | **оставить Pending** до живого прогона на staging; в REQUIREMENTS приписать «локально подтверждено, live BLOCKED». Не записывать PASS. |
| SEC-07 | 24-05, 10 | Ограничение только на сайте, записано | ✓ SATISFIED | истина 5 | Complete (уже отмечено) |

Все девять ID из ROADMAP присутствуют в `requirements:` планов 24-01..24-11, потерянных нет. ORPHANED: нет (в REQUIREMENTS.md за Phase 24 закреплены ровно эти девять).

### Антипаттерны

| Файл | Строка | Шаблон | Серьёзность | Влияние |
|---|---|---|---|---|
| — | — | `TBD/FIXME/XXX` в изменённых файлах | — | не найдено |
| `components/portia-desktop.tsx` | 1987-1994 | `hasSubsections` считает заглушки (WR-01) | ⚠️ Warning | на телефоне тело открытого раздела «Информации» недостижимо, если все подразделы закрыты |
| `components/portia-level-picker.tsx` | 22-23 | `<legend>` не первый потомок `<fieldset>` (WR-02) | ⚠️ Warning | у пикера «Устав» группа без доступного имени |
| `lib/level-placeholders.ts` | 111-113 | `shownViewerLevel` без маркера = 5 (WR-03) | ⚠️ Warning | подпись «ДОПУСК 5» на экране отказа при офлайн-первой загрузке |

### Решение по замечаниям код-ревью (24-REVIEW.md)

Критических нет, на цель и истины 1–5 ни одно замечание не влияет напрямую: утечек закрытого содержимого они не открывают. Все 10 записей в `24-REVIEW-DISPOSITION.md` имеют статус `open` (не triaged).

- **WR-01 (телефон, «Информация»)** — подтверждено чтением кода: `hasSubsections = subRows.length > 0` включает заглушки, а `infoOverviewVisible` смотрит на открытые подразделы, так что для открытого раздела с телом и только закрытыми подразделами нет пути к телу. Это регрессия относительно поведения до фазы 24 для открытого содержимого, но только в узком сценарии (телефон, раздел с телом, все подразделы выше уровня). Не противоречит ни одной истине (закрытое не утекает), поэтому не BLOCKER. Рекомендация: починить до Phase 26 (она работает с «Информацией» на телефоне), добавить unit или e2e тест на 390 px. Предупреждение, ждёт решения владельца: чинить сейчас отдельным gap-планом или передать в Phase 26.
- **WR-02 (a11y пикера)** — не противоречит цели; проверка со скринридером всё равно BLOCKED. Исправляется заменой порядка `legend`/`caption`; можно в Phase 26 (единый стиль).
- **WR-03 (запасной «ДОПУСК 5»)** — не утечка: записи при этом не показываются (`hasData` берётся из `lastGoodAt`, у дефолтного содержимого его нет, вид «fatal»; дефолтное содержимое — публичные заготовки). Но нарушает дух D-15 (показывать реальный уровень) и принцип «неизвестное = строже». Не блокирует; исправление дешёвое (брать `viewerLevel` шлюза).
- **IN-01..IN-07** — информационные, не влияют на истины. Из них ближе всего к цели IN-07 (поздний 401 может стереть свежий офлайн-кэш; доступ не страдает) и IN-06 (503 на пути редактора при коротком секрете; шлюз без секрета и так не работает).

Вердикт по замечаниям: ни одно не делает фазу FAILED. WR-01 и WR-03 стоит закрыть или явно принять; решение прошу принять владельца/оркестратора.

### Человеческая проверка / BLOCKED (не засчитано как пройденное)

См. `human_verification` во frontmatter. Кратко: живые роли и RPC шлюза; Postgres/RLS; staging и production; заголовки кэша Netlify CDN; физические устройства и реальные размеры экранов; скринридер; другие движки (Firefox, WebKit) и проекты `chromium-dpr125`/`chromium-phone`; живая смена уровня человеком в «Пользователях» (LVL-09). Дополнительно: сам `bash .claude/skills/portia-check/run.sh` не отработал (сломан `npm` временного Node), прямые эквиваленты зелёные — это честно записано в `24-LOCAL-CHECK.md` и не равно прогону `run.sh`; `npm run build` с настоящим источником данных — BLOCKED. Остаточный риск, переданный Phase 25 (SEC-01): анонимное чтение `portia_content` по публичному ключу обходит очистку сайта; принят владельцем (D-03, D-11) и записан в `PROJECT.md`.

### Резюме пробелов

Пробелов (gaps) нет. Цель фазы по Acceptance gate (локальная сборка + тесты-приманки + подмена API) достигнута; всё, что требует живой аутентификации, Postgres/RLS, staging, CDN и устройств, честно оставлено BLOCKED и вынесено в человеческую проверку. LVL-09 рекомендуется оставить Pending до живого подтверждения; LVL-03, LVL-06, LVL-07 по коду выполнены и должны быть отмечены Complete.

---

_Проверено: 2026-11-15_
_Проверяющий: Claude (gsd-verifier)_
