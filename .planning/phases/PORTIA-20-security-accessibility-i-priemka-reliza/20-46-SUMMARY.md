---
phase: PORTIA-20-security-accessibility-i-priemka-reliza
plan: 46
subsystem: ui
tags: [hints, copy, d-56, d-58, accessibility, register, template-builder, promotion, editor-shared-components]

requires:
  - phase: PORTIA-20
    provides: "20-41/20-42/20-44/20-45 (конструктор шаблона, карточка архива, кнопка «ОФОРМЛЕНИЕ»), решения D-56, D-57, D-58"
provides:
  - "20-HINTS-INVENTORY.md: реестр 140 строк (где показано, было, стало, решение, тесты) с итогом и заметками для владельца"
  - "lib/phase20-hints-inventory.test.ts: охрана реестра (старые тексты ушли, новые есть, длины, фразы-образцы, поиск длинных пояснений по AST, самопроверка)"
  - "Короткие подсказки по всему сайту, кроме components/portia-editor.tsx (D-58)"
affects: [20-47, 20-13]

actuals:
  tokens: 37500
  tasks: 3
  commits: 4
estimate_actuals_note: "chars/4 над diff PLAN_BASE..HEAD без .planning (149807 символов); реестр 20-HINTS-INVENTORY.md в оценку не входит"
plan_head_before: a68d47103fb60b20437b1c6d9a7f93a6b161ca3e
plan_head_after: df05717beb758c103bd3f3d0f0c0cc578bfaab46
commits: 4

tech-stack:
  added: []
  patterns:
    - "Реестр текстов как проверяемый артефакт: таблица в .md разбирается тестом и сверяется с исходниками; поиск длинных пояснений идёт по AST TypeScript (JsxText, строки, части шаблонных строк)"
    - "Файл включается в «применённые» только после правки: до этого «Было» обязано быть в коде, после - обязано исчезнуть из всех источников"

key-files:
  created:
    - .planning/phases/PORTIA-20-security-accessibility-i-priemka-reliza/20-HINTS-INVENTORY.md
    - lib/phase20-hints-inventory.test.ts
  modified:
    - components/portia-template-builder.tsx
    - lib/format-launch.ts
    - components/portia-desktop.tsx
    - components/portia-promotion.tsx
    - components/portia-promotion-editor-main.tsx
    - components/portia-promotion-ordinary-editor.tsx
    - components/portia-promotion-qualification-editor.tsx
    - components/portia-editor-rich-text.tsx
    - components/portia-editor-dossier.tsx
    - app/owner-login/page.tsx
    - lib/accent-theme.test.ts
    - lib/portia-promotion-editor.test.ts
    - lib/portia-promotion-ui.test.ts
    - lib/portia-qualification-ui.test.ts
    - lib/portia-template-builder.test.ts
    - tests/e2e/specs/accessibility.spec.ts
    - tests/e2e/specs/template-builder.spec.ts
    - tests/e2e/specs/visitor.spec.ts
    - tests/e2e/visual-candidates/promotion.spec.ts
    - tests/e2e/visual-candidates/phase20-art.spec.ts

key-decisions:
  - "D-56 в объёме D-58: components/portia-editor.tsx не менялся (git diff PLAN_BASE..HEAD пуст), его 38 строк в реестре «оставлено: D-58»; охрана D-57 в lib/format-launch.test.ts зелёная и не расширялась (файл не правился)."
  - "Правило сокращения: чистые пояснения убраны, нужные - одна фраза до 8 слов; ошибки, причины недоступности и результаты сокращены до одной фразы, но не удалены; одно-фразовые состояния до 12 слов оставлены."
  - "Предупреждение теста на ПК («Не переключайте вкладку и окно…», утверждено владельцем в 19) оставлено дословно как предупреждение безопасности (11 слов); текст для телефона из того же утверждения (13 слов, больше предела 12) сокращён до «Можно переключаться между приложениями.»; подсказка «Анимации» (утверждена в 18) сокращена. Оба случая вынесены в заметки реестра для галереи 20-47."
  - "Подтверждения необратимых действий оставлены или сокращены с сохранением последствия: «Если вернуться сейчас, набранное будет потеряно.», «Запрос и связанные данные будут удалены без восстановления.», «Вопрос будет удалён. Это нельзя отменить.»"

requirements-completed: [STAB-A11Y-03, STAB-VIS-04, STAB-TMPL-01]

coverage:
  - id: D1
    description: "Реестр подсказок 20-HINTS-INVENTORY.md: 140 строк (55 сокращено, 11 убрано, 74 оставлено, из них 38 D-58), охраняется тестом: старые тексты ушли из кода, новые есть, длины в пределах правила, каждый текст от 7 слов записан, фраз-образцов нет"
    requirement: STAB-A11Y-03
    verification:
      - kind: unit
        ref: "lib/phase20-hints-inventory.test.ts (6 тестов, включая самопроверку на синтетическом реестре)"
        status: pass
    human_judgment: false
  - id: D2
    description: "Конструктор шаблона и кнопка «ОФОРМЛЕНИЕ»: заметка вверху, подсказки слота изображения, состояние, подтверждение ухода и причина недоступности скачивания - одна короткая фраза; доступные имена кнопки не менялись"
    requirement: STAB-TMPL-01
    verification:
      - kind: e2e
        ref: "template-builder.spec.ts + accessibility.spec.ts, chromium-desktop и chromium-phone, --retries=0: 32 passed (Task 1)"
        status: pass
      - kind: unit
        ref: "lib/format-launch.test.ts (8 pass)"
        status: pass
    human_judgment: true
    rationale: "Хватает ли короткого текста для понимания (в частности «Изображения — только файлом.»), решает владелец по галерее 20-47"
  - id: D3
    description: "Рабочий стол, Повышение, редакторы Повышения, общие компоненты редактора и страница входа: подсказки сокращены или убраны, причины и ошибки сохранены"
    requirement: STAB-VIS-04
    verification:
      - kind: unit
        ref: "npm test (node --experimental-strip-types --test lib/*.test.ts): 1538 tests, 1534 pass, 0 fail, 4 skipped"
        status: pass
      - kind: e2e
        ref: "accessibility.spec.ts + visitor.spec.ts + template-builder.spec.ts на сборке HEAD (chromium-desktop, chromium-phone): 75 passed, 16 skipped, 1 failed (устаревший спек «Информация» на телефоне, не связан с планом, см. deferred-items.md)"
        status: pass
      - kind: automated_ui
        ref: "visual-candidates/promotion.spec.ts, набор phase20-dev-hints-d56: 16 passed"
        status: pass
    human_judgment: true
    rationale: "Роли участника и проверяющего и живые окна Повышения не проверены на цели (BLOCKED ENV); читаемость коротких формулировок оценивает владелец"
  - id: D4
    description: "Файл редактора не менялся (D-58), подсказки общих компонентов видны в нём короткими"
    requirement: STAB-A11Y-03
    verification:
      - kind: unit
        ref: "git diff --exit-code PLAN_BASE HEAD -- components/portia-editor.tsx: код 0; lib/format-launch.test.ts (охрана 449c756) зелёная"
        status: pass
    human_judgment: false

duration: 28 min
completed: 2026-11-07
status: complete
---

# Phase PORTIA-20 Plan 46: подсказки сайта короткие или убраны (D-56 в объёме D-58) Summary

**По всему сайту, кроме файла редактора, подсказки сокращены до одной фразы или убраны (55 сокращено, 11 убрано), ошибки, причины и подтверждения сохранены, а реестр из 140 строк закреплён тестом, который читает исходники по AST и ловит любой незаписанный длинный текст; components/portia-editor.tsx не изменён.**

## Performance

- **Duration:** 28 min
- **Started:** 2026-11-07T11:34:32Z
- **Completed:** 2026-11-07T12:02:05Z
- **Tasks:** 3 (Task 1 tracer, Task 2, Task 3)
- **Files modified:** 21 вне `.planning` (2 созданы: реестр в `.planning`, тест реестра); 388 строк добавлено, 92 удалено
- **PLAN_BASE:** `a68d47103fb60b20437b1c6d9a7f93a6b161ca3e` (записан и в теле коммита `7009008`)

## Accomplishments

- Реестр `20-HINTS-INVENTORY.md`: `| ID | Файл | Где показано | Было | Стало | Решение | Тесты и имена |`, 140 строк; «Тесты и имена» вычислены поиском по тестам на PLAN_BASE. Итог: 55 сокращено, 11 убрано, 74 оставлено (24 ошибка или состояние, 5 уже коротко, 2 подтверждение необратимого действия, 1 предупреждение безопасности, 4 содержимое, **38 «оставлено: D-58»**).
- Тест `lib/phase20-hints-inventory.test.ts`: разбор таблицы, допустимые решения и пределы слов (сокращено до 8, предупреждение и подтверждение до 12), «Было» исчезло из components, app (без api) и не-тестовых lib для применённых файлов, «Стало» есть в файле, у строк редактора только «оставлено: D-58», фразы-образцы отсутствуют, поиск текстов от 7 слов с кириллицей (JsxText, строки, части шаблонных строк через `typescript`) находит только записанное, итог совпадает со строками, список применённых файлов равен множеству файлов реестра; самопроверка на синтетическом реестре ловит оставшийся старый текст, «Стало» на 15 слов, правку файла редактора и незаписанное пояснение.
- Конструктор шаблона: заметка «Скачайте файл и отправьте проверяющему вне сайта.» вместо 29 слов, «Изображения — только файлом.», «Перетащите · PNG, JPEG, WebP · до 5 МБ», подсказка слота убрана, «Файл скачан на устройство.», подтверждение ухода «Если вернуться сейчас, набранное будет потеряно.», причина недоступности «Чтобы скачать, введите текст или добавьте изображение.»; две скрытые подсказки кнопки запуска формата (видны и в редакторе) сокращены, доступные имена не менялись.
- Рабочий стол, Повышение, редакторы Повышения, общие компоненты редактора (поле картинки, панель оформления, подсказка поля по умолчанию «Текст и GIF можно сочетать.») и страница входа сокращены по реестру; убраны подписи под заголовками поиска, настроек, «Повышения», пояснение «Процент не принимает решение автоматически.», «Оставьте вкладку открытой…», «Незавершённые данные удаляются через 3 дня.» под запросом, пояснение «Ник найден в основном составе…».

## Task Commits

1. **Task 1 RED:** `7009008` (test) - реестр и тест; падают только строки конструктора и lib/format-launch.ts (`# fail 1` из 5, ошибки «the old text is still in the sources» и «the new text is not in…» по h-130..h-140 и 5 незаписанных пояснений конструктора).
2. **Task 1 GREEN:** `006c07b` (feat) - тексты конструктора и кнопки, спек конструктора; 71 unit-тест зелёный, 32 e2e passed.
3. **Task 2:** `12c6bae` (feat) - остальные файлы, переведённые unit-тесты и спеки.
4. **Task 3:** `df05717` (test) - реестр с итогом и охрана «все файлы применены», deferred-items.md.

**Plan metadata:** следующий коммит (docs: complete plan).

## Результаты проверок

- Unit `node --experimental-strip-types --test lib/*.test.ts`: 1538 тестов, 1534 pass, 0 fail, 4 skipped. `tsc --noEmit`: код 0. eslint `. --ignore-pattern dist --ignore-pattern .next`: 0 errors, 17 warnings (как на базе).
- Fail-first конструктора: `GSD_PROHIB_SUBJECT=lib/fixtures/template-builder-violation.txt` даёт `# fail 13`.
- Сборка `next build` на Node 22.13.1 с `PORTIA_E2E_ALLOW_HTTP=1` - код 0 (дважды); `next start` на 127.0.0.1:3100; `.env*` не читались.
- Task 1 (сборка перед Task 2): `template-builder.spec.ts` + `accessibility.spec.ts -g "STAB-TMPL-01|template builder"`, chromium-desktop и chromium-phone, `--retries=0`: **32 passed**.
- Task 3 (сборка HEAD): `accessibility.spec.ts` + `visitor.spec.ts` + `template-builder.spec.ts`, оба проекта, `--retries=0`: **75 passed, 16 skipped, 1 failed**. Кадровый спек `visual-candidates/promotion.spec.ts`, набор `phase20-dev-hints-d56`: **16 passed**.
- `git diff --exit-code PLAN_BASE HEAD -- components/portia-editor.tsx`: код 0 (файл редактора не менялся); `lib/format-launch.test.ts` не правился и зелёный; `git diff --exit-code --stat HEAD -- tests/e2e/visual/__screenshots__`: код 0; порт 3100 остановлен (проверен `next start` по командной строке процесса, затем `taskkill`, `netstat` пуст).

### Пропуски (не засчитаны как проход)

- **BLOCKED (ENV)**, 8 тестов (по 4 на chromium-desktop и chromium-phone): живой квалификационный прогон (ловушка фокуса диалога), роли «очередь проверяющего и редакторы Повышения», «диалоги редактора содержимого и ручки перетаскивания», «менеджер доступа владельца» - нужны роли участника, проверяющего и владельца, на цели их нет.
- Пропуски по проекту (не BLOCKED, тест предназначен для другого проекта), 8 тестов: `visitor.spec.ts:56` smoke касания и три замера 44×44/«нажатия без hover»/«поле не закрыто нижней панелью» на chromium-desktop, а также перетаскивания Alt+Arrow для ярлыка и панели задач и UI-контрактная заглушка квалификационного окна на chromium-phone.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Тесты и спеки, не названные в плане, проверяли прежние тексты**
- **Found during:** Task 2 (прогон `lib/*.test.ts` и поиск по `tests/`)
- **Issue:** `lib/portia-qualification-ui.test.ts` и `tests/e2e/visual-candidates/phase20-art.spec.ts` (текст ошибки сохранения фона) пинили сокращаемые тексты, в списке файлов плана их нет.
- **Fix:** тексты переведены на новые с комментарием «D-56 (20-37)»; правила проверок не ослаблены.
- **Files modified:** lib/portia-qualification-ui.test.ts, tests/e2e/visual-candidates/phase20-art.spec.ts
- **Committed in:** 12c6bae

**2. [Rule 1 - Bug] Реестр: разбор строк при CRLF**
- **Found during:** Task 1 (git сообщает о замене LF на CRLF при следующем касании)
- **Issue:** `parseRegistry` проверял `endsWith(" |")` до удаления `\r`; на чекауте с CRLF строки не разобрались бы.
- **Fix:** `trimEnd()` перед разбором.
- **Committed in:** 006c07b

### Отступления от текста плана (без правила)

- **Акцептанс «`grep -rlF 'не запись архива' components lib` печатает 0 (на HEAD 2)»:** на PLAN_BASE таких файлов уже 0 (фраза убрана в 20-43); ни «локальный черновик», ни «не запись архива» в коде нет, отсутствие закреплено тестом.
- **Файл `lib/format-launch.test.ts`** не менялся: ожидания подсказок в нём не было, охрана D-57 осталась как есть.
- **Предупреждение теста на ПК** оставлено дословно (утверждено владельцем в 19-OWNER-DECISIONS пункт 11) как «предупреждение безопасности», а не сокращено; текст телефона из того же утверждения сокращён, потому что в 13 слов он не помещается в предел 12. Подсказка «Анимации» из 18-MOTION-APPROVAL сокращена (план назвал её прямо). Оба решения вынесены в заметки реестра для галереи 20-47: владелец может ответить «вернуть».
- **Окружение:** `npm run ...` на Node 22.13.1 падает на node-gyp; использованы прямые команды (next build/start, playwright cli.js, tsc, eslint).

---

**Total deviations:** 2 auto-fixed (1 Rule 3, 1 Rule 1), 4 замечания.
**Impact on plan:** продуктовый контракт выполнен; реестр и охрана строже плана (AST-поиск, равенство множества файлов, проверка итога).

## Issues Encountered

- `accessibility.spec.ts:674` ««Информация» on a phone…» (chromium-phone) падает на `click` по `[data-info-id="what-is-virus"]`: после 20-16 (D-29) список на телефоне показывает только разделы верхнего уровня, подраздел не виден. К правкам плана не относится (`components/portia-desktop.tsx`: изменены только тексты подсказок); записано в `deferred-items.md` (open), не исправлялось, как требует граница объёма.
- Пины в «Тесты и имена» для общих фраз вроде «Нет связи с сервером» включают несколько тестов с тем же началом; точные имена - по столбцу, а реальные расхождения нашлись прогоном.

## Known Stubs

Нет.

## Threat Flags

Нет новых сетевых точек и путей данных; правки текстов. T-20-94: ошибки, причины недоступности и подтверждения не удалялись, пределы слов и допустимые решения проверяет тест реестра. T-20-95: `components/portia-editor.tsx` не менялся (`git diff --exit-code`), тест запрещает «сокращено»/«убрано» для его строк.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 20-47 показывает владельцу таблицу `20-HINTS-INVENTORY.md`, раздел «Итог», заметки (предупреждение ПК, подсказка «Анимации») и пометку «подсказки редактора не менялись по D-58».
- Открыто в `deferred-items.md`: устаревший спек «Информация» на телефоне (chromium-phone).
- Роли участника, проверяющего и владельца по-прежнему BLOCKED (ENV) на цели; физический телефон - 20-14. Сервер на порту 3100 остановлен.

## Self-Check: PASSED

- `20-HINTS-INVENTORY.md`, `lib/phase20-hints-inventory.test.ts`, `components/portia-template-builder.tsx`, `lib/format-launch.ts`, `components/portia-promotion.tsx` - найдены.
- Коммиты 7009008, 006c07b, 12c6bae, df05717 - предки HEAD; `git rev-list --count PLAN_BASE..HEAD` = 4.
- `grep -cE '^\| h-[0-9]+ \|'` по реестру = 140 (не меньше 40); строк «оставлено: D-58» в таблице 38; `git diff --exit-code PLAN_BASE HEAD -- components/portia-editor.tsx` = 0; `git status --porcelain -- tests/e2e/visual/__screenshots__` пуст; порт 3100 не слушается.

---
*Phase: PORTIA-20-security-accessibility-i-priemka-reliza*
*Completed: 2026-11-07*
